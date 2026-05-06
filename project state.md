# haMMA Project State Summary
*Last updated: May 2026*

## What is haMMA
An interactive public map of Hawaiʻi's 90+ managed marine and freshwater areas. Built by Tyler Kueffner (DAR) using Leaflet.js + ArcGIS Online. Designed for fishers, divers, and ocean users in the field — especially on mobile.

**Live repo:** GitHub (haMMA and haMMA2)
**ArcGIS layer:** `TK_MMA_FEATURECLASS` — FeatureServer/727
**Contact:** tk85@hawaii.edu

---

## Web App — Current State

### Files
- `script.js` — v21 (latest)
- `style.css` — v21 (latest)
- `index.html` — current (mobile pill slot removed, clean)

### Architecture
- **Leaflet.js** map with ArcGIS Online feature service
- **Mobile bottom sheet** with two-phase drag system (passive observation → active drag)
- **Desktop split panel** — narrow list pane (260px) + info pane (300px)
- **Single scroll container per panel** on mobile — `info-content` scrolls, `mmpopup` is normal flow

### Key Features Built
- Tap map → shows all overlapping areas at that location
- **Combined rules summary** — field-first layout, source chips at end of each bullet, deduplication of identical rules across sources
- **Source legend pills** — tap any area name to flash its polygon on map (no fly-to)
- **Overlap notification** — when selecting from list, shows "N other managed areas overlap at this zone"
- **About pane** — "About this map" button at bottom of island list, opens README content in info panel
- Rules display uses 16 structured fields with color-coded status blocks (Prohibited/Allowed/Limited/Notes)
- Legacy blob field fallback removed — new fields only

### Known Issues / Next Items
- Transit notes: a few variants still not perfectly deduplicated (minor — doesn't affect functionality)
- Snap positions: `list-full` = H×0.03, `info-full` = H×0.22 (may want to tweak)
- Mobile initial extent: paddingBottomRight 320, maxZoom 8.3 (may need further adjustment by device)
- Dead code still present: `stripCalloutPrefix`, `splitRuleLines`, `classifyRuleLine`, `parseRuleField`, `normalizeRuleForMerge` — safe to remove in a cleanup pass

---

## Data Schema — 16 Active Rule Fields

```
Rules_Gear_Prohibited       Rules_Gear_Allowed       Rules_Gear_Limited
Rules_Species_Prohibited    Rules_Species_Allowed    Rules_Species_Limited
Rules_Activities_Prohibited Rules_Activities_Allowed Rules_Activities_Limited  Rules_Activities_Notes
Rules_Seasons_Prohibited    Rules_Seasons_Allowed    Rules_Seasons_Limited
Rules_Transit_Prohibited    Rules_Transit_Allowed    Rules_Transit_Notes
```

**Intentionally null (exist in DB but not populated):**
`Rules_Gear_Notes`, `Rules_Species_Notes`, `Rules_Seasons_Notes`, `Rules_Transit_Limited`

**Field length:** 2000 chars each (ArcGIS Online hosted feature layer)

---

## Data Pipeline — Current Scripts

All scripts live in `C:\haMMA\`. Run in order:

### 1. `scan_pdfs.py` v1
Checks all PDF URLs in CSV. Identifies image PDFs that need manual text files.
- Manual text files → `C:\haMMA\manual_text\`
- Currently needed: `NARS-Rules-Revision-Filed-July-19-2025.txt` (ʻĀhihi-Kīnaʻu NAR)
- HRS HTML pages (4 files already saved): `HRS_0188-0022_0008.txt`, `HRS_0188-0034.txt`, `HRS_0188-0035.txt`, `HRS_0188-0036.txt`

### 2. `extract_rules.py` v9
Fetches PDFs, sends to Claude API, extracts rules into 16-field schema.
- Model: `claude-sonnet-4-5`
- `max_tokens`: 6000
- HAR text limit: 32,000 chars
- HRS text limit: 8,000 chars
- `TEST_MODE = False` for full run
- Output: `output/rules_output.csv`
- Cost: ~$3-4 for full 90-row run

### 3. `normalize_rules.py` v1
Fuzzy-matches near-identical values across rows. Standardizes wording.
- **Field-specific thresholds** (NOT one global threshold):
  - `Rules_Transit_Notes`: 0.85 (aggressive — boilerplate)
  - `Rules_Transit_Allowed`: 0.88
  - `Rules_Activities_Notes`: 0.90
  - `Rules_Activities_Prohibited`: 0.96
  - `Rules_Gear_Prohibited/Allowed`: 0.97 (strict — every word matters legally)
- Output: `output/rules_normalized.csv` + `output/normalization_report.txt`

### 4. `verify_rules.py` v1
Re-fetches source PDFs, asks Claude to verify each extracted value for accuracy.
- `--mode changes` (default): only verifies rows touched by normalizer (~$0.50, ~5 min)
- `--mode full`: verifies all 90 rows (~$3-5, ~40 min)
- Output: `output/rules_verified.csv` + `output/verification_report.txt`

### 5. `review_decisions.py` v1
**Interactive terminal tool** — shows each changed cell one at a time.
- Keys: `a`=accept, `r`=reject, `n`=null, `e`=edit, `s`=skip, `b`=back, `q`=quit+save
- Progress auto-saved to `output/review_progress.json` after every keypress
- Resume anytime — picks up where you left off
- Output: `output/rules_reconciled.csv`

---

## ArcGIS Import Workflow

1. Run pipeline: extract → normalize → verify → review_decisions
2. Open `rules_reconciled.csv` in **Google Sheets** (NOT Excel — corrupts Hawaiian characters)
3. Delete all columns except OBJECTID + 16 rule fields
4. File → Download → CSV
5. ArcGIS Online → Feature layer → Update Data → Update from CSV
6. Match on OBJECTID, map 16 rule fields, Update existing features only

---

## Known Data Issues

### OBJ 21 — Port Allen FMA
The document (ch49.5) defines Zone A as the regulated area, which IS the entire Port Allen FMA — no meaningful distinction. Current data is clean:
- `Rules_Gear_Prohibited`: All nets except landing nets (max 3 ft, any mesh size)
- `Rules_Species_Limited`: Akule: 75 per person per day
- `Rules_Activities_Prohibited`: Snagging fish
- All other fields: empty (correct — no other rules in document)

### Areas worth re-extracting in a future run
- **OBJ 57** — Miloli'i CBSFA: uhu size limits uncertain (verifier flagged)
- **OBJ 58** — ʻŌpelu TMZ: season direction confirmed as Sep–Jan (hook-and-line prohibited Feb 1–Aug 31)
- **OBJ 72/73** — Kaʻūpūlehu MR: deep-water exceptions need manual verification against §13-60.4-5(d)
- **OBJ 89/90** — Kahoʻolawe Zones A/B: source PDF truncated at 20k chars, rules not extracted

### Transit notes
Two canonical forms exist (both correct, just different areas):
- Short: "Vessels adrift, anchored, or moored are not in active transit" (17 rows)
- With boat ramp exception: "...except vessels in line for boat ramp or actively loading/unloading at wharf" (5-6 rows)

---

## Cost Summary (to date)
- Claude.ai subscription: ~$40/month
- Claude API credits used: ~$17 of $20 starting balance
- Estimated contractor equivalent: $15,000–$25,000

---

## Suggested Next Chat Structure

**Chat A — Map/JS/CSS**
Start with: upload latest repo zip + paste this summary
Focus: UI features, rendering, mobile fixes, new functionality

**Chat B — Data pipeline**
Start with: upload all 5 scripts + latest rules CSV + paste this summary
Focus: extraction improvements, re-runs, data quality, ArcGIS import
