// =============================================
// SpineAlign — Correction Target Computation
// =============================================

const Corrections = {

    // Main computation entry point
    compute(patientData, cervicalData, lumbarData) {
        const results = { cervical: null, lumbar: null };

        if (patientData.regionCervical && !isNaN(cervicalData.cl)) {
            results.cervical = Cervical.computeTargets(cervicalData, patientData.age);
        }

        if (patientData.regionLumbar && !isNaN(lumbarData.pi)) {
            results.lumbar = Lumbar.computeTargets(lumbarData, patientData.age);
        }

        return results;
    },

    // Render correction targets into the DOM (Step 4)
    render(results, patientData) {
        // ---- Cervical ----
        const cervSection = document.getElementById('cervicalResults');
        if (results.cervical) {
            cervSection.style.display = 'block';
            const grid = document.getElementById('cervResultsGrid');
            const tbody = document.getElementById('cervSummaryBody');
            grid.innerHTML = results.cervical.params.map(p => UI.paramCard(p)).join('');
            tbody.innerHTML = results.cervical.params.map(p => UI.summaryRow(p)).join('');
        } else {
            cervSection.style.display = 'none';
        }

        // ---- Lumbar ----
        const lumbarSection = document.getElementById('lumbarResults');
        if (results.lumbar) {
            lumbarSection.style.display = 'block';
            const grid = document.getElementById('lumbarResultsGrid');
            const tbody = document.getElementById('lumbarSummaryBody');
            grid.innerHTML = results.lumbar.params.map(p => UI.paramCard(p)).join('');
            tbody.innerHTML = results.lumbar.params.map(p => UI.summaryRow(p)).join('');
        } else {
            lumbarSection.style.display = 'none';
        }

        // Age note
        document.getElementById('ageNote').textContent =
            `Targets computed for age ${patientData.age} using age-adjusted Schwab-SRS/Lafage thresholds. ` +
            `Bone quality: ${patientData.boneQuality || 'not specified'}. BMI: ${patientData.bmi || 'not specified'}. ` +
            `Patient-specific anatomy and comorbidities must guide final correction goals.`;
    },

    // Overall deformity severity score (used by implant engine)
    getOverallSeverity(results) {
        const allParams = [
            ...(results.cervical ? results.cervical.params : []),
            ...(results.lumbar ? results.lumbar.params : [])
        ];

        if (allParams.length === 0) return 'none';

        const hasSevere = allParams.some(p => p.severity.text.includes('Severe'));
        const hasModerate = allParams.some(p => p.severity.text.includes('Moderate'));
        const hasMild = allParams.some(p => p.severity.text.includes('Mild'));

        if (hasSevere) return 'severe';
        if (hasModerate) return 'moderate';
        if (hasMild) return 'mild';
        return 'normal';
    }
};
