# Posterflow GmbH (Mannheim): print partner fact sheet

Prepared 2026-11-13 for plana studio (shop launch 2026-11-26; product: personalised wall planner poster, 70 x 100 cm, matte, unframed, shipped rolled to end customers in Germany, later DACH).

**Conventions.** Every number is copied from a named source. "Not stated" means the sources are silent. Items marked **[INFERRED]** are my reasoning, not a statement by Posterflow, and need confirmation. All prices are net (excl. VAT) unless marked otherwise.

## Sources

| Tag | Source | Date on document |
|---|---|---|
| **MAIL** | Email from Thomas Weidner (Geschäftsführer), Posterflow, to Franziska Schäfers, 2026-11-11 (Gmail thread `1a1ca791af32d622`) | 2026-11-11 |
| **PL** | `Preisliste Posterflow Stand Oktober 2026 DE.pdf` (4 pages) | 06.11.2026 |
| **KAT** | `Produktkatalog_SKU_V1.61.pdf` (18 pages) | "08/2026, V.1.61" |
| **DHL** | `Preisliste DHL Stand MAI 2026 DE.pdf` (5 pages; the title inside says "Gültig ab 01.01.2026") | see note in section 2 |
| **KURZ** | `Posterflow Das Wichtigste in Kürze V2.pdf` (2 pages) | "Stand: September 2026" |
| **AGB** | `Posterflow_AGB_B2B_0726.pdf` (3 pages, §1 to §11) | 0726 (file name) |
| **API-WEB** | https://www.posterflow.de/restful-order-api and /en/restful-order-api (rendered with Playwright; content sits in a shadow-DOM component, plain text extraction returns nothing) | read 2026-11-13 |
| **LLMS** | https://www.posterflow.de/custom-elements/llms.txt (linked from API-WEB; "Last updated: 2026-07-30") | read 2026-11-13 |
| **OAS** | OpenAPI 3.0 v1.30 "Posterflow Print Fulfillment / POD API", linked from API-WEB as "Swagger"; read as JSON from the public SwaggerHub registry `https://api.swaggerhub.com/apis/Posterflow/Posterflow_POD_API/1.30` | read 2026-11-13 |
| **FAQ** | https://www.posterflow.de/faq (every accordion item opened and read) | read 2026-11-13 |
| **FLOW** | https://www.posterflow.de/bestellablauf | read 2026-11-13 |

Contacts (KURZ): integration questions daniel@posterflow.de; commercial questions thomas@posterflow.de; order questions support@posterflow.de; invoices buchhaltung@posterflow.de. Address: Markircher Str. 17, 68229 Mannheim (MAIL signature).

## 1. Products and SKUs

### 1.1 What Posterflow confirmed (MAIL)

- "Unser maximal druckbares Format ist 70x100 cm. DIN A1 ist auch möglich. DIN A0 ist nicht möglich."
- "Unser Papier hat eine maximale Grammatur von 250 g/qm" (our requested 270 g/m² is not available).
- Unframed, individual design, shipping to end customers in DE/DACH, 50 pieces to year end: "kein Problem".
- "Keine Mindestmenge oder Einrichtungsgebühren."
- Sample print: "20,00 € pauschal zzgl. Versandkosten."

### 1.2 Poster SKUs at 70 x 100 cm and A1 (KAT p.3, PL p.1)

SKU pattern: `{width_mm or cm}x{height}_{paper}`. Net unit price per PL: **one price per format, identical for all three papers** (the price cell is merged across the paper options in PL; checked visually on the rendered page).

| Format | SKU | Paper (KAT wording) | Grammage | Finish | Net unit price (PL) |
|---|---|---|---|---|---|
| 70 x 100 cm | `70x100_white250` | Naturpapier matt weiss (uncoated, matte, white) | 250 g/m² | matt | 10,00 € |
| 70 x 100 cm | `70x100_warmwhite210` | Naturpapier matt warmweiss (uncoated, matte, warm white) | 210 g/m² | matt | 10,00 € |
| 70 x 100 cm | `70x100_satin250` | Photopapier satin weiss | 250 g/m² | satin (not matte) | 10,00 € |
| DIN A1 (59,4 x 84,1) | `594x841_white250` | Naturpapier matt weiss | 250 g/m² | matt | 7,50 € |
| DIN A1 | `594x841_warmwhite210` | Naturpapier matt warmweiss | 210 g/m² | matt | 7,50 € |
| DIN A1 | `594x841_satin250` | Photopapier satin weiss | 250 g/m² | satin (not matte) | 7,50 € |

**Naming mismatch (flag).** PL names the three papers differently from KAT: "Fotopapier 250 g/qm semimatt", "FineArt 250 g/qm hochweiss", "FineArt 210 g/qm warmweiss". KAT: "Photopapier satin weiss, 250", "Naturpapier matt weiss, 250", "Naturpapier matt warmweiss, 210". Pairing PL "FineArt 250 hochweiss" with KAT "Naturpapier matt weiss 250" and PL "FineArt 210 warmweiss" with KAT "Naturpapier matt warmweiss 210" is **[INFERRED]** from identical grammage and colour; Posterflow does not state it. PL labels the satin paper "semimatt"; KAT labels it "satin".

Print quality per PL: "Qualitätsdruck auf HP-DesignJet in 'Bester Qualität'". FAQ (print methods): "thermischen Tintenstrahldruckern ... 9-Farben Druck mit pigmentierten Tinte ... maximalen Auflösung von 2400 x 1200 dpi".

### 1.3 Other large formats (PL p.1; each has the same three paper SKUs in KAT p.3)

- 40 x 60 cm: 5,00 €
- 45 x 60 cm: 5,00 € (price list only; no `45x60` SKU appears in the KAT poster table)
- 50 x 50 cm: 5,00 € (price list only; no `50x50` SKU appears in the KAT poster table)
- 60 x 60 cm: 6,00 € (price list only; no `60x60` SKU appears in the KAT poster table)
- DIN A2 (420x594): 5,00 €
- 50 x 70 cm: 6,00 €
- 50 x 75 cm: 6,25 €
- 60 x 80 cm: 7,50 €
- 60 x 90 cm: 8,50 €

Smaller: A5 1,75 €; 20x30 2,00 €; A4 2,00 €; 30x30 3,00 €; 30x40 3,60 €; A3 3,60 €; 40x40 4,00 €; 40x50 4,50 €. KAT lists SKUs for A5, A4, A3, A2, A1, 20x30, 30x40, 40x50, 40x60, 50x70, 50x75, 60x80, 60x90, 70x100. The prices for formats without a KAT SKU (30x30, 40x40, 45x60, 50x50, 60x60) are in PL only; whether they can be ordered by API is not stated.

### 1.4 Hangers and frames at our sizes

- **Magnetic poster bars (Posterleiste):** PL lists widths 21, 31, 41, 51 cm (6,50 / 7,50 / 8,50 / 9,50 €). KAT lists bar SKUs only for A4, A3, 20x30, 30x40, 40x50, 50x70. **No bar for 70x100 or A1.**
- **Premium wood frames and "Rahmenverpackung":** PL and KAT list sizes A5, A4, A3, A2, 30x40, 40x50, 50x70 only. **No frame for 70x100 or A1.**
- Alu-Dibond (UV print): up to 50 x 70 cm in PL and KAT. Not relevant at our sizes.
- API articles of type `Hanger` exist in the API description (OAS, API-WEB), but which hanger part numbers cover 70x100 is only answerable via `GET /articles` (not queried, requires a key).

## 2. Shipping

### 2.1 Packaging (PL p.1, KAT, FAQ)

- 70x100 and A1 ship **rolled in a Hartpapier-Hülse (hard paper tube) of 78 x 8 x 8 cm**; packaging fee **2,90 €** net per tube (PL: "Poster-Verpackung Hülse für A1 + 60x90 + 70x100, 78 x 8 x 8 cm, 2,90 €"). Tube contents per PL: "Packseide schwarz, CN 23 Zollformular, DHL-Label, Puffermaterial, Versand an Packstation möglich."
- Shipping method for formats larger than A4: "DHL-Paket" (PL). FAQ: "Gerollte Poster von DIN A4 bis max. 70 x 100 cm werden transportsicher in Harthülsen versendet."
- Maximum 4 posters per tube/shipment; rolled and framed posters cannot be mixed in one shipment (FAQ).
- **Neutral / white label:** FAQ: "Pakete und DHL-Labels sind Neutral und ohne Hinweis auf Posterflow als Produzent / Absender." Sender address is ours; if our company address is used, DHL returns come to us. Alternative hybrid address "Dein Shopname / Posterversand / Markircher Str. 17 / 68229 Mannheim", with "Posterversand" in line 1 or 2 (KURZ, FAQ); then returns go to Posterflow, who handle returns management (KURZ).
- **Inserts:** FAQ: flyers or stickers cannot be added ("aus Produktionstechnischen Gründen nicht möglich"); the DHL label can carry our logo. The API description mentions printed accessories ("Print" type such as invoice or delivery note, "Printed invoice in red pouch" in the example response); whether a packing slip is available for our account is not stated (see open questions).
- Returns: stored 2 months; re-shipment free of service charge, only shipping fees for the re-shipment are billed (FAQ).

### 2.2 DHL prices (DHL, net, "Inkl. Tracking")

Weight of a 70x100 poster in the tube: **not stated** by Posterflow. All prices below use the "bis 1 KG" band; that choice is **[INFERRED]** (a 70 x 100 cm sheet at 250 g/m² is 0,7 m² x 250 g = 175 g of paper before tube and packing). Confirm.

| Destination | Product | Price, up to 1 kg | Up to 2 kg | Notes (DHL) |
|---|---|---|---|---|
| Germany | DHL-Paket National | **4,24 €** | 4,80 € (3 kg 5,19 €; 4 kg 5,56 €; 31,5 kg 6,11 €) | "Inkl. Tracking. Laufzeit 1-2 WT" |
| Austria | DHL-Paket International Premium | **8,05 €** | 8,38 € (3 kg 8,71 €; 4 kg 9,04 €; 5 kg 9,37 €) | Zone 1 EU |
| Switzerland | DHL-Paket International Premium | **11,61 €** | 11,85 € (3 kg 12,09 €; 4 kg 12,33 €; 5 kg 12,57 €) | Zone 1 non-EU |

Surcharges and fees (DHL):
- Prices "Inkl. Maut"; national "Inkl. Energiezuschlag bis max. 2 %"; international "Inkl. GoGreen".
- **PEAK-Zuschlag Nov. + Dez.: 0,19 €** ("Nur in den Monaten Nov. + Dez."), listed for the national and international blocks.
- **PEAK-in-PEAK-Zuschlag: 0,50 €** ("Nur in der Zeit von 24.11-07.12"), listed for the national and international blocks. **Our launch day 26.11 falls inside both windows.**
- Rücksendeentgeld Paket (national) 4,50 €; Rücksendeentgeld international 10,00 €.
- Filial-Routing Paket National 1,99 € (due when undeliverable or the customer collects from a Packstation or shop within the storage period).
- Leitcodierung 0,49 € (due when DHL cannot code the shipment automatically; for international, "fällig bei Adressfehler").
- Per DHL's own price list, a national DHL-Kleinpaket (3,10 €) is "nur für Acrylglasprodukte". It does not apply to posters.
- Whether the PEAK surcharges apply to the national Paket is **[INFERRED]**: the DHL sheet prints them in the national block with the "Exkl." rows, without a separate statement for national versus international.

**Date discrepancy:** the file is named "Stand MAI 2026" while the document header says "Gültig ab 01.01.2026". Ask which is current.

AT/CH specifics: PL tube includes a CN 23 customs form. OAS requires `exportinvoicenumber` and `exportvalue` (EUR sales value) for shipments outside the EU, which includes Switzerland. Customs duties, Swiss import VAT and who pays them: **not stated**. Transit times for AT and CH: **not stated**. Delivery to Packstation is possible per PL (needs `postnumber`, `packstationnumber` in the API).

### 2.3 Tracking

DHL tracking included. Tracking number and URL are available via the `tracking` webhook and in `shipping[].trackingid` / `trackingurl` of order status responses (OAS). MAIL: the email address we give them is used "für Tracking und Bestellbestätigung". For the web form, confirmation is sent by email (FLOW).

## 3. Production, delivery, cut-offs

- **Cut-off and production (KURZ):** "Poster ohne Rahmen: Bestellung vor 12:00 Uhr, Versand noch am gleichen Tage." (Framed poster, acrylic, laser, wood, Alu-Dibond: ship the next day.) Stated as "Richtwerte. Sie werden nicht garantiert."
- **Peak times (KURZ):** "In den PEAK-Zeiten wie vor Weihnachten, Valentinstag, Ostern, Muttertag usw. kann die Produktion durchaus den einen oder anderen Tag länger dauern."
- **Carrier transit Germany (DHL):** "Laufzeit 1-2 WT".
- **Resulting estimate [INFERRED]:** order before 12:00 on a working day, shipped the same day, delivered 1-2 working days later (Germany). Not a promise from Posterflow.
- **Christmas order deadlines:** not stated anywhere (only the peak warning above). Posterflow's DHL dispatch cut-off is not stated either.
- Transit time Austria and Switzerland: not stated.
- AGB §3(1): "Von uns angegebene Lieferzeiten berechnen sich vom Zeitpunkt unserer Auftragsbestätigung, vorherige Zahlung der Vergütung vorausgesetzt." This conflicts with the monthly invoice model (see section 6).
- Sample for a test print: MAIL says 20,00 € flat plus shipping. We asked for it by 18.11; Posterflow's answer does not say whether that date can be met. They need billing address, sender address (for the DHL label) and an email to unlock the order web form.

## 4. Print file requirements

From FAQ ("Wie muss ich die Druckdaten anlegen?", section "Poster, Dibond & Gerahmte Poster") unless noted:

| Item | Requirement |
|---|---|
| Formats | PDF, JPEG (with ICC profile, otherwise sRGB) or PNG. OAS `filetype` enum additionally lists `tif`; API-WEB says "pdf, png, or jpg". |
| Colour space | RGB (AdobeRGB, AppleRGB or sRGB). No CMYK requirement stated for posters. |
| Resolution | ">300 DPI (Text & Grafiken möglichst vektorisiert)", "DPI in cm umrechnen". At 300 dpi, 70 x 100 cm is about 8268 x 11811 px **[INFERRED arithmetic]**. |
| Size | "Endformat = Druckformat". If the file format differs it is scaled proportionally ("Automatische Anpassung"). |
| Bleed / marks | "Kein Beschnitt. Keine Druckmarken. Vollflächiger Druck möglich." |
| Max file size | **Not stated.** |
| Fonts | AGB §6(2)(d): non-embedded fonts and wrong colour profiles are our risk. |
| Supply method | API: `fileurl` must be a "Directly downloadable artwork file URL", reachable "without an interactive login page" (API-WEB, LLMS). OAS: one URL or a comma-separated list of PDF, PNG or JPG URLs, merged in the supplied order. Web form: file upload (FLOW). Etsy CSV: URL column; Dropbox links must end `dl=1`. How long the URL must stay valid: not stated. |
| Posterflow checks | None. AGB §6(2): no technical or content check of files (resolution, bleed, size, profile, typos). §6(3): colour deviation preview vs print and trim tolerance of ± 2 mm are not defects. §6(5): before automated series orders over the API, the customer must do a test order and check the sample. |

## 5. API

Sources: API-WEB (human documentation, v1.0), OAS (v1.30), LLMS. **Where they disagree, the differences are listed below.** LLMS states: "If this file conflicts with the OpenAPI definition, use the OpenAPI definition and ask Posterflow to clarify."

### 5.1 Readability of the docs

- The public documentation is fully readable without a login (API-WEB, LLMS, OAS).
- The live API key is created after login at `https://www.posterflow.de/account/api-access` (not accessible to me).
- GET probes (no credentials) of `https://api.posterflow.de/api` returned 404; `/api/docs`, `/api/swagger`, `/api/openapi.json`, `/api/swagger.json`, `/api/api-docs`, `/api/articles`, `/api/orders` returned 401 "Authentication required."; `/api/v3/api-docs` returned 404; the same doc paths on the host root (`/`, `/docs`, `/swagger`, `/openapi.json`) returned 401 "access not allowed". So nothing is served on the API host without credentials; the OpenAPI definition is on SwaggerHub.
- **I did not authenticate and sent no POST/PUT/DELETE.** `GET /articles` (the only way to get the real part numbers for our sizes) therefore remains unverified.
- A public shared test key is published on API-WEB, LLMS, OAS and in KURZ. It is deliberately not reproduced here; take it from API-WEB when building. Behaviour per API-WEB: orders with it "are not produced and not charged"; test orders and print files "are visible to all users of the public test key" (no real personal data); deleted after 30 days.

### 5.2 Base URL, authentication

- Base URL: `https://api.posterflow.de/api` (API-WEB, OAS `servers`).
- Auth: header `Authorization: Basic <key>` (API-WEB). OAS describes an `apiKey` scheme in header `Authorization` and says "The server accepts the issued token directly or with the configured Basic/Bearer prefix."
- JSON POST: `Content-Type: application/json`.

### 5.3 Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/articles` | Products and accessories available to the key: `partnumber`, `type` (Substrate, Board, Frame, Hanger, Print, Item, Service), `description`, `available sizes for print` (array), for frames `width in cm` / `height in cm`. Responses: 200, 401. |
| POST | `/` (i.e. `https://api.posterflow.de/api/`) | Place an order. Production starts immediately; no change via the API afterwards (API-WEB, LLMS). Responses: 200 (array with one OrderStatus), 400, 401, 408 ("The DHL service is temporarily unavailable"), 409 ("The order ID already exists or the system is temporarily busy"). |
| GET | `/orders?orderid={external_id}` | Status of one order (array with the order). 200, 400, 401, 429 (OAS); 404 listed in API-WEB only. |
| GET | `/orders` | OAS: "up to 400 orders created during the previous 24 hours, ordered from newest to oldest and independent of production status". API-WEB: "all of your orders that are currently in production". **Conflict.** `items` and `accessory` are counts in this list view. |

No cancel, update or delete endpoint is documented.

### 5.4 Order request: `POST /` (OAS; API-WEB where noted)

Top-level body `{"data": {...}}`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `data.type` | string | yes | enum `submit` |
| `data.orderid` | string | yes | unique external order number, maxLength 40 (OAS) |
| `data.shipping.shippingcompany` | string | yes | OAS enum `DHL`, `DHLWP`, `Auto`: "Use `Auto` only after prior coordination with Posterflow." API-WEB/LLMS recommend lowercase `"auto"` and say Posterflow then picks DHL Paket or Warenpost. **Conflict on casing and on whether `auto` is allowed by default.** |
| `data.shipping.parceloutletrouting` | boolean | no | default false; DHL parcel-outlet routing "when supported" |
| `data.shipping.destination.first_name`, `last_name` | string | yes | |
| `...destination.street` | string | yes | street without number |
| `...destination.street_number` | string | yes | |
| `...destination.zip`, `city` | string | yes | |
| `...destination.country` | string | yes | country name, e.g. "Germany" |
| `...destination.country_code` | string | yes | 2 letters, ISO 3166-1 alpha-2 (`^[A-Za-z]{2}$`) |
| `...destination.email` | string | listed in schema `required`; API-WEB says optional | used for DHL notifications |
| `...destination.phone`, `province`, `address2`, `company`, `name` | string | schema lists them in `required`, descriptions say optional | send empty strings if unknown **[INFERRED]** |
| `...destination.postnumber`, `packstationnumber`, `postfilialnumber` | string | only for Packstation / DHL shop | |
| `...destination.exportinvoicenumber`, `exportvalue` | string | required outside the EU (Switzerland) | value in EUR |
| `data.shipping.shipper.*` | object | OAS: required, with "Required!" on email, first_name, last_name, name, street, street_number, phone, city, zip, country, country_code, company; API-WEB: "Recommended" | printed on label; return address |
| `data.label.fileurl`, `filetype` (`pdf`), `shippingcompany` (`DHL`, `DHLWP`, `GLS`), `tracking` | strings | `label` object required in schema; empty `fileurl` means Posterflow generates the label | own label supplied by us; `tracking` is returned as `trackingid` and does not trigger a webhook |
| `data.mainitems[].id` | string | yes | unique in the order |
| `...type` | string | yes | article part number from `/articles` (docs example `satin250`) |
| `...size` | string | yes | `WxH` in cm, e.g. `30x40` |
| `...fileurl` | string | yes | direct download URL (or comma-separated list) |
| `...filetype` | string | yes | enum `pdf`, `png`, `jpeg`, `jpg`, `tif` |
| `...designname` | string | schema `required`, API-WEB optional | |
| `...item_accessory` | string | schema `required`, API-WEB optional | accessory part number linked to this item |
| `...set_code`, `set_id` | string | no | must be sent together |
| `data.accessory[].partnumber` | string | yes | from `/articles` |
| `...quantity` | integer | yes | minimum 0 |
| `...fileurl`, `filetype` (`pdf`), `id` | string | fileurl needed for printable accessories (invoice) | |

**Open mapping question [INFERRED]:** KAT SKUs are composite (`70x100_white250`), while the API takes `type` and `size` separately. The likely API call for our poster is `type: "white250"`, `size: "70x100"` **[INFERRED from the example `satin250` + `30x40` and the Etsy SKU `210x297_white250_RND30`]**. Only `GET /articles` with our live key proves it. The docs' `available sizes` example shows "21x30", whereas KAT says 20x30 and 210x297: do not hard-code sizes.

Example request (API-WEB):

```json
{
  "data": {
    "type": "submit",
    "orderid": "4711",
    "shipping": {
      "shippingcompany": "auto",
      "destination": {
        "first_name": "Daniel", "last_name": "Mustermann",
        "street": "Mustergasse", "street_number": "12",
        "city": "Mannheim", "zip": "68229",
        "country": "Germany", "country_code": "DE",
        "email": "customer@example.com"
      },
      "shipper": {
        "first_name": "Daniel", "last_name": "Mustersender",
        "street": "Mustergasse", "street_number": "25",
        "city": "Berlin", "zip": "10777",
        "country": "Germany", "country_code": "DE", "company": "Mustershop"
      }
    },
    "label": { "fileurl": "", "filetype": "", "shippingcompany": "" },
    "mainitems": [
      { "id": "itemi1", "type": "satin250", "size": "30x40",
        "fileurl": "https://example.com/TT_30x40.pdf", "filetype": "pdf",
        "designname": "Whitemap", "item_accessory": "RSD40" }
    ],
    "accessory": [
      { "id": "frame-1", "partnumber": "RSD40", "fileurl": "", "quantity": 1 },
      { "id": "invoice-1", "partnumber": "INVOICE",
        "fileurl": "https://example.com/TT_invoice.pdf", "filetype": "pdf", "quantity": 1 }
    ]
  }
}
```

Note: this example sends `"label": {"fileurl": "", "filetype": "", ...}`, whereas OAS allows only `pdf` for `label.filetype`. Whether empty strings are accepted is not stated; the OAS example uses `"filetype": "pdf"` with an empty `fileurl`.

Example response 200 (API-WEB; same shape from `POST /` and `GET /orders?orderid=`):

```json
[
  {
    "External_orderid": "4711",
    "orderid": "TT4711",
    "createdat": "2021-08-03T11:48:04.917Z",
    "completedat": null,
    "items": [ { "size": "30x40", "type": "satin250", "url": "https://example.com/TT_30x40.pdf", "downloaded": 0, "id": "itemi1" } ],
    "shipping": [ { "type": "DHL", "trackingid": "00340434498787103807", "fileurl": "https://example.com/dhl-label.pdf", "countrycode": "DE", "weight": 0.89 } ]
  }
]
```

OAS additionally defines `trackingurl`, `filename`, `api`, `apiresponse`, `createdat` in `shipping[]`, and per item `color`, `completed`, `downloaded`, `set_code`, `set_id`.

### 5.5 Order status values

**No enumerated status field exists in the documentation.** Progress is expressed by:
- `completedat` (null until printing is complete): "Timestamp set when printing is complete and the order is scanned into downstream processing. From this point the order can no longer be cancelled." (OAS)
- per item `downloaded` (integer) and `completed` (integer) flags
- presence of a `shipping[]` record with `trackingid`
- the four webhook statuses below.

### 5.6 Webhooks / tracking callbacks

Events (API-WEB, OAS): `tracking` (label and tracking number created; not proof of carrier hand-over), `printed` (printing complete, `completedat` set), `shipped` (packed parcel scanned into the dispatch vehicle, waiting for carrier pickup), `error` (processing problem, e.g. product validation, label or server error).

- Method POST to a URL we provide to Posterflow. API-WEB: pattern `https://yourserver/{External_orderid}/{event}`. OAS: "Webhooks are configured manually per customer. Callback URLs and payload details are agreed during onboarding; clients must not assume that Posterflow appends a fixed path." **Conflict**; clarify.
- Body fields (API-WEB): `External_orderid`, `orderid`, `status`, plus `trackingid` and `trackingurl` (tracking) or `error` (error). Example: `{"External_orderid":"4711","orderid":"TT4711","status":"tracking","trackingid":"00340434498787103876","trackingurl":"https://www.dhl.de/sendungsverfolgung?piececode=00340434498787103876"}`.
- Receiver must return HTTP 2xx. OAS: retryable failures including 429 and 5xx "are retried up to three times"; delivery "cannot be guaranteed if the sending system itself is unavailable".
- Signing (OAS): optional, per customer. If a shared secret is configured, header `X-Posterflow-Signature` holds the lowercase hex HMAC-SHA256 of the exact raw request body.

### 5.7 Sandbox, errors, limits

- **Sandbox:** the public shared test key (5.1). No separate sandbox host.
- **Error body (OAS `ErrorResponse`):** `{"Error": "<human-readable text>", "code": "BAD_REQUEST", "retryable": false}`. Used for `POST /` and `GET /orders`. The set of `code` values is not listed (only the example `BAD_REQUEST`).
- **Status codes:** 200, 400, 401, 404 (API-WEB only), 408, 409 (OAS only), 429 with `Retry-After` header (OAS, only "Too many order-list requests"), 500+ (API-WEB: retry later). Unauthenticated GETs return plain-text "Authentication required." (observed).
- **Rate limits:** no numbers stated. The only mention is the 429 on `GET /orders` (list). Whether `POST /` is limited: not stated.
- **Idempotency:** only through the unique `data.orderid` (409 if it exists). LLMS: "On an ambiguous timeout, check the order status before retrying a live order." Because 408 on `POST /` means the DHL service was unavailable, whether the order was created in that case is not stated.
- **Other integrations offered (KURZ, FLOW):** Shopify via Exporteo, Teeinblue, Customily, Etsy CSV, web form (Cognito test form `https://www.cognitoforms.com/PosterflowGmbH/BestellformularTest`), dashboard at `https://www.posterflow.de/account/dashboard`.

## 6. Commercial terms (AGB B2B, KURZ, FAQ)

- **Payment terms.** Three statements that do not match:
  - KURZ: monthly collective invoice for the previous month's orders, "spätestens nach 5 Tagen auf unser Konto überweisen."
  - AGB §5(1): "Die Vergütung ist mit Vertragsschluss fällig und innerhalb von 14 Tagen zu leisten, sofern nichts anderes vereinbart ist." §5(2): default after 30 days from due date and invoice receipt, interest 9 percentage points over base rate (§ 288 Abs. 2 BGB). §3(2)/§5(3): Posterflow may pause further orders while an invoice is overdue.
  - AGB §3(1): delivery times run from order confirmation, "vorherige Zahlung der Vergütung vorausgesetzt".
- **Prices and shipping (AGB §4):** prices plus statutory VAT; "Die Versandkosten sind vom Kunden zu tragen"; shipping risk passes on handover to the carrier.
- **Contract formation (AGB §2):** automatic receipt email is not acceptance; the contract exists on a separate "Auftragsbestätigung" email. (API-WEB says production starts immediately after a successful transfer.)
- **Complaints / reprint:**
  - KURZ and FAQ: email support@posterflow.de with the order number as subject and a photo showing the whole product and the defect; release of a free replacement "in der Regel innerhalb von drei Stunden"; reorder with the original order number plus "Reklamation" (KURZ example `BE4711-Reklamation`; FAQ: suffix "REKLAMATION", automatically deducted from the monthly billing). FAQ: free replacement for quality defects or (transport) damage.
  - AGB §8: warranty 12 months from delivery; obvious defects, wrong deliveries and quantity differences must be notified in text form "unverzüglich, spätestens binnen 5 Werktagen nach Ablieferung"; photos of the print, packaging and shipping label on request within 5 working days; §377 HGB duty to inspect applies; Posterflow may choose repair or replacement; reduction or withdrawal only after failed rework.
  - **Misprints caused by our files are excluded:** AGB §6(4), no rework or replacement for prints based on faulty print files unless the error is attributable to Posterflow. §6(3): colour deviation and ± 2 mm trim tolerance are not defects.
- **Liability (AGB §9):** damages claims excluded, except injury to life, body or health, breach of essential contractual duties (cardinal duties), and intent or gross negligence. For slightly negligent breach of essential duties, liability is limited to the typical, foreseeable damage. Product Liability Act unaffected. No monetary cap is stated.
- **IP (AGB §10):** we must indemnify Posterflow against third-party claims from our files.
- **VerpackG / packaging licensing:** FAQ: shipping packaging "für den Versand innerhalb von Deutschland" is licensed through Der Grüne Punkt, free of charge for us; "du die Verpackungen ... nicht mehr selbst an einem System beteiligen musst (VerpackG, LUCID)". Posterflow register number as given in FAQ: DE1984831714595. Applies to Germany only; shipments to AT/CH: not stated. The AGB are silent on VerpackG.
- **Data processing (AVV / DPA):** **not stated** in AGB, KURZ, FAQ or API docs. We would pass end-customer names and addresses to Posterflow and DHL. No AVV is mentioned in any source.
- **Cancellation:** the AGB have no cancellation clause (**not stated**). Technical rule: "completedat ... From this point the order can no longer be cancelled" (OAS), and the API documentation says a live order cannot be changed through the API after transfer. No cancel endpoint; the cancellation process before printing is not stated.
- **Platform availability (AGB §7):** no guaranteed uninterrupted availability of the platform or API; maintenance may suspend it.
- **Other:** German law, CISG excluded (§11(1)); place of jurisdiction Posterflow's seat for merchants (§11(2)). Contracts only with businesses (§1(2)). Sample print: 20,00 € flat plus shipping (MAIL).

## 7. Total landed cost: one 70 x 100 cm poster, matte, to Germany

Chosen product: **`70x100_white250`** (Naturpapier matt weiss, 250 g/m²), the matte paper with the highest grammage that Posterflow offers. PL gives the same net print price for all three papers, so choosing the highest grammage costs nothing extra.

Inputs (all net): print 10,00 € (PL), tube 2,90 € (PL), DHL-Paket National up to 1 kg 4,24 € (DHL; weight band **[INFERRED]**). No setup fee, no minimum quantity (MAIL). No VerpackG fee for us (FAQ).

**A. Outside the peak windows (price list base):**

| Line | Net |
|---|---|
| Poster print 70x100 | 10,00 € |
| Hülse 78x8x8 packaging | 2,90 € |
| DHL-Paket National up to 1 kg | 4,24 € |
| **Total net** | 10,00 + 2,90 + 4,24 = **17,14 €** |
| VAT 19 % | 17,14 x 0,19 = 3,2566, rounded 3,26 € |
| **Total gross** | 17,14 + 3,26 = **20,40 €** |

**B. At launch (26.11.2026 is in both "PEAK" windows; surcharges 0,19 € and 0,50 € per DHL, applicability to national Paket [INFERRED]):**

| Line | Net |
|---|---|
| Poster print 70x100 | 10,00 € |
| Hülse 78x8x8 packaging | 2,90 € |
| DHL-Paket National up to 1 kg | 4,24 € |
| PEAK-Zuschlag Nov.+Dez. | 0,19 € |
| PEAK-in-PEAK-Zuschlag (24.11-07.12) | 0,50 € |
| **Total net** | 10,00 + 2,90 + 4,24 + 0,19 + 0,50 = **17,83 €** |
| VAT 19 % | 17,83 x 0,19 = 3,3877, rounded 3,39 € |
| **Total gross** | 17,83 + 3,39 = **21,22 €** |

Not included: payment-term interest, return fees (Rücksendeentgelt 4,50 €), Filial-Routing 1,99 €, Leitcodierung 0,49 € (only if triggered), replacement shipments (free for defects per KURZ/FAQ), and any plana studio payment fees. These sums show Posterflow's cost to us as a business customer; VAT on our own sale to consumers is separate. Reference points for pricing: A1 on the same basis (A) would be 7,50 + 2,90 + 4,24 = 14,64 € net; Austria (A, 8,05 € Paket) 10,00 + 2,90 + 8,05 = 20,95 € net; Switzerland (11,61 € Paket) 10,00 + 2,90 + 11,61 = 24,51 € net (before PEAK surcharges, customs, and Swiss VAT, which are not covered by any source).

## 8. Open questions for Posterflow

1. **Product mapping:** please confirm that PL "FineArt 250 g/qm hochweiss" = KAT "Naturpapier matt weiss 250 g/m²" (`white250`) and PL "Fotopapier semimatt" = KAT "Photopapier satin" (`satin250`). Is white250 truly matte and uncoated?
2. **API part numbers:** which `type` and `size` values do we send for 70x100 and A1 (confirm `white250` + `70x100`)? Please give us a live key and confirm what `GET /articles` returns for our account.
3. **Parcel weight and DHL band** for one 70x100 poster in the 78 cm tube (and for 2 to 4 posters). Is the 78 x 8 x 8 cm tube covered by the "DHL-Paket" price without a bulky/length surcharge?
4. **Surcharges:** do PEAK (0,19 €) and PEAK-in-PEAK (0,50 €) apply to national Paket? Which DHL price list is valid: "Stand MAI 2026" or "ab 01.01.2026"? Will prices change on 01.01.2027?
5. **Christmas 2026:** last order date for delivery before 24.12 (DE, AT, CH); DHL last dispatch date; expected extra production days in peak.
6. **Transit times and customs for AT and CH:** transit days; duties and Swiss import VAT; who pays; DAP or DDP; what `exportvalue` and `exportinvoicenumber` must contain.
7. **Payment terms:** reconcile KURZ (monthly invoice, 5 days) with AGB §5 (due on contract conclusion, 14 days) and §3(1) (prior payment). Which applies to us? Payment method, credit limit, invoice currency.
8. **AVV (data processing agreement):** does Posterflow provide one? Sub-processors (DHL), hosting location, retention of print files and addresses.
9. **VerpackG:** confirm the licence covers our parcels shipped to Germany from Posterflow, and what applies for AT and CH.
10. **Cancellation:** can an order be cancelled before `completedat`; how (email, API); any fee? Is there a way to hold or change an order after the POST?
11. **API details:** rate limits for `POST /` and `GET /orders`; full list of `ErrorResponse.code` values; whether `shippingcompany` accepts `"auto"` / `"Auto"` for our account; whether `destination.email`, `shipper.phone` and other fields flagged "required" in the schema really are required; `label.filetype` empty string behaviour; behaviour and order state after a 408 on `POST /`.
12. **Webhooks:** does the callback path get `/{External_orderid}/{event}` appended or is the URL exactly as agreed (API-WEB and OAS differ)? Can we enable HMAC signing? Which email/phone do we give for setup?
13. **Print files:** maximum file size; how long the file URL must remain downloadable; is CMYK or a profile conversion applied; TIFF accepted (OAS) but not in the FAQ; behaviour on wrong aspect ratio (FAQ says proportional scaling: crop or letterbox?); recommended pixel size at 70x100.
14. **Packing slip / invoice insert:** is the `INVOICE` / delivery-note accessory ("Printed invoice in red pouch") available to us, and at what price? (FAQ: flyers and stickers are not possible.)
15. **Sample by 18.11:** will the 20,00 € sample plus shipping arrive by 18.11? Can the web form be unlocked now? Is the sample made on `white250` with the same quality as production?
16. **Complaints:** is a transport-damaged tube replaced free (KURZ/FAQ say yes) given the AGB §8 five-working-day notice? Photos requirement and who bears the cost of the replacement shipment.
17. **Liability:** any cap on liability for lost or damaged parcels; is DHL insurance included for Paket (FAQ says Warenpost is uninsured)?
18. **Returns and address:** which sender-address option do we use (own vs "Posterversand" hybrid); who handles returns of unclaimed Packstation parcels and what does it cost?
19. **Price validity:** how long is the October 2026 list guaranteed? Volume discounts above the expected 50 units?
20. **Doc inconsistencies to correct on their side:** phone numbers differ (email signature "0621 / 4909 4904" vs catalog and website "+49 621 490949 17"); example `available sizes` "21x30".
