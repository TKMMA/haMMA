# haMMA — Hawaiʻi Managed Marine & Freshwater Areas

An interactive public map that helps residents, visitors, fishers, divers, and ocean users understand which managed marine and freshwater areas apply at any location in Hawaiʻi — and what the rules are.

---

## Why this exists

Hawaiʻi has over 90 managed marine and freshwater areas across all islands — Marine Life Conservation Districts, Fish Replenishment Areas, Community-Based Subsistence Fishing Areas, Wildlife Sanctuaries, harbors, canals, and more. These areas frequently overlap, and their rules are scattered across dense legal documents that are hard to find and harder to read.

Someone standing on a reef in Miloli'i might be simultaneously inside the West Hawaiʻi Regional Fishery Management Area, the Miloli'i CBSFA, and one of its sub-zones — each with different rules for gear, species, seasons, and activities. The existing government map tools are difficult to use in the field, especially on a phone.

haMMA replaces that experience with something fast, clear, and built for real people in real places.

---

## How it works

### Tap the map, get your rules

The primary interaction is simple: tap or click anywhere on the map. The app identifies every managed area at that location — including overlapping polygons — and shows you the applicable rules immediately.

On mobile, a panel slides up from the bottom. On desktop, it opens in a sidebar to the right of the map. Either way, you're reading rules within a second or two of tapping.

### Browse by island and area name

A searchable list on the left panel (desktop) or the bottom sheet (mobile) organizes all 90+ areas by island. Tap any area name to fly to it on the map and open its rules.

### Area information in three tabs

Each area card has three tabs:

- **About** — designation type, island, purpose, establishment date, and location description
- **Rules** — the area's fishing and activity rules, organized by category and status
- **Laws** — links to the official HAR and HRS legal documents the rules are sourced from

---

## The rules display

Rules are organized into five categories:

- **Gear Rules** — what fishing equipment is allowed, prohibited, or restricted
- **Species & Bag Limits** — which species are protected, what bag limits apply, and size requirements
- **Activities Rules** — actions like fish feeding, anchoring, diving, and removing geological features
- **Seasons & Times** — closed seasons, time-of-day restrictions, and seasonal windows
- **Transit & Anchor** — rules for vessels passing through with otherwise-restricted gear

Within each category, rules are color-coded by status:
- 🔴 **Prohibited** — unlawful activities and gear
- ✅ **Allowed** — explicitly permitted gear or activities (shown when useful context)
- ⚠️ **Allowed with limits** — permitted under specific conditions: size limits, bag limits, seasonal windows, gear restrictions
- 📋 **Notes** — important context that modifies how other rules apply (transit exemptions, permit options)

Rule text is written in plain English, not legal prose. Hawaiian species names use correct diacritical markings (ʻokina and kahakō).

---

## Overlapping areas — the combined summary

This is the most distinctive feature of the app. Because managed areas frequently overlap, simply showing one area's rules isn't enough.

When multiple areas are selected, the app shows:

### Combined rules summary

A single card that reorganizes rules from all selected areas into one unified view. Rules are grouped by category and status — so all Prohibited gear rules from all areas appear together, all Species limits appear together, and so on.

**Source chips** — small colored numbered circles — appear at the end of each rule line, indicating which area that rule comes from. A legend at the top of the summary lists all included areas with their chip numbers. Tapping any area name in the legend **flashes that polygon on the map** so you can see exactly where it is — without moving the map or changing the selection.

When multiple areas share identical rule text (for example, the standard transit note that appears in every CBSFA), the app deduplicates it and shows it once with all relevant source chips grouped together.

### Area-specific cards

Below the summary, individual cards for each selected area preserve the original rule text in full. These are the source of truth — the summary is an organizational aid, not a replacement.

---

## Mobile experience

The app is designed to be used on a phone in the field.

- **Bottom sheet** — the rules panel slides up as a bottom sheet with three snap positions: peek, half-height, and full-height
- **Drag to resize** — drag the banner at the top of the panel up or down to adjust how much map you can see
- **Back to list** — the back button in the panel header returns you to the areas list without closing anything
- **Multi-area header pill** — when multiple areas are selected, a "Combined Rules" pill appears in the panel header so you can jump to the summary without scrolling
- **No accidental map movement** — tapping the map never triggers a fly-to animation. The map stays where you left it so you always know where you are

---

## Desktop experience

- **Split panel layout** — the areas list sits in a narrower left panel, the info panel opens to its right, leaving the majority of the screen as map
- **Click any polygon** — the info panel opens immediately without moving the map
- **List panel** — organized by island, with a search bar to filter by area name

---

## Data

Rules are sourced directly from Hawaii Administrative Rules (HAR) and Hawaii Revised Statutes (HRS) documents. The structured rule fields were extracted from official government PDFs using a custom extraction pipeline, then reviewed and organized into a consistent schema.

The data layer is a hosted ArcGIS Online feature service maintained by the project team. Each of the 90+ features includes structured rule fields for all five rule categories, links to official legal documents, and images where available.

---

## Important note

haMMA is an informational tool. Rule text is based on official sources but may not reflect recent amendments or administrative updates. Always verify rules against official agency resources before entering a managed area, and when in doubt contact the Division of Aquatic Resources.

Links to official HAR and HRS documents are available in the **Laws** tab of each area card.

---

## Technical stack

- **Leaflet.js** — map rendering and polygon interaction
- **ArcGIS Online** — hosted feature service for area geometries and attributes
- **Vanilla JS / CSS** — no frontend framework; single-file architecture
- **Esri World Imagery** — satellite basemap with labels overlay

---

## Project

Built as a public service to replace the existing government ArcGIS map viewer with a faster, clearer, mobile-friendly experience for the people who actually use these waters.
