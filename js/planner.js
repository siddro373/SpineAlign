// =============================================
// SpineAlign — Surgical Plan Visualization
// 3-panel: Preop → Surgical Strategy → Postop
// Canvas-based rendering with measurement annotations,
// alignment curves, cage planning, and instrumentation
// =============================================

const Planner = {

    // ---- State ----
    canvases: {},       // { preop, strategy, postop } canvas elements
    ctxs: {},           // { preop, strategy, postop } 2D contexts
    image: null,        // Uploaded lateral X-ray (Image object)
    landmarks: [],      // Original preop landmarks (deep copy)
    landmarkDefs: [],
    region: null,       // 'cervical' or 'lumbar'
    cervicalData: {},
    lumbarData: {},
    correctionResults: {},
    implantRecs: [],
    patientData: {},
    canvasW: 0,
    canvasH: 0,
    pixelScale: 1,      // pixels per mm

    // ---- Rendering options ----
    activePanel: 0,      // 0=preop, 1=strategy, 2=postop (for mobile swipe)

    // ---- Colors ----
    C: {
        // Preop
        preopSpine:     '#f87171',      // red
        preopSpineGlow: 'rgba(248,113,113,0.25)',
        preopLabel:     '#f87171',

        // Strategy / correction
        corrCurve:      '#fbbf24',      // gold/amber — desired correction curve
        corrCurveGlow:  'rgba(251,191,36,0.20)',
        corrArrow:      'rgba(251,191,36,0.7)',
        cageOutline:    '#60a5fa',      // blue cage
        cageFill:       'rgba(96,165,250,0.15)',
        endplateGreen:  '#34d399',
        endplateOlive:  '#a3be8c',
        osteotomyRed:   '#f87171',
        measureLine:    'rgba(255,255,255,0.45)',
        measureText:    '#e2e8f0',
        angleFill:      'rgba(96,165,250,0.12)',
        angleArc:       'rgba(96,165,250,0.6)',

        // Postop
        postopSpine:     '#34d399',     // green
        postopSpineGlow: 'rgba(52,211,153,0.25)',
        postopLabel:     '#34d399',
        svaCorrected:    'rgba(52,211,153,0.4)',

        // Instrumentation
        screw:          '#d0d8e4',
        screwShaft:     '#b8c4d4',
        screwThread:    '#8b95a8',
        screwHead:      '#e2e8f0',
        rod:            'rgba(200,210,225,0.85)',
        rodHighlight:   'rgba(255,255,255,0.18)',
        cage:           'rgba(96,165,250,0.35)',
        cageStroke:     '#60a5fa',
        cageGraft:      'rgba(96,165,250,0.15)',

        // Plumbline
        plumb:          'rgba(96,165,250,0.45)',
        plumbDash:      [6, 4],

        // Canvas
        dimPreop:  0.7,
        dimStrat:  0.55,
        dimPostop: 0.50,
        bgDark:    '#050810',

        // Labels
        labelBg:    'rgba(10,14,20,0.82)',
        stepBadge:  '#4a9ead',
        stepBadgeBg:'rgba(74,158,173,0.15)',
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

        // Get canvas elements
        this.canvases.preop    = document.getElementById('planCanvasPreop');
        this.canvases.strategy = document.getElementById('planCanvasStrategy');
        this.canvases.postop   = document.getElementById('planCanvasPostop');

        if (!this.canvases.preop || !this.canvases.strategy || !this.canvases.postop) return;

        this.ctxs.preop    = this.canvases.preop.getContext('2d');
        this.ctxs.strategy = this.canvases.strategy.getContext('2d');
        this.ctxs.postop   = this.canvases.postop.getContext('2d');

        if (imageSrc && this.landmarks.length >= 4) {
            this.image = new Image();
            this.image.onload = () => {
                this._setupCanvases();
                this.pixelScale = this._estimatePixelScale();
                this.renderAll();
            };
            this.image.src = imageSrc;
        } else {
            this.image = null;
            this._setupCanvasesSchematic();
            this.pixelScale = 1;
            this.renderAll();
        }
    },

    renderAll() {
        this.renderPreop();
        this.renderStrategy();
        this.renderPostop();
        this.renderSurgicalSteps();
        this.renderComparisonTable();
        this.renderLegend();
    },

    // =============================================
    // CANVAS SETUP
    // =============================================
    _setupCanvases() {
        const wrap = this.canvases.preop.parentElement;
        const maxW = wrap.clientWidth;
        const aspect = this.image.width / this.image.height;
        const maxViewH = window.innerHeight * 0.8;
        let w = maxW;
        let h = maxW / aspect;

        // Clamp height to 80vh so each panel fits in window
        if (h > maxViewH) {
            h = maxViewH;
            w = h * aspect;
        }

        this.canvasW = w;
        this.canvasH = h;

        [this.canvases.preop, this.canvases.strategy, this.canvases.postop].forEach(c => {
            this._sizeCanvas(c, w, h);
        });
    },

    _setupCanvasesSchematic() {
        const wrap = this.canvases.preop.parentElement;
        const maxW = wrap.clientWidth;
        const maxViewH = window.innerHeight * 0.8;
        const w = maxW;
        const h = Math.min(w * 1.3, maxViewH);

        this.canvasW = w;
        this.canvasH = h;

        [this.canvases.preop, this.canvases.strategy, this.canvases.postop].forEach(c => {
            this._sizeCanvas(c, w, h);
        });
    },

    _sizeCanvas(canvas, w, h) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width  = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';
        canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    },


    // =============================================
    // PANEL 1: PREOPERATIVE
    // Clean X-ray with alignment measurements
    // =============================================
    renderPreop() {
        const ctx = this.ctxs.preop;
        this._clearCanvas(ctx);

        // Draw X-ray
        this._drawXray(ctx, this.C.dimPreop);

        if (this.landmarks.length < 4) {
            this._centeredText(ctx, 'Upload and annotate a lateral X-ray to generate plan');
            return;
        }

        // Draw current alignment curve (red)
        const spinePoints = this._getSpinePoints(this.landmarks);
        this._drawAlignmentCurve(ctx, spinePoints, this.C.preopSpine, this.C.preopSpineGlow, 3);

        // Draw SVA plumbline
        this._drawPlumbline(ctx, this.landmarks, this.C.preopSpine);

        // Draw landmark dots
        this._drawDots(ctx, this.landmarks, this.C.preopSpine, 3.5);

        // Draw measurement annotations
        this._drawPreopMeasurements(ctx);

        // Panel label
        this._drawPanelBadge(ctx, 'PREOPERATIVE', this.C.preopSpine);
    },

    _drawPreopMeasurements(ctx) {
        const data = this.region === 'lumbar' ? this.lumbarData : this.cervicalData;
        if (!data) return;

        const x = this.canvasW - 12;
        let y = 40;
        const lineH = 22;
        const col = this.C.preopLabel;

        ctx.textAlign = 'right';

        if (this.region === 'lumbar') {
            if (data.sva != null) { this._drawMeasureTag(ctx, x, y, `SVA ${data.sva} mm`, col); y += lineH; }
            if (data.ll != null)  { this._drawMeasureTag(ctx, x, y, `LL ${data.ll}°`, col); y += lineH; }
            if (data.pi != null)  { this._drawMeasureTag(ctx, x, y, `PI ${data.pi}°`, col); y += lineH; }
            if (data.pt != null)  { this._drawMeasureTag(ctx, x, y, `PT ${data.pt}°`, col); y += lineH; }
            if (data.pi != null && data.ll != null) {
                this._drawMeasureTag(ctx, x, y, `PI-LL ${(data.pi - data.ll).toFixed(0)}°`, col);
            }
        } else {
            if (data.cl != null)   { this._drawMeasureTag(ctx, x, y, `CL ${data.cl}°`, col); y += lineH; }
            if (data.csva != null) { this._drawMeasureTag(ctx, x, y, `cSVA ${data.csva} mm`, col); y += lineH; }
            if (data.t1s != null)  { this._drawMeasureTag(ctx, x, y, `T1S ${data.t1s}°`, col); y += lineH; }
            if (data.cbva != null) { this._drawMeasureTag(ctx, x, y, `CBVA ${data.cbva}°`, col); }
        }
        ctx.textAlign = 'left';
    },


    // =============================================
    // PANEL 2: SURGICAL STRATEGY
    // Shows correction vectors, angle targets,
    // cage placement zones, osteotomy site
    // =============================================
    renderStrategy() {
        const ctx = this.ctxs.strategy;
        this._clearCanvas(ctx);

        this._drawXray(ctx, this.C.dimStrat);

        if (this.landmarks.length < 4) {
            this._centeredText(ctx, 'No landmark data for planning');
            return;
        }

        const postopLM = this._computePostopLandmarks();
        const preopPts = this._getSpinePoints(this.landmarks);
        const postopPts = this._getSpinePoints(postopLM);

        // 1) Draw preop alignment (dimmed red, thinner)
        this._drawAlignmentCurve(ctx, preopPts, 'rgba(248,113,113,0.35)', 'rgba(248,113,113,0.08)', 1.5);

        // 2) Draw target alignment curve (gold)
        this._drawAlignmentCurve(ctx, postopPts, this.C.corrCurve, this.C.corrCurveGlow, 3);

        // 3) Draw correction vectors (arrows from preop → postop)
        this._drawCorrectionVectors(ctx, preopPts, postopPts);

        // 4) Draw endplate outlines at disc spaces
        this._drawEndplateOutlines(ctx);

        // 5) Draw cage placement zones
        this._drawCagePlanningZones(ctx, postopLM);

        // 6) Draw angle measurements (LL arc, PI-LL)
        this._drawStrategyAngles(ctx, postopLM);

        // 7) Draw SVA correction line
        this._drawSVACorrectionIndicator(ctx, postopLM);

        // 8) Draw osteotomy site marker if applicable
        this._drawOsteotomySite(ctx);

        // Panel label
        this._drawPanelBadge(ctx, 'SURGICAL STRATEGY', this.C.corrCurve);

        // Target values on the right
        this._drawTargetValues(ctx);
    },

    _drawCorrectionVectors(ctx, preopPts, postopPts) {
        const count = Math.min(preopPts.length, postopPts.length);
        for (let i = 0; i < count; i++) {
            const from = preopPts[i];
            const to   = postopPts[i];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 3) continue; // skip tiny corrections

            // Arrow line
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.strokeStyle = this.C.corrArrow;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Arrowhead
            const angle = Math.atan2(dy, dx);
            const headLen = 6;
            ctx.beginPath();
            ctx.moveTo(to.x, to.y);
            ctx.lineTo(to.x - headLen * Math.cos(angle - 0.4), to.y - headLen * Math.sin(angle - 0.4));
            ctx.moveTo(to.x, to.y);
            ctx.lineTo(to.x - headLen * Math.cos(angle + 0.4), to.y - headLen * Math.sin(angle + 0.4));
            ctx.strokeStyle = this.C.corrArrow;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    },

    _drawEndplateOutlines(ctx) {
        if (this.region !== 'lumbar' || this.landmarks.length < 6) return;

        // L1 superior endplate (green outline)
        this._drawEndplateLine(ctx, this.landmarks[0], this.landmarks[1], this.C.endplateGreen, 30);

        // L5 inferior endplate (green outline)
        this._drawEndplateLine(ctx, this.landmarks[2], this.landmarks[3], this.C.endplateGreen, 30);

        // S1 superior endplate (olive outline)
        if (this.landmarks.length >= 5) {
            const s1mid = this.landmarks[4];
            const s1post = this.landmarks[5];
            // Extrapolate anterior point
            const dx = s1mid.x - s1post.x;
            const dy = s1mid.y - s1post.y;
            const s1ant = { x: s1mid.x + dx, y: s1mid.y + dy };
            this._drawEndplateLine(ctx, s1ant, s1post, this.C.endplateOlive, 25);
        }
    },

    _drawEndplateLine(ctx, p1, p2, color, extend) {
        // Draw an extended endplate outline
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;
        const nx = dx / len;
        const ny = dy / len;

        const startX = p1.x - nx * extend * 0.3;
        const startY = p1.y - ny * extend * 0.3;
        const endX   = p2.x + nx * extend * 0.3;
        const endY   = p2.y + ny * extend * 0.3;

        // Rounded endplate shape
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Subtle endplate body (elliptical highlight)
        const cx = (startX + endX) / 2;
        const cy = (startY + endY) / 2;
        const halfW = len / 2 + extend * 0.3;
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, halfW, 6, 0, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
    },

    _drawCagePlanningZones(ctx, postopLM) {
        if (this.region !== 'lumbar' || postopLM.length < 4) return;

        const approach = this.lumbarData.approach;
        const levels = parseInt(this.lumbarData.levels) || 1;
        if (!approach || approach === 'posterior_only') return;

        // Draw cage boxes between instrumented levels
        const upper = this._mid(postopLM[0], postopLM[1]); // L1 midpoint
        const lower = this._mid(postopLM[2], postopLM[3]); // L5 inf midpoint

        for (let i = 0; i < levels; i++) {
            const t1 = levels > 1 ? i / (levels) : 0;
            const t2 = levels > 1 ? (i + 1) / (levels) : 1;

            const topPt = {
                x: upper.x + (lower.x - upper.x) * t1,
                y: upper.y + (lower.y - upper.y) * t1
            };
            const botPt = {
                x: upper.x + (lower.x - upper.x) * t2,
                y: upper.y + (lower.y - upper.y) * t2
            };

            const discMid = this._mid(topPt, botPt);
            const endplateAngle = Math.atan2(
                postopLM[1].y - postopLM[0].y,
                postopLM[1].x - postopLM[0].x
            );
            const cageW = this._dist(this.landmarks[0], this.landmarks[1]) * 0.7;
            const cageH = this._dist(topPt, botPt) * 0.45;

            this._drawCageBox(ctx, discMid, endplateAngle, cageW, Math.max(cageH, 12));
        }
    },

    _drawCageBox(ctx, center, angle, width, height) {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(angle);

        const hw = width / 2;
        const hh = height / 2;
        const r = 3;

        // Cage body
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

        ctx.fillStyle = this.C.cageFill;
        ctx.fill();
        ctx.strokeStyle = this.C.cageOutline;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Graft window
        const gw = width * 0.35;
        const gh = height * 0.5;
        ctx.strokeStyle = 'rgba(96,165,250,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-gw / 2, -gh / 2, gw, gh);

        ctx.restore();
    },

    _drawStrategyAngles(ctx, postopLM) {
        if (this.region !== 'lumbar' || postopLM.length < 4) return;

        // Draw the target LL angle arc between L1 and L5 endplates
        const l1mid = this._mid(postopLM[0], postopLM[1]);
        const l5mid = this._mid(postopLM[2], postopLM[3]);

        // Vertical reference line at L5 midpoint
        const vertTop = { x: l5mid.x, y: l5mid.y - 80 };

        // Endplate angle of L1
        const l1angle = Math.atan2(
            postopLM[1].y - postopLM[0].y,
            postopLM[1].x - postopLM[0].x
        );
        const l5angle = Math.atan2(
            postopLM[3].y - postopLM[2].y,
            postopLM[3].x - postopLM[2].x
        );

        // Draw LL angle arc at the intersection
        const arcCenter = l5mid;
        const arcR = 35;

        // Angle from vertical to L1 endplate perpendicular
        const startAngle = -Math.PI / 2; // vertical
        const targetLL = this.lumbarData.pi || 55;
        const endAngle = startAngle - (targetLL * Math.PI / 180);

        ctx.beginPath();
        ctx.moveTo(arcCenter.x, arcCenter.y);
        ctx.arc(arcCenter.x, arcCenter.y, arcR, startAngle, endAngle, true);
        ctx.closePath();
        ctx.fillStyle = this.C.angleFill;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(arcCenter.x, arcCenter.y, arcR, startAngle, endAngle, true);
        ctx.strokeStyle = this.C.angleArc;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label the angle
        const midAngle = (startAngle + endAngle) / 2;
        const labelR = arcR + 14;
        const labelX = arcCenter.x + labelR * Math.cos(midAngle);
        const labelY = arcCenter.y + labelR * Math.sin(midAngle);

        const targetLLVal = this.correctionResults.lumbar
            ? this.correctionResults.lumbar.params.find(p => p.label && p.label.includes('PI-LL'))
            : null;
        const llText = targetLLVal ? `Target LL ${this.lumbarData.pi}°` : `LL ${targetLL}°`;
        this._drawMeasureTag(ctx, labelX, labelY, llText, this.C.corrCurve);
    },

    _drawSVACorrectionIndicator(ctx, postopLM) {
        if (this.region !== 'lumbar' || this.landmarks.length < 7 || postopLM.length < 7) return;

        const preopC7 = this.landmarks[6];
        const postopC7 = postopLM[6];
        const s1post = this.landmarks[5];

        // Draw horizontal correction indicator at S1 level
        if (Math.abs(preopC7.x - postopC7.x) > 2) {
            // Preop plumbline (faded red)
            ctx.beginPath();
            ctx.moveTo(preopC7.x, preopC7.y);
            ctx.lineTo(preopC7.x, s1post.y + 15);
            ctx.strokeStyle = 'rgba(248,113,113,0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Postop plumbline (green)
            ctx.beginPath();
            ctx.moveTo(postopC7.x, postopC7.y);
            ctx.lineTo(postopC7.x, s1post.y + 15);
            ctx.strokeStyle = this.C.svaCorrected;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Horizontal arrow showing SVA correction
            const arrowY = s1post.y + 10;
            ctx.beginPath();
            ctx.moveTo(preopC7.x, arrowY);
            ctx.lineTo(postopC7.x, arrowY);
            ctx.strokeStyle = this.C.corrCurve;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.stroke();

            // SVA delta label
            const data = this.lumbarData;
            const svaTarget = this.correctionResults.lumbar
                ? this.correctionResults.lumbar.params.find(p => p.label && p.label.includes('SVA'))
                : null;
            const targetText = svaTarget ? svaTarget.target : (data.sva ? '< 40 mm' : '');
            if (targetText) {
                this._drawMeasureTag(ctx,
                    (preopC7.x + postopC7.x) / 2,
                    arrowY - 10,
                    `SVA → ${targetText}`,
                    this.C.corrCurve
                );
            }
        }
    },

    _drawOsteotomySite(ctx) {
        if (this.region !== 'lumbar') return;
        const osteotomy = this.lumbarData.osteotomy;
        if (!osteotomy || osteotomy === 'none' || osteotomy === '') return;

        // Mark osteotomy at ~L3-L4 level (midpoint of instrumented segment)
        if (this.landmarks.length < 4) return;

        const l1mid = this._mid(this.landmarks[0], this.landmarks[1]);
        const l5mid = this._mid(this.landmarks[2], this.landmarks[3]);
        const osteoPoint = {
            x: (l1mid.x + l5mid.x) / 2,
            y: (l1mid.y + l5mid.y) / 2
        };

        // Red dashed wedge
        const wedgeW = 30;
        ctx.save();
        ctx.translate(osteoPoint.x, osteoPoint.y);

        // Wedge lines
        ctx.beginPath();
        ctx.moveTo(-wedgeW, -8);
        ctx.lineTo(0, 0);
        ctx.lineTo(-wedgeW, 8);
        ctx.strokeStyle = this.C.osteotomyRed;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(wedgeW, -8);
        ctx.lineTo(0, 0);
        ctx.lineTo(wedgeW, 8);
        ctx.strokeStyle = this.C.osteotomyRed;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        // Label
        const osteoLabels = { spo: 'SPO', pso: 'PSO', vcr: 'VCR' };
        const label = osteoLabels[osteotomy] || osteotomy.toUpperCase();
        this._drawMeasureTag(ctx, osteoPoint.x + wedgeW + 8, osteoPoint.y, label, this.C.osteotomyRed);
    },

    _drawTargetValues(ctx) {
        const corrData = this.region === 'lumbar'
            ? this.correctionResults.lumbar
            : this.correctionResults.cervical;
        if (!corrData || !corrData.params) return;

        const x = this.canvasW - 12;
        let y = 40;
        const lineH = 22;

        ctx.textAlign = 'right';
        this._drawMeasureTag(ctx, x, y, 'TARGETS', this.C.corrCurve);
        y += lineH + 4;

        corrData.params.forEach(p => {
            const col = p.severity && p.severity.cls === 'status-normal'
                ? this.C.postopSpine : this.C.corrCurve;
            this._drawMeasureTag(ctx, x, y, `${p.label}: ${p.target}`, col);
            y += lineH;
        });

        ctx.textAlign = 'left';
    },


    // =============================================
    // PANEL 3: POSTOPERATIVE (Corrected)
    // Shows corrected alignment + instrumentation
    // =============================================
    renderPostop() {
        const ctx = this.ctxs.postop;
        this._clearCanvas(ctx);

        this._drawXray(ctx, this.C.dimPostop);

        if (this.landmarks.length < 4) {
            this._centeredText(ctx, 'No data for postop projection');
            return;
        }

        const postopLM = this._computePostopLandmarks();
        const postopPts = this._getSpinePoints(postopLM);

        // 1) Draw corrected alignment curve (green)
        this._drawAlignmentCurve(ctx, postopPts, this.C.postopSpine, this.C.postopSpineGlow, 2.5);

        // 2) Draw corrected plumbline
        this._drawPlumbline(ctx, postopLM, this.C.postopSpine);

        // 3) Draw instrumentation (screws, rods, cages)
        this._drawInstrumentation(ctx, postopLM);

        // 4) Draw corrected landmark dots
        this._drawDots(ctx, postopLM, this.C.postopSpine, 3);

        // 5) Draw postop measurements
        this._drawPostopMeasurements(ctx);

        // 6) Panel label
        this._drawPanelBadge(ctx, 'CORRECTED POSTOP', this.C.postopSpine);
    },

    _drawPostopMeasurements(ctx) {
        const corrData = this.region === 'lumbar'
            ? this.correctionResults.lumbar
            : this.correctionResults.cervical;
        if (!corrData || !corrData.params) return;

        const x = this.canvasW - 12;
        let y = 40;
        const lineH = 22;

        ctx.textAlign = 'right';

        corrData.params.forEach(p => {
            const col = this.C.postopLabel;
            this._drawMeasureTag(ctx, x, y, `${p.label}: ${p.target}`, col);
            y += lineH;
        });

        ctx.textAlign = 'left';
    },


    // =============================================
    // INSTRUMENTATION OVERLAY (Postop panel)
    // =============================================
    _drawInstrumentation(ctx, landmarks) {
        const approach = this.region === 'cervical'
            ? this.cervicalData.approach
            : this.lumbarData.approach;
        const levels = this.region === 'cervical'
            ? parseInt(this.cervicalData.levels) || 2
            : parseInt(this.lumbarData.levels) || 2;

        // Generate screw positions
        const screws = this._generateScrewPositions(landmarks, levels);
        if (screws.length < 2) return;

        // Draw rods (behind screws)
        this._drawRods(ctx, screws);

        // Draw pedicle screws
        screws.forEach(sp => {
            this._drawPedicleScrew(ctx, sp, sp.angle, 'left');
            this._drawPedicleScrew(ctx, sp, sp.angle, 'right');
        });

        // Draw interbody cages
        if (approach && approach !== 'posterior_only' && approach !== 'posterior') {
            for (let i = 0; i < screws.length - 1; i++) {
                this._drawInterbodyCage(ctx, screws[i], screws[i + 1]);
            }
        }
    },

    _generateScrewPositions(landmarks, numLevels) {
        const positions = [];
        let upper, lower;

        if (this.region === 'lumbar' && landmarks.length >= 4) {
            upper = this._mid(landmarks[0], landmarks[1]);
            lower = this._mid(landmarks[2], landmarks[3]);
        } else if (this.region === 'cervical' && landmarks.length >= 5) {
            upper = this._mid(landmarks[0], landmarks[1]);
            lower = this._mid(landmarks[3], landmarks[4]);
        } else {
            return positions;
        }

        // Calculate spine curve direction at each level for angling screws
        for (let i = 0; i <= numLevels; i++) {
            const t = numLevels > 0 ? i / numLevels : 0;
            const pos = {
                x: upper.x + (lower.x - upper.x) * t,
                y: upper.y + (lower.y - upper.y) * t,
                angle: Math.atan2(lower.y - upper.y, lower.x - upper.x)
            };
            positions.push(pos);
        }

        // Refine angles using neighboring points for more natural screw direction
        for (let i = 0; i < positions.length; i++) {
            const prev = positions[Math.max(0, i - 1)];
            const next = positions[Math.min(positions.length - 1, i + 1)];
            positions[i].angle = Math.atan2(next.y - prev.y, next.x - prev.x);
        }

        return positions;
    },

    _drawPedicleScrew(ctx, pos, angle, side) {
        ctx.save();
        ctx.translate(pos.x, pos.y);

        // Screw perpendicular to spine line
        const perpAngle = angle - Math.PI / 2;
        const screwAngle = side === 'left'
            ? perpAngle - 0.25
            : perpAngle + Math.PI + 0.25;
        ctx.rotate(screwAngle);

        const len = Math.max(18, this.canvasW * 0.04);
        const shaftW = 2.5;

        // Shaft
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(len, 0);
        ctx.strokeStyle = this.C.screwShaft;
        ctx.lineWidth = shaftW;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Thread marks
        for (let t = 4; t < len - 2; t += 3) {
            ctx.beginPath();
            ctx.moveTo(t, -(shaftW + 0.5));
            ctx.lineTo(t, (shaftW + 0.5));
            ctx.strokeStyle = this.C.screwThread;
            ctx.lineWidth = 0.6;
            ctx.stroke();
        }

        // Screw head (tulip)
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = this.C.screwHead;
        ctx.fill();
        ctx.strokeStyle = this.C.screwThread;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = this.C.screwThread;
        ctx.fill();

        // Tip
        ctx.beginPath();
        ctx.moveTo(len, -1.5);
        ctx.lineTo(len + 3, 0);
        ctx.lineTo(len, 1.5);
        ctx.closePath();
        ctx.fillStyle = this.C.screwShaft;
        ctx.fill();

        ctx.restore();
    },

    _drawRods(ctx, screwPositions) {
        if (screwPositions.length < 2) return;

        // Draw bilateral rods
        ['left', 'right'].forEach(side => {
            const offset = side === 'left' ? -5 : 5;

            ctx.beginPath();
            const pts = screwPositions.map(sp => ({
                x: sp.x + offset * Math.cos(sp.angle - Math.PI / 2),
                y: sp.y + offset * Math.sin(sp.angle - Math.PI / 2)
            }));

            ctx.moveTo(pts[0].x, pts[0].y);
            if (pts.length === 2) {
                ctx.lineTo(pts[1].x, pts[1].y);
            } else {
                for (let i = 1; i < pts.length; i++) {
                    const prev = pts[i - 1];
                    const curr = pts[i];
                    const cpx = (prev.x + curr.x) / 2;
                    const cpy = (prev.y + curr.y) / 2;
                    ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
                }
                ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            }

            // Main rod stroke
            ctx.strokeStyle = this.C.rod;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Highlight for 3D
            ctx.strokeStyle = this.C.rodHighlight;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    },

    _drawInterbodyCage(ctx, upper, lower) {
        const cx = (upper.x + lower.x) / 2;
        const cy = (upper.y + lower.y) / 2;
        const dist = this._dist(upper, lower);
        const angle = Math.atan2(lower.y - upper.y, lower.x - upper.x);

        const cageW = Math.max(dist * 0.55, 15);
        const cageH = Math.max(dist * 0.35, 8);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2); // perpendicular to spine

        const hw = cageW / 2;
        const hh = cageH / 2;
        const r = 3;

        // Rounded rect cage body
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

        ctx.fillStyle = this.C.cage;
        ctx.fill();
        ctx.strokeStyle = this.C.cageStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Graft window
        ctx.strokeStyle = this.C.cageGraft;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-hw * 0.4, -hh * 0.4, hw * 0.8, hh * 0.8);

        ctx.restore();
    },


    // =============================================
    // POSTOP LANDMARK COMPUTATION
    // =============================================
    _computePostopLandmarks() {
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
        // Lumbar: 0=L1SupAnt, 1=L1SupPost, 2=L5InfAnt, 3=L5InfPost,
        //   4=S1SupMid, 5=S1PostSup, 6=C7Center, 7=FHLeft, 8=FHRight
        const params = this.correctionResults.lumbar.params;
        const currentSVA = this.lumbarData.sva;
        const currentLL = this.lumbarData.ll;

        // 1. SVA correction
        if (postop.length >= 7 && currentSVA) {
            let targetSVA = currentSVA;
            const svaParam = params.find(p => p.label && p.label.includes('SVA'));
            if (svaParam && svaParam.target) {
                const match = svaParam.target.match(/(\d+)/);
                if (match) targetSVA = parseFloat(match[1]);
            }
            if (currentSVA > targetSVA) {
                const svaDelta = currentSVA - targetSVA;
                const shift = svaDelta * this.pixelScale;
                postop[6].x -= shift;
                postop[0].x -= shift * 0.4;
                postop[1].x -= shift * 0.4;
            }
        }

        // 2. LL correction
        if (postop.length >= 4 && currentLL) {
            const pi = this.lumbarData.pi || 55;
            const targetLL = pi;
            const llDelta = targetLL - currentLL;
            if (llDelta > 0) {
                const llDeltaRad = (llDelta * Math.PI) / 180;
                const pivot = this._mid(postop[2], postop[3]);

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
        const params = this.correctionResults.cervical.params;
        const currentCSVA = this.cervicalData.csva;
        const currentCL = this.cervicalData.cl;

        // cSVA correction
        if (postop.length >= 6 && currentCSVA) {
            let targetCSVA = 25;
            const csvaParam = params.find(p => p.label && p.label.includes('cSVA'));
            if (csvaParam && csvaParam.target) {
                const match = csvaParam.target.match(/(\d+)/);
                if (match) targetCSVA = parseFloat(match[1]);
            }
            if (currentCSVA > targetCSVA) {
                const delta = currentCSVA - targetCSVA;
                const shift = delta * this.pixelScale;
                postop[2].x -= shift;
                postop[0].x -= shift * 0.8;
                postop[1].x -= shift * 0.8;
            }
        }

        // CL correction
        if (postop.length >= 5 && currentCL) {
            const t1s = this.cervicalData.t1s || 25;
            const targetCL = -(t1s - 16.5);
            const clDelta = targetCL - currentCL;
            if (Math.abs(clDelta) > 2) {
                const clDeltaRad = (clDelta * Math.PI) / 180;
                const pivot = this._mid(postop[3], postop[4]);
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
    // SURGICAL STEPS (HTML panel below canvases)
    // =============================================
    renderSurgicalSteps() {
        const container = document.getElementById('planStepsContainer');
        if (!container) return;

        const data = this.region === 'lumbar' ? this.lumbarData : this.cervicalData;
        const corrData = this.region === 'lumbar'
            ? this.correctionResults.lumbar
            : this.correctionResults.cervical;
        const patient = this.patientData;
        const approach = data.approach || '';
        const levels = data.levels || '';
        const osteotomy = data.osteotomy || '';

        const steps = [];

        // Step 1: Patient positioning & approach
        steps.push({
            num: 1,
            title: 'Patient Positioning & Approach',
            detail: this._getApproachDescription(approach, this.region)
        });

        // Step 2: Decompression / preparation
        if (osteotomy && osteotomy !== 'none') {
            const osteoNames = { spo: 'Smith-Petersen Osteotomy (SPO)', pso: 'Pedicle Subtraction Osteotomy (PSO)', vcr: 'Vertebral Column Resection (VCR)' };
            steps.push({
                num: 2,
                title: 'Osteotomy & Decompression',
                detail: `Perform ${osteoNames[osteotomy] || osteotomy} at the planned level to achieve the desired sagittal correction. Release anterior longitudinal ligament as needed.`
            });
        } else {
            steps.push({
                num: 2,
                title: 'Decompression & Disc Preparation',
                detail: `Perform decompression at ${levels || 'planned'} level(s). Prepare disc spaces with complete annulotomy, discectomy, and endplate preparation.`
            });
        }

        // Step 3: Interbody cage placement
        if (approach && approach !== 'posterior_only' && approach !== 'posterior') {
            const cageRec = this.implantRecs.find(r => r.category && (r.category.includes('Interbody') || r.category.includes('ALIF') || r.category.includes('TLIF') || r.name.includes('tezo') || r.name.includes('Flux') || r.name.includes('uCerv')));
            const cageName = cageRec ? cageRec.name : 'appropriately sized interbody cage';
            steps.push({
                num: 3,
                title: 'Interbody Cage Placement',
                detail: `Insert ${cageName} at each prepared disc space. Pack with bone graft. Cage selection: height and lordotic angle per preoperative templating to achieve target segmental lordosis.`
            });
        }

        // Step 4: Pedicle screw placement
        const screwRec = this.implantRecs.find(r => r.name && (r.name.includes('Momentum') || r.name.includes('Cortium') || r.name.includes('neon')));
        const screwSys = screwRec ? screwRec.name : 'posterior fixation system';
        const cementNote = (patient.boneQuality === 'osteoporosis')
            ? ' Consider cement augmentation (G21 V-STEADY) for improved screw purchase in osteoporotic bone.'
            : '';
        steps.push({
            num: steps.length + 1,
            title: 'Pedicle Screw Instrumentation',
            detail: `Place pedicle screws (${screwSys}) at ${levels || 'planned'} level(s). Confirm placement with fluoroscopy or navigation.${cementNote}`
        });

        // Step 5: Rod placement & correction
        steps.push({
            num: steps.length + 1,
            title: 'Rod Contouring & Final Correction',
            detail: this._getCorrectionDescription(corrData, data)
        });

        // Step 6: Final check
        steps.push({
            num: steps.length + 1,
            title: 'Intraoperative Confirmation',
            detail: 'Obtain intraoperative lateral radiograph. Confirm SVA, lordosis, and hardware position. Verify neural elements are decompressed. Final tightening of set screws.'
        });

        // Render steps
        container.innerHTML = steps.map(s => `
            <div class="plan-step">
                <div class="plan-step-num">${s.num}</div>
                <div class="plan-step-body">
                    <div class="plan-step-title">${s.title}</div>
                    <div class="plan-step-detail">${s.detail}</div>
                </div>
            </div>
        `).join('');
    },

    _getApproachDescription(approach, region) {
        if (region === 'cervical') {
            const map = {
                anterior: 'Supine position. Anterior cervical approach (Smith-Robinson). Identify target disc levels under fluoroscopy.',
                posterior: 'Prone position with Mayfield head fixation. Posterior midline approach. Expose lateral masses / pedicles at target levels.',
                combined: 'Staged anterior-posterior approach. Begin with anterior cervical discectomy and fusion, followed by posterior instrumented stabilization.'
            };
            return map[approach] || 'Position patient and perform the planned surgical approach to the cervical spine.';
        } else {
            const map = {
                posterior: 'Prone position on Wilson or Jackson frame. Posterior midline approach. Expose transverse processes and pedicle entry points bilaterally at target levels.',
                lateral: 'Lateral decubitus position. Retroperitoneal transpsoas or anterior-to-psoas approach for lateral interbody access. Neuromonitoring required.',
                anterior: 'Supine position. Retroperitoneal or transperitoneal anterior approach. Expose anterior disc spaces at target levels with vascular surgery assistance as needed.',
                combined: 'Staged or same-day combined approach. Lateral or anterior interbody access followed by posterior pedicle screw fixation for 3-column correction.'
            };
            return map[approach] || 'Position patient and perform the planned surgical approach to the lumbar spine.';
        }
    },

    _getCorrectionDescription(corrData, data) {
        if (!corrData || !corrData.params) {
            return 'Contour rods to achieve planned lordosis. Perform sequential correction maneuvers. Lock set screws.';
        }

        const corrections = corrData.params.map(p => `${p.label}: ${p.current} ${p.unit} → ${p.target}`).join('; ');
        return `Contour rods to planned lordosis profile. Perform sequential compression/distraction to achieve correction targets: ${corrections}. Use in-situ rod bending if needed. Apply final compression across interbody cages.`;
    },


    // =============================================
    // COMPARISON TABLE
    // =============================================
    renderComparisonTable() {
        const container = document.getElementById('planComparisonTable');
        if (!container) return;

        const allParams = [
            ...(this.correctionResults.cervical ? this.correctionResults.cervical.params : []),
            ...(this.correctionResults.lumbar ? this.correctionResults.lumbar.params : [])
        ];

        if (allParams.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);padding:12px;font-size:13px;">No correction targets computed.</p>';
            return;
        }

        const rows = allParams.map(p => `
            <tr>
                <td style="font-weight:600;">${p.label}</td>
                <td><span style="color:${this.C.preopSpine};">${p.current} ${p.unit}</span></td>
                <td><span style="color:${this.C.postopSpine};">${p.target}</span></td>
                <td>${p.correction}</td>
                <td><span class="param-status ${p.severity.cls}">${p.severity.text}</span></td>
            </tr>
        `).join('');

        container.innerHTML = `
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Parameter</th>
                        <th style="color:${this.C.preopSpine};">Preop</th>
                        <th style="color:${this.C.postopSpine};">Target</th>
                        <th>Correction Δ</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },


    // =============================================
    // LEGEND
    // =============================================
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
                    <span class="plan-legend-swatch" style="background:${this.C.preopSpine}"></span>
                    <span>Preop alignment</span>
                </div>
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.C.corrCurve}"></span>
                    <span>Correction target</span>
                </div>
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.C.postopSpine}"></span>
                    <span>Corrected alignment</span>
                </div>
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.C.screw}; border-radius:50%;"></span>
                    <span>Pedicle screws</span>
                </div>
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.C.rod}; height:4px; border-radius:2px;"></span>
                    <span>Connecting rods</span>
                </div>
                <div class="plan-legend-entry">
                    <span class="plan-legend-swatch" style="background:${this.C.cage}; border:1.5px solid ${this.C.cageStroke};"></span>
                    <span>Interbody cage</span>
                </div>
            </div>
            ${recNames ? `<div class="plan-legend-implants"><strong>Recommended Implants:</strong> ${recNames}</div>` : ''}
        `;
    },


    // =============================================
    // SHARED DRAWING HELPERS
    // =============================================
    _clearCanvas(ctx) {
        ctx.clearRect(0, 0, this.canvasW, this.canvasH);
    },

    _drawXray(ctx, alpha) {
        if (this.image) {
            ctx.globalAlpha = alpha;
            ctx.drawImage(this.image, 0, 0, this.canvasW, this.canvasH);
            ctx.globalAlpha = 1.0;
        } else {
            ctx.fillStyle = this.C.bgDark;
            ctx.fillRect(0, 0, this.canvasW, this.canvasH);
        }
    },

    _getSpinePoints(landmarks) {
        const pts = [];
        if (this.region === 'lumbar') {
            if (landmarks.length >= 7) pts.push(landmarks[6]); // C7
            if (landmarks.length >= 2) pts.push(this._mid(landmarks[0], landmarks[1])); // L1 mid
            if (landmarks.length >= 4) pts.push(this._mid(landmarks[2], landmarks[3])); // L5 mid
            if (landmarks.length >= 5) pts.push(landmarks[4]); // S1 Sup Mid
            if (landmarks.length >= 6) pts.push(landmarks[5]); // S1 Post-Sup
        } else if (this.region === 'cervical') {
            if (landmarks.length >= 3) pts.push(landmarks[2]); // C2 centroid
            if (landmarks.length >= 2) pts.push(this._mid(landmarks[0], landmarks[1])); // C2 endplate
            if (landmarks.length >= 5) pts.push(this._mid(landmarks[3], landmarks[4])); // C7 endplate
            if (landmarks.length >= 6) pts.push(landmarks[5]); // C7 Post-Sup
            if (landmarks.length >= 8) pts.push(this._mid(landmarks[6], landmarks[7])); // T1
        }
        return pts;
    },

    _drawAlignmentCurve(ctx, points, color, glowColor, width) {
        if (points.length < 2) return;

        // Glow
        ctx.beginPath();
        this._traceCurve(ctx, points);
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = width + 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main line
        ctx.beginPath();
        this._traceCurve(ctx, points);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.stroke();
    },

    _traceCurve(ctx, points) {
        ctx.moveTo(points[0].x, points[0].y);
        if (points.length === 2) {
            ctx.lineTo(points[1].x, points[1].y);
        } else {
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const cpx = (prev.x + curr.x) / 2;
                const cpy = (prev.y + curr.y) / 2;
                ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
            }
            const last = points[points.length - 1];
            ctx.lineTo(last.x, last.y);
        }
    },

    _drawPlumbline(ctx, landmarks, color) {
        if (this.region === 'lumbar' && landmarks.length >= 7) {
            const c7 = landmarks[6];
            const s1 = landmarks[5];
            const endY = Math.max(s1.y + 25, c7.y + 80);

            ctx.beginPath();
            ctx.moveTo(c7.x, c7.y);
            ctx.lineTo(c7.x, endY);
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 1;
            ctx.setLineDash(this.C.plumbDash);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Horizontal offset from S1
            ctx.beginPath();
            ctx.moveTo(c7.x, s1.y);
            ctx.lineTo(s1.x, s1.y);
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        } else if (this.region === 'cervical' && landmarks.length >= 6) {
            const c2 = landmarks[2];
            const c7 = landmarks[5];
            const endY = Math.max(c7.y + 25, c2.y + 80);

            ctx.beginPath();
            ctx.moveTo(c2.x, c2.y);
            ctx.lineTo(c2.x, endY);
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 1;
            ctx.setLineDash(this.C.plumbDash);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }
    },

    _drawDots(ctx, landmarks, color, r) {
        landmarks.forEach(lm => {
            ctx.beginPath();
            ctx.arc(lm.x, lm.y, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        });
    },

    _drawMeasureTag(ctx, x, y, text, color) {
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        const tw = ctx.measureText(text).width;
        const align = ctx.textAlign || 'left';

        let rx = x;
        if (align === 'right') rx = x - tw - 8;
        else if (align === 'center') rx = x - tw / 2 - 4;
        else rx = x - 4;

        ctx.fillStyle = this.C.labelBg;
        ctx.fillRect(rx, y - 9, tw + 8, 18);
        ctx.fillStyle = color;
        ctx.fillText(text, align === 'right' ? x - tw - 4 : (align === 'center' ? x - tw / 2 : x), y + 3);
    },

    _drawPanelBadge(ctx, text, color) {
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        const tw = ctx.measureText(text).width;
        const px = 10;
        const py = 12;

        ctx.fillStyle = this.C.stepBadgeBg;
        ctx.fillRect(px, py - 9, tw + 16, 22);
        ctx.fillStyle = color;
        ctx.fillText(text, px + 8, py + 5);
    },

    _centeredText(ctx, text) {
        ctx.fillStyle = this.C.bgDark;
        ctx.fillRect(0, 0, this.canvasW, this.canvasH);
        ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#8b95a8';
        ctx.textAlign = 'center';
        ctx.fillText(text, this.canvasW / 2, this.canvasH / 2);
        ctx.textAlign = 'left';
    },


    // =============================================
    // GEOMETRY UTILITIES
    // =============================================
    _mid(p1, p2) {
        return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    },

    _dist(p1, p2) {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    },

    _rotatePoint(point, pivot, angle) {
        const dx = point.x - pivot.x;
        const dy = point.y - pivot.y;
        return {
            x: pivot.x + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: pivot.y + dx * Math.sin(angle) + dy * Math.cos(angle)
        };
    },

    _estimatePixelScale() {
        if (this.region === 'lumbar' && this.landmarks.length >= 4) {
            const l1 = this._mid(this.landmarks[0], this.landmarks[1]);
            const s1 = this._mid(this.landmarks[2], this.landmarks[3]);
            return this._dist(l1, s1) / 150; // L1-S1 ≈ 150mm
        } else if (this.region === 'cervical' && this.landmarks.length >= 5) {
            const c2 = this._mid(this.landmarks[0], this.landmarks[1]);
            const c7 = this._mid(this.landmarks[3], this.landmarks[4]);
            return this._dist(c2, c7) / 100; // C2-C7 ≈ 100mm
        }
        return 1;
    }
};
