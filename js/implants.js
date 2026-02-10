// =============================================
// SpineAlign — Ulrich Medical Implant Engine
// =============================================

const Implants = {

    // Generate implant recommendations
    recommend(patientData, cervicalData, lumbarData, correctionResults) {
        const recs = [];

        if (patientData.regionCervical) {
            recs.push(...this.cervicalRecs(patientData, cervicalData, correctionResults));
        }

        if (patientData.regionLumbar) {
            recs.push(...this.lumbarRecs(patientData, lumbarData, correctionResults));
        }

        return recs;
    },

    // ---- Cervical Implant Recommendations ----
    cervicalRecs(patient, cerv, results) {
        const recs = [];
        const approach = cerv.approach;
        const levels = cerv.levels;
        const boneQ = patient.boneQuality;
        const hasSevere = results.cervical &&
            results.cervical.params.some(p => p.severity.cls === 'status-severe');

        // Anterior approach implants
        if (approach === 'anterior' || approach === 'combined') {

            // Interbody device: Flux-C for poor bone, uCerv for normal/osteopenic
            if (boneQ === 'osteoporosis') {
                recs.push({
                    name: 'Flux-C\u00AE',
                    category: 'Anterior Cervical Interbody',
                    recommended: true,
                    description: '3D porous titanium cervical interbody device manufactured via selective laser melting. The open porous structure promotes bone cell migration and osseointegration, providing superior fixation in compromised bone.',
                    features: [
                        '3D porous titanium (SLM) architecture',
                        'Enhanced endplate contact in osteoporotic bone',
                        'Open structure promotes vascular ingrowth and bone cell migration',
                        'High coefficient of friction reduces migration risk',
                        'Multiple footprint and height options'
                    ],
                    rationale: `Primary recommendation due to osteoporotic bone quality (T-score ≤ -2.5). The 3D porous titanium structure provides superior initial fixation and long-term osseointegration compared to PEEK alternatives in compromised bone. High surface friction coefficient resists cage migration.`,
                    link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/interbody-cages/'
                });
            } else {
                const isOsteopenic = boneQ === 'osteopenia';
                recs.push({
                    name: 'uCerv\u00AE / uCerv Ti',
                    category: 'Anterior Cervical Interbody',
                    recommended: true,
                    description: 'Anterior cervical interbody device available in PEEK or titanium alloy. Bullet-tipped design for ease of insertion with self-distraction. Parallel or 6\u00B0 lordotic configurations.',
                    features: [
                        'PEEK or titanium alloy material options',
                        'Parallel or 6\u00B0 lordotic configurations',
                        'Heights: 5mm to 12mm across multiple footprints',
                        'Standard (14\u00D712, 15\u00D713, 17\u00D714) and XL (19\u00D716) footprints',
                        'Bullet-tipped design for self-distraction and ease of insertion',
                        'Optimized tooth pattern to limit migration',
                        'Large central core for maximum bone graft volume'
                    ],
                    rationale: `${isOsteopenic ? 'Titanium variant (uCerv Ti) recommended for improved endplate fixation in osteopenic bone. ' : 'PEEK or titanium variant appropriate for normal bone quality. '}` +
                        `${cerv.cl > -10 ? '6\u00B0 lordotic configuration recommended to help restore cervical lordosis (current CL: ' + cerv.cl + '\u00B0). ' : 'Parallel or lordotic configuration per surgeon preference. '}` +
                        `${parseInt(levels) >= 2 ? 'For multi-level ACDF, lordotic cages at each level contribute to cumulative CL restoration.' : ''}`,
                    link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/interbody-cages/ucerv'
                });
            }

            // Cervical plate
            recs.push({
                name: 'uNion\u00AE',
                category: 'Anterior Cervical Plate',
                recommended: true,
                description: 'Cervical plate system designed for anterior stabilization in conjunction with interbody cages. Provides supplemental fixation to promote fusion and maintain correction.',
                features: [
                    'Low-profile plate design minimizes dysphagia risk',
                    'Screw locking mechanism for construct stability',
                    'Compatible with uCerv and Flux-C interbody systems',
                    'Multiple length options for single and multi-level constructs',
                    'Variable-angle screw trajectory'
                ],
                rationale: `Anterior plating recommended for ${parseInt(levels) >= 2 ? 'multi-level' : 'single-level'} ACDF to enhance fusion rates and maintain lordotic correction. ` +
                    `${boneQ !== 'normal' ? 'Supplemental anterior fixation particularly important with compromised bone quality to prevent graft subsidence and kyphosis recurrence.' : 'Standard of care for ACDF stabilization.'}`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
            });

            // VBR for corpectomy indications
            if (levels === '3' || levels === '4+' || patient.pathology === 'trauma' || patient.pathology === 'tumor') {
                recs.push({
                    name: 'Small VBR\u00AE',
                    category: 'Cervical Vertebral Body Replacement',
                    recommended: patient.pathology === 'trauma' || patient.pathology === 'tumor',
                    description: 'Compact expandable vertebral body replacement for cervical and upper thoracic corpectomy. Proven platform with over 25,000 successful implantations worldwide.',
                    features: [
                        'Expandable design for precise height restoration',
                        'Optimized for cervical and upper thoracic spine',
                        'Restores sagittal alignment and vertebral height',
                        'Proven track record (25,000+ implantations)',
                        'In-situ expansion for patient-specific fit'
                    ],
                    rationale: `${patient.pathology === 'trauma' ? 'Indicated for vertebral body reconstruction following burst fracture. ' : ''}` +
                        `${patient.pathology === 'tumor' ? 'Indicated for anterior column reconstruction after tumor corpectomy. ' : ''}` +
                        `${levels === '3' || levels === '4+' ? 'Consider corpectomy with VBR as alternative to multi-level discectomy for ≥3 level pathology — may provide more robust anterior column support.' : ''}` +
                        ` Expandable design allows precise height restoration to correct cSVA.`,
                    link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/vertebral-body-replacement/'
                });
            }
        }

        // Posterior approach implants
        if (approach === 'posterior' || approach === 'combined') {
            if (hasSevere || levels === '4+' || approach === 'combined') {
                recs.push({
                    name: 'Cortium\u00AE',
                    category: 'Universal OCT Fixation System',
                    recommended: true,
                    description: 'Universal occipital-cervical-thoracic (OCT) spinal fixation system designed for complex posterior stabilization of the occiput, cervical, and thoracic spine.',
                    features: [
                        'Occiput to upper thoracic fixation capability',
                        'Modular polyaxial screw system',
                        'Multiple rod options for complex deformity correction',
                        'Occipital plate for cranio-cervical extension',
                        'Compatible with lateral mass, pedicle, and transarticular screws'
                    ],
                    rationale: `Recommended for posterior fixation due to ${hasSevere ? 'severe deformity parameters requiring rigid posterior stabilization' : 'multi-level or combined construct requirements'}. ` +
                        `${approach === 'combined' ? 'Essential posterior supplementation for combined anterior-posterior approach. ' : ''}` +
                        `OCT capability allows cranial extension to occiput if cervical alignment requires occipitocervical fixation for CBVA correction.`,
                    link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
                });
            } else {
                recs.push({
                    name: 'neon3\u00AE',
                    category: 'Universal OCT Stabilization',
                    recommended: true,
                    description: 'Universal OCT spinal stabilization system for posterior cervical applications. Streamlined instrumentation for efficient posterior fusion.',
                    features: [
                        'Versatile posterior cervical-thoracic stabilization',
                        'Streamlined instrumentation',
                        'Compatible with lateral mass and pedicle screw fixation',
                        'Low-profile rod-screw connection'
                    ],
                    rationale: `Suitable for standard posterior cervical stabilization in this ${levels}-level case with mild-moderate deformity. ` +
                        `${boneQ !== 'normal' ? 'Consider bicortical screw purchase or cement augmentation given bone quality concerns.' : ''}`,
                    link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
                });
            }
        }

        return recs;
    },

    // ---- Lumbar Implant Recommendations ----
    lumbarRecs(patient, lumbar, results) {
        const recs = [];
        const approach = lumbar.approach;
        const levels = lumbar.levels;
        const osteotomy = lumbar.osteotomy;
        const boneQ = patient.boneQuality;
        const piLL = lumbar.pi - lumbar.ll;
        const severeSVA = lumbar.sva > 80;
        const isLongConstruct = levels === '3' || levels === '4+';
        const needsOsteotomy = osteotomy && osteotomy !== 'none';

        // 1. Posterior Fixation System
        const isMISCandidate = (levels === '1' || levels === '2') &&
            !needsOsteotomy && !severeSVA && approach === 'posterior';

        if (isMISCandidate) {
            recs.push({
                name: 'Momentum\u00AE MIS',
                category: 'MIS Posterior Fixation',
                recommended: true,
                description: 'Minimally invasive posterior spinal fixation system for percutaneous pedicle screw placement. Designed for reduced approach-related morbidity.',
                features: [
                    'Percutaneous minimally invasive approach',
                    'Reduced muscle dissection, blood loss, and tissue trauma',
                    'Polyaxial pedicle screw design',
                    'Rod reduction mechanism',
                    'Compatible with TLIF interbody placement'
                ],
                rationale: `MIS approach appropriate for ${levels}-level posterior fusion without osteotomy. Reduced approach-related morbidity, shorter hospital stay, and less blood loss compared to open approach. ` +
                    `${boneQ === 'osteoporosis' ? 'Consider fenestrated screws with cement augmentation (G21 V-STEADY) given osteoporotic bone.' : ''}` +
                    `${patient.bmi >= 35 ? ' MIS approach may be technically challenging with BMI ≥ 35; ensure adequate fluoroscopic visualization.' : ''}`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
            });
        } else {
            recs.push({
                name: 'Momentum\u00AE',
                category: 'Posterior Spinal Fixation',
                recommended: true,
                description: 'Comprehensive open posterior spinal fixation system for thoracolumbar stabilization. Full deformity correction instrumentation.',
                features: [
                    'Polyaxial and monoaxial screw options',
                    'Multiple rod diameters (5.5mm, 6.0mm) and materials (Ti, CoCr)',
                    'Cross-connectors for multi-rod construct rigidity',
                    'Reduction screws for spondylolisthesis correction',
                    'Compatible with deformity correction maneuvers (cantilever, in-situ bending)',
                    'Satellite (supplemental fixation point) connectors'
                ],
                rationale: `Open posterior fixation indicated for ${isLongConstruct ? 'long construct' : levels + '-level'} fusion. ` +
                    `${needsOsteotomy ? 'Rigid fixation essential for stabilization after ' + osteotomy.toUpperCase() + ' osteotomy. Consider CoCr rods for increased fatigue resistance across osteotomy site. ' : ''}` +
                    `${severeSVA ? 'Long construct fixation critical for SVA correction from ' + lumbar.sva + 'mm to target. ' : ''}` +
                    `${isLongConstruct ? 'Consider cross-connectors and multi-rod constructs for long fusions to reduce rod fracture risk. ' : ''}` +
                    `${boneQ === 'osteoporosis' ? 'Cement-augmented pedicle screws (G21 V-STEADY) strongly recommended in osteoporotic bone.' : ''}`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
            });
        }

        // 2. Interbody Device Selection
        if (approach === 'posterior') {
            recs.push({
                name: 'tezo\u00AE (TLIF/PLIF)',
                category: 'Posterior Lumbar Interbody Cage',
                recommended: true,
                description: 'Titanium cage system for thoracolumbar interbody fusion via posterior approach. Available in TLIF and PLIF configurations.',
                features: [
                    'Titanium construction for osseointegration',
                    'Lordotic angle options (0\u00B0 to 15\u00B0) for sagittal correction',
                    'TLIF: single large-footprint cage for unilateral insertion',
                    'PLIF: bilateral cage placement option',
                    'Multiple width and height combinations',
                    'Open architecture for bone graft incorporation'
                ],
                rationale: `Interbody fusion provides anterior column load sharing and structural support. ` +
                    `${piLL > 10 ? 'Lordotic cage configuration (10-15\u00B0) recommended to contribute to PI-LL correction (current mismatch: ' + piLL.toFixed(0) + '\u00B0). ' : ''}` +
                    `${boneQ !== 'normal' ? 'Titanium preferred over PEEK for endplate integration in ' + boneQ + ' bone. Consider larger footprint to distribute load and resist subsidence.' : ''}`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
            });
        } else if (approach === 'lateral') {
            recs.push({
                name: 'tezo\u00AE (Lateral / DLIF)',
                category: 'Lateral Lumbar Interbody Cage',
                recommended: true,
                description: 'Titanium cage for lateral lumbar interbody fusion (LLIF/DLIF). Large footprint spanning the ring apophysis for maximal endplate coverage and subsidence resistance.',
                features: [
                    'Large lateral footprint (48-52mm lengths)',
                    'Lordotic angle options (6\u00B0, 10\u00B0, 15\u00B0) for sagittal correction',
                    'Coronal and sagittal plane correction capability',
                    'Rests on bilateral ring apophysis for subsidence resistance',
                    'Indirect decompression via disc height and foraminal restoration',
                    'Multiple heights (7-13mm) for disc space matching'
                ],
                rationale: `Lateral approach provides indirect decompression and powerful lordotic correction through a retroperitoneal corridor. ` +
                    `Large footprint resists subsidence${boneQ !== 'normal' ? ' — critical in ' + boneQ + ' bone' : ''}. ` +
                    `${piLL > 10 ? 'Hyperlordotic cages (10-15\u00B0) across multiple levels significantly contribute to PI-LL correction.' : ''}` +
                    `${isLongConstruct ? ' Consider supplemental posterior fixation (Momentum) for multi-level lateral constructs.' : ''}`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
            });
        } else if (approach === 'anterior') {
            recs.push({
                name: 'tezo\u00AE (ALIF)',
                category: 'Anterior Lumbar Interbody Cage',
                recommended: true,
                description: 'Titanium interbody device for anterior lumbar interbody fusion. Provides maximum lordotic correction potential with large graft chamber.',
                features: [
                    'Large anterior footprint for endplate coverage',
                    'High lordotic angle options (up to 20\u00B0+)',
                    'Maximum disc space height restoration',
                    'Optimal access at L4-L5 and L5-S1',
                    'Large graft chamber for fusion biology'
                ],
                rationale: `ALIF provides the greatest lordotic correction per level (20-30\u00B0 at L5-S1). ` +
                    `${piLL > 15 ? 'Critical for addressing significant PI-LL mismatch of ' + piLL.toFixed(0) + '\u00B0. ' : ''}` +
                    `Supplemental posterior fixation (Momentum) recommended for rotational stability and to protect the interbody construct. ` +
                    `${patient.bmi >= 30 ? 'Retroperitoneal approach may be technically demanding with elevated BMI.' : ''}`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
            });
        } else if (approach === 'combined') {
            recs.push({
                name: 'tezo\u00AE (Multi-approach)',
                category: 'Interbody Cage System',
                recommended: true,
                description: 'Titanium interbody cage system with configurations for ALIF, TLIF, PLIF, and lateral approaches. Select configuration based on level-specific approach.',
                features: [
                    'Comprehensive cage family covering all approaches',
                    'Lordotic options across all configurations',
                    'Titanium construction throughout',
                    'Size range accommodates varied disc space anatomy'
                ],
                rationale: `Combined/staged approach: consider ALIF at L5-S1 for maximum lordotic correction, with TLIF or lateral cages at proximal levels. ` +
                    `3-column osteotomy levels typically do not receive interbody devices at the osteotomy site. ` +
                    `${piLL > 20 ? 'Significant PI-LL mismatch (' + piLL.toFixed(0) + '\u00B0) may require lordotic cages at every instrumented level in addition to osteotomy correction.' : ''}`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
            });
        }

        // 3. Vertebral Body Replacement
        if (osteotomy === 'vcr' || patient.pathology === 'trauma' || patient.pathology === 'tumor') {
            recs.push({
                name: 'Solidity\u00AE',
                category: 'Expandable VBR (T1-L5)',
                recommended: osteotomy === 'vcr' || patient.pathology === 'trauma' || patient.pathology === 'tumor',
                description: 'Expandable vertebral body replacement system for thoracolumbar reconstruction (T1-L5). Modular platform with 625+ angulation plate configurations and continuous gear-driven expansion.',
                features: [
                    '625+ unique angulation plate configurations in one set',
                    'Continuous gear-driven expansion for precise height adjustment (13-72mm)',
                    '360\u00B0 assembly orientation — compatible with any surgical approach',
                    'Self-locking mechanism (no additional set screw required)',
                    'Replaceable angulation plates even after assembly and in-situ',
                    'Low-profile inserter with tactile feedback',
                    'Integrated lordotic correction capability'
                ],
                rationale: `${osteotomy === 'vcr' ? 'Essential for anterior column reconstruction after vertebral column resection. In-situ expandable design allows precise height restoration and sagittal correction. ' : ''}` +
                    `${patient.pathology === 'trauma' ? 'Indicated for vertebral body reconstruction following thoracolumbar burst fracture. ' : ''}` +
                    `${patient.pathology === 'tumor' ? 'Indicated for anterior column reconstruction after oncologic corpectomy. ' : ''}` +
                    `Self-locking mechanism is particularly advantageous in ${boneQ !== 'normal' ? 'compromised bone quality where set screw tightening may be unreliable' : 'maintaining intra-operative correction'}. ` +
                    `625+ angulation plate options allow precise matching to patient anatomy.`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/vertebral-body-replacement/solidity'
            });
        }

        // Also recommend obelisc for VBR cases as an alternative
        if (osteotomy === 'vcr' || patient.pathology === 'tumor') {
            recs.push({
                name: 'obelisc\u00AE',
                category: 'Vertebral Body Replacement',
                recommended: false,
                description: 'Expandable vertebral body replacement system for thoracolumbar corpectomy reconstruction. Alternative VBR platform.',
                features: [
                    'Expandable corpectomy implant',
                    'Thoracic and lumbar spine coverage (T1-L5)',
                    'In-situ height adjustment',
                    'Established clinical track record'
                ],
                rationale: `Alternative VBR option. Consider based on specific anatomic requirements and surgeon preference versus Solidity system.`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/vertebral-body-replacement/obelisc'
            });
        }

        // 4. Cement augmentation
        if (boneQ === 'osteoporosis' || (boneQ === 'osteopenia' && isLongConstruct)) {
            recs.push({
                name: 'G21 V-STEADY',
                category: 'High Viscosity Bone Cement',
                recommended: boneQ === 'osteoporosis',
                description: 'High viscosity PMMA bone cement system for vertebral augmentation (vertebroplasty/kyphoplasty) and pedicle screw cement augmentation in osteoporotic bone.',
                features: [
                    'High viscosity formulation reduces extravasation/leakage risk',
                    'Pedicle screw fenestrated screw augmentation',
                    'Vertebroplasty and kyphoplasty capability',
                    'Controlled delivery system with working time indicators',
                    'Radiopaque for fluoroscopic visualization'
                ],
                rationale: `${boneQ === 'osteoporosis' ? 'Strongly recommended' : 'Consider'} for pedicle screw cement augmentation in ${boneQ} bone. ` +
                    `Screw pullout force increases 2-3x with cement augmentation. ` +
                    `${isLongConstruct ? 'Critical in long constructs where screw failure at any level can lead to catastrophic construct failure. ' : ''}` +
                    `${patient.age >= 65 ? 'Age ≥65 compounds osteoporotic bone risk. ' : ''}` +
                    `High viscosity formulation of V-STEADY reduces cement extravasation risk, which is important near neural structures.`,
                link: 'https://www.ulrichmedicalusa.com/spinal-systems/products/'
            });
        }

        return recs;
    },

    // Build patient factor notes
    buildPatientFactorNotes(patient) {
        const notes = [];
        const boneQ = patient.boneQuality;
        const age = patient.age;
        const bmi = patient.bmi;
        const smoking = patient.smoking;

        // Bone quality
        if (boneQ === 'osteoporosis') {
            notes.push(UI.factorNote('critical', 'Osteoporotic Bone (T-score ≤ -2.5)',
                'High risk for screw loosening, cage subsidence, and proximal junctional failure (PJK/PJF). ' +
                'Cement-augmented pedicle screws (G21 V-STEADY) recommended. Titanium interbody devices preferred over PEEK for enhanced endplate purchase. ' +
                'Larger footprint cages reduce subsidence risk. Consider medical optimization: vitamin D, calcium, bisphosphonate holiday if applicable, anabolic agents (teriparatide).'));
        } else if (boneQ === 'osteopenia') {
            notes.push(UI.factorNote('caution', 'Osteopenic Bone (T-score -1.0 to -2.5)',
                'Moderate risk for implant-related complications. Consider cement augmentation for long constructs (≥3 levels). ' +
                'Titanium implant surfaces (Flux-C, uCerv Ti, tezo) may provide better fixation than PEEK. Optimize bone health pre-operatively.'));
        } else if (boneQ === 'normal') {
            notes.push(UI.factorNote('ok', 'Normal Bone Quality (T-score ≥ -1.0)',
                'Standard implant fixation expected to be adequate. Both PEEK and titanium interbody options are appropriate based on surgeon preference.'));
        }

        // BMI
        if (bmi >= 40) {
            notes.push(UI.factorNote('critical', `BMI ${bmi} (Class III Obesity)`,
                'Substantially increased mechanical load on construct. Strongly consider larger diameter rods (6.0mm), cross-connectors, and multi-rod constructs. ' +
                'Elevated risk of wound complications, pseudarthrosis, and hardware failure. Consider weight optimization pre-operatively if feasible. ' +
                'MIS approaches may reduce wound morbidity but can be technically challenging.'));
        } else if (bmi >= 35) {
            notes.push(UI.factorNote('critical', `BMI ${bmi} (Class II Obesity)`,
                'Increased mechanical load on construct. Consider larger diameter rods, cross-connectors, and extended fixation points. ' +
                'Higher risk of wound complications and pseudarthrosis. MIS approach may reduce wound morbidity if technically feasible.'));
        } else if (bmi >= 30) {
            notes.push(UI.factorNote('caution', `BMI ${bmi} (Class I Obesity)`,
                'Moderately increased load on implants. Standard constructs generally sufficient but consider supplementary fixation for long constructs.'));
        }

        // Age
        if (age >= 75) {
            notes.push(UI.factorNote('caution', `Age ${age} (≥75)`,
                'Age-adjusted alignment targets applied (more permissive per Lafage). Frailty assessment (CCI, mFI) recommended. ' +
                'Under-correction may be better tolerated than aggressive correction — balance alignment goals with surgical morbidity. ' +
                'Consider staged procedures, limited correction strategies, or hybrid MIS/open approaches to reduce operative time and blood loss.'));
        } else if (age >= 65) {
            notes.push(UI.factorNote('caution', `Age ${age} (65-74)`,
                'Moderately adjusted alignment targets. Balance correction goals against surgical risk and comorbidity burden. Bone quality optimization important.'));
        }

        // Smoking
        if (smoking === 'current') {
            notes.push(UI.factorNote('critical', 'Active Smoker',
                'Significantly elevated pseudarthrosis risk (up to 5x non-smoker rate). Strongly recommend smoking cessation ≥6 weeks pre-operatively. ' +
                'Consider biologic adjuncts (BMP-2) for fusion augmentation. Titanium interbody surfaces may promote more reliable fusion than PEEK. ' +
                'Smoking also impairs wound healing, increasing surgical site infection risk.'));
        } else if (smoking === 'former') {
            notes.push(UI.factorNote('caution', 'Former Smoker',
                'Residual elevation in pseudarthrosis risk, dependent on duration and recency of cessation. Confirm continued abstinence pre-operatively.'));
        }

        // Previous surgery
        if (patient.prevSurgery && patient.prevSurgery !== 'none') {
            notes.push(UI.factorNote('caution', `Previous Spine Surgery (${patient.prevSurgery})`,
                'Revision surgery increases complexity: altered anatomy, scar tissue, potential hardware removal. ' +
                'Assess prior construct integrity, fusion status, and adjacent segment disease. May require different approach or extended fixation.'));
        }

        return notes.join('');
    },

    // Render implant recommendations into the DOM (Step 5)
    render(recs, patient) {
        const container = document.getElementById('implantRecsContainer');
        if (recs.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); padding:20px;">No implant recommendations generated. Ensure surgical region and approach are specified.</p>';
        } else {
            container.innerHTML = recs.map(r => UI.implantCard(r)).join('');
        }

        document.getElementById('patientFactorNotes').innerHTML = this.buildPatientFactorNotes(patient);
    }
};
