// =============================================
// SpineAlign — Canvas Landmark Annotator
// Manual landmark placement on lateral X-ray
// Auto-computes spine deformity parameters
// =============================================

const Annotator = {

    // ---- State ----
    canvas: null,
    ctx: null,
    image: null,
    region: null, // 'cervical' or 'lumbar'
    landmarks: [], // [{x, y}] placed points (canvas coords)
    landmarkDefs: [], // current landmark definitions
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    imgW: 0,
    imgH: 0,
    draggingIdx: -1,
    hoverIdx: -1,
    overrides: {}, // manual mm overrides for distances

    // ---- Landmark Definitions ----
    CERVICAL_LANDMARKS: [
        { id: 'c2_sup_ant',  label: 'C2 Superior Endplate (Anterior)',  short: 'C2 Sup Ant' },
        { id: 'c2_sup_post', label: 'C2 Superior Endplate (Posterior)', short: 'C2 Sup Post' },
        { id: 'c2_centroid', label: 'C2 Centroid',                      short: 'C2 Center' },
        { id: 'c7_inf_ant',  label: 'C7 Inferior Endplate (Anterior)',  short: 'C7 Inf Ant' },
        { id: 'c7_inf_post', label: 'C7 Inferior Endplate (Posterior)', short: 'C7 Inf Post' },
        { id: 'c7_sup_post', label: 'C7 Posterior-Superior Corner',     short: 'C7 Post-Sup' },
        { id: 't1_sup_ant',  label: 'T1 Superior Endplate (Anterior)',  short: 'T1 Sup Ant' },
        { id: 't1_sup_post', label: 'T1 Superior Endplate (Posterior)', short: 'T1 Sup Post' },
        { id: 'chin',        label: 'Chin Point',                       short: 'Chin' },
        { id: 'brow',        label: 'Brow Point',                       short: 'Brow' }
    ],

    LUMBAR_LANDMARKS: [
        { id: 'l1_sup_ant',  label: 'L1 Superior Endplate (Anterior)',  short: 'L1 Sup Ant' },
        { id: 'l1_sup_post', label: 'L1 Superior Endplate (Posterior)', short: 'L1 Sup Post' },
        { id: 's1_sup_ant',  label: 'S1 Superior Endplate (Anterior)',  short: 'S1 Sup Ant' },
        { id: 's1_sup_post', label: 'S1 Superior Endplate (Posterior)', short: 'S1 Sup Post' },
        { id: 's1_post_sup', label: 'S1 Posterior-Superior Corner',     short: 'S1 Post-Sup' },
        { id: 'c7_centroid', label: 'C7 Centroid (on full-spine film)', short: 'C7 Center' },
        { id: 'fh_left',     label: 'Left Femoral Head Center',         short: 'FH Left' },
        { id: 'fh_right',    label: 'Right Femoral Head Center',        short: 'FH Right' }
    ],

    // ---- Colors ----
    COLORS: {
        landmark: '#4ae0d2',
        landmarkStroke: '#1a2332',
        active: '#fbbf24',
        hover: '#60a5fa',
        line: 'rgba(74, 224, 210, 0.6)',
        lineDash: [6, 4],
        text: '#e0e4ea',
        textBg: 'rgba(13, 17, 23, 0.75)',
        angleFill: 'rgba(74, 158, 173, 0.15)',
        angleStroke: 'rgba(74, 158, 173, 0.6)'
    },

    // =============================================
    // INITIALIZATION
    // =============================================
    init(region, imageSrc) {
        this.region = region;
        this.landmarks = [];
        this.overrides = {};
        this.draggingIdx = -1;
        this.hoverIdx = -1;
        this.scale = 1;

        this.landmarkDefs = region === 'cervical'
            ? this.CERVICAL_LANDMARKS
            : this.LUMBAR_LANDMARKS;

        this.canvas = document.getElementById('annotatorCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Load image
        this.image = new Image();
        this.image.onload = () => {
            this.fitImageToCanvas();
            this.bindEvents();
            this.render();
            this.updateSidebar();
            this.buildOverrideInputs();
        };
        this.image.src = imageSrc;
    },

    fitImageToCanvas() {
        const wrap = document.getElementById('annotatorCanvasWrap');
        const maxW = wrap.clientWidth;
        const maxH = Math.max(500, window.innerHeight - 260);

        const aspect = this.image.width / this.image.height;
        let w, h;
        if (this.image.width / maxW > this.image.height / maxH) {
            w = maxW;
            h = maxW / aspect;
        } else {
            h = maxH;
            w = maxH * aspect;
        }

        this.imgW = w;
        this.imgH = h;

        // Set canvas pixel dimensions
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.offsetX = 0;
        this.offsetY = 0;
    },

    // =============================================
    // EVENT HANDLING
    // =============================================
    bindEvents() {
        // Remove old listeners
        this.canvas.onmousedown = null;
        this.canvas.onmousemove = null;
        this.canvas.onmouseup = null;
        this.canvas.ontouchstart = null;
        this.canvas.ontouchmove = null;
        this.canvas.ontouchend = null;

        this.canvas.onmousedown = (e) => this.onPointerDown(e);
        this.canvas.onmousemove = (e) => this.onPointerMove(e);
        this.canvas.onmouseup = (e) => this.onPointerUp(e);

        // Touch support
        this.canvas.ontouchstart = (e) => {
            e.preventDefault();
            const t = e.touches[0];
            this.onPointerDown(t);
        };
        this.canvas.ontouchmove = (e) => {
            e.preventDefault();
            const t = e.touches[0];
            this.onPointerMove(t);
        };
        this.canvas.ontouchend = (e) => {
            e.preventDefault();
            this.onPointerUp(e);
        };
    },

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / this.scale,
            y: (e.clientY - rect.top) / this.scale
        };
    },

    findNearLandmark(pos, threshold) {
        threshold = threshold || 12;
        for (let i = this.landmarks.length - 1; i >= 0; i--) {
            const lm = this.landmarks[i];
            const dx = lm.x - pos.x;
            const dy = lm.y - pos.y;
            if (Math.sqrt(dx * dx + dy * dy) < threshold) return i;
        }
        return -1;
    },

    onPointerDown(e) {
        const pos = this.getCanvasPos(e);
        const nearIdx = this.findNearLandmark(pos);

        if (nearIdx >= 0) {
            // Start dragging existing landmark
            this.draggingIdx = nearIdx;
            this.canvas.style.cursor = 'grabbing';
        } else if (this.landmarks.length < this.landmarkDefs.length) {
            // Place new landmark
            this.landmarks.push({ x: pos.x, y: pos.y });
            this.render();
            this.updateSidebar();
            this.computeMeasurements();
        }
    },

    onPointerMove(e) {
        const pos = this.getCanvasPos(e);

        if (this.draggingIdx >= 0) {
            this.landmarks[this.draggingIdx].x = pos.x;
            this.landmarks[this.draggingIdx].y = pos.y;
            this.render();
            this.computeMeasurements();
        } else {
            const nearIdx = this.findNearLandmark(pos);
            if (nearIdx >= 0) {
                this.canvas.style.cursor = 'grab';
                this.hoverIdx = nearIdx;
            } else if (this.landmarks.length < this.landmarkDefs.length) {
                this.canvas.style.cursor = 'crosshair';
                this.hoverIdx = -1;
            } else {
                this.canvas.style.cursor = 'default';
                this.hoverIdx = -1;
            }
        }
    },

    onPointerUp() {
        if (this.draggingIdx >= 0) {
            this.draggingIdx = -1;
            this.canvas.style.cursor = 'crosshair';
            this.updateSidebar();
            this.computeMeasurements();
        }
    },

    // =============================================
    // RENDERING
    // =============================================
    render() {
        const ctx = this.ctx;
        const w = this.imgW;
        const h = this.imgH;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Draw image
        ctx.save();
        ctx.scale(this.scale, this.scale);
        ctx.translate(this.offsetX, this.offsetY);
        ctx.drawImage(this.image, 0, 0, w / this.scale, h / this.scale);
        ctx.restore();

        // Draw measurement lines
        this.drawMeasurementLines(ctx);

        // Draw landmarks
        for (let i = 0; i < this.landmarks.length; i++) {
            this.drawLandmark(ctx, i);
        }

        // Draw next landmark indicator
        if (this.landmarks.length < this.landmarkDefs.length) {
            this.drawNextIndicator(ctx);
        }
    },

    drawLandmark(ctx, idx) {
        const lm = this.landmarks[idx];
        const def = this.landmarkDefs[idx];
        const isHover = idx === this.hoverIdx;
        const isDrag = idx === this.draggingIdx;
        const r = isHover || isDrag ? 7 : 5;
        const color = isHover ? this.COLORS.hover :
                     isDrag ? this.COLORS.active :
                     this.COLORS.landmark;

        // Outer ring
        ctx.beginPath();
        ctx.arc(lm.x, lm.y, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = this.COLORS.landmarkStroke;
        ctx.fill();

        // Inner dot
        ctx.beginPath();
        ctx.arc(lm.x, lm.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        const label = def.short;
        ctx.font = '10px -apple-system, sans-serif';
        const tw = ctx.measureText(label).width;
        const lx = lm.x + 10;
        const ly = lm.y - 6;

        ctx.fillStyle = this.COLORS.textBg;
        ctx.fillRect(lx - 2, ly - 10, tw + 4, 14);
        ctx.fillStyle = color;
        ctx.fillText(label, lx, ly);
    },

    drawNextIndicator(ctx) {
        const nextIdx = this.landmarks.length;
        const def = this.landmarkDefs[nextIdx];

        // Instruction text at top
        ctx.font = 'bold 12px -apple-system, sans-serif';
        ctx.fillStyle = this.COLORS.active;
        ctx.textAlign = 'center';
        ctx.fillText(`Click to place: ${def.label}`, this.imgW / 2, 20);
        ctx.textAlign = 'left';
    },

    drawMeasurementLines(ctx) {
        if (this.region === 'cervical') {
            this.drawCervicalLines(ctx);
        } else {
            this.drawLumbarLines(ctx);
        }
    },

    // ---- Cervical measurement lines ----
    drawCervicalLines(ctx) {
        const lm = this.landmarks;

        // C2 superior endplate line (0-1)
        if (lm.length >= 2) {
            this.drawLine(ctx, lm[0], lm[1], 'C2 Sup');
        }

        // C7 inferior endplate line (3-4)
        if (lm.length >= 5) {
            this.drawLine(ctx, lm[3], lm[4], 'C7 Inf');

            // CL Cobb angle visualization
            const angle = this.cobbAngle(lm[0], lm[1], lm[3], lm[4]);
            this.drawAngleArc(ctx, lm[0], lm[1], lm[3], lm[4], `CL: ${angle.toFixed(1)}\u00B0`);
        }

        // cSVA plumbline from C2 centroid (2) to C7 post-sup (5)
        if (lm.length >= 6) {
            // Vertical plumb from C2
            const plumbEnd = { x: lm[2].x, y: Math.max(lm[5].y, lm[2].y + 100) };
            this.drawDashedLine(ctx, lm[2], plumbEnd, 'C2 plumb');

            // Horizontal offset at C7 level
            const c7Ref = { x: lm[2].x, y: lm[5].y };
            this.drawDashedLine(ctx, c7Ref, lm[5], '');

            const dist = Math.abs(lm[2].x - lm[5].x);
            this.drawLabel(ctx, (lm[2].x + lm[5].x) / 2, lm[5].y - 8, `cSVA: ${dist.toFixed(0)}px`);
        }

        // T1 slope line (6-7)
        if (lm.length >= 8) {
            this.drawLine(ctx, lm[6], lm[7], 'T1');
            const t1s = this.lineAngle(lm[6], lm[7]);
            this.drawLabel(ctx, (lm[6].x + lm[7].x) / 2, (lm[6].y + lm[7].y) / 2 - 12, `T1S: ${t1s.toFixed(1)}\u00B0`);
        }

        // CBVA line (8-9)
        if (lm.length >= 10) {
            this.drawLine(ctx, lm[8], lm[9], 'CBVA');
            const cbva = this.angleToVertical(lm[8], lm[9]);
            this.drawLabel(ctx, (lm[8].x + lm[9].x) / 2, (lm[8].y + lm[9].y) / 2 - 12, `CBVA: ${cbva.toFixed(1)}\u00B0`);
        }
    },

    // ---- Lumbar measurement lines ----
    drawLumbarLines(ctx) {
        const lm = this.landmarks;

        // L1 superior endplate (0-1)
        if (lm.length >= 2) {
            this.drawLine(ctx, lm[0], lm[1], 'L1 Sup');
        }

        // S1 superior endplate (2-3)
        if (lm.length >= 4) {
            this.drawLine(ctx, lm[2], lm[3], 'S1 Sup');

            // LL Cobb angle
            const angle = this.cobbAngle(lm[0], lm[1], lm[2], lm[3]);
            this.drawAngleArc(ctx, lm[0], lm[1], lm[2], lm[3], `LL: ${angle.toFixed(1)}\u00B0`);
        }

        // SVA: C7 centroid (5) to S1 post-sup (4)
        if (lm.length >= 6) {
            const plumbEnd = { x: lm[5].x, y: Math.max(lm[4].y, lm[5].y + 100) };
            this.drawDashedLine(ctx, lm[5], plumbEnd, 'C7 plumb');

            const s1Ref = { x: lm[5].x, y: lm[4].y };
            this.drawDashedLine(ctx, s1Ref, lm[4], '');

            const dist = Math.abs(lm[5].x - lm[4].x);
            this.drawLabel(ctx, (lm[5].x + lm[4].x) / 2, lm[4].y - 8, `SVA: ${dist.toFixed(0)}px`);
        }

        // PI: S1 endplate perpendicular → hip center (6-7)
        if (lm.length >= 8) {
            // Midpoint of S1 endplate
            const s1Mid = this.midpoint(lm[2], lm[3]);
            // Midpoint of femoral heads = hip center
            const hipCenter = this.midpoint(lm[6], lm[7]);

            // Draw femoral head markers
            ctx.beginPath();
            ctx.arc(lm[6].x, lm[6].y, 3, 0, Math.PI * 2);
            ctx.fillStyle = this.COLORS.landmark;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(lm[7].x, lm[7].y, 3, 0, Math.PI * 2);
            ctx.fillStyle = this.COLORS.landmark;
            ctx.fill();

            // Line from hip center to S1 midpoint
            this.drawDashedLine(ctx, hipCenter, s1Mid, '');

            // S1 endplate perpendicular
            const perpAngle = this.perpendicularAngle(lm[2], lm[3]);
            const perpLen = 60;
            const perpEnd = {
                x: s1Mid.x + perpLen * Math.cos(perpAngle),
                y: s1Mid.y + perpLen * Math.sin(perpAngle)
            };
            this.drawDashedLine(ctx, s1Mid, perpEnd, 'perp');

            // Compute PI
            const pi = this.computePI(lm[2], lm[3], hipCenter);
            this.drawLabel(ctx, s1Mid.x + 15, s1Mid.y - 20, `PI: ${pi.toFixed(1)}\u00B0`);

            // Compute PT
            const pt = this.computePT(s1Mid, hipCenter);
            this.drawLabel(ctx, hipCenter.x + 15, hipCenter.y - 8, `PT: ${pt.toFixed(1)}\u00B0`);
        }
    },

    // ---- Drawing Helpers ----
    drawLine(ctx, p1, p2, label) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = this.COLORS.line;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.stroke();

        if (label) {
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            ctx.font = '9px -apple-system, sans-serif';
            ctx.fillStyle = this.COLORS.textBg;
            const tw = ctx.measureText(label).width;
            ctx.fillRect(mx - tw / 2 - 2, my + 4, tw + 4, 12);
            ctx.fillStyle = this.COLORS.text;
            ctx.fillText(label, mx - tw / 2, my + 14);
        }
    },

    drawDashedLine(ctx, p1, p2, label) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = this.COLORS.angleStroke;
        ctx.lineWidth = 1;
        ctx.setLineDash(this.COLORS.lineDash);
        ctx.stroke();
        ctx.setLineDash([]);

        if (label) {
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            ctx.font = '9px -apple-system, sans-serif';
            ctx.fillStyle = this.COLORS.text;
            ctx.fillText(label, mx + 4, my - 4);
        }
    },

    drawLabel(ctx, x, y, text) {
        ctx.font = 'bold 11px -apple-system, sans-serif';
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = this.COLORS.textBg;
        ctx.fillRect(x - tw / 2 - 3, y - 10, tw + 6, 16);
        ctx.fillStyle = this.COLORS.active;
        ctx.textAlign = 'center';
        ctx.fillText(text, x, y);
        ctx.textAlign = 'left';
    },

    drawAngleArc(ctx, a1, a2, b1, b2, label) {
        // Simplified: draw arc near the midpoint between the two lines
        const midA = this.midpoint(a1, a2);
        const midB = this.midpoint(b1, b2);
        const center = this.midpoint(midA, midB);

        ctx.font = 'bold 12px -apple-system, sans-serif';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = this.COLORS.textBg;
        ctx.fillRect(center.x - tw / 2 - 4, center.y - 8, tw + 8, 18);
        ctx.fillStyle = this.COLORS.active;
        ctx.textAlign = 'center';
        ctx.fillText(label, center.x, center.y + 6);
        ctx.textAlign = 'left';
    },

    // =============================================
    // GEOMETRY COMPUTATIONS
    // =============================================

    // Cobb angle between two endplate lines
    // Returns absolute angle in degrees
    cobbAngle(a1, a2, b1, b2) {
        const angleA = Math.atan2(a2.y - a1.y, a2.x - a1.x);
        const angleB = Math.atan2(b2.y - b1.y, b2.x - b1.x);
        let diff = Math.abs(angleA - angleB);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        return diff * (180 / Math.PI);
    },

    // Angle of a line relative to horizontal (degrees)
    lineAngle(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
    },

    // Angle of a line relative to vertical (degrees)
    angleToVertical(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const angleFromHoriz = Math.atan2(dy, dx);
        const angleFromVert = Math.PI / 2 - Math.abs(angleFromHoriz);
        return angleFromVert * (180 / Math.PI);
    },

    // Horizontal offset in pixels
    horizontalOffset(p1, p2) {
        return Math.abs(p1.x - p2.x);
    },

    // Perpendicular angle to an endplate line (radians)
    perpendicularAngle(p1, p2) {
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        return angle - Math.PI / 2; // perpendicular (pointing "up" from endplate)
    },

    midpoint(p1, p2) {
        return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    },

    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    // Pelvic Incidence: angle between S1 endplate perpendicular and line to hip center
    computePI(s1_ant, s1_post, hipCenter) {
        const s1Mid = this.midpoint(s1_ant, s1_post);
        // S1 endplate angle
        const epAngle = Math.atan2(s1_post.y - s1_ant.y, s1_post.x - s1_ant.x);
        // Perpendicular to endplate
        const perpAngle = epAngle - Math.PI / 2;
        // Line from S1 mid to hip center
        const hipAngle = Math.atan2(hipCenter.y - s1Mid.y, hipCenter.x - s1Mid.x);
        // PI = angle between perpendicular and hip line
        let pi = Math.abs(perpAngle - hipAngle);
        if (pi > Math.PI) pi = 2 * Math.PI - pi;
        return pi * (180 / Math.PI);
    },

    // Pelvic Tilt: angle of hip-center-to-S1-midpoint line relative to vertical
    computePT(s1Mid, hipCenter) {
        const dx = s1Mid.x - hipCenter.x;
        const dy = hipCenter.y - s1Mid.y; // positive = upward
        const angleFromVert = Math.atan2(Math.abs(dx), dy);
        return angleFromVert * (180 / Math.PI);
    },

    // =============================================
    // MEASUREMENT COMPUTATION
    // =============================================
    computeMeasurements() {
        const results = this.getResults();
        this.updateMeasurementsSidebar(results);
    },

    // Get computed results (same shape as Cervical.collectData / Lumbar.collectData)
    getResults() {
        if (this.region === 'cervical') {
            return this.getCervicalResults();
        } else {
            return this.getLumbarResults();
        }
    },

    getCervicalResults() {
        const lm = this.landmarks;
        const r = { cl: NaN, csva: NaN, t1s: NaN, cbva: NaN };

        // CL: Cobb angle between C2 sup endplate (0-1) and C7 inf endplate (3-4)
        if (lm.length >= 5) {
            let cobb = this.cobbAngle(lm[0], lm[1], lm[3], lm[4]);
            // Convention: lordosis = negative
            // If C2 line slopes more than C7 line → kyphosis → positive
            const a2Slope = (lm[1].y - lm[0].y) / (lm[1].x - lm[0].x);
            const c7Slope = (lm[4].y - lm[3].y) / (lm[4].x - lm[3].x);
            // In lateral X-ray, lordosis means lines converge posteriorly
            // Simplified: if C7 line tilts more anteriorly down → lordosis
            if (c7Slope > a2Slope) {
                cobb = -cobb; // lordotic
            }
            r.cl = parseFloat(cobb.toFixed(1));
        }

        // cSVA: horizontal distance from C2 centroid to C7 post-sup corner
        if (lm.length >= 6) {
            const pxDist = lm[2].x - lm[5].x; // positive = forward
            r.csva = this.overrides.csva != null ? this.overrides.csva : parseFloat(Math.abs(pxDist).toFixed(1));
        }

        // T1S: angle of T1 endplate to horizontal
        if (lm.length >= 8) {
            r.t1s = parseFloat(this.lineAngle(lm[6], lm[7]).toFixed(1));
        }

        // CBVA: chin-brow line angle to vertical
        if (lm.length >= 10) {
            let cbva = this.angleToVertical(lm[8], lm[9]);
            // Positive = chin-down (brow higher than chin in image → chin point below brow)
            if (lm[8].y > lm[9].y) {
                // chin is below brow → could be either way depending on lateral offset
            }
            r.cbva = parseFloat(cbva.toFixed(1));
        }

        return r;
    },

    getLumbarResults() {
        const lm = this.landmarks;
        const r = { pi: NaN, ll: NaN, sva: NaN, pt: NaN };

        // LL: Cobb angle between L1 sup (0-1) and S1 sup (2-3)
        if (lm.length >= 4) {
            r.ll = parseFloat(this.cobbAngle(lm[0], lm[1], lm[2], lm[3]).toFixed(1));
        }

        // SVA: horizontal distance C7 centroid (5) to S1 post-sup (4)
        if (lm.length >= 6) {
            const pxDist = Math.abs(lm[5].x - lm[4].x);
            r.sva = this.overrides.sva != null ? this.overrides.sva : parseFloat(pxDist.toFixed(1));
        }

        // PI and PT: need S1 endplate (2-3) and femoral heads (6-7)
        if (lm.length >= 8) {
            const hipCenter = this.midpoint(lm[6], lm[7]);
            const s1Mid = this.midpoint(lm[2], lm[3]);
            r.pi = parseFloat(this.computePI(lm[2], lm[3], hipCenter).toFixed(1));
            r.pt = parseFloat(this.computePT(s1Mid, hipCenter).toFixed(1));
        }

        return r;
    },

    // =============================================
    // SIDEBAR UPDATES
    // =============================================
    updateSidebar() {
        const checklistEl = document.getElementById('landmarkChecklist');
        if (!checklistEl) return;

        let html = '';
        for (let i = 0; i < this.landmarkDefs.length; i++) {
            const def = this.landmarkDefs[i];
            let cls = '';
            if (i < this.landmarks.length) cls = 'placed';
            else if (i === this.landmarks.length) cls = 'active';

            html += `<div class="landmark-item ${cls}">
                <div class="landmark-dot"></div>
                <span>${def.short}</span>
            </div>`;
        }
        checklistEl.innerHTML = html;
    },

    updateMeasurementsSidebar(results) {
        const el = document.getElementById('measurementsList');
        if (!el) return;

        let html = '';

        if (this.region === 'cervical') {
            html += this.measurementRow('CL', results.cl, '\u00B0');
            html += this.measurementRow('cSVA', results.csva, 'px');
            html += this.measurementRow('T1S', results.t1s, '\u00B0');
            html += this.measurementRow('CBVA', results.cbva, '\u00B0');
        } else {
            html += this.measurementRow('LL', results.ll, '\u00B0');
            html += this.measurementRow('SVA', results.sva, 'px');
            html += this.measurementRow('PI', results.pi, '\u00B0');
            html += this.measurementRow('PT', results.pt, '\u00B0');
        }

        el.innerHTML = html;
    },

    measurementRow(label, value, unit) {
        const disp = isNaN(value) ? '--' : value.toFixed(1);
        const cls = isNaN(value) ? 'pending' : '';
        return `<div class="measurement-row">
            <span class="measurement-label">${label}</span>
            <span class="measurement-value ${cls}">${disp}${isNaN(value) ? '' : unit}</span>
        </div>`;
    },

    buildOverrideInputs() {
        const el = document.getElementById('manualOverrides');
        if (!el) return;

        if (this.region === 'cervical') {
            el.innerHTML = `
                <div class="form-group" style="margin-bottom:8px;">
                    <label style="font-size:11px;">cSVA Override (mm)
                        <span class="hint">Enter mm value if known</span>
                    </label>
                    <input type="number" id="overrideCSVA" step="0.1" min="0" placeholder="mm"
                           style="padding:6px 8px; font-size:12px;"
                           oninput="Annotator.onOverride('csva', this.value)">
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="form-group" style="margin-bottom:8px;">
                    <label style="font-size:11px;">SVA Override (mm)
                        <span class="hint">Enter mm value if known</span>
                    </label>
                    <input type="number" id="overrideSVA" step="0.1" placeholder="mm"
                           style="padding:6px 8px; font-size:12px;"
                           oninput="Annotator.onOverride('sva', this.value)">
                </div>
            `;
        }
    },

    onOverride(key, val) {
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
            this.overrides[key] = num;
        } else {
            delete this.overrides[key];
        }
        this.computeMeasurements();
    },

    // =============================================
    // TOOLBAR ACTIONS
    // =============================================
    undo() {
        if (this.landmarks.length > 0) {
            this.landmarks.pop();
            this.render();
            this.updateSidebar();
            this.computeMeasurements();
        }
    },

    clearAll() {
        this.landmarks = [];
        this.render();
        this.updateSidebar();
        this.computeMeasurements();
    },

    zoomIn() {
        this.scale = Math.min(3, this.scale + 0.2);
        this.fitZoom();
        this.render();
    },

    zoomOut() {
        this.scale = Math.max(0.5, this.scale - 0.2);
        this.fitZoom();
        this.render();
    },

    fitZoom() {
        const wrap = document.getElementById('annotatorCanvasWrap');
        const w = this.imgW * this.scale;
        const h = this.imgH * this.scale;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, 0, 0);
    },

    // =============================================
    // REGION ACCESSORS
    // =============================================
    isComplete() {
        return this.landmarks.length >= this.landmarkDefs.length;
    },

    hasMinimumData() {
        if (this.region === 'cervical') {
            return this.landmarks.length >= 5; // at least CL computable
        } else {
            return this.landmarks.length >= 4; // at least LL computable
        }
    }
};
