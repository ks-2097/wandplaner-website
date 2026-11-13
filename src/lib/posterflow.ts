import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Print partner client. The rest of the shop talks to the PrintPartner interface only,
 * so a second printer can be added later with its own client.
 *
 * Posterflow facts come from docs/posterflow.md (human docs v1.0 and OpenAPI v1.30).
 * Values marked "inferred" there are env settings here, because only a live key can
 * confirm them (GET /articles).
 */

// ---- Partner-neutral interface

/** Normalised progress of a print order, in the order it normally happens. */
export type PartnerProgress = 'submitted' | 'printed' | 'label' | 'shipped';

export type PartnerOrderStatus = {
  /** Our reference (order number) as the partner echoes it */
  reference: string;
  /** The partner's own order number */
  partnerOrderId: string;
  progress: PartnerProgress;
  tracking?: string;
  trackingUrl?: string;
};

export type PrintJob = {
  /** Our unique reference; the partner rejects a second order with the same one */
  reference: string;
  recipient: { firstName: string; lastName: string; street: string; streetNumber: string; zip: string; city: string; countryCode: string; email: string };
  file: { url: string; type: 'pdf' };
  orientation: 'portrait' | 'landscape';
  designName: string;
};

export type PartnerArticle = { partnumber: string; type: string; description: string; sizes: string[] };

export interface PrintPartner {
  readonly id: string;
  readonly name: string;
  submit(job: PrintJob): Promise<PartnerOrderStatus>;
  /** undefined when the partner has no order with this reference */
  getStatus(reference: string): Promise<PartnerOrderStatus | undefined>;
  listArticles(): Promise<PartnerArticle[]>;
}

/**
 * ambiguous: we cannot tell whether the partner created the order (timeout, network, 408,
 * 409, 5xx). Look it up before sending again. rejected: it definitely was not created.
 */
export class PartnerError extends Error {
  constructor(
    message: string,
    readonly kind: 'ambiguous' | 'rejected',
    readonly status?: number,
  ) {
    super(message);
  }
}

// ---- Posterflow configuration

const env = (name: string, fallback = ''): string => process.env[name]?.trim() || fallback;

export const POSTERFLOW_DEFAULT_BASE_URL = 'https://api.posterflow.de/api';

/** Read on every call, so a changed .env (and tests) take effect without a reload. */
export function posterflowConfig() {
  return {
    apiKey: env('POSTERFLOW_API_KEY'),
    baseUrl: env('POSTERFLOW_BASE_URL', POSTERFLOW_DEFAULT_BASE_URL).replace(/\/$/, ''),
    /** Article part number; "white250" is inferred from their docs, confirm with GET /articles */
    articleType: env('POSTERFLOW_ARTICLE_TYPE', 'white250'),
    /** Size for portrait files ("spalten" layout) */
    size: env('POSTERFLOW_SIZE', '70x100'),
    /** Size for landscape files ("wochen", "zeilen"); whether Posterflow wants "100x70" here is not documented */
    sizeLandscape: env('POSTERFLOW_SIZE_LANDSCAPE', env('POSTERFLOW_SIZE', '70x100')),
    /** OAS enum DHL, DHLWP, Auto; "Auto" only after agreeing it with Posterflow */
    shippingCompany: env('POSTERFLOW_SHIPPING_COMPANY', 'DHL'),
    /** Shared secret for X-Posterflow-Signature, if Posterflow enabled signing for us */
    webhookSecret: env('POSTERFLOW_WEBHOOK_SECRET'),
    timeoutMs: Number(env('POSTERFLOW_TIMEOUT_MS', '30000')) || 30000,
    /** Sender / return address printed on the DHL label */
    shipper: {
      company: env('POSTERFLOW_SENDER_COMPANY', 'plana studio'),
      first_name: env('POSTERFLOW_SENDER_FIRST_NAME'),
      last_name: env('POSTERFLOW_SENDER_LAST_NAME'),
      street: env('POSTERFLOW_SENDER_STREET'),
      street_number: env('POSTERFLOW_SENDER_STREET_NUMBER'),
      zip: env('POSTERFLOW_SENDER_ZIP'),
      city: env('POSTERFLOW_SENDER_CITY'),
      country: 'Germany',
      country_code: 'DE',
      email: env('POSTERFLOW_SENDER_EMAIL'),
      phone: env('POSTERFLOW_SENDER_PHONE'),
    },
  };
}

/** The feature is off unless POSTERFLOW_API_KEY is set. */
export const posterflowEnabled = (): boolean => Boolean(posterflowConfig().apiKey);

const COUNTRY_NAMES: Record<string, string> = { DE: 'Germany', AT: 'Austria', CH: 'Switzerland' };

// ---- Wire format (docs/posterflow.md, section 5.4)

type ApiOrderStatus = {
  External_orderid?: string;
  orderid?: string;
  createdat?: string | null;
  completedat?: string | null;
  items?: unknown;
  shipping?: { type?: string; trackingid?: string | null; trackingurl?: string | null }[];
};

export function buildOrderBody(job: PrintJob, cfg = posterflowConfig()) {
  const r = job.recipient;
  return {
    data: {
      type: 'submit',
      orderid: job.reference,
      shipping: {
        shippingcompany: cfg.shippingCompany,
        destination: {
          first_name: r.firstName,
          last_name: r.lastName,
          street: r.street,
          street_number: r.streetNumber,
          zip: r.zip,
          city: r.city,
          country: COUNTRY_NAMES[r.countryCode] ?? r.countryCode,
          country_code: r.countryCode,
          // The OpenAPI schema lists email as required (DHL notifications). Nothing else
          // about the customer is sent; the schema's other "required" fields go empty.
          email: r.email,
          phone: '',
          province: '',
          address2: '',
          company: '',
          name: '',
        },
        shipper: cfg.shipper,
      },
      // Empty fileurl: Posterflow creates the DHL label itself (OAS example shape)
      label: { fileurl: '', filetype: 'pdf', shippingcompany: cfg.shippingCompany === 'DHLWP' ? 'DHLWP' : 'DHL', tracking: '' },
      mainitems: [
        {
          id: 'item1',
          type: cfg.articleType,
          size: job.orientation === 'landscape' ? cfg.sizeLandscape : cfg.size,
          fileurl: job.file.url,
          filetype: job.file.type,
          designname: job.designName,
          item_accessory: '',
        },
      ],
      accessory: [],
    },
  };
}

/**
 * Posterflow has no status field (section 5.5). Progress is read from completedat and
 * the shipping records. "printed and label created" is taken as shipped, because their
 * cut-off rule ships unframed posters the same day; that reading is inferred.
 */
export function mapApiStatus(o: ApiOrderStatus): PartnerOrderStatus {
  const ship = (o.shipping ?? []).find((s) => s?.trackingid);
  const tracking = ship?.trackingid ?? undefined;
  const progress: PartnerProgress = tracking && o.completedat ? 'shipped' : tracking ? 'label' : o.completedat ? 'printed' : 'submitted';
  return { reference: String(o.External_orderid ?? ''), partnerOrderId: String(o.orderid ?? ''), progress, tracking, trackingUrl: ship?.trackingurl ?? undefined };
}

/** Webhook events (section 5.6) mapped to our progress. 'error' is handled separately. */
export const WEBHOOK_EVENTS: Record<string, PartnerProgress> = { tracking: 'label', printed: 'printed', shipped: 'shipped' };

/** X-Posterflow-Signature: lowercase hex HMAC-SHA256 of the exact raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const given = Buffer.from(signature.trim().toLowerCase(), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function errorText(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text) as { Error?: string; code?: string };
    if (body.Error) return body.code ? `${body.Error} (${body.code})` : body.Error;
  } catch {
    /* plain text body */
  }
  return text.slice(0, 300) || res.statusText || `HTTP ${res.status}`;
}

export class PosterflowClient implements PrintPartner {
  readonly id = 'posterflow';
  readonly name = 'Posterflow';

  constructor(private readonly cfg = posterflowConfig()) {
    if (!cfg.apiKey) throw new Error('POSTERFLOW_API_KEY is not set');
  }

  private async call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Response> {
    return fetch(this.cfg.baseUrl + path, {
      method,
      headers: {
        // Human docs: "Authorization: Basic <key>" (the key as issued, not base64 user:pass)
        Authorization: `Basic ${this.cfg.apiKey}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
      cache: 'no-store',
    });
  }

  async submit(job: PrintJob): Promise<PartnerOrderStatus> {
    let res: Response;
    try {
      res = await this.call('POST', '/', buildOrderBody(job, this.cfg));
    } catch (err) {
      // Timeout or network error after sending: Posterflow may have created the order.
      throw new PartnerError(`Keine Antwort von Posterflow (${err instanceof Error ? err.name : 'Fehler'})`, 'ambiguous');
    }
    if (res.ok) {
      const list = (await res.json().catch(() => [])) as ApiOrderStatus[];
      const first = Array.isArray(list) ? list[0] : undefined;
      if (!first) throw new PartnerError('Posterflow hat den Auftrag ohne Auftragsdaten bestätigt', 'ambiguous', res.status);
      return mapApiStatus(first);
    }
    const message = await errorText(res);
    // 408: DHL unavailable, 409: id exists or system busy, 429/5xx: unknown outcome
    const ambiguous = res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500;
    throw new PartnerError(`Posterflow ${res.status}: ${message}`, ambiguous ? 'ambiguous' : 'rejected', res.status);
  }

  async getStatus(reference: string): Promise<PartnerOrderStatus | undefined> {
    let res: Response;
    try {
      res = await this.call('GET', `/orders?orderid=${encodeURIComponent(reference)}`);
    } catch (err) {
      throw new PartnerError(`Posterflow nicht erreichbar (${err instanceof Error ? err.name : 'Fehler'})`, 'ambiguous');
    }
    if (res.status === 404) return undefined;
    if (!res.ok) throw new PartnerError(`Posterflow ${res.status}: ${await errorText(res)}`, 'ambiguous', res.status);
    const list = (await res.json().catch(() => [])) as ApiOrderStatus[];
    if (!Array.isArray(list)) return undefined;
    const found = list.find((o) => String(o.External_orderid ?? '') === reference) ?? (list.length === 1 && !list[0]?.External_orderid ? list[0] : undefined);
    return found ? mapApiStatus(found) : undefined;
  }

  async listArticles(): Promise<PartnerArticle[]> {
    const res = await this.call('GET', '/articles');
    if (!res.ok) throw new PartnerError(`Posterflow ${res.status}: ${await errorText(res)}`, 'rejected', res.status);
    const list = (await res.json()) as Record<string, unknown>[];
    // Field names as printed in the docs; read loosely because the docs show them with spaces.
    return (Array.isArray(list) ? list : []).map((a) => ({
      partnumber: String(a.partnumber ?? ''),
      type: String(a.type ?? ''),
      description: String(a.description ?? ''),
      sizes: (Object.entries(a).find(([k]) => /sizes/i.test(k))?.[1] as string[] | undefined) ?? [],
    }));
  }
}

/** The configured print partner, or undefined when the integration is off. */
export function getPrintPartner(): PrintPartner | undefined {
  return posterflowEnabled() ? new PosterflowClient() : undefined;
}
