// =============================================
// SpineAlign — App Controller
// Screen navigation, upload, annotation bridge,
// case save/load, export
// =============================================

const App = {
    currentScreen: 'welcome',
    patientData: {},
    cervicalData: {},
    lumbarData: {},
    correctionResults: { cervical: null, lumbar: null },
    implantRecs: [],

    // Region selection state
    regionCervical: false,
    regionLumbar: false,

    // Upload state
    uploadedImages: { lateral: null, ap: null },

    // Track where user came from for back navigation
    cameFromAnnotation: false,

    STORAGE_KEY: 'spinealign_cases',

    // =============================================
    // NAVIGATION
    // =============================================
    goToScreen(name) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        // Show target screen
        const el = document.getElementById(`screen-${name}`);
        if (el) el.classList.add('active');

        this.currentScreen = name;

        // Show/hide flow progress breadcrumb
        const flow = document.getElementById('flowProgress');
        if (flow) {
            flow.style.display = name === 'welcome' ? 'none' : 'flex';
        }

        // Update breadcrumb active state
        this.updateBreadcrumb(name);

        // Show/hide manual sections based on region
        if (name === 'manual') {
            this.showManualSections();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateBreadcrumb(activeScreen) {
        document.querySelectorAll('.flow-step').forEach(step => {
            step.classList.remove('active', 'completed');
            const screen = step.dataset.screen;
            if (screen === activeScreen) {
                step.classList.add('active');
            }
        });
    },

    // =============================================
    // WELCOME SCREEN
    // =============================================
    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning, Dr.';
        if (hour < 17) return 'Good afternoon, Dr.';
        return 'Good evening, Dr.';
    },

    // =============================================
    // PATIENT INFO
    // =============================================
    savePatientAndNext() {
        this.patientData = {
            id:          document.getElementById('patientId').value || 'Unspecified',
            age:         parseFloat(document.getElementById('age').value),
            bmi:         parseFloat(document.getElementById('bmi').value),
            sex:         document.getElementById('sex').value,
            boneQuality: document.getElementById('boneQuality').value,
            pathology:   document.getElementById('pathology').value,
            smoking:     document.getElementById('smoking').value,
            prevSurgery: document.getElementById('prevSurgery').value
        };

        if (!this.patientData.age || !this.patientData.bmi || !this.patientData.boneQuality) {
            UI.toast('Please fill in Age, BMI, and Bone Quality.', 'error');
            return;
        }

        UI.toast('Patient information saved.', 'success');
        this.goToScreen('region');
    },

    // =============================================
    // REGION SELECTION
    // =============================================
    toggleRegion(region) {
        if (region === 'cervical') {
            this.regionCervical = !this.regionCervical;
            document.getElementById('regionCardCervical').classList.toggle('selected', this.regionCervical);
        } else {
            this.regionLumbar = !this.regionLumbar;
            document.getElementById('regionCardLumbar').classList.toggle('selected', this.regionLumbar);
        }
    },

    saveRegionAndNext() {
        if (!this.regionCervical && !this.regionLumbar) {
            UI.toast('Please select at least one surgical region.', 'error');
            return;
        }

        this.patientData.regionCervical = this.regionCervical;
        this.patientData.regionLumbar = this.regionLumbar;

        this.goToScreen('upload');
    },

    // =============================================
    // FILE UPLOAD
    // =============================================
    handleDragOver(e, type) {
        e.preventDefault();
        e.stopPropagation();
        const zone = document.getElementById(type === 'lateral' ? 'dropzoneLateral' : 'dropzoneAP');
        zone.classList.add('dragover');
    },

    handleDragLeave(e, type) {
        e.preventDefault();
        e.stopPropagation();
        const zone = document.getElementById(type === 'lateral' ? 'dropzoneLateral' : 'dropzoneAP');
        zone.classList.remove('dragover');
    },

    handleDrop(e, type) {
        e.preventDefault();
        e.stopPropagation();
        const zone = document.getElementById(type === 'lateral' ? 'dropzoneLateral' : 'dropzoneAP');
        zone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            this.loadImagePreview(files[0], type);
        }
    },

    handleFileSelect(e, type) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.loadImagePreview(file, type);
        }
    },

    loadImagePreview(file, type) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            this.uploadedImages[type] = dataUrl;

            const zoneId = type === 'lateral' ? 'dropzoneLateral' : 'dropzoneAP';
            const contentId = type === 'lateral' ? 'dropzoneLateralContent' : 'dropzoneAPContent';
            const zone = document.getElementById(zoneId);
            const content = document.getElementById(contentId);

            zone.classList.add('has-image');
            content.innerHTML = `
                <div class="upload-preview">
                    <img src="${dataUrl}" alt="${type} view">
                    <button class="btn btn-sm btn-outline upload-remove" onclick="event.stopPropagation(); App.removeImage('${type}')">Remove</button>
                </div>
            `;

            // Enable annotate button if lateral is uploaded
            if (type === 'lateral') {
                document.getElementById('btnProceedAnnotate').disabled = false;
            }
        };
        reader.readAsDataURL(file);
    },

    removeImage(type) {
        this.uploadedImages[type] = null;

        const zoneId = type === 'lateral' ? 'dropzoneLateral' : 'dropzoneAP';
        const contentId = type === 'lateral' ? 'dropzoneLateralContent' : 'dropzoneAPContent';
        const zone = document.getElementById(zoneId);
        const content = document.getElementById(contentId);

        zone.classList.remove('has-image');
        const label = type === 'lateral' ? 'Lateral View' : 'AP View';
        const hint = type === 'lateral'
            ? 'Drag &amp; drop or click to upload standing lateral radiograph'
            : 'Drag &amp; drop or click to upload AP radiograph (optional, reference)';

        content.innerHTML = `
            <div class="dropzone-icon">&#128444;</div>
            <div class="dropzone-label">${label}</div>
            <div class="dropzone-hint">${hint}</div>
        `;

        if (type === 'lateral') {
            document.getElementById('btnProceedAnnotate').disabled = true;
        }

        // Reset file input
        const fileInput = document.getElementById(type === 'lateral' ? 'fileLateral' : 'fileAP');
        if (fileInput) fileInput.value = '';
    },

    // =============================================
    // ANNOTATION
    // =============================================
    proceedToAnnotation() {
        if (!this.uploadedImages.lateral) {
            UI.toast('Please upload a lateral radiograph first.', 'error');
            return;
        }

        // Determine which region to annotate first
        // If both selected, start with cervical
        const region = this.regionCervical ? 'cervical' : 'lumbar';

        this.goToScreen('annotate');
        this.startAnnotation(region);
    },

    startAnnotation(region) {
        const title = document.getElementById('annotateTitle');
        const subtitle = document.getElementById('annotateSubtitle');

        if (region === 'cervical') {
            title.textContent = 'Cervical Landmark Annotation';
            subtitle.textContent = 'Place 10 landmarks on the lateral cervical X-ray in sequence';
        } else {
            title.textContent = 'Lumbar Landmark Annotation';
            subtitle.textContent = 'Place 9 landmarks on the lateral lumbar X-ray in sequence';
        }

        // Initialize annotator with the lateral image
        Annotator.init(region, this.uploadedImages.lateral);
    },

    acceptAnnotationAndCompute() {
        const results = Annotator.getResults();
        const region = Annotator.region;

        if (region === 'cervical') {
            // Store cervical data from annotation
            this.cervicalData = {
                cl:       results.cl,
                csva:     results.csva,
                t1s:      results.t1s,
                cbva:     results.cbva,
                approach: '',
                levels:   ''
            };

            // If lumbar is also selected, proceed to lumbar annotation
            if (this.regionLumbar) {
                UI.toast('Cervical landmarks saved. Now annotate lumbar landmarks.', 'success');
                this.startAnnotation('lumbar');
                return;
            }
        } else {
            // Store lumbar data from annotation
            this.lumbarData = {
                pi:        results.pi,
                ll:        results.ll,
                sva:       results.sva,
                pt:        results.pt,
                approach:  '',
                levels:    '',
                osteotomy: ''
            };
        }

        this.cameFromAnnotation = true;
        UI.toast('Landmarks accepted. Review and add surgical details.', 'success');

        // Go to manual screen to fill in surgical details + review/override values
        this.populateManualFromAnnotation();
        this.goToScreen('manual');
    },

    populateManualFromAnnotation() {
        // Fill in computed values into manual entry fields
        if (this.regionCervical && this.cervicalData) {
            const c = this.cervicalData;
            if (!isNaN(c.cl))   document.getElementById('cl').value = c.cl;
            if (!isNaN(c.csva)) document.getElementById('csva').value = c.csva;
            if (!isNaN(c.t1s))  document.getElementById('t1s').value = c.t1s;
            if (!isNaN(c.cbva)) document.getElementById('cbva').value = c.cbva;
        }

        if (this.regionLumbar && this.lumbarData) {
            const l = this.lumbarData;
            if (!isNaN(l.pi))  document.getElementById('pi').value = l.pi;
            if (!isNaN(l.ll))  document.getElementById('ll').value = l.ll;
            if (!isNaN(l.sva)) document.getElementById('sva').value = l.sva;
            if (!isNaN(l.pt))  document.getElementById('pt').value = l.pt;
            Lumbar.updatePiLlDisplay();
        }
    },

    skipToManual() {
        this.cameFromAnnotation = false;
        this.goToScreen('manual');
    },

    backFromManual() {
        if (this.cameFromAnnotation) {
            this.goToScreen('annotate');
        } else {
            this.goToScreen('upload');
        }
    },

    showManualSections() {
        const cervSection = document.getElementById('manualCervicalSection');
        const lumbarSection = document.getElementById('manualLumbarSection');

        if (cervSection) cervSection.style.display = this.regionCervical ? 'block' : 'none';
        if (lumbarSection) lumbarSection.style.display = this.regionLumbar ? 'block' : 'none';
    },

    // =============================================
    // COMPUTE CORRECTIONS
    // =============================================
    computeAndShowCorrections() {
        // Collect current values from manual entry fields
        if (this.regionCervical) {
            this.cervicalData = Cervical.collectData();
            if (isNaN(this.cervicalData.cl) || isNaN(this.cervicalData.csva) ||
                isNaN(this.cervicalData.t1s) || isNaN(this.cervicalData.cbva)) {
                UI.toast('Please fill in all four cervical parameters.', 'error');
                return;
            }
        }

        if (this.regionLumbar) {
            this.lumbarData = Lumbar.collectData();
            if (isNaN(this.lumbarData.pi) || isNaN(this.lumbarData.ll) || isNaN(this.lumbarData.sva)) {
                UI.toast('Please fill in PI, LL, and SVA at minimum.', 'error');
                return;
            }
        }

        // Set region flags for Corrections module
        this.patientData.regionCervical = this.regionCervical;
        this.patientData.regionLumbar = this.regionLumbar;

        // Compute correction targets
        this.correctionResults = Corrections.compute(
            this.patientData, this.cervicalData, this.lumbarData
        );

        // Render
        Corrections.render(this.correctionResults, this.patientData);
        this.goToScreen('corrections');
    },

    // =============================================
    // IMPLANT RECOMMENDATIONS
    // =============================================
    generateImplantRecs() {
        this.implantRecs = Implants.recommend(
            this.patientData, this.cervicalData, this.lumbarData, this.correctionResults
        );
        Implants.render(this.implantRecs, this.patientData);
        this.goToScreen('implants');
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
            regionCervical: this.regionCervical,
            regionLumbar: this.regionLumbar,
            label: `${this.patientData.id || 'Case'} \u2014 Age ${this.patientData.age || '?'}, BMI ${this.patientData.bmi || '?'}`
        };
        cases.unshift(caseData);
        if (cases.length > 50) cases.length = 50;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cases));
        UI.toast('Case saved successfully.', 'success');
        this.renderCaseList();
    },

    loadCase(caseId) {
        const cases = this.getSavedCases();
        const c = cases.find(x => x.id === caseId);
        if (!c) { UI.toast('Case not found.', 'error'); return; }

        // Restore state
        this.patientData = c.patient || {};
        this.cervicalData = c.cervical || {};
        this.lumbarData = c.lumbar || {};
        this.regionCervical = c.regionCervical || !!c.patient.regionCervical;
        this.regionLumbar = c.regionLumbar || !!c.patient.regionLumbar;

        // Populate patient fields
        document.getElementById('patientId').value = c.patient.id || '';
        document.getElementById('age').value = c.patient.age || '';
        document.getElementById('bmi').value = c.patient.bmi || '';
        document.getElementById('sex').value = c.patient.sex || '';
        document.getElementById('boneQuality').value = c.patient.boneQuality || '';
        document.getElementById('pathology').value = c.patient.pathology || '';
        document.getElementById('smoking').value = c.patient.smoking || '';
        document.getElementById('prevSurgery').value = c.patient.prevSurgery || '';

        // Update region cards
        document.getElementById('regionCardCervical').classList.toggle('selected', this.regionCervical);
        document.getElementById('regionCardLumbar').classList.toggle('selected', this.regionLumbar);

        // Populate cervical fields
        if (c.cervical) {
            if (c.cervical.cl != null) document.getElementById('cl').value = c.cervical.cl;
            if (c.cervical.csva != null) document.getElementById('csva').value = c.cervical.csva;
            if (c.cervical.t1s != null) document.getElementById('t1s').value = c.cervical.t1s;
            if (c.cervical.cbva != null) document.getElementById('cbva').value = c.cervical.cbva;
            if (c.cervical.approach) document.getElementById('cervApproach').value = c.cervical.approach;
            if (c.cervical.levels) document.getElementById('cervLevels').value = c.cervical.levels;
        }

        // Populate lumbar fields
        if (c.lumbar) {
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
        this.goToScreen('manual');
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
                    <span class="case-item-meta">${UI.formatDate(c.savedAt)} \u00B7 ${c.patient.boneQuality || ''} \u00B7 ${[c.regionCervical || c.patient.regionCervical ? 'Cervical' : '', c.regionLumbar || c.patient.regionLumbar ? 'Lumbar' : ''].filter(Boolean).join(' + ')}</span>
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
            application: 'SpineAlign \u2014 Ulrich Medical Surgical Planning',
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

        rows.push(['Patient', 'ID', this.patientData.id, '', '', '']);
        rows.push(['Patient', 'Age', this.patientData.age, '', '', '']);
        rows.push(['Patient', 'BMI', this.patientData.bmi, '', '', '']);
        rows.push(['Patient', 'Bone Quality', this.patientData.boneQuality, '', '', '']);
        rows.push(['Patient', 'Smoking', this.patientData.smoking || '', '', '', '']);

        if (this.correctionResults.cervical) {
            this.correctionResults.cervical.params.forEach(p => {
                rows.push(['Cervical', p.label, p.current + ' ' + p.unit, p.target, p.correction, p.severity.text]);
            });
        }

        if (this.correctionResults.lumbar) {
            this.correctionResults.lumbar.params.forEach(p => {
                rows.push(['Lumbar', p.label, p.current + ' ' + p.unit, p.target, p.correction, p.severity.text]);
            });
        }

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
    // CONTACT REPRESENTATIVE
    // =============================================
    contactRepresentative() {
        // Build a summary of the surgical plan for the email body
        const p = this.patientData;
        const lines = [];

        lines.push('SpineAlign Surgical Plan Summary');
        lines.push('================================');
        lines.push('');
        lines.push(`Patient: ${p.id || 'Unspecified'} | Age: ${p.age || '?'} | BMI: ${p.bmi || '?'}`);
        lines.push(`Bone Quality: ${p.boneQuality || 'N/A'} | Pathology: ${p.pathology || 'N/A'}`);
        lines.push(`Region: ${[this.regionCervical ? 'Cervical' : '', this.regionLumbar ? 'Lumbar' : ''].filter(Boolean).join(' + ')}`);
        lines.push('');

        // Cervical parameters
        if (this.regionCervical && this.cervicalData) {
            const c = this.cervicalData;
            lines.push('CERVICAL PARAMETERS:');
            lines.push(`  CL: ${c.cl}\u00B0 | cSVA: ${c.csva}mm | T1S: ${c.t1s}\u00B0 | CBVA: ${c.cbva}\u00B0`);
            lines.push(`  Approach: ${c.approach || 'N/A'} | Levels: ${c.levels || 'N/A'}`);
            lines.push('');
        }

        // Lumbar parameters
        if (this.regionLumbar && this.lumbarData) {
            const l = this.lumbarData;
            lines.push('LUMBAR PARAMETERS:');
            lines.push(`  PI: ${l.pi}\u00B0 | LL: ${l.ll}\u00B0 | SVA: ${l.sva}mm | PT: ${l.pt || 'N/A'}\u00B0`);
            lines.push(`  PI-LL Mismatch: ${(l.pi - l.ll).toFixed(1)}\u00B0`);
            lines.push(`  Approach: ${l.approach || 'N/A'} | Levels: ${l.levels || 'N/A'} | Osteotomy: ${l.osteotomy || 'N/A'}`);
            lines.push('');
        }

        // Correction targets
        if (this.correctionResults.cervical) {
            lines.push('CERVICAL CORRECTION TARGETS:');
            this.correctionResults.cervical.params.forEach(param => {
                lines.push(`  ${param.label}: ${param.current}${param.unit} \u2192 Target: ${param.target} | ${param.severity.text}`);
            });
            lines.push('');
        }
        if (this.correctionResults.lumbar) {
            lines.push('LUMBAR CORRECTION TARGETS:');
            this.correctionResults.lumbar.params.forEach(param => {
                lines.push(`  ${param.label}: ${param.current}${param.unit} \u2192 Target: ${param.target} | ${param.severity.text}`);
            });
            lines.push('');
        }

        // Implant recommendations
        if (this.implantRecs.length > 0) {
            lines.push('IMPLANT RECOMMENDATIONS:');
            this.implantRecs.forEach(r => {
                lines.push(`  ${r.recommended ? '\u2713' : '\u25CB'} ${r.name} (${r.category})`);
                lines.push(`    ${r.rationale.substring(0, 150)}${r.rationale.length > 150 ? '...' : ''}`);
            });
            lines.push('');
        }

        lines.push('---');
        lines.push('Generated by SpineAlign \u2014 Ulrich Medical USA Surgical Planning Platform');
        lines.push('https://siddro373.github.io/SpineAlign/');

        const subject = encodeURIComponent(`SpineAlign Surgical Plan \u2014 ${p.id || 'Case'} (Age ${p.age || '?'})`);
        const body = encodeURIComponent(lines.join('\n'));

        window.location.href = `mailto:?subject=${subject}&body=${body}`;

        UI.toast('Opening email client with surgical plan...', 'success');
    },

    // =============================================
    // RESET
    // =============================================
    resetAll() {
        if (!confirm('Start a new case? All current data will be cleared.')) return;

        // Clear form fields
        document.querySelectorAll('input[type="number"], input[type="text"]').forEach(i => i.value = '');
        document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);

        // Reset region cards
        this.regionCervical = false;
        this.regionLumbar = false;
        document.getElementById('regionCardCervical').classList.remove('selected');
        document.getElementById('regionCardLumbar').classList.remove('selected');

        // Reset PI-LL display
        const piLlVal = document.getElementById('piLlValue');
        const piLlDisp = document.getElementById('piLlDisplay');
        if (piLlVal) piLlVal.textContent = '--';
        if (piLlDisp) piLlDisp.className = 'param-card';

        // Reset uploads
        this.removeImage('lateral');
        this.removeImage('ap');

        // Reset state
        this.patientData = {};
        this.cervicalData = {};
        this.lumbarData = {};
        this.correctionResults = { cervical: null, lumbar: null };
        this.implantRecs = [];
        this.cameFromAnnotation = false;

        this.goToScreen('welcome');
    },

    // =============================================
    // INITIALIZATION
    // =============================================
    init() {
        // Set welcome greeting
        const greetEl = document.getElementById('welcomeGreeting');
        if (greetEl) greetEl.textContent = this.getGreeting();

        // PI-LL auto-calculation listeners
        const piInput = document.getElementById('pi');
        const llInput = document.getElementById('ll');
        if (piInput) piInput.addEventListener('input', () => Lumbar.updatePiLlDisplay());
        if (llInput) llInput.addEventListener('input', () => Lumbar.updatePiLlDisplay());

        // Render saved case list
        this.renderCaseList();
    }
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => App.init());
