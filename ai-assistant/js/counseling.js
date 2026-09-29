// 心理分析模組：讀取最近五筆 psych_results + AI 輔導員對話
const CounselingModule = {
    history: [],       // 輔導員對話歷史
    MAX_HISTORY: 10,   // 保留最近 5 輪

    init() {
        const input = document.getElementById('counselInput');
        if (input && !input.dataset.bound) {
            input.dataset.bound = 'true';
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    this.sendMessage();
                }
            });
        }
        const box = document.getElementById('counselChatBox');
        if (box && !box.dataset.welcome) {
            box.dataset.welcome = 'true';
            this.addMessage('ai', '你好，我會參考最近五筆心理測驗資料，用輔導員的角度陪你整理狀態。你可以直接說最近遇到的壓力或困擾。');
        }
    },

    addMessage(role, content) {
        const box = document.getElementById('counselChatBox');
        const wrapper = document.createElement('div');
        wrapper.className = `message ${role}`;
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = content;
        wrapper.appendChild(bubble);
        box.appendChild(wrapper);
        box.scrollTop = box.scrollHeight;
        return bubble;
    },

    async loadPsychReport() {
        const container = document.getElementById('analysisReport');
        if (!container) return;
        container.innerHTML = '<div class="no-data">讀取心理測驗資料中...</div>';
        try {
            const report = await DataManager.getPsychReport();
            container.innerHTML = this.renderReport(report);
        } catch (error) {
            container.innerHTML = `<div class="alert alert-warning">讀取心理測驗資料失敗：${DataManager.escapeHtml(error.message)}</div>`;
        }
    },

    renderReport(report) {
        const riskClass = report.risk_level === 'high' ? 'risk-high' : report.risk_level === 'medium' ? 'risk-medium' : 'risk-low';
        const riskLabel = report.risk_level === 'high' ? '高度留意' : report.risk_level === 'medium' ? '中度留意' : report.risk_level === 'low' ? '相對穩定' : '資料不足';
        const results = report.recent_results || [];

        return `
            <div class="report-card">
                <div class="card-title">${DataManager.escapeHtml(report.title || '心理分析報告')}</div>
                <div class="card-detail">風險狀態：<span class="${riskClass}">${riskLabel}</span></div>
                ${report.average_score !== undefined ? `<div class="card-detail">近期平均分數：${DataManager.escapeHtml(String(report.average_score))}</div>` : ''}
                <div class="alert alert-info" style="margin-top:12px;">${DataManager.escapeHtml(report.summary || '')}</div>
                <div class="card-title" style="margin-top:12px;">建議</div>
                <ul>${(report.recommendations || []).map(item => `<li>${DataManager.escapeHtml(item)}</li>`).join('')}</ul>
            </div>
            <div class="report-card">
                <div class="card-title">最近五筆心理測驗資料</div>
                ${results.length ? results.map(item => `
                    <div class="result-card">
                        <div class="card-detail"><strong>${DataManager.escapeHtml(item.test_name || '心理測驗')}</strong>｜${DataManager.escapeHtml(item.category || item.stress_level || '')}</div>
                        <div class="card-detail">分數：${DataManager.escapeHtml(String(item.score_total ?? '-'))}｜時間：${DataManager.formatDateTime(item.created_at || item.completed_at || item.tested_at)}</div>
                        ${item.sleep_quality ? `<div class="card-detail">睡眠：${DataManager.escapeHtml(item.sleep_quality)}</div>` : ''}
                        ${item.note ? `<div class="card-detail">備註：${DataManager.escapeHtml(item.note)}</div>` : ''}
                    </div>
                `).join('') : '<div class="no-data">沒有可顯示的心理測驗資料</div>'}
            </div>`;
    },

    async sendMessage() {
        const input = document.getElementById('counselInput');
        if (!input) return;
        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        this.addMessage('user', message);
        const loadingBubble = this.addMessage('ai', '我先根據近期測驗資料整理一下...');

        // 送出時 history 不含本輪 user 訊息，後端會自己 append
        const prevHistory = [...this.history];

        try {
            const result = await DataManager.sendCounselorMessage(message, prevHistory);
            loadingBubble.textContent = result.reply;

            // 成功後才寫入 history
            this.history.push({ role: 'user', content: message });
            this.history.push({ role: 'assistant', content: result.reply });
            if (this.history.length > this.MAX_HISTORY) {
                this.history = this.history.slice(-this.MAX_HISTORY);
            }
        } catch (error) {
            loadingBubble.textContent = `回應失敗：${error.message}`;
        } finally {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
};
