import { NextResponse } from 'next/server';
import { clientIp, fail, rateLimit } from '@/lib/http';
import { findVoucher } from '@/lib/orders';

/** Tells the checkout how much a voucher code is worth. */
export async function POST(req: Request) {
  if (!rateLimit(`voucher:${clientIp(req)}`, 10, 10 * 60_000)) return fail('Zu viele Versuche. Bitte warte ein paar Minuten.', 429);
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const voucher = code ? findVoucher(String(code).slice(0, 40)) : undefined;
  if (!voucher || voucher.balance_cents <= 0) return fail('Dieser Gutscheincode ist nicht gültig oder schon eingelöst.', 404);
  return NextResponse.json({ code: voucher.code, balance: voucher.balance_cents });
}
