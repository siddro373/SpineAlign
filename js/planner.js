// =============================================
// SpineAlign -- Postop Plan Visualization
// Side-by-side preop vs simulated postop
// Canvas-based rendering with instrumentation
// Inspired by Medtronic UNiD ASI approach
// =============================================

const Planner = {

    // ---- State ----
    preopCanvas: null,
    postopCanvas: null,
    preopCtx: null,
    postopCtx: null,
    image: null,
    landmarks: [],       // Original preop landmark positions (deep copy)
    landmarkDefs: [],
    region: null,        // 'cervical' or 'lumbar'
    cervicalData: {},
    lumbarData: {},
    correctionResults: {},
    implantRecs: [],
    patientData: {},
    showOverlay: true,
    showLabels: true,
    canvasW: 0,
    canvasH: 0,

    // ---- Colors ----
    COLORS: {
        preop: {
            spine: 'rgba(248, 113, 113, 0.9)',
            spineGlow: 'rgba(248, 113, 113, 0.3)',
            label: '#f87171',
            labelBg: 'rgba(13, 17, 23, 0.85)'
        },
        postop: {
            spine: 'rgba(52, 211, 153, 0.9)',
            spineGlow: 'rgba(52, 211, 153, 0.3)',
            label: '#34d399',
            labelBg: 'rgba(13, 17, 23, 0.85)'
        },
        screw: '#c8d0dc',
        screwDark: '#8b95a8',
        rod: 'rgba(200, 208, 220, 0.9)',
        rodHighlight: 'rgba(255, 255, 255, 0.2)',
        cage: 'rgba(74, 158, 173, 0.5)',
        cageStroke: '#4a9ead',
        cageWindow: 'rgba(74, 158, 173, 0.25)',
        plumb: 'rgba(96, 165, 250, 0.5)',
        plumbDash: [6, 4],
        dimImage: 0.6,
        dimImagePostop: 0.4
    },

    // =============================================
    // INITIALIZATION
    // =============================================
    init(imageSrc, landmarks, landmarkDefs, region, cervData, lumbarData, corrections, implantRecs, patientData) {
        this.landmarks = landmarks ? landmarks.map(l => ({ x: l.x, y: l.y })) : [];
        this.landmarkDefs = landmarkDefs || [];
        this.region = region;
        this.cervicalData = cervData || {};
        this.lumbarData = lumbarData || {};
        this.correctionResults = corrections || {};
        this.implantRecs = implantRecs || [];
        this.patientData = patientData || {};
        this.showOverlay = true;
        this.showLabels = true;

        this.preopCanvas = document.getElementById('planCanvasPreop');
        this.postopCanvas = document.getElementById('planCanvasPostop');

        if (!this.preopCanvas || !this.postopCanvas) return;

        this.preopCtx = this.preopCanvas.getContext('2d');
        this.postopCtx = this.postopCanvas.getContext('2d');

        if (imageSrc && this.landmarks.length >= 4) {
            this.image = new Image();
            this.image.onload = () => {
                this.setupCanvases();
                this.renderAll();
            };
            this.image.src = imageSrc;
        } else {
            // No image or no landmarks -- render schematic
            this.image = null;
            this.setupCanvasesSchematic();
            this.renderAll();
        }
    },

    renderAll() {
        this.renderPreop();
        this.renderPostop();
        this.renderComparisonTable();
        this.renderLegend();
    },

    // =============================================
    // CANVAS SETUP
    // =============================================
    setupCanvases() {
        const wrap = this.preopCanvas.parentElement;
        const maxW = wrap.clientWidth;
        const aspect = this.image.width / this.image.height;
        const w = maxW;
        const h = maxW / aspect;

        this.canvasW = w;
        this.canvasH = h;

        this._applyCanvasSize(this.preopCanvas, w, h);
        this._applyCanvasSize(this.postopCanvas, w, h);
    },

    setupCanvasesSchematic() {
        const wrap = this.preopCanvas.parentElement;
        const w = wrap.clientWidth;
        const h = w * 1.2; // portrait aspect ratio

        this.canvasW = w;
        this.canvasH = h;

        this._applyCanvasSize(this.preopCanvas, w, h);
        this._applyCanvasSize(this.postopCanvas, w, h);
    },

    _applyCanvasSize(canvas, w, h) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    // =============================================
    // PREOP RENDERING
    // =============================================
    renderPreop() {
        const ctx = this.preopCtx;
        ctx.clearRect(0, 0, this.canvasW, this.canvasH);

        if (this.image) {
            // Draw X-ray dimmed
            ctx.globalAlpha = this.COLORS.dimImage;
            ctx.drawImage(this.image, 0, 0, this.canvasW, this.canvasH);
            ctx.globalAlpha = 1.0;
        } else {
            // Dark background
            ctx.fillStyle = '#0a0e14';
            ctx.fillRect(0, 0, this.canvasW, this.canvasH);
        }

        if (this.landmarks.length < 4) {
            this._drawCenteredText(ctx, 'No landmark data available', this.COLORS.preop.label);
            return;
        }

        // Draw current spine alignment
        this._drawSpineLine(ctx, this.landmarks, this.COLORS.preop.spine, this.COLORS.preop.spineGlow);

        // Draw SVA plumbline
        this._drawSVAPlumbline(ctx, this.landmarks);

        // Draw landmark dots
        this._drawLandmarkDots(ctx, this.landmarks, this.COLORS.preop.spine);

        // Labels
        if (this.showLabels) {
            this._drawPreopLabels(ctx);
        }
    },

    // =============================================
    // POSTOP RENDERING
    // =============================================
    renderPostop() {
        const ctx = this.postopCtx;
        ctx.clearRect(0, 0, this.canvasW, this.canvasH);

        if (this.image) {
            ctx.globalAlpha = this.COLORS.dimImagePostop;
            ctx.drawImage(this.image, 0, 0, this.canvasW, this.canvasH);
            ctx.globalAlpha = 1.0;
        } else {
            ctx.fillStyle = '#0a0e14';
            ctx.fillRect(0, 0, this.canvasW, this.canvasH);
        }

        if (this.landmarks.length < 4) {
            this._drawCenteredText(ctx, 'No landmark data available', this.COLORS.postop.label);
            return;
        }

        // Compute postop landmarks
        const postopLM = this.computePostopLandmarks();

        // Draw corrected spine alignment
        this._drawSpineLine(ctx, postopLM, this.COLORS.postop.spine, this.COLORS.postop.spineGlow);

        // Draw corrected SVA plumbline
        this._drawSVAPlumbline(ctx, postopLM);

        // Draw instrumentation overlay
        if (this.showOverlay) {
            this._drawInstrumentation(ctx, postopLM);
        }

        // Draw landmark dots
        this._drawLandmarkDots(ctx, postopLM, this.COLORS.postop.spine);

        // Labels
        if (this.showLabels) {
            this._drawPostopLabels(ctx, postopLM);
        }
    },

    // =============================================
    // POSTOP LANDMARK COMPUTATION
    // =============================================
    computePostopLandmarks() {
        // Deep copy
        const postop = this.landmarks.map(l => ({ x: l.x, y: l.y }));

        if (this.region === 'lumbar' && this.correctionResults.lumbar) {
            this._applyLumbarCorrections(postop);
        }
        if (this.region === 'cervical' && this.correctionResults.cervical) {
            this._applyCervicalCorrections(postop);
        }

        return postop;
    },

    _applyLumbarCorrections(postop) {
        // Lumbar indices: 0=L1SupAnt, 1=L1SupPost, 2=L5InfAnt, 3=L5InfPost,
        //   4=S1SupMid, 5=S1PostSup, 6=C7Center, 7=FHLeft, 8=FHRight
        const params = this.correctionResults.lumbar.params;
        const currentSVA = this.lumbarData.sva;
        const currentLL = this.lumbarData.ll;

        // Extract target values from correction params
        const svaParam = params.find(p => p.label && p.label.includes('SVA'));
        const llParam = params.find(p => p.label && p.label.includes('PI-LL'));

        // 1. SVA correction: shift upper landmarks horizontally
        if (postop.length >= 7 && currentSVA) {
            // Parse target SVA from target string (e.g., "< 40 mm")
            let targetSVA = currentSVA;
            if (svaParam && svaParam.target) {
                const match = svaParam.target.match(/(\d+)/);
                if (match) targetSVA = parseFloat(match[1]);
            }

            if (currentSVA > targetSVA) {
                // Need to shift C7 posteriorly (leftward on lateral X-ray)
                const svaDelta = currentSVA - targetSVA;
                const pixelScale = this._estimatePixelScale();
                const pixelShift = svaDelta * pixelScale;

                // C7 gets full correction, L1 gets partial
                postop[6].x -= pixelShift;             // C7 centroid
                postop[0].x -= pixelShift * 0.4;       // L1 sup ant
                postop[1].x -= pixelShift * 0.4;       // L1 sup post
            }
        }

        // 2. LL correction: rotate L1 endplate to increase lordosis
        if (postop.length >= 4 && currentLL) {
            // Target LL = PI (ideal PI-LL match)
            const pi = this.lumbarData.pi || 55;
            const targetLL = pi; // Ideal: PI-LL = 0
            const llDelta = targetLL - currentLL;

            if (llDelta > 0) {
                // Need more lordosis -- rotate upper landmarks
                const llDeltaRad = (llDelta * Math.PI) / 180;
                const pivot = {
                    x: (postop[2].x + postop[3].x) / 2,
                    y: (postop[2].y + postop[3].y) / 2
                };

                // Rotate L1 landmarks and C7 around sacral pivot
                [0, 1].forEach(idx => {
                    if (postop[idx]) {
                        const r = this._rotatePoint(postop[idx], pivot, -llDeltaRad * 0.3);
                        postop[idx].x = r.x;
                        postop[idx].y = r.y;
                    }
                });
                if (postop[6]) {
                    const r = this._rotatePoint(postop[6], pivot, -llDeltaRad * 0.2);
                    postop[6].x = r.x;
                    postop[6].y = r.y;
                }
            }
        }
    },

    _applyCervicalCorrections(postop) {
        // Cervical indices: 0=C2SupAnt, 1=C2SupPost, 2=C2Centroid, 3=C7InfAnt,
        //   4=C7InfPost, 5=C7PostSup, 6=T1SupAnt, 7=T1SupPost, 8=Chin, 9=Brow
        const params = this.correctionResults.cervical.params;
        const currentCSVA = this.cervicalData.csva;
        const currentCL = this.cervicalData.cl;

        // 1. cSVA correction
        if (postop.length >= 6 && currentCSVA) {
            let targetCSVA = 25; // default target
            const csvaParam = params.find(p => p.label && p.label.includes('cSVA'));
            if (csvaParam && csvaParam.target) {
                const match = csvaParam.target.match(/(\d+)/);
                if (match) targetCSVA = parseFloat(match[1]);
            }

            if (currentCSVA > targetCSVA) {
                const delta = currentCSVA - targetCSVA;
                const pixelScale = this._estimatePixelScale();
                const pixelShift = delta * pixelScale;

                // Shift C2 centroid and C2 endplate
                postop[2].x -= pixelShift;
                postop[0].x -= pixelShift * 0.8;
                postop[1].x -= pixelShift * 0.8;
            }
        }

        // 2. CL correction: rotate C2 relative to C7
        if (postop.length >= 5 && currentCL) {
            // Target CL based on T1S-CL relationship
            const t1s = this.cervicalData.t1s || 25;
            const targetCL = -(t1s - 16.5); // Hyun formula
            const clDelta = targetCL - currentCL; // negative = more lordosis needed

            if (Math.abs(clDelta) > 2) {
                const clDeltaRad = (clDelta * Math.PI) / 180;
                const pivot = {
                    x: (postop[3].x + postop[4].x) / 2,
                    y: (postop[3].y + postop[4].y) / 2
                };

                [0, 1, 2].forEach(idx => {
                    if (postop[idx]) {
                        const r = this._rotatePoint(postop[idx], pivot, clDeltaRad * 0.3);
                        postop[idx].x = r.x;
                        postop[idx].y = r.y;
                    }
                });
            }
        }
    },

    // =============================================
    // DRAWING HELPERS
    // =============================================
    _drawSpineLine(ctx, landmarks, color, glowColor) {
        if (landmarks.length < 2) return;

        // Determine which landmarks form the spine line based on region
        let spineIndices;
        if (this.region === 'lumbar') {
            // L1 midpoint → S1/L5 midpoint, through C7 if available
            spineIndices = [];
            if (landmarks.length >= 7) spineIndices.push(6); // C7
            spineIndices.push(0, 1); // L1 (will use midpoint)
            // Build actual spine path points
            const points = [];
            if (landmarks.length >= 7) points.push(landmarks[6]);
            if (landmarks.length >= 2) points.push(this._midpoint(landmarks[0], landmarks[1]));
            if (landmarks.length >= 4) points.push(this._midpoint(landmarks[2], landmarks[3]));
            if (landmarks.length >= 5) points.push(landmarks[4]); // S1 Sup Mid
            if (landmarks.length >= 6) points.push(landmarks[5]); // S1 Post-Sup
            this._drawSmoothPath(ctx, points, color, glowColor);
        } else if (this.region === 'cervical') {
            const points = [];
            if (landmarks.length >= 3) points.push(landmarks[2]); // C2 centroid
            if (landmarks.length >= 2) points.push(this._midpoint(landmarks[0], landmarks[1])); // C2 endplate mid
            if (landmarks.length >= 5) points.push(this._midpoint(landmarks[3], landmarks[4])); // C7 endplate mid
            if (landmarks.length >= 6) points.push(landmarks[5]); // C7 Post-Sup
            if (landmarks.length >= 8) points.push(this._midpoint(landmarks[6], landmarks[7])); // T1 mid
            this._drawSmoothPath(ctx, points, color, glowColor);
        }
    },

    _drawSmoothPath(ctx, points, color, glowColor) {
        if (points.length < 2) return;

        // Glow
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpx = (prev.x + curr.x) / 2;
            const cpy = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpx = (prev.x + curr.x) / 2;
            const cpy = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
    },

    _drawSVAPlumbline(ctx, landmarks) {
        if (this.region === 'lumbar' && landmarks.length >= 7) {
            // C7 plumbline to S1 Post-Sup level
            const c7 = landmarks[6];
            const s1PostSup = landmarks[5];
            const plumbEnd = { x: c7.x, y: Math.max(s1PostSup.y + 20, c7.y + 100) };
            this._drawDashedLine(ctx, c7, plumbEnd, this.COLORS.plumb);

            // Horizontal offset indicator
            const refPt = { x: c7.x, y: s1PostSup.y };
            this._drawDashedLine(ctx, refPt, s1PostSup, this.COLORS.plumb);
        } else if (this.region === 'cervical' && landmarks.length >= 6) {
            // C2 plumbline
            const c2 = landmarks[2];
            const c7PostSup = landmarks[5];
            const plumbEnd = { x: c2.x, y: Math.max(c7PostSup.y + 20, c2.y + 100) };
            this._drawDashedLine(ctx, c2, plumbEnd, this.COLORS.plumb);
        }
    },

    _drawDashedLine(ctx, p1, p2, color) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash(this.COLORS.plumbDash);
        ctx.stroke();
        ctx.setLineDash([]);
    },

    _drawLandmarkDots(ctx, landmarks, color) {
        landmarks.forEach(lm => {
            ctx.beginPath();
            ctx.arc(lm.x, lm.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(13, 17, 23, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    },

    _drawLabel(ctx, x, y, text, color, bgColor) {
        ctx.font = 'bold 11px -apple-system, sans-serif';
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = bgColor;
        ctx.fillRect(x - tw / 2 - 4, y - 8, tw + 8, 18);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(text, x, y + 4);
        ctx.textAlign = 'left';
    },

    _drawCenteredText(ctx, text, color) {
        ctx.font = '14px -apple-system, sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(text, this.canvasW / 2, this.canvasH / 2);
        ctx.textAlign = 'left';
    },

    // =============================================
    // PREOP / POSTOP LABELS
    // =============================================
    _drawPreopLabels(ctx) {
        const c = this.COLORS.preop;
        if (this.region === 'lumbar') {
            const sva = this.lumbarData.sva;
            const ll = this.lumbarData.ll;
            const pi = this.lumbarData.pi;
            const pt = this.lumbarData.pt;
            const piLL = pi && ll ? (pi - ll).toFixed(0) : '--';

            let y = 30;
            this._drawLabel(ctx, 50, y, 'PREOP', c.label, c.labelBg); y += 28;
            if (sva != null) { this._drawLabel(ctx, 50, y, `SVA: ${sva}mm`, c.label, c.labelBg); y += 22; }
            if (ll != null) { this._drawLabel(ctx, 50, y, `LL: ${ll}\u00B0`, c.label, c.labelBg); y += 22; }
            if (pi != null) { this._drawLabel(ctx, 50, y, `PI: ${pi}\u00B0`, c.label, c.labelBg); y += 22; }
            if (pt != null) { this._drawLabel(ctx, 50, y, `PT: ${pt}\u00B0`, c.label, c.labelBg); y += 22; }
            this._drawLabel(ctx, 50, y, `PI-LL: ${piLL}\u00B0`, c.label, c.labelBg);
        } else if (this.region === 'cervical') {
            const cl = this.cervicalData.cl;
            const csva = this.cervicalData.csva;
            const t1s = this.cervicalData.t1s;
            const cbva = this.cervicalData.cbva;

            let y = 30;
            this._drawLabel(ctx, 50, y, 'PREOP', c.label, c.labelBg); y += 28;
            if (cl != null) { this._drawLabel(ctx, 50, y, `CL: ${cl}\u00B0`, c.label, c.labelBg); y += 22; }
            if (csva != null) { this._drawLabel(ctx, 50, y, `cSVA: ${csva}mm`, c.label, c.labelBg); y += 22; }
            if (t1s != null) { this._drawLabel(ctx, 50, y, `T1S: ${t1s}\u00B0`, c.label, c.labelBg); y += 22; }
            if (cbva != null) { this._drawLabel(ctx, 50, y, `CBVA: ${cbva}\u00B0`, c.label, c.labelBg); }
        }
    },

    _drawPostopLabels(ctx, postopLM) {
        const c = this.COLORS.postop;
        if (this.region === 'lumbar' && this.correctionResults.lumbar) {
            const params = this.correctionResults.lumbar.params;
            let y = 30;
            this._drawLabel(ctx, 50, y, 'TARGET', c.label, c.labelBg); y += 28;
            params.forEach(p => {
                this._drawLabel(ctx, 50, y, `${p.label}: ${p.target}`, c.label, c.labelBg);
                y += 22;
            });
        } else if (this.region === 'cervical' && this.correctionResults.cervical) {
            const params = this.correctionResults.cervical.params;
            let y = 30;
            this._drawLabel(ctx, 50, y, 'TARGET', c.label, c.labelBg); y += 28;
            params.forEach(p => {
                this._drawLabel(ctx, 50, y, `${p.label}: ${p.target}`, c.label, c.labelBg);
                y += 22;
            });
        }
    },

    // =============================================
    // INSTRUMENTATION DRAWING
    // =============================================
    _drawInstrumentation(ctx, landmarks) {
        const approach = this.region === 'cervical'
            ? this.cervicalData.approach
            : this.lumbarData.approach;
        const levels = this.region === 'cervical'
            ? parseInt(this.cervicalData.levels) || 1
            : parseInt(this.lumbarData.levels) || 1;

        // Generate screw positions along corrected spine
        const screwPositions = this._generateScrewPositions(landmarks, levels);

        if (screwPositions.length < 2) return;

        // Draw rods first (behind screws)
        this._drawRod(ctx, screwPositions);

        // Draw pedicle screws at each level
        screwPositions.forEach(sp => {
            this._drawPedicleScrew(ctx, sp, sp.angle, 'left');
            this._drawPedicleScrew(ctx, sp, sp.angle, 'right');
        });

        // Draw interbody cages between screw levels
        if (approach && approach !== 'posterior_only') {
            this._drawCagesAtDiscSpaces(ctx, screwPositions);
        }
    },

    _generateScrewPositions(landmarks, numLevels) {
        const positions = [];

        if (this.region === 'lumbar' && landmarks.length >= 4) {
            const upper = this._midpoint(landmarks[0], landmarks[1]); // L1
            const lower = this._midpoint(landmarks[2], landmarks[3]); // L5 inf / sacral endplate

            for (let i = 0; i <= numLevels; i++) {
                const t = numLevels > 0 ? i / numLevels : 0;
                const pos = {
                    x: upper.x + (lower.x - upper.x) * t,
                    y: upper.y + (lower.y - upper.y) * t,
                    angle: Math.atan2(lower.y - upper.y, lower.x - upper.x)
                };
                positions.push(pos);
            }
        } else if (this.region === 'cervical' && landmarks.length >= 5) {
            const upper = this._midpoint(landmarks[0], landmarks[1]); // C2
            const lower = this._midpoint(landmarks[3], landmarks[4]); // C7

            for (let i = 0; i <= numLevels; i++) {
                const t = numLevels > 0 ? i / numLevels : 0;
                const pos = {
                    x: upper.x + (lower.x - upper.x) * t,
                    y: upper.y + (lower.y - upper.y) * t,
                    angle: Math.atan2(lower.y - upper.y, lower.x - upper.x)
                };
                positions.push(pos);
            }
        }

        return positions;
    },

    _drawPedicleScrew(ctx, position, angle, side) {
        ctx.save();
        ctx.translate(position.x, position.y);

        // Screw angle: perpendicular to spine line, adjusted for side
        const perpAngle = angle - Math.PI / 2;
        const screwAngle = side === 'left' ? perpAngle - 0.3 : perpAngle + Math.PI + 0.3;
        ctx.rotate(screwAngle);

        const screwLen = 20;

        // Screw shaft
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(screwLen, 0);
        ctx.strokeStyle = this.COLORS.screw;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Screw head (tulip)
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = this.COLORS.screw;
        ctx.fill();
        ctx.strokeStyle = '#0d1117';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Thread marks
        for (let t = 5; t < screwLen; t += 3.5) {
            ctx.beginPath();
            ctx.moveTo(t, -2);
            ctx.lineTo(t, 2);
            ctx.strokeStyle = this.COLORS.screwDark;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // Screw tip
        ctx.beginPath();
        ctx.moveTo(screwLen, -1.5);
        ctx.lineTo(screwLen + 3, 0);
        ctx.lineTo(screwLen, 1.5);
        ctx.closePath();
        ctx.fillStyle = this.COLORS.screw;
        ctx.fill();

        ctx.restore();
    },

    _drawRod(ctx, screwPositions) {
        if (screwPositions.length < 2) return;

        // Draw rod as a smooth curve through screw head positions
        // Offset slightly to represent the rod sitting in the tulip heads
        const offsetX = 0;
        const offsetY = 0;

        ctx.beginPath();
        ctx.moveTo(screwPositions[0].x + offsetX, screwPositions[0].y + offsetY);

        if (screwPositions.length === 2) {
            ctx.lineTo(screwPositions[1].x + offsetX, screwPositions[1].y + offsetY);
        } else {
            for (let i = 1; i < screwPositions.length; i++) {
                const prev = screwPositions[i - 1];
                const curr = screwPositions[i];
                const cpx = (prev.x + curr.x) / 2 + offsetX;
                const cpy = (prev.y + curr.y) / 2 + offsetY;
                ctx.quadraticCurveTo(prev.x + offsetX, prev.y + offsetY, cpx, cpy);
            }
            const last = screwPositions[screwPositions.length - 1];
            ctx.lineTo(last.x + offsetX, last.y + offsetY);
        }

        // Main rod
        ctx.strokeStyle = this.COLORS.rod;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Highlight for 3D appearance
        ctx.strokeStyle = this.COLORS.rodHighlight;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    },

    _drawCagesAtDiscSpaces(ctx, screwPositions) {
        for (let i = 0; i < screwPositions.length - 1; i++) {
            const upper = screwPositions[i];
            const lower = screwPositions[i + 1];
            this._drawCage(ctx, upper, lower);
        }
    },

    _drawCage(ctx, upper, lower) {
        const cx = (upper.x + lower.x) / 2;
        const cy = (upper.y + lower.y) / 2;
        const dist = Math.sqrt((lower.x - upper.x) ** 2 + (lower.y - upper.y) ** 2);
        const cageH = dist * 0.4;
        const cageW = dist * 0.6;
        const angle = Math.atan2(lower.y - upper.y, lower.x - upper.x);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Cage body (rounded rectangle approximation)
        const r = 3;
        const hw = cageW / 2;
        const hh = cageH / 2;

        ctx.beginPath();
        ctx.moveTo(-hw + r, -hh);
        ctx.lineTo(hw - r, -hh);
        ctx.arcTo(hw, -hh, hw, -hh + r, r);
        ctx.lineTo(hw, hh - r);
        ctx.arcTo(hw, hh, hw - r, hh, r);
        ctx.lineTo(-hw + r, hh);
        ctx.arcTo(-hw, hh, -hw, hh - r, r);
        ctx.lineTo(-hw, -hh + r);
        ctx.arcTo(-hw, -hh, -hw + r, -hh, r);
        ctx.closePath();

        ctx.fillStyle = this.COLORS.cage;
        ctx.fill();
        ctx.strokeStyle = this.COLORS.cageStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Internal graft window
        const iw = cageW * 0.4;
        const ih = cageH * 0.4;
        ctx.beginPath();
        ctx.rect(-iw / 2, -ih / 2, iw, ih);
        ctx.strokeStyle = this.COLORS.cageWindow;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Cross-hatch inside graft window
        ctx.beginPath();
        ctx.moveTo(-iw / 4, -ih / 2);
        ctx.lineTo(-iw / 4, ih / 2);
        ctx.moveTo(iw / 4, -ih / 2);
        ctx.lineTo(iw / 4, ih / 2);
        ctx.strokeStyle = this.COLORS.cageWindow;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.restore();
    },

    // =============================================
    // COMPARISON TABLE & LEGEND
    // =============================================
    renderComparisonTable() {
        const container = document.getElementById('planComparisonTable');
        if (!container) return;

        const allParams = [
            ...(this.correctionResults.cervical ? this.correctionResults.cervical.params : []),
            ...(this.correctionResults.lumbar ? this.correctionResults.lumbar.params : [])
        ];

        if (allParams.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); padding:12px; font-size:13px;">No correction targets computed.</p>';
            return;
        }

        let rows = allParams.map(p => `
            <tr>
                <td style="font-weight:600;">${p.label}</td>
                <td style="color:var(--danger);">${p.current} ${p.unit}</td>
                <td style="color:var(--success);">${p.target}</td>
                <td>${p.correction}</td>
                <td><span class="param-status ${p.severity.cls}">${p.severity.text}</span></td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="card" style="box-shadow:none; border:1px solid var(--border); padding:16px;">
                <div class="card-section-title" style="margin-bottom:12px;">Parameter Comparison: Preop vs Target</div>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Parameter</th>
                            <th style="color:var(--danger);">Preop</th>
                            <th style="color:var(--success);">Target</th>
                            <th>Correction</th>
                            <th>Severity</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    renderLegend() {
        const container = document.getElementById('planLegend');
        if (!container) return;

        const recNames = this.implantRecs
            .filter(r => r.recommended)
            .map(r => `<span class="plan-legend-item">${r.name}</span>`)
            .join('');

        container.innerHTML = `
            <div class="plan-legend-grid">
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.COLORS.preop.spine}"></span>
                    <span>Current alignment</span>
                </div>
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.COLORS.postop.spine}"></span>
                    <span>Target alignment</span>
                </div>
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.COLORS.screw}"></span>
                    <span>Pedicle screws</span>
                </div>
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.COLORS.rod}; height:4px; border-radius:2px;"></span>
                    <span>Connecting rods</span>
                </div>
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.COLORS.cage}; border:1px solid ${this.COLORS.cageStroke};"></span>
                    <span>Interbody cage</span>
                </div>
            </div>
            <div class="plan-legend-implants">
                <strong>Recommended Implants:</strong> ${recNames || '<span style="color:var(--text-light);">None specified</span>'}
            </div>
        `;
    },

    // =============================================
    // TOGGLES
    // =============================================
    toggleOverlay() {
        this.showOverlay = !this.showOverlay;
        this.renderPostop();
        UI.toast(this.showOverlay ? 'Instrumentation overlay shown.' : 'Instrumentation overlay hidden.', 'info');
    },

    toggleLabels() {
        this.showLabels = !this.showLabels;
        this.renderPreop();
        this.renderPostop();
    },

    // =============================================
    // GEOMETRY UTILITIES
    // =============================================
    _midpoint(p1, p2) {
        return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    },

    _distance(p1, p2) {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    },

    _rotatePoint(point, pivot, angle) {
        const dx = point.x - pivot.x;
        const dy = point.y - pivot.y;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: pivot.x + dx * cos - dy * sin,
            y: pivot.y + dx * sin + dy * cos
        };
    },

    _estimatePixelScale() {
        // Estimate pixels per mm from landmark distances
        // Use the distance between L1 and S1 landmarks as reference
        // Average L1-S1 distance is approximately 150mm in adults
        if (this.region === 'lumbar' && this.landmarks.length >= 4) {
            const l1Mid = this._midpoint(this.landmarks[0], this.landmarks[1]);
            const s1Mid = this._midpoint(this.landmarks[2], this.landmarks[3]);
            const pixDist = this._distance(l1Mid, s1Mid);
            const approxMM = 150; // average L1-S1 anatomic distance
            return pixDist / approxMM;
        } else if (this.region === 'cervical' && this.landmarks.length >= 5) {
            const c2Mid = this._midpoint(this.landmarks[0], this.landmarks[1]);
            const c7Mid = this._midpoint(this.landmarks[3], this.landmarks[4]);
            const pixDist = this._distance(c2Mid, c7Mid);
            const approxMM = 100; // average C2-C7 distance
            return pixDist / approxMM;
        }
        return 1; // fallback: 1 pixel per mm
    }
};
