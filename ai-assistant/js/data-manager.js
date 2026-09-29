// 與 ai.py 後端溝通的資料管理器
const DataManager = {
    getUserId() {
        return localStorage.getItem('auth_user_id') || 'system';
    },

    async request(path, options = {}) {
        const response = await fetch(path, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
    },

    async getCalendarEvents() {
        const data = await this.request('/api/ai/calendar_events');
        return data.items || [];
    },

    async getPsychReport() {
        const userId = encodeURIComponent(this.getUserId());
        const data = await this.request(`/api/ai/psych_report?user_id=${userId}`);
        return data.report;
    },

    async sendChatMessage(message, history = []) {
        return this.request('/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ user_id: this.getUserId(), message, history })
        });
    },

    async sendCounselorMessage(message, history = []) {
        return this.request('/api/ai/counselor_chat', {
            method: 'POST',
            body: JSON.stringify({ user_id: this.getUserId(), message, history })
        });
    },

    async acceptSchedule(suggestion) {
        return this.request('/api/ai/accept_schedule', {
            method: 'POST',
            body: JSON.stringify({ user_id: this.getUserId(), suggestion })
        });
    },

    formatDateTime(value) {
        if (!value) return '-';
        return new Date(value).toLocaleString('zh-TW', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    },

    formatTime(value) {
        if (!value) return '-';
        return new Date(value).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    },

    escapeHtml(text) {
        return String(text ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }
};
