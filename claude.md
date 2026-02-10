# SpineAlign — Ulrich Medical Surgical Planning Platform

## Project Overview
SpineAlign is a web-based surgical planning tool for spine surgeons, powered by Ulrich Medical USA's implant catalog. It allows surgeons to input anonymized patient data, compute ideal deformity correction targets for cervical and lumbar spine surgeries, and receive implant recommendations matched to the clinical scenario.

## Architecture
- **Frontend-only** single-page application (no backend)
- Modular file structure: `index.html`, `css/styles.css`, `js/` modules
- No build tools or framework dependencies — runs directly in the browser
- All computation is client-side; no patient data leaves the browser

## File Structure
```
SpineAlign/
├── index.html              # Main HTML shell
├── css/
│   └── styles.css          # All styles
├── js/
│   ├── app.js              # App initialization, navigation, state management
│   ├── cervical.js          # Cervical deformity parameter logic & classification
│   ├── lumbar.js            # Lumbar deformity parameter logic & classification
│   ├── corrections.js       # Correction target computation engine
│   ├── implants.js          # Implant recommendation engine (Ulrich catalog)
│   └── ui.js                # Shared UI builders (cards, tables, rendering)
├── claude.md               # This file — project context for Claude
└── README.md               # (not created unless requested)
```

## Key Concepts

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

## Important Notes
- This is a surgical planning aid, NOT a diagnostic tool
- All correction targets must be validated by the treating surgeon
- The implant recommendations are suggestions based on published literature and Ulrich Medical's catalog — final implant selection is the surgeon's responsibility
- No patient data is transmitted or stored externally; all computation is browser-side
- Product details sourced from ulrichmedicalusa.com
