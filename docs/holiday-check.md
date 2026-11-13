# Holiday data check (school and public holidays)

Audit date: 2026-11-13. Range: 1 Nov 2026 to 31 Jul 2028. Data under test: `data/school-holidays.json` (OpenHolidays snapshot fetched 2026-11-10, `meta.to` = 2028-03-31) and `src/planner/holidays.ts`.
Regression tests: `tests/holidays-official.test.ts` (official dates as fixtures, asserted against `schoolHolidays()` and `publicHolidays()`).

## Summary

- School holidays: all 16 states compared. 1 real mismatch found and fixed (Mecklenburg-Vorpommern, 4 extra days). Everything else in the snapshot window (to 2028-03-31) matches the official sources.
- Biggest problem is a **data gap**, not a wrong date: the snapshot ends 2028-03-31, so the April 2028 Easter holidays (where they fall in April), the Pfingsten/Himmelfahrt 2028 holidays and bridge days, and **all summer holidays 2028** are missing for every state. The school-year edition to July 2028 would print without them.
- Public holidays: computed list is consistent with OpenHolidays and with the statutes that could be read. 1 code bug: Berlin's one-off holiday on 17 June 2028 is missing.
- Ministry pages could not be read for **Saarland** (HTTP 403), **Schleswig-Holstein** (connection reset) and **Thüringen** (CAPTCHA). These three are verified against the KMK tables only.
- KMK tables are "Stand 09.10.2025". For the 13 states where the ministry page was read, it agreed with KMK (no later changes found).

## Sources and how they were read

- KMK overview index: https://www.kmk.org/service/ferienregelung.html
- KMK 2026/27: https://www.kmk.org/fileadmin/Dateien/pdf/Ferienkalender/FER2026_27.pdf (also as HTML table at https://www.kmk.org/service/ferienregelung/ferienkalender.html, same content)
- KMK 2027/28: https://www.kmk.org/fileadmin/Dateien/pdf/Ferienkalender/FER2027_28.pdf
- KMK long-term summer holidays: https://www.kmk.org/fileadmin/Dateien/pdf/Ferienkalender/Sommerferienregelung_2025-2030_2022-09-21.pdf
- Downloaded copies and extracted text: `/tmp/claude-0/-home-user-wandplaner-website/91d3c9ce-0d1b-5275-9186-e14752d544b6/scratchpad/holidays/`

## Conventions that cause apparent differences

- KMK gives the first and last holiday day, including Saturdays. Several states count a Saturday as the last day.
- Our data splits some periods that the KMK prints as one cell (BW: `26.10.-30.10.` plus separate Reformationsfest `31.10.`; MV: winter holidays plus a separate Brückentag 18.02.2028). The tests compare day sets, so splitting is not a mismatch.
- School-free days (single bridge days, "unterrichtsfreie Tage") are italic in the KMK PDF. Text extraction loses the italics, so these were taken from the ministry pages: BW Gründonnerstag 25.03.2027 and 13.04.2028, BB variable Ferientage 07.05.2027 and 26.05.2028, SN unterrichtsfreie Tage 07.05.2027 and 26.05.2028, MV 18.02.2028.
- "Bewegliche Ferientage" (RP 6, HE 3-4, NW 3, BW 4-5, ...) are set by each school. They are not in the data and must not be.
- Brandenburg's "variabler Ferientag" (07.05.2027, 26.05.2028) is a default that the Schulkonferenz may move. KMK omits it for BB. We keep it, as the ministry's VV Schulbetrieb Anlage 1 lists it.
- Bayern: Buß- und Bettag (18.11.2026, 17.11.2027) is school-free but not a public holiday. Source: BayFTG Art. 4 Nr. 3, "An den Schulen aller Gattungen entfällt der Unterricht" (https://www.gesetze-bayern.de/Content/Document/BayFTG/true). Kept in the data, correct.
- Islands: Schleswig-Holstein (Sylt, Föhr, Amrum, Helgoland, Halligen: Sommer and Herbst) and Niedersachsen islands have different dates (KMK footnote). The data and tests cover the mainland only. `scripts/fetch-holidays.mjs` skips API entries with a `comment`.
- Vocational schools (berufliche Schulen) have their own dates in MV and elsewhere. Planners are for general schools.

## Tables per state

"Official" lists every period in the range. "Result": match = same days as our data; GAP = official period after the snapshot end (2028-03-31) is missing from our data; MISMATCH = our data differs (none remain after the fix below).

### BW Baden-Württemberg

Source: KMK PDFs; ministry https://km.baden-wuerttemberg.de/de/service/ferien (matches KMK; adds Reformationsfest 31.10.2026, Gründonnerstag 25.03.2027 and 13.04.2028 school-free). Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 09.01.2027 | 23.12.2026 - 09.01.2027 Weihnachtsferien | match |
| 25.03.2027 | 25.03.2027 Gründonnerstag | match |
| 30.03.2027 - 03.04.2027 | 30.03.2027 - 03.04.2027 Osterferien | match |
| 18.05.2027 - 29.05.2027 | 18.05.2027 - 29.05.2027 Pfingstferien | match |
| 29.07.2027 - 11.09.2027 | 29.07.2027 - 11.09.2027 Sommerferien | match |
| 02.11.2027 - 06.11.2027 | 02.11.2027 - 06.11.2027 Herbstferien | match |
| 23.12.2027 - 08.01.2028 | 23.12.2027 - 08.01.2028 Weihnachtsferien | match |
| 13.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 18.04.2028 - 22.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 06.06.2028 - 17.06.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 27.07.2028 - 09.09.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### BY Bayern

Source: KMK PDFs; official order https://www.gesetze-bayern.de/Content/Document/BayVV_2230_1_1_0_K_13479/true and https://www.km.bayern.de/schueler/schule-und-mehr/termine/ferientermine.html; Buß- und Bettag: https://www.gesetze-bayern.de/Content/Document/BayFTG/true Art. 4 Nr. 3. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 02.11.2026 - 06.11.2026 | 02.11.2026 - 06.11.2026 Herbstferien | match |
| 18.11.2026 | 18.11.2026 Buß- und Bettag | match |
| 24.12.2026 - 08.01.2027 | 24.12.2026 - 08.01.2027 Weihnachtsferien | match |
| 08.02.2027 - 12.02.2027 | 08.02.2027 - 12.02.2027 Frühjahrsferien | match |
| 22.03.2027 - 02.04.2027 | 22.03.2027 - 02.04.2027 Osterferien | match |
| 18.05.2027 - 28.05.2027 | 18.05.2027 - 28.05.2027 Pfingstferien | match |
| 02.08.2027 - 13.09.2027 | 02.08.2027 - 13.09.2027 Sommerferien | match |
| 02.11.2027 - 05.11.2027 | 02.11.2027 - 05.11.2027 Herbstferien | match |
| 17.11.2027 | 17.11.2027 Buß- und Bettag | match |
| 24.12.2027 - 07.01.2028 | 24.12.2027 - 07.01.2028 Weihnachtsferien | match |
| 28.02.2028 - 03.03.2028 | 28.02.2028 - 03.03.2028 Frühjahrsferien | match |
| 10.04.2028 - 21.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 06.06.2028 - 16.06.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 31.07.2028 - 11.09.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### BE Berlin

Source: KMK PDFs; official ICS https://berlin.de/sen/bjf/service/kalender/ferien/schulferien_berlin.ics (page https://www.berlin.de/sen/bjf/service/kalender/ferien/termine/, Stand Nov 2026). Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 02.01.2027 | 23.12.2026 - 02.01.2027 Weihnachtsferien | match |
| 01.02.2027 - 06.02.2027 | 01.02.2027 - 06.02.2027 Winterferien | match |
| 22.03.2027 - 02.04.2027 | 22.03.2027 - 02.04.2027 Osterferien | match |
| 07.05.2027 | 07.05.2027 Unterrichtsfreier Tag | match |
| 18.05.2027 - 19.05.2027 | 18.05.2027 - 19.05.2027 Pfingstferien | match |
| 01.07.2027 - 14.08.2027 | 01.07.2027 - 14.08.2027 Sommerferien | match |
| 11.10.2027 - 23.10.2027 | 11.10.2027 - 23.10.2027 Herbstferien | match |
| 22.12.2027 - 31.12.2027 | 22.12.2027 - 31.12.2027 Weihnachtsferien | match |
| 31.01.2028 - 05.02.2028 | 31.01.2028 - 05.02.2028 Winterferien | match |
| 10.04.2028 - 22.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 26.05.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 01.06.2028 - 02.06.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 01.07.2028 - 12.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### BB Brandenburg

Source: KMK PDFs; https://bravors.brandenburg.de/sixcms/media.php/66/VV-Schulbetrieb-Anlage-1-2025.pdf. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 02.01.2027 | 23.12.2026 - 02.01.2027 Weihnachtsferien | match |
| 01.02.2027 - 06.02.2027 | 01.02.2027 - 06.02.2027 Winterferien | match |
| 22.03.2027 - 03.04.2027 | 22.03.2027 - 03.04.2027 Osterferien | match |
| 07.05.2027 | 07.05.2027 Variabler Ferientag | match |
| 18.05.2027 | 18.05.2027 Pfingstferien | match |
| 01.07.2027 - 14.08.2027 | 01.07.2027 - 14.08.2027 Sommerferien | match |
| 11.10.2027 - 23.10.2027 | 11.10.2027 - 23.10.2027 Herbstferien | match |
| 23.12.2027 - 31.12.2027 | 23.12.2027 - 31.12.2027 Weihnachtsferien | match |
| 31.01.2028 - 05.02.2028 | 31.01.2028 - 05.02.2028 Winterferien | match |
| 10.04.2028 - 22.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 26.05.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 29.06.2028 - 12.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### HB Bremen

Source: KMK PDFs; https://www.bildung.bremen.de/ferientermine-3404. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 09.01.2027 | 23.12.2026 - 09.01.2027 Weihnachtsferien | match |
| 01.02.2027 - 02.02.2027 | 01.02.2027 - 02.02.2027 Halbjahresferien | match |
| 22.03.2027 - 03.04.2027 | 22.03.2027 - 03.04.2027 Osterferien | match |
| 07.05.2027 | 07.05.2027 Tag nach Himmelfahrt | match |
| 18.05.2027 | 18.05.2027 Pfingstferien | match |
| 08.07.2027 - 18.08.2027 | 08.07.2027 - 18.08.2027 Sommerferien | match |
| 18.10.2027 - 30.10.2027 | 18.10.2027 - 30.10.2027 Herbstferien | match |
| 23.12.2027 - 08.01.2028 | 23.12.2027 - 08.01.2028 Weihnachtsferien | match |
| 31.01.2028 - 01.02.2028 | 31.01.2028 - 01.02.2028 Halbjahresferien | match |
| 10.04.2028 - 22.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 26.05.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 06.06.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 20.07.2028 - 30.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### HH Hamburg

Source: KMK PDFs; https://www.hamburg.de/resource/blob/134372/5bc131bdd36a604f67b361d21f7df37e/ferienordnung-hamburg-2024-2030-data.pdf. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 21.12.2026 - 01.01.2027 | 21.12.2026 - 01.01.2027 Weihnachtsferien | match |
| 29.01.2027 | 29.01.2027 Halbjahrespause | match |
| 01.03.2027 - 12.03.2027 | 01.03.2027 - 12.03.2027 Frühjahrsferien | match |
| 07.05.2027 - 14.05.2027 | 07.05.2027 - 14.05.2027 Pfingstferien | match |
| 01.07.2027 - 11.08.2027 | 01.07.2027 - 11.08.2027 Sommerferien | match |
| 11.10.2027 - 22.10.2027 | 11.10.2027 - 22.10.2027 Herbstferien | match |
| 20.12.2027 - 31.12.2027 | 20.12.2027 - 31.12.2027 Weihnachtsferien | match |
| 28.01.2028 | 28.01.2028 Halbjahrespause | match |
| 06.03.2028 - 17.03.2028 | 06.03.2028 - 17.03.2028 Frühjahrsferien | match |
| 22.05.2028 - 26.05.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 03.07.2028 - 11.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### HE Hessen

Source: KMK PDFs; https://kultus.hessen.de/schulsystem/ferien/ferientermine. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 12.01.2027 | 23.12.2026 - 12.01.2027 Weihnachtsferien | match |
| 22.03.2027 - 02.04.2027 | 22.03.2027 - 02.04.2027 Osterferien | match |
| 28.06.2027 - 06.08.2027 | 28.06.2027 - 06.08.2027 Sommerferien | match |
| 04.10.2027 - 16.10.2027 | 04.10.2027 - 16.10.2027 Herbstferien | match |
| 23.12.2027 - 11.01.2028 | 23.12.2027 - 11.01.2028 Weihnachtsferien | match |
| 03.04.2028 - 14.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 03.07.2028 - 11.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### MV Mecklenburg-Vorpommern

Source: KMK PDFs; https://land-mv.de/seite/ferientermine. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 21.12.2026 - 02.01.2027 | 21.12.2026 - 02.01.2027 Weihnachtsferien | match |
| 08.02.2027 - 19.02.2027 | 08.02.2027 - 19.02.2027 Winterferien | match |
| 24.03.2027 - 02.04.2027 | 24.03.2027 - 02.04.2027 Osterferien | match |
| 07.05.2027 | 07.05.2027 Zusätzlicher Ferientag | match |
| 14.05.2027 - 18.05.2027 | 14.05.2027 - 18.05.2027 Pfingstferien | match |
| 05.07.2027 - 14.08.2027 | 05.07.2027 - 14.08.2027 Sommerferien | match |
| 14.10.2027 - 23.10.2027 | 14.10.2027 - 23.10.2027 Herbstferien | match |
| 22.12.2027 - 04.01.2028 | 22.12.2027 - 04.01.2028 Weihnachtsferien | match |
| 05.02.2028 - 18.02.2028 | 05.02.2028 - 17.02.2028 Winterferien; 18.02.2028 Schulfrei | match |
| 12.04.2028 - 21.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 26.05.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 02.06.2028 - 06.06.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 26.06.2028 - 05.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### NI Niedersachsen

Source: KMK PDFs; https://www.mk.niedersachsen.de/download/98088. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 09.01.2027 | 23.12.2026 - 09.01.2027 Weihnachtsferien | match |
| 01.02.2027 - 02.02.2027 | 01.02.2027 - 02.02.2027 Halbjahresferien | match |
| 22.03.2027 - 03.04.2027 | 22.03.2027 - 03.04.2027 Osterferien | match |
| 07.05.2027 | 07.05.2027 Tag nach Himmelfahrt | match |
| 18.05.2027 | 18.05.2027 Pfingstferien | match |
| 08.07.2027 - 18.08.2027 | 08.07.2027 - 18.08.2027 Sommerferien | match |
| 16.10.2027 - 30.10.2027 | 16.10.2027 - 30.10.2027 Herbstferien | match |
| 23.12.2027 - 08.01.2028 | 23.12.2027 - 08.01.2028 Weihnachtsferien | match |
| 31.01.2028 - 01.02.2028 | 31.01.2028 - 01.02.2028 Halbjahresferien | match |
| 10.04.2028 - 22.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 26.05.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 06.06.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 20.07.2028 - 30.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### NW Nordrhein-Westfalen

Source: KMK PDFs; https://www.schulministerium.nrw/service/ferienordnung-nrw-bis-2029-30. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 06.01.2027 | 23.12.2026 - 06.01.2027 Weihnachtsferien | match |
| 22.03.2027 - 03.04.2027 | 22.03.2027 - 03.04.2027 Osterferien | match |
| 18.05.2027 | 18.05.2027 Pfingstferien | match |
| 19.07.2027 - 31.08.2027 | 19.07.2027 - 31.08.2027 Sommerferien | match |
| 23.10.2027 - 06.11.2027 | 23.10.2027 - 06.11.2027 Herbstferien | match |
| 24.12.2027 - 08.01.2028 | 24.12.2027 - 08.01.2028 Weihnachtsferien | match |
| 10.04.2028 - 22.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 10.07.2028 - 22.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### RP Rheinland-Pfalz

Source: KMK PDFs; https://bm.rlp.de/service/ferientermine. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 08.01.2027 | 23.12.2026 - 08.01.2027 Weihnachtsferien | match |
| 22.03.2027 - 02.04.2027 | 22.03.2027 - 02.04.2027 Osterferien | match |
| 28.06.2027 - 06.08.2027 | 28.06.2027 - 06.08.2027 Sommerferien | match |
| 04.10.2027 - 15.10.2027 | 04.10.2027 - 15.10.2027 Herbstferien | match |
| 23.12.2027 - 07.01.2028 | 23.12.2027 - 07.01.2028 Weihnachtsferien | match |
| 10.04.2028 - 21.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 03.07.2028 - 11.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### SL Saarland

Source: KMK PDFs only (saarland.de returned HTTP 403, ministry not read). Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 21.12.2026 - 31.12.2026 | 21.12.2026 - 31.12.2026 Weihnachtsferien | match |
| 08.02.2027 - 12.02.2027 | 08.02.2027 - 12.02.2027 Fastnachtsferien | match |
| 30.03.2027 - 09.04.2027 | 30.03.2027 - 09.04.2027 Osterferien | match |
| 28.06.2027 - 06.08.2027 | 28.06.2027 - 06.08.2027 Sommerferien | match |
| 04.10.2027 - 15.10.2027 | 04.10.2027 - 15.10.2027 Herbstferien | match |
| 20.12.2027 - 31.12.2027 | 20.12.2027 - 31.12.2027 Weihnachtsferien | match |
| 21.02.2028 - 29.02.2028 | 21.02.2028 - 29.02.2028 Fastnachtsferien | match |
| 12.04.2028 - 21.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 03.07.2028 - 11.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### SN Sachsen

Source: KMK PDFs; https://www.schule.sachsen.de/schuljahrestermine-4793.html (does not list autumn 2026, so SN autumn 2026 is KMK only; not in the 1 Nov window anyway). Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 02.01.2027 | 23.12.2026 - 02.01.2027 Weihnachtsferien | match |
| 08.02.2027 - 19.02.2027 | 08.02.2027 - 19.02.2027 Winterferien | match |
| 26.03.2027 - 02.04.2027 | 26.03.2027 - 02.04.2027 Osterferien | match |
| 07.05.2027 | 07.05.2027 Unterrichtsfreier Tag | match |
| 15.05.2027 - 18.05.2027 | 15.05.2027 - 18.05.2027 Pfingstferien | match |
| 10.07.2027 - 20.08.2027 | 10.07.2027 - 20.08.2027 Sommerferien | match |
| 11.10.2027 - 23.10.2027 | 11.10.2027 - 23.10.2027 Herbstferien | match |
| 23.12.2027 - 01.01.2028 | 23.12.2027 - 01.01.2028 Weihnachtsferien | match |
| 14.02.2028 - 26.02.2028 | 14.02.2028 - 26.02.2028 Winterferien | match |
| 14.04.2028 - 22.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 26.05.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 22.07.2028 - 01.09.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### ST Sachsen-Anhalt

Source: KMK PDFs; https://mb.sachsen-anhalt.de/api/media/Ferientermine_2024_bis_2030.pdf?collection=document. Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 21.12.2026 - 02.01.2027 | 21.12.2026 - 02.01.2027 Weihnachtsferien | match |
| 01.02.2027 - 06.02.2027 | 01.02.2027 - 06.02.2027 Winterferien | match |
| 22.03.2027 - 27.03.2027 | 22.03.2027 - 27.03.2027 Osterferien | match |
| 15.05.2027 - 22.05.2027 | 15.05.2027 - 22.05.2027 Pfingstferien | match |
| 10.07.2027 - 20.08.2027 | 10.07.2027 - 20.08.2027 Sommerferien | match |
| 18.10.2027 - 23.10.2027 | 18.10.2027 - 23.10.2027 Herbstferien | match |
| 20.12.2027 - 31.12.2027 | 20.12.2027 - 31.12.2027 Weihnachtsferien | match |
| 07.02.2028 - 12.02.2028 | 07.02.2028 - 12.02.2028 Winterferien | match |
| 10.04.2028 - 22.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 03.06.2028 - 10.06.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 22.07.2028 - 01.09.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### SH Schleswig-Holstein

Source: KMK PDFs only (schleswig-holstein.de connection reset, ministry not read). Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 21.12.2026 - 06.01.2027 | 21.12.2026 - 06.01.2027 Weihnachtsferien | match |
| 30.03.2027 - 10.04.2027 | 30.03.2027 - 10.04.2027 Osterferien | match |
| 07.05.2027 | 07.05.2027 Himmelfahrt | match |
| 03.07.2027 - 14.08.2027 | 03.07.2027 - 14.08.2027 Sommerferien | match |
| 11.10.2027 - 23.10.2027 | 11.10.2027 - 23.10.2027 Herbstferien | match |
| 23.12.2027 - 08.01.2028 | 23.12.2027 - 08.01.2028 Weihnachtsferien | match |
| 03.04.2028 - 15.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 26.05.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 24.06.2028 - 04.08.2028 | (none) | GAP (after snapshot end 2028-03-31) |

### TH Thüringen

Source: KMK PDFs only (bildung.thueringen.de CAPTCHA, ministry not read). Checked 2026-11-13.

| Official (first - last day) | Our data | Result |
|---|---|---|
| 23.12.2026 - 02.01.2027 | 23.12.2026 - 02.01.2027 Weihnachtsferien | match |
| 01.02.2027 - 06.02.2027 | 01.02.2027 - 06.02.2027 Winterferien | match |
| 22.03.2027 - 03.04.2027 | 22.03.2027 - 03.04.2027 Osterferien | match |
| 07.05.2027 | 07.05.2027 Schulfreier Tag | match |
| 10.07.2027 - 20.08.2027 | 10.07.2027 - 20.08.2027 Sommerferien | match |
| 09.10.2027 - 23.10.2027 | 09.10.2027 - 23.10.2027 Herbstferien | match |
| 23.12.2027 - 31.12.2027 | 23.12.2027 - 31.12.2027 Weihnachtsferien | match |
| 07.02.2028 - 12.02.2028 | 07.02.2028 - 12.02.2028 Winterferien | match |
| 03.04.2028 - 15.04.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 26.05.2028 | (none) | GAP (after snapshot end 2028-03-31) |
| 22.07.2028 - 01.09.2028 | (none) | GAP (after snapshot end 2028-03-31) |

## Mismatches and exact fixes

### 1. Mecklenburg-Vorpommern: four vocational-school days listed as general-school holidays (FIXED)

`data/school-holidays.json`, `states.MV` contained four single-day periods named "Zusätzlicher Ferientag":
`2026-11-26`, `2026-11-27`, `2027-11-25`, `2027-11-26`.
Official MV page https://land-mv.de/seite/ferientermine: for general schools the only additional fixed days are 07.05.2027 and 26.05.2028. The days 26.11.2026, 27.11.2026, 25.11.2027, 26.11.2027 are listed under "an beruflichen Schulen". The KMK tables for MV also show neither. OpenHolidays tags the days with both groups `MV-ABS` and `MV-BBS`, which is why the script's group filter let them through.
Impact: a planner starting November 2026 would have printed "FERIENTAG" on Thu/Fri 26/27 Nov 2026 (the launch week) for MV.
Fix applied: the four entries removed from `data/school-holidays.json` (MV 15 periods to 11), and an `OVERRIDES.remove` list added to `scripts/fetch-holidays.mjs` so `npm run holidays` removes them again. Delete the override once OpenHolidays corrects it.

No other mismatch exists in the window 2026-11-01 to 2028-03-31 for any state.

### Left for your decision

- None that block printing. Judgement calls for you: (a) keep Brandenburg's variable Ferientage (07.05.2027; 26.05.2028 once the data covers it) although KMK omits them and schools may move them; (b) keep school-free bridge days at all (they print as "FERIENTAG"); (c) whether SL, SH and TH need a manual look on the ministry sites before launch (not readable here).

## Data gaps

1. **Snapshot ends 2028-03-31** (`meta.to`). Missing (official dates are in the tables above, rows marked GAP): Easter 2028 holidays for all states except HH (Frühjahr 06.-17.03.2028 is present), the Pfingsten/Himmelfahrt 2028 holidays and bridge days where a state has them, and **Sommerferien 2028 for all 16 states**. The school-year edition to July 2028 and any planner with months after March 2028 are affected.
   Fix: `node scripts/fetch-holidays.mjs 2026-10-01 2028-07-31` (the OpenHolidays API answered from this environment), then `npm test`. The MV override stays in the script. The `[DATA GAP]` tests in `tests/holidays-official.test.ts` turn green when the data is complete. The same run also extends `data/public-holidays-reference.json`, which would let the existing public-holiday test see the Berlin 17 June 2028 problem below.
   Check afterwards: the API may again add the MV vocational days or other non-general-school days for later months; the tests flag any non-official day.
2. `schoolDataCoversUntil()` reads `meta.to`; it is only as good as that field. After the refresh it must be at least 2028-07-31.
3. SL, SH, TH: the ministry pages could not be read, only KMK. Pfingsten/summer 2028 for these three therefore rest on KMK alone.
4. Summer 2028 end dates are outside the "1 Nov 2026 - 31 Jul 2028" range for most states (they run into August/September). The tests clip to 31 Jul 2028.
5. Autumn 2028 holidays and later are not covered, and not needed for the stated editions.

## Public holidays 2026, 2027, 2028

Method: the code's output for every state and year (including all regional options switched on) was dumped and compared with (a) the OpenHolidays reference snapshot (the existing test in `tests/planner.test.ts` passes through 2028-03-31), (b) Easter Sunday cross-checked with an independent implementation (python `dateutil.easter`: 05.04.2026, 28.03.2027, 16.04.2028, all as in the code), (c) the statutes that were fetched.

Statutes actually read in this session:
- Bayern, BayFTG Art. 1: Neujahr, Heilige Drei Könige, Karfreitag, Ostermontag, 1. Mai, Himmelfahrt, Pfingstmontag, Fronleichnam, 3. Oktober, Allerheiligen, 1./2. Weihnachtstag statewide; Mariä Himmelfahrt only in municipalities with a predominantly Catholic population; Augsburg Friedensfest (8 Aug) only in the city of Augsburg. https://www.gesetze-bayern.de/Content/Document/BayFTG/true
- Sachsen, SächsSFG: Reformationsfest 31.10. and Buß- und Bettag are statutory holidays; Fronleichnam only where the FronleichnamsVO says so. http://www.revosax.sachsen.de/Text.link?stid=4071
- Sachsen, FronleichnamsVO: Fronleichnam is a holiday in the listed communes of the (former) Landkreise Bautzen, Hoyerswerda and Kamenz. https://www.revosax.sachsen.de/vorschrift/4142-FronleichnamsVO
- Berlin: https://www.berlin.de/sen/bjf/service/kalender/ferien/termine/ states "Im Schuljahr 2027/2028 ist der 17. Juni 2028 ein einmaliger gesetzlicher Feiertag."

| Item | Code | Result |
|---|---|---|
| Buß- und Bettag SN | 18.11.2026, 17.11.2027, 22.11.2028 (Wednesday before 23 Nov); not in any other state, not in BY | correct (dates checked by weekday calculation) |
| Reformationstag | BB, HB, HH, MV, NI, SN, ST, SH, TH on 31 Oct | consistent with OpenHolidays; SN confirmed by SächsSFG; others not read in the statute |
| Fronleichnam | statewide BW, BY, HE, NW, RP, SL; opt-in (default off) SN and TH | BY and SN confirmed by statute; TH hint "vor allem im Eichsfeld" not verified (the Thüringen statute page could not be fetched) |
| Mariä Himmelfahrt | SL statewide; BY opt-in, default on | BY confirmed (BayFTG); SL not read in the statute |
| Augsburger Friedensfest | BY opt-in, default off | correct |
| Weltkindertag TH 20 Sep | in code | matches OpenHolidays; statute not fetched |
| Frauentag 8 March BE, MV | in code | matches OpenHolidays (to Mar 2028); statutes not fetched |
| 8 May | no state in code for 2026-2028 | none in the OpenHolidays reference to Mar 2028; Berlin's page lists only 17 June 2028 as a one-off for 2027/28 |
| Heilige Drei Könige | BW, BY, ST | consistent with OpenHolidays |
| Allerheiligen | BW, BY, NW, RP, SL | consistent with OpenHolidays |
| Ostersonntag / Pfingstsonntag | day off only in BB; label only elsewhere | consistent with OpenHolidays |

### Handling of holidays that apply in only part of a state

`REGIONAL_HOLIDAYS` makes Mariä Himmelfahrt (BY, default on), Augsburger Friedensfest (BY, default off) and Fronleichnam (SN, TH, default off) customer choices; `defaultRegional()` supplies the defaults and a draft saved before the option existed keeps them. This matches the statutes read: BY Mariä Himmelfahrt is a holiday in predominantly Catholic municipalities (the checkbox hint is accurate in outline; the named examples "München" and "Nürnberg oder Fürth" were not checked against a source). Sachsen's hint says "Teilen des Landkreises Bautzen": the VO lists communes of the former Landkreise Bautzen, Hoyerswerda and Kamenz, which are today all in Landkreis Bautzen (my inference, not stated in the VO). One thing to note: Fronleichnam in BY is statewide, so no option is needed, and the code does that correctly.

### Suspected code bug (not fixed, `src/` untouched)

**Berlin 17 June 2028 missing.** `publicHolidays()` has no rule for the one-off statutory holiday on Saturday 17 June 2028 (75th anniversary of 17 June 1953). It falls on a Saturday so no extra day off, but the planner should still label and shade it like other holidays for Berlin. Failing test: `[CODE BUG] Berlin has a one-off public holiday on Saturday 17 June 2028`. Suggested fix in `publicHolidays()`: `if (year === 2028) add(fixed(6, 17), '75. Jahrestag des Volksaufstands vom 17. Juni 1953', '17. JUNI', only('BE'));`. The existing OpenHolidays comparison test stops at 2028-03-31, which is why it did not catch this.

No other code bug found. The `GENERIC_DAY` label rule turns single bridge days into "FERIENTAG"; this is a design choice, not an error.

## Tests

`tests/holidays-official.test.ts` (54 tests):
- 1 check that fixtures exist for all 16 states.
- Per state: (1) every official day up to 2028-03-31 is in the planner data, (2) the planner data has no non-official day in the whole range, (3) `[DATA GAP]` official days from 2028-04-01 to 2028-07-31 are present.
- `[DATA GAP]` snapshot coverage reaches 2028-07-31.
- Public-holiday checks (Buß- und Bettag, Bayern options, Sachsen Fronleichnam) and the `[CODE BUG]` Berlin test.

The 18 failing tests are the 16 per-state `[DATA GAP]` tests, the snapshot-coverage test and the Berlin `[CODE BUG]` test. They fail until the snapshot is refreshed to 2028-07-31 and the Berlin rule is added. Everything else passes.

## Follow-up (13 Nov 2026)

- The snapshot was refreshed to 2028-07-31, which closed the data gap above.
- The Berlin holiday on 17 June 2028 was added to `publicHolidays()`; the OpenHolidays reference lists it too.
- All tests in `tests/holidays-official.test.ts` now pass.
