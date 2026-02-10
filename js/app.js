// =============================================
// SpineAlign — App Controller
// State management, navigation, case save/load, export
// =============================================

const App = {
    currentStep: 1,
    patientData: {},
    cervicalData: {},
    lumbarData: {},
    correctionResults: { cervical: null, lumbar: null },
    implantRecs: [],

    STORAGE_KEY: 'spinealign_cases',

    // =============================================
    // NAVIGATION
    // =============================================
    goToStep(step) {
        document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`step-${step}`).classList.add('active');
        document.getElementById(`step-btn-${step}`).classList.add('active');
        this.currentStep = step;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    markStepCompleted(step) {
        document.getElementById(`step-btn-${step}`).classList.add('completed');
    },

    // =============================================
    // STEP 1: Patient Info
    // =============================================
    savePatientAndNext() {
        this.patientData = {
            id:             document.getElementById('patientId').value || 'Unspecified',
            age:            parseFloat(document.getElementById('age').value),
            bmi:            parseFloat(document.getElementById('bmi').value),
            sex:            document.getElementById('sex').value,
            boneQuality:    document.getElementById('boneQuality').value,
            pathology:      document.getElementById('pathology').value,
            regionCervical: document.getElementById('regionCervical').checked,
            regionLumbar:   document.getElementById('regionLumbar').checked,
            smoking:        document.getElementById('smoking').value,
            prevSurgery:    document.getElementById('prevSurgery').value
        };

        if (!this.patientData.age || !this.patientData.bmi || !this.patientData.boneQuality) {
            UI.toast('Please fill in Age, BMI, and Bone Quality.', 'error');
            return;
        }
        if (!this.patientData.regionCervical && !this.patientData.regionLumbar) {
            UI.toast('Please select at least one surgical region.', 'error');
            return;
        }

        this.markStepCompleted(1);
        UI.toast('Patient information saved.', 'success');

        if (this.patientData.regionCervical) {
            this.goToStep(2);
        } else {
            this.goToStep(3);
        }
    },

    // =============================================
    // STEP 2: Cervical Parameters
    // =============================================
    saveCervicalAndNext() {
        this.cervicalData = Cervical.collectData();

        if (isNaN(this.cervicalData.cl) || isNaN(this.cervicalData.csva) ||
            isNaN(this.cervicalData.t1s) || isNaN(this.cervicalData.cbva)) {
            UI.toast('Please fill in all four cervical parameters.', 'error');
            return;
        }

        this.markStepCompleted(2);

        if (this.patientData.regionLumbar) {
            this.goToStep(3);
        } else {
            this.computeAndShowCorrections();
        }
    },

    // =============================================
    // STEP 3: Lumbar Parameters → Compute
    // =============================================
    computeAndShowCorrections() {
        if (this.patientData.regionLumbar) {
            this.lumbarData = Lumbar.collectData();
            if (isNaN(this.lumbarData.pi) || isNaN(this.lumbarData.ll) || isNaN(this.lumbarData.sva)) {
                UI.toast('Please fill in PI, LL, and SVA at minimum.', 'error');
                return;
            }
            this.markStepCompleted(3);
        }

        // Compute correction targets
        this.correctionResults = Corrections.compute(
            this.patientData, this.cervicalData, this.lumbarData
        );

        // Render
        Corrections.render(this.correctionResults, this.patientData);
        this.goToStep(4);
    },

    // =============================================
    // STEP 5: Implant Recommendations
    // =============================================
    generateImplantRecs() {
        this.markStepCompleted(4);
        this.implantRecs = Implants.recommend(
            this.patientData, this.cervicalData, this.lumbarData, this.correctionResults
        );
        Implants.render(this.implantRecs, this.patientData);
        this.goToStep(5);
    },

    // =============================================
    // CASE SAVE / LOAD (localStorage)
    // =============================================
    getSavedCases() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    },

    saveCase() {
        const cases = this.getSavedCases();
        const caseData = {
            id: Date.now(),
            savedAt: new Date().toISOString(),
            patient: this.patientData,
            cervical: this.cervicalData,
            lumbar: this.lumbarData,
            label: `${this.patientData.id} — Age ${this.patientData.age}, BMI ${this.patientData.bmi}`
        };
        cases.unshift(caseData);
        // Keep last 50 cases
        if (cases.length > 50) cases.length = 50;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cases));
        UI.toast('Case saved successfully.', 'success');
        this.renderCaseList();
    },

    loadCase(caseId) {
        const cases = this.getSavedCases();
        const c = cases.find(x => x.id === caseId);
        if (!c) { UI.toast('Case not found.', 'error'); return; }

        // Populate patient fields
        this.patientData = c.patient;
        document.getElementById('patientId').value = c.patient.id || '';
        document.getElementById('age').value = c.patient.age || '';
        document.getElementById('bmi').value = c.patient.bmi || '';
        document.getElementById('sex').value = c.patient.sex || '';
        document.getElementById('boneQuality').value = c.patient.boneQuality || '';
        document.getElementById('pathology').value = c.patient.pathology || '';
        document.getElementById('regionCervical').checked = !!c.patient.regionCervical;
        document.getElementById('regionLumbar').checked = !!c.patient.regionLumbar;
        document.getElementById('smoking').value = c.patient.smoking || '';
        document.getElementById('prevSurgery').value = c.patient.prevSurgery || '';

        // Populate cervical fields
        if (c.cervical) {
            this.cervicalData = c.cervical;
            if (c.cervical.cl != null) document.getElementById('cl').value = c.cervical.cl;
            if (c.cervical.csva != null) document.getElementById('csva').value = c.cervical.csva;
            if (c.cervical.t1s != null) document.getElementById('t1s').value = c.cervical.t1s;
            if (c.cervical.cbva != null) document.getElementById('cbva').value = c.cervical.cbva;
            if (c.cervical.approach) document.getElementById('cervApproach').value = c.cervical.approach;
            if (c.cervical.levels) document.getElementById('cervLevels').value = c.cervical.levels;
        }

        // Populate lumbar fields
        if (c.lumbar) {
            this.lumbarData = c.lumbar;
            if (c.lumbar.pi != null) document.getElementById('pi').value = c.lumbar.pi;
            if (c.lumbar.ll != null) document.getElementById('ll').value = c.lumbar.ll;
            if (c.lumbar.sva != null) document.getElementById('sva').value = c.lumbar.sva;
            if (c.lumbar.pt != null) document.getElementById('pt').value = c.lumbar.pt;
            if (c.lumbar.approach) document.getElementById('lumbarApproach').value = c.lumbar.approach;
            if (c.lumbar.levels) document.getElementById('lumbarLevels').value = c.lumbar.levels;
            if (c.lumbar.osteotomy) document.getElementById('osteotomy').value = c.lumbar.osteotomy;
            Lumbar.updatePiLlDisplay();
        }

        UI.closeModal('caseModal');
        UI.toast('Case loaded.', 'success');
        this.goToStep(1);
    },

    deleteCase(caseId) {
        let cases = this.getSavedCases();
        cases = cases.filter(x => x.id !== caseId);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cases));
        UI.toast('Case deleted.', 'success');
        this.renderCaseList();
    },

    renderCaseList() {
        const list = document.getElementById('caseList');
        if (!list) return;
        const cases = this.getSavedCases();
        if (cases.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted); padding:12px; font-size:13px;">No saved cases.</p>';
            return;
        }
        list.innerHTML = cases.map(c => `
            <div class="case-item" onclick="App.loadCase(${c.id})">
                <div class="case-item-info">
                    <span class="case-item-id">${c.label || c.patient.id}</span>
                    <span class="case-item-meta">${UI.formatDate(c.savedAt)} · ${c.patient.boneQuality || ''} · ${[c.patient.regionCervical ? 'Cervical' : '', c.patient.regionLumbar ? 'Lumbar' : ''].filter(Boolean).join(' + ')}</span>
                </div>
                <div class="case-item-actions">
                    <button class="btn-icon" title="Delete" onclick="event.stopPropagation(); App.deleteCase(${c.id});">&times;</button>
                </div>
            </div>
        `).join('');
    },

    // =============================================
    // EXPORT
    // =============================================
    exportJSON() {
        const data = {
            exportedAt: new Date().toISOString(),
            application: 'SpineAlign — Ulrich Medical Surgical Planning',
            patient: this.patientData,
            cervicalParameters: this.cervicalData,
            lumbarParameters: this.lumbarData,
            correctionTargets: {
                cervical: this.correctionResults.cervical ? this.correctionResults.cervical.params.map(p => ({
                    parameter: p.label,
                    current: p.current + ' ' + p.unit,
                    target: p.target,
                    correction: p.correction,
                    severity: p.severity.text
                })) : null,
                lumbar: this.correctionResults.lumbar ? this.correctionResults.lumbar.params.map(p => ({
                    parameter: p.label,
                    current: p.current + ' ' + p.unit,
                    target: p.target,
                    correction: p.correction,
                    severity: p.severity.text
                })) : null
            },
            implantRecommendations: this.implantRecs.map(r => ({
                name: r.name,
                category: r.category,
                recommended: r.recommended,
                rationale: r.rationale
            }))
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SpineAlign_${this.patientData.id || 'case'}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast('Case exported as JSON.', 'success');
    },

    exportCSV() {
        const rows = [['Section', 'Parameter', 'Current', 'Target', 'Correction', 'Severity']];

        // Patient info
        rows.push(['Patient', 'ID', this.patientData.id, '', '', '']);
        rows.push(['Patient', 'Age', this.patientData.age, '', '', '']);
        rows.push(['Patient', 'BMI', this.patientData.bmi, '', '', '']);
        rows.push(['Patient', 'Bone Quality', this.patientData.boneQuality, '', '', '']);
        rows.push(['Patient', 'Smoking', this.patientData.smoking || '', '', '', '']);

        // Cervical
        if (this.correctionResults.cervical) {
            this.correctionResults.cervical.params.forEach(p => {
                rows.push(['Cervical', p.label, p.current + ' ' + p.unit, p.target, p.correction, p.severity.text]);
            });
        }

        // Lumbar
        if (this.correctionResults.lumbar) {
            this.correctionResults.lumbar.params.forEach(p => {
                rows.push(['Lumbar', p.label, p.current + ' ' + p.unit, p.target, p.correction, p.severity.text]);
            });
        }

        // Implants
        this.implantRecs.forEach(r => {
            rows.push(['Implant', r.name, r.category, r.recommended ? 'Recommended' : 'Consider', '', '']);
        });

        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SpineAlign_${this.patientData.id || 'case'}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast('Case exported as CSV.', 'success');
    },

    printReport() {
        window.print();
    },

    // =============================================
    // RESET
    // =============================================
    resetAll() {
        if (!confirm('Start a new case? All current data will be cleared.')) return;
        document.querySelectorAll('input[type="number"], input[type="text"]').forEach(i => i.value = '');
        document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
        document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('completed'));
        document.getElementById('regionCervical').checked = true;
        document.getElementById('regionLumbar').checked = true;
        document.getElementById('piLlValue').textContent = '--';
        document.getElementById('piLlDisplay').className = 'param-card';
        this.patientData = {};
        this.cervicalData = {};
        this.lumbarData = {};
        this.correctionResults = { cervical: null, lumbar: null };
        this.implantRecs = [];
        this.goToStep(1);
    },

    // =============================================
    // INITIALIZATION
    // =============================================
    init() {
        // PI-LL auto-calculation listeners
        document.getElementById('pi').addEventListener('input', () => Lumbar.updatePiLlDisplay());
        document.getElementById('ll').addEventListener('input', () => Lumbar.updatePiLlDisplay());

        // Render saved case list
        this.renderCaseList();
    }
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => App.init());
