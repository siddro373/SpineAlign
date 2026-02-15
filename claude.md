# SpineAlign — Ulrich Medical Surgical Planning Platform

## Project Overview
SpineAlign is a web-based surgical planning tool for spine surgeons, powered by Ulrich Medical USA's implant catalog. It allows surgeons to input anonymized patient data, compute ideal deformity correction targets for cervical and lumbar spine surgeries, receive implant recommendations matched to the clinical scenario, and visualize a simulated postoperative alignment plan.

**Live URL:** https://siddro373.github.io/SpineAlign/
**Repo:** github.com/siddro373/SpineAlign

## Architecture
- **Frontend-only** single-page application (no backend, no frameworks, no build tools)
- Vanilla HTML/CSS/JS — runs directly in the browser via `<script>` tags
- All computation is client-side; no patient data leaves the browser
- Dark navy/teal clinical theme with CSS custom properties
- Screen-based navigation (`App.goToScreen()`) through a 9-screen flow
- localStorage for saving/loading up to 50 cases
- GitHub Pages deployment via GitHub Actions

## File Structure
```
SpineAlign/
├── index.html              # Main HTML — 9-screen single-page layout
├── css/
│   └── styles.css          # All styles — dark theme, components, print, responsive
├── js/
│   ├── app.js              # App state, screen navigation, flashcard patient input, case management
│   ├── annotator.js        # Canvas-based X-ray landmark annotation tool
│   ├── planner.js          # Postop plan visualization — side-by-side canvas rendering with instrumentation
│   ├── cervical.js         # Cervical deformity parameter logic & classification
│   ├── lumbar.js           # Lumbar deformity parameter logic & classification
│   ├── corrections.js      # Correction target computation engine
│   ├── implants.js         # Implant recommendation engine — Ulrich catalog
│   └── ui.js               # Shared UI builders (cards, tables, toasts, modals)
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages deployment workflow
└── CLAUDE.md               # This file — project context for Claude
```

## Application Flow (9 Screens)
1. **Welcome** (`screen-welcome`) — Greeting, "New Case" / "Saved Cases" CTAs, disclaimer
2. **Patient** (`screen-patient`) — Flashcard-style one-field-at-a-time input: Age, BMI, Bone Quality, Smoking, Pathology, Patient ID (optional), Sex (optional), Previous Surgery (optional). Progress bar, slide animations, Enter key to advance, Skip for optional fields.
3. **Region** (`screen-region`) — Select cervical, lumbar, or both
4. **Upload** (`screen-upload`) — Drag & drop lateral/AP radiographs, or skip to manual entry
5. **Annotate** (`screen-annotate`) — Canvas landmark placement tool with computed measurements sidebar
6. **Manual** (`screen-manual`) — Manual entry/edit of spine parameters (CL, cSVA, T1S, CBVA, PI, LL, SVA, PT) + surgical details
7. **Corrections** (`screen-corrections`) — Age-adjusted correction targets with parameter cards and summary table
8. **Implants** (`screen-implants`) — Ulrich implant recommendations, patient factors, export options
9. **Plan** (`screen-plan`) — 3-panel surgical plan: (1) Preoperative X-ray with alignment measurements, (2) Surgical Strategy with correction vectors, cage planning zones, endplate outlines, angle arcs, osteotomy markers, (3) Corrected Postop with superimposed instrumentation (screws, rods, cages) and corrected alignment. Below: step-by-step operative instructions, parameter comparison table, legend, Contact Representative CTA

## Key JavaScript Objects

### `App` (js/app.js)
- **State:** `currentScreen`, `patientData`, `cervicalData`, `lumbarData`, `correctionResults`, `implantRecs`, `regionCervical`, `regionLumbar`, `uploadedImages`, `cameFromAnnotation`, `flashcardIndex`, `flashcardValues`
- **Navigation:** `goToScreen(name)` — shows/hides screens, updates flow progress breadcrumb, initializes flashcards when entering patient screen
- **Flashcard system:** `flashcardConfig[]` (8 field definitions), `initFlashcards()`, `renderFlashcard()`, `flashcardNext()`, `flashcardBack()`, `flashcardSkip()`, `finalizePatientData()`
- **Flow:** `toggleRegion()`, `saveRegionAndNext()`, `proceedToAnnotation()`, `skipToManual()`, `computeAndShowCorrections()`, `generateImplantRecs()`, `showPlanVisualization()`
- **File handling:** `handleDragOver/Leave/Drop()`, `handleFileSelect()`, `loadImagePreview()`, `removeImage()`
- **Annotation bridge:** `startAnnotation()`, `acceptAnnotationAndCompute()`, `populateManualFromAnnotation()`
- **Persistence:** `saveCase()`, `loadCase(idx)`, `deleteCase(idx)`, `loadCaseList()`
- **Export:** `exportCSV()`, `exportJSON()`, `printReport()`
- **Contact:** `contactRepresentative()` — builds surgical plan summary, opens `mailto:` link

### `Annotator` (js/annotator.js)
- Canvas-based landmark annotation with click-to-place, drag-to-adjust
- **Cervical mode:** 10 landmarks → computes CL, cSVA, T1S, CBVA
- **Lumbar mode:** 9 landmarks → computes LL, SVA, PI, PT
  - Lumbar landmarks: L1 Sup Ant, L1 Sup Post, L5 Inf Ant, L5 Inf Post, S1 Sup Mid, S1 Post-Sup, C7 Center, FH Left, FH Right
- **Geometry functions:** `cobbAngle()`, `lineAngle()`, `angleToVertical()`, `horizontalOffset()`, `perpendicularAngle()`, `midpoint()`, `distance()`, `computePI()`, `computePT()`
- **Rendering:** Image display, landmark dots with labels, measurement lines, angle arcs
- **Controls:** Undo, clear, zoom in/out, manual override inputs for distance measurements (SVA/cSVA in mm)

### `Planner` (js/planner.js)
- 3-panel canvas-based surgical plan visualization
- **Init:** `init(imageSrc, landmarks, landmarkDefs, region, cervData, lumbarData, corrections, implantRecs, patientData)`
- **Panel 1 — Preop:** Dimmed X-ray + current alignment curve (red) + SVA plumbline + preop measurement tags
- **Panel 2 — Surgical Strategy:** Dimmed X-ray + preop alignment (faded red) + target alignment curve (gold) + correction vectors (dashed arrows) + endplate outlines + cage planning zones (blue boxes) + LL angle arcs + SVA correction indicator + osteotomy site marker + target values
- **Panel 3 — Corrected Postop:** Dimmed X-ray + corrected alignment (green) + bilateral rods + pedicle screws (shaft + tulip + threads) + interbody cages + corrected plumbline + postop measurement tags
- **Surgical Steps:** `renderSurgicalSteps()` — generates step-by-step operative instructions (positioning, decompression, cage placement, screw instrumentation, rod contouring, intraop confirmation) based on approach, levels, osteotomy, implant recs, and patient factors
- **Correction algorithm:** `_computePostopLandmarks()` — transforms landmarks based on SVA delta (horizontal shift) and LL/CL delta (rotation around pivot)
- **Supporting:** `renderComparisonTable()`, `renderLegend()`
- **Pixel scale estimation:** `_estimatePixelScale()` — uses anatomic landmark distances (L1-S1 ~150mm, C2-C7 ~100mm) to approximate pixels-per-mm
- **Graceful fallback:** Works without X-ray data (dark background + parameter labels only)

### `UI` (js/ui.js)
- `paramCard()`, `summaryRow()`, `implantCard()`, `factorNote()` — HTML builders
- `toast()` — Notification popups
- `openModal()`, `closeModal()` — Modal management
- `formatDate()` — Date formatting

### `Cervical` / `Lumbar` (js/cervical.js, js/lumbar.js)
- `collectData()` — Gathers form values
- `computeTargets(age)` — Returns age-adjusted correction targets with severity classifications

### `Corrections` (js/corrections.js)
- `compute(cervData, lumbarData, age)` — Combines cervical + lumbar correction computations
- `render(results)` — Renders parameter cards + summary tables

### `Implants` (js/implants.js)
- `recommend(corrections, patient, cervData, lumbarData)` — Master recommendation logic
- `cervicalRecs(cervData, patient, corrections)` — Cervical-specific implant matching
- `lumbarRecs(lumbarData, patient, corrections)` — Lumbar-specific implant matching
- `render(recs, patient)` — Renders implant cards with features, rationale, links

## CSS Theme & Design System

### Color Variables
- **Backgrounds:** `--bg: #0d1117`, `--bg-elevated: #131a24`, `--card-bg: #1a2332`
- **Text:** `--text: #f0f2f5`, `--text-muted: #b8c0cc`, `--text-light: #8b95a8`
- **Accent:** `--accent: #4a9ead` (clinical teal), `--accent-hover: #5cb8c8`
- **Status:** `--success: #34d399`, `--warning: #fbbf24`, `--danger: #f87171`, `--info: #60a5fa`

### Key CSS Components
- `.header` — Sticky dark gradient header with brand + action buttons
- `.welcome-screen` — Centered welcome with logo, greeting, CTAs
- `.card` — Dark elevated cards with border and shadow
- `.flashcard-*` — Flashcard patient input system: progress bar, slide-in/out animations, centered large inputs
- `.region-card` / `.upload-dropzone` — Interactive selection cards
- `.annotator-layout` — Two-column grid (canvas + sidebar)
- `.flow-progress` — Breadcrumb step indicators
- `.param-card` — Color-coded parameter display cards (success/warning/danger)
- `.implant-card` — Implant recommendation cards with features and rationale
- `.plan-layout-3` — Three-column grid for preop / strategy / postop canvases
- `.plan-step` / `.plan-step-num` / `.plan-step-title` / `.plan-step-detail` — Step-by-step operative instructions
- `.plan-steps-section` — Container for surgical steps
- `.plan-panel` / `.plan-canvas-wrap` — Panel containers for plan visualization canvases
- `.plan-legend` — Color-coded legend with instrument swatches and recommended implant pills
- `.btn-contact-rep` — Large gradient CTA button for contacting Ulrich representative
- `.summary-table` — Correction target comparison tables

### Responsive Breakpoints
- **≤768px (tablet):** Single-column grids, hidden header badge, compact buttons, horizontal scroll for breadcrumb and tables, stacked button groups, plan layout stacks vertically
- **≤480px (mobile):** Auto-height header with flex-wrap, smaller logo/fonts, stacked welcome buttons, compact forms/cards/inputs, smaller contact CTA, full-width toasts/modals, compact flashcard inputs

### Print Styles
- Overrides to white background, hides navigation/buttons/toasts/flashcard buttons, shows all screens, plan layout preserves side-by-side

## Clinical Knowledge

### Cervical Deformity Parameters
1. **Cervical Lordosis (CL):** C2-C7 modified Cobb angle. Lordosis = negative. Target: CL ≈ T1S − 16.5° (Hyun et al.)
2. **Cervical SVA (cSVA):** C2 centroid to C7 posterior superior endplate distance (mm). Target: < 40mm, age-adjusted.
3. **T1 Slope (T1S):** Angle of T1 superior endplate to horizontal. Used in T1S-CL mismatch (normative: 16°–26°).
4. **Chin-Brow Vertical Angle (CBVA):** Chin-brow line to vertical. Target: ±10° (neutral gaze).

### Lumbar Deformity Parameters
1. **Pelvic Incidence (PI):** Fixed anatomic parameter measured from sacral endplate.
2. **Sagittal Vertical Axis (SVA):** C7 plumbline to S1 posterior superior corner (mm). Age-adjusted targets per Schwab-SRS.
3. **PI-LL Mismatch:** PI minus Lumbar Lordosis. Age-adjusted target (younger < 10°, elderly < 15°).
4. **Pelvic Tilt (PT):** Compensatory pelvic retroversion indicator.

### Lumbar Annotation Landmarks (9 total)
| Index | ID | Short Label | Description |
|-------|----|-------------|-------------|
| 0 | l1_sup_ant | L1 Sup Ant | L1 Superior Endplate (Anterior) |
| 1 | l1_sup_post | L1 Sup Post | L1 Superior Endplate (Posterior) |
| 2 | l5_inf_ant | L5 Inf Ant | L5 Inferior Endplate (Anterior) |
| 3 | l5_inf_post | L5 Inf Post | L5 Inferior Endplate (Posterior) |
| 4 | s1_sup_mid | S1 Sup Mid | S1 Superior Endplate (Midpoint) |
| 5 | s1_post_sup | S1 Post-Sup | S1 Posterior-Superior Corner |
| 6 | c7_centroid | C7 Center | C7 Centroid (on full-spine film) |
| 7 | fh_left | FH Left | Left Femoral Head Center |
| 8 | fh_right | FH Right | Right Femoral Head Center |

### Age-Adjusted Correction Targets (Schwab-SRS / Lafage)
| Age Group | Target SVA | Target PT | Target PI-LL |
|-----------|-----------|-----------|--------------|
| < 45      | < 25 mm   | < 12°     | < 0°         |
| 45–54     | < 30 mm   | < 15°     | < 5°         |
| 55–64     | < 40 mm   | < 20°     | < 10°        |
| 65–74     | < 50 mm   | < 22°     | < 12°        |
| ≥ 75      | < 60 mm   | < 25°     | < 15°        |

### Ulrich Medical USA Implant Catalog
**Anterior Cervical:**
- Flux-C® — 3D porous titanium cervical interbody (preferred in osteoporosis)
- uCerv® / uCerv Ti — PEEK or titanium cervical interbody (parallel or 6° lordotic, heights 5-12mm, footprints 14×12 to 19×16 XL)
- uNion® — Anterior cervical plate system

**Posterior Cervical:**
- Cortium® — Universal OCT fixation (occiput-cervical-thoracic, for complex/severe deformity)
- neon3® — Universal OCT stabilization (standard posterior cervical)

**Vertebral Body Replacement:**
- Solidity® — Expandable VBR, T1-L5, 625+ configurations, 13-72mm height, gear-driven expansion, self-locking
- Small VBR® — Compact expandable VBR for cervical/upper thoracic corpectomy
- obelisc® / obelisc LE® — VBR systems
- Omni VBR® / ADDplus® — Additional VBR options

**Thoracolumbar:**
- Momentum® — Open posterior spinal fixation (polyaxial/monoaxial screws, 5.5/6.0mm rods)
- Momentum® MIS — Minimally invasive percutaneous variant
- tezo® — Titanium interbody cages (TLIF/PLIF/ALIF/lateral configurations)

**Ancillary:**
- G21 V-STEADY — High viscosity bone cement for vertebral augmentation and screw augmentation in osteoporotic bone

### Implant Selection Logic
- Bone quality drives material choice: titanium (Flux-C, uCerv Ti) preferred in osteoporosis/osteopenia; PEEK acceptable in normal bone
- Surgical approach determines interbody device type (ACDF → uCerv/Flux-C, TLIF/PLIF/ALIF/lateral → tezo variants)
- Deformity severity drives fixation complexity: severe → Cortium (cervical) or open Momentum (lumbar); mild → neon3 or Momentum MIS
- Osteotomy type (SPO/PSO/VCR) and pathology (trauma/tumor) trigger VBR recommendations (Solidity, Small VBR)
- Osteoporosis + long constructs → G21 V-STEADY cement augmentation

### Patient Factors Affecting Recommendations
- **Bone Quality:** Normal / Osteopenia / Osteoporosis — affects implant material, cement augmentation need
- **Age:** Adjusts correction targets; elderly patients may tolerate under-correction better
- **BMI:** ≥30 increases mechanical load; ≥35 may require larger rods, cross-connectors
- **Smoking:** Current smokers have 5x pseudarthrosis risk; titanium surfaces and biologics preferred

## Deployment
- **GitHub Pages** via `.github/workflows/deploy.yml`
- Pushes to `main` trigger automatic deployment
- No build step — static files served directly
- Push command: `git push origin main` (use `/opt/homebrew/bin/gh` for gh CLI)

## Important Notes
- This is a surgical planning aid, NOT a diagnostic tool
- All correction targets must be validated by the treating surgeon
- The implant recommendations are suggestions based on published literature and Ulrich Medical's catalog — final implant selection is the surgeon's responsibility
- The postop plan visualization is a schematic approximation — does NOT replace intraoperative imaging or navigation
- No patient data is transmitted or stored externally; all computation is browser-side
- Product details sourced from ulrichmedicalusa.com
- Contact Representative button opens `mailto:` with full surgical plan summary
