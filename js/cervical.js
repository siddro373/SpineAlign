// =============================================
// SpineAlign — Cervical Deformity Module
// =============================================

const Cervical = {

    // Collect cervical form data
    collectData() {
        return {
            cl:       parseFloat(document.getElementById('cl').value),
            csva:     parseFloat(document.getElementById('csva').value),
            t1s:      parseFloat(document.getElementById('t1s').value),
            cbva:     parseFloat(document.getElementById('cbva').value),
            approach: document.getElementById('cervApproach').value,
            levels:   document.getElementById('cervLevels').value
        };
    },

    // Compute correction targets for cervical spine
    // References:
    //   - CL target: T1S - CL should be 16.5° ± 12° (Hyun et al., Spine 2017)
    //   - cSVA: <40mm correlates with better HRQOL (Tang et al., Spine 2012)
    //   - T1S-CL mismatch normative: 16°–26° (Lee et al., Spine 2012)
    //   - CBVA: ±10° neutral horizontal gaze (Suk et al., Spine 2003)
    computeTargets(cervData, age) {
        const t1s = cervData.t1s || 25;
        const params = [];

        // 1. Cervical Lordosis
        // Target CL: CL should match T1S within the T1S-CL relationship
        // CL ≈ T1S - 16.5° (as lordosis, so negative)
        const targetCL = -(t1s - 16.5);
        const clDiff = cervData.cl - targetCL;
        params.push({
            id: 'cl',
            label: 'Cervical Lordosis (CL)',
            current: cervData.cl,
            unit: '°',
            target: `${targetCL.toFixed(1)}°`,
            targetVal: targetCL,
            correction: Math.abs(clDiff) < 3 ? 'Within target' : `${clDiff.toFixed(1)}° correction needed`,
            severity: this.classifyCL(cervData.cl, targetCL),
            range: `Target: CL ≈ T1S(${t1s}°) − 16.5° = ${targetCL.toFixed(1)}°`
        });

        // 2. Cervical SVA
        // Age-adjusted cSVA threshold
        // Younger patients: stricter target ~17-20mm
        // Elderly: more permissive, up to 30-40mm
        let targetCSVA;
        if (age < 45) targetCSVA = 17;
        else if (age < 55) targetCSVA = 20;
        else if (age < 65) targetCSVA = 25;
        else if (age < 75) targetCSVA = 30;
        else targetCSVA = 35;

        params.push({
            id: 'csva',
            label: 'Cervical SVA (cSVA)',
            current: cervData.csva,
            unit: 'mm',
            target: `< ${targetCSVA} mm`,
            targetVal: targetCSVA,
            correction: cervData.csva > targetCSVA
                ? `${(cervData.csva - targetCSVA).toFixed(1)} mm reduction needed`
                : 'Within target',
            severity: this.classifyCSVA(cervData.csva, age),
            range: `Threshold < 40mm (HRQOL); age-adjusted target: ${targetCSVA}mm`
        });

        // 3. T1 Slope – CL Mismatch
        // T1S-CL = T1S - |CL|. Normative range 16°–26°.
        // Mismatch > 26° associated with poor outcomes.
        const t1sCL = cervData.t1s - Math.abs(cervData.cl);
        let t1sCLCorrection;
        if (t1sCL > 26) t1sCLCorrection = `${(t1sCL - 26).toFixed(1)}° excess — increase lordosis`;
        else if (t1sCL < 16) t1sCLCorrection = `${(16 - t1sCL).toFixed(1)}° deficit`;
        else t1sCLCorrection = 'Within target';

        params.push({
            id: 't1s_cl',
            label: 'T1S – CL Mismatch',
            current: t1sCL.toFixed(1),
            unit: '°',
            target: '16° – 26°',
            targetVal: 21,
            correction: t1sCLCorrection,
            severity: this.classifyT1SCL(t1sCL),
            range: `T1S(${cervData.t1s}°) − |CL|(${Math.abs(cervData.cl).toFixed(1)}°) = ${t1sCL.toFixed(1)}°`
        });

        // 4. Chin-Brow Vertical Angle
        // Target: -10° to +10° for neutral gaze
        // Positive CBVA = downward gaze, Negative = upward gaze
        let cbvaCorrection;
        if (Math.abs(cervData.cbva) <= 10) cbvaCorrection = 'Within target';
        else if (cervData.cbva > 10) cbvaCorrection = `${(cervData.cbva - 10).toFixed(1)}° extension correction needed`;
        else cbvaCorrection = `${(Math.abs(cervData.cbva) - 10).toFixed(1)}° flexion correction needed`;

        params.push({
            id: 'cbva',
            label: 'Chin-Brow Vertical Angle (CBVA)',
            current: cervData.cbva,
            unit: '°',
            target: '−10° to +10°',
            targetVal: 0,
            correction: cbvaCorrection,
            severity: this.classifyCBVA(cervData.cbva),
            range: 'Neutral horizontal gaze window'
        });

        return {
            targetCL,
            targetCSVA,
            t1sCL,
            params
        };
    },

    // ---- Classification Functions ----

    classifyCL(cl, target) {
        const diff = Math.abs(cl - target);
        if (diff < 5)  return { text: 'Normal', cls: 'status-normal' };
        if (diff < 15) return { text: 'Mild', cls: 'status-mild' };
        if (diff < 25) return { text: 'Moderate', cls: 'status-moderate' };
        return { text: 'Severe', cls: 'status-severe' };
    },

    classifyCSVA(csva, age) {
        // Absolute thresholds with some age adjustment
        if (csva < 20) return { text: 'Normal', cls: 'status-normal' };
        if (csva < 40) return { text: age >= 65 ? 'Normal' : 'Mild', cls: age >= 65 ? 'status-normal' : 'status-mild' };
        if (csva < 60) return { text: 'Moderate', cls: 'status-moderate' };
        return { text: 'Severe', cls: 'status-severe' };
    },

    classifyT1SCL(mismatch) {
        if (mismatch >= 16 && mismatch <= 26) return { text: 'Normal', cls: 'status-normal' };
        const diff = mismatch > 26 ? mismatch - 26 : 16 - mismatch;
        if (diff < 8)  return { text: 'Mild', cls: 'status-mild' };
        if (diff < 15) return { text: 'Moderate', cls: 'status-moderate' };
        return { text: 'Severe', cls: 'status-severe' };
    },

    classifyCBVA(cbva) {
        const abs = Math.abs(cbva);
        if (abs <= 10) return { text: 'Normal', cls: 'status-normal' };
        if (abs <= 17) return { text: 'Mild', cls: 'status-mild' };
        if (abs <= 25) return { text: 'Moderate', cls: 'status-moderate' };
        return { text: 'Severe', cls: 'status-severe' };
    }
};
