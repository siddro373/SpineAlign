// =============================================
// SpineAlign — Lumbar Deformity Module
// =============================================

const Lumbar = {

    // Collect lumbar form data
    collectData() {
        return {
            pi:       parseFloat(document.getElementById('pi').value),
            ll:       parseFloat(document.getElementById('ll').value),
            sva:      parseFloat(document.getElementById('sva').value),
            pt:       parseFloat(document.getElementById('pt').value),
            approach: document.getElementById('lumbarApproach').value,
            levels:   document.getElementById('lumbarLevels').value,
            osteotomy: document.getElementById('osteotomy').value
        };
    },

    // Auto-calculate PI-LL mismatch for real-time display
    updatePiLlDisplay() {
        const pi = parseFloat(document.getElementById('pi').value);
        const ll = parseFloat(document.getElementById('ll').value);
        const display = document.getElementById('piLlValue');
        const card = document.getElementById('piLlDisplay');

        if (!isNaN(pi) && !isNaN(ll)) {
            const mismatch = pi - ll;
            display.textContent = mismatch.toFixed(1) + '°';
            card.className = 'param-card';
            if (Math.abs(mismatch) <= 10) card.classList.add('success');
            else if (Math.abs(mismatch) <= 20) card.classList.add('warning');
            else card.classList.add('danger');
        } else {
            display.textContent = '--';
            card.className = 'param-card';
        }
    },

    // Compute correction targets for lumbar spine
    // References:
    //   - Schwab SRS-Schwab Classification (Schwab et al., Spine 2012)
    //   - Age-adjusted targets (Lafage et al., Spine 2016; Yilgor et al. GAP score, Spine 2017)
    //   - PI-LL: Target LL = PI ± 10° (Schwab, classic); age-adjusted per Lafage
    //   - SVA: < 50mm (classic threshold); age-adjusted
    //   - PT: < 20° (classic); age-adjusted
    computeTargets(lumbarData, age) {
        const params = [];
        const piLL = lumbarData.pi - lumbarData.ll;

        // Age-adjusted targets per Lafage / Schwab-SRS
        let targetSVA, targetPT, targetPILL;
        if (age < 45) {
            targetSVA = 25; targetPT = 12; targetPILL = 0;
        } else if (age < 55) {
            targetSVA = 30; targetPT = 15; targetPILL = 5;
        } else if (age < 65) {
            targetSVA = 40; targetPT = 20; targetPILL = 10;
        } else if (age < 75) {
            targetSVA = 50; targetPT = 22; targetPILL = 12;
        } else {
            targetSVA = 60; targetPT = 25; targetPILL = 15;
        }

        const targetLL = lumbarData.pi - targetPILL;

        // 1. Sagittal Vertical Axis
        params.push({
            id: 'sva',
            label: 'Sagittal Vertical Axis (SVA)',
            current: lumbarData.sva,
            unit: 'mm',
            target: `< ${targetSVA} mm`,
            targetVal: targetSVA,
            correction: lumbarData.sva > targetSVA
                ? `${(lumbarData.sva - targetSVA).toFixed(1)} mm reduction needed`
                : 'Within target',
            severity: this.classifySVA(lumbarData.sva, targetSVA),
            range: `Age-adjusted threshold (Schwab-SRS/Lafage)`
        });

        // 2. PI-LL Mismatch
        // Classic: PI-LL < 10° is normal
        // Schwab grading: + (10-20°), ++ (>20°)
        params.push({
            id: 'pill',
            label: 'PI-LL Mismatch',
            current: piLL.toFixed(1),
            unit: '°',
            target: `< ${targetPILL}°`,
            targetVal: targetPILL,
            correction: piLL > targetPILL
                ? `${(piLL - targetPILL).toFixed(1)}° of additional lordosis needed (target LL ≈ ${targetLL.toFixed(0)}°)`
                : 'Within target',
            severity: this.classifyPILL(piLL, targetPILL),
            range: `PI = ${lumbarData.pi}° | Current LL = ${lumbarData.ll}° | Target LL ≈ ${targetLL.toFixed(0)}°`
        });

        // 3. Pelvic Tilt
        // Elevated PT indicates compensatory retroversion
        params.push({
            id: 'pt',
            label: 'Pelvic Tilt (PT)',
            current: lumbarData.pt,
            unit: '°',
            target: `< ${targetPT}°`,
            targetVal: targetPT,
            correction: lumbarData.pt > targetPT
                ? `${(lumbarData.pt - targetPT).toFixed(1)}° reduction expected with lordosis restoration`
                : 'Within target',
            severity: this.classifyPT(lumbarData.pt, targetPT),
            range: `Compensatory retroversion indicator; normalizes with LL correction`
        });

        return {
            piLL,
            targetSVA,
            targetPT,
            targetPILL,
            targetLL,
            params
        };
    },

    // ---- Classification Functions ----

    // SVA Schwab classification
    classifySVA(sva, target) {
        if (sva <= target) return { text: 'Normal', cls: 'status-normal' };
        const excess = sva - target;
        if (excess < 25) return { text: 'Mild (Schwab +)', cls: 'status-mild' };
        if (excess < 60) return { text: 'Moderate (Schwab ++)', cls: 'status-moderate' };
        return { text: 'Severe (Schwab +++)', cls: 'status-severe' };
    },

    // PI-LL Schwab classification
    classifyPILL(pill, target) {
        if (pill <= target) return { text: 'Matched', cls: 'status-normal' };
        const excess = pill - target;
        if (excess < 10) return { text: 'Mild (Schwab +)', cls: 'status-mild' };
        if (excess < 20) return { text: 'Moderate (Schwab ++)', cls: 'status-moderate' };
        return { text: 'Severe (Schwab +++)', cls: 'status-severe' };
    },

    // PT classification
    classifyPT(pt, target) {
        if (pt <= target) return { text: 'Normal', cls: 'status-normal' };
        const excess = pt - target;
        if (excess < 8) return { text: 'Mild', cls: 'status-mild' };
        if (excess < 15) return { text: 'Moderate', cls: 'status-moderate' };
        return { text: 'Severe', cls: 'status-severe' };
    }
};
