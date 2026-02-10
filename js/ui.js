// =============================================
// SpineAlign — Shared UI Builders
// =============================================

const UI = {

    // Build a parameter result card
    paramCard(p) {
        const cardCls = p.severity.cls === 'status-normal' ? 'success' :
                        p.severity.cls === 'status-severe' ? 'danger' : 'warning';
        return `
            <div class="param-card ${cardCls}">
                <span class="param-label">${p.label}</span>
                <span class="param-value">${p.current}<span class="param-unit"> ${p.unit}</span></span>
                <span class="param-range">Target: ${p.target}</span>
                <span class="param-status ${p.severity.cls}">${p.severity.text}</span>
            </div>
        `;
    },

    // Build a summary table row
    summaryRow(p) {
        return `
            <tr>
                <td style="font-weight:600;">${p.label}</td>
                <td>${p.current} ${p.unit}</td>
                <td>${p.target}</td>
                <td>${p.correction}</td>
                <td><span class="param-status ${p.severity.cls}">${p.severity.text}</span></td>
            </tr>
        `;
    },

    // Build an implant recommendation card
    implantCard(r) {
        const featuresHtml = r.features.map(f => `<li>${f}</li>`).join('');
        return `
            <div class="implant-card ${r.recommended ? 'recommended' : ''}">
                <div class="implant-header">
                    <div>
                        <div class="implant-name">${r.name}</div>
                        <span class="implant-category">${r.category}</span>
                    </div>
                    ${r.recommended ? '<span class="rec-badge">Recommended</span>' : '<span class="rec-badge" style="background:var(--text-muted);">Consider</span>'}
                </div>
                <p class="implant-desc">${r.description}</p>
                <ul class="implant-features">${featuresHtml}</ul>
                <div class="implant-rationale">
                    <strong>Clinical Rationale:</strong> ${r.rationale}
                </div>
                <a href="${r.link}" target="_blank" rel="noopener" class="implant-link">View on ulrichmedicalusa.com →</a>
            </div>
        `;
    },

    // Build a patient factor note
    factorNote(level, title, text) {
        const cls = level === 'critical' ? 'critical' : level === 'caution' ? 'caution' : 'ok';
        return `
            <div class="factor-note ${cls}">
                <strong>${title}</strong>
                ${text}
            </div>
        `;
    },

    // Toast notification
    toast(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Open a modal
    openModal(id) {
        const overlay = document.getElementById(id);
        if (overlay) overlay.classList.add('open');
    },

    // Close a modal
    closeModal(id) {
        const overlay = document.getElementById(id);
        if (overlay) overlay.classList.remove('open');
    },

    // Format date for display
    formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
};
