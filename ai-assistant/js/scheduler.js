// 「聊聊」模組：一般聊天 + 排程建議 + 接受後才寫入行事曆
const ChatModule = {
    pendingSuggestions: {},
    history: [],          // 對話歷史，每輪 {role, content}
    MAX_HISTORY: 10,      // 保留最近 5 輪（user×5 + assistant×5）

    init() {
        const input = document.getElementById('chatInput');
        if (input && !input.dataset.bound) {
            input.dataset.bound = 'true';
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    this.sendMessage();
                }
            });
        }
        const box = document.getElementById('chatBox');
        if (box && !box.dataset.welcome) {
            box.dataset.welcome = 'true';
            this.addMessage('ai', '你好，我是「聊聊」。你可以問一般問題，也可以直接說想安排的事情；有排程需求時，我會先提出建議，等你按下接受才新增到行事曆。');
        }
    },

    addMessage(role, content, extraHtml = '') {
        const box = document.getElementById('chatBox');
        const wrapper = document.createElement('div');
        wrapper.className = `message ${role}`;
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = DataManager.escapeHtml(content) + extraHtml;
        wrapper.appendChild(bubble);
        box.appendChild(wrapper);
        box.scrollTop = box.scrollHeight;
        return bubble;
    },

    async sendMessage() {
        const input = document.getElementById('chatInput');
        if (!input) return;
        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        this.addMessage('user', message);
        const loadingBubble = this.addMessage('ai', '思考中...');

        // 送出時 history 不含本輪 user 訊息，後端會自己 append
        const prevHistory = [...this.history];

        try {
            const result = await DataManager.sendChatMessage(message, prevHistory);
            let extraHtml = '';
            if (result.schedule_suggestion) {
                const suggestion = result.schedule_suggestion;
                this.pendingSuggestions[suggestion.suggestion_id] = suggestion;
                extraHtml = this.renderSuggestionCard(suggestion);
            }
            loadingBubble.innerHTML = DataManager.escapeHtml(result.reply) + extraHtml;

            // 成功後才寫入 history
            this.history.push({ role: 'user', content: message });
            this.history.push({ role: 'assistant', content: result.reply });
            if (this.history.length > this.MAX_HISTORY) {
                this.history = this.history.slice(-this.MAX_HISTORY);
            }
        } catch (error) {
            loadingBubble.innerHTML = DataManager.escapeHtml(`發生錯誤：${error.message}`);
        } finally {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    renderSuggestionCard(suggestion) {
        const event = suggestion.proposed_event;
        const conflicts = suggestion.conflicts || [];
        const conflictHtml = conflicts.length > 0
            ? `<div class="card-detail" style="color:#f0a84e;">⚠️ 衝突：${conflicts.map(c => `${DataManager.escapeHtml(c.title)}（${c.overlap_min} 分鐘）`).join('、')}</div>`
            : '<div class="card-detail" style="color:#5bbf8a;">✅ 目前未發現衝突</div>';

        return `
            <div class="suggestion-card" id="suggestion_${DataManager.escapeHtml(suggestion.suggestion_id)}">
                <div class="card-title">📌 排程建議</div>
                <div class="card-detail"><strong>${DataManager.escapeHtml(event.title)}</strong></div>
                <div class="card-detail">⏰ ${DataManager.formatDateTime(event.start_at)} ~ ${DataManager.formatTime(event.end_at)}</div>
                ${conflictHtml}
                <div class="card-detail">${DataManager.escapeHtml(suggestion.reason || '')}</div>
                <button class="btn" style="margin-top:10px;" onclick="ChatModule.acceptSuggestion('${DataManager.escapeHtml(suggestion.suggestion_id)}')">接受建議</button>
            </div>`;
    },

    async acceptSuggestion(suggestionId) {
        const suggestion = this.pendingSuggestions[suggestionId];
        if (!suggestion) {
            this.addMessage('ai', '找不到這筆建議，請重新產生一次。');
            return;
        }

        const card = document.getElementById(`suggestion_${suggestionId}`);
        const button = card?.querySelector('button');
        if (button) { button.disabled = true; button.textContent = '新增中...'; }

        try {
            const result = await DataManager.acceptSchedule(suggestion);
            if (card) card.classList.add('accepted');
            if (button) button.textContent = '已接受並新增';
            this.addMessage('ai', `已新增到行事曆：${result.event.title}`);
            await this.refreshCalendar();
        } catch (error) {
            if (button) { button.disabled = false; button.textContent = '接受建議'; }
            this.addMessage('ai', `新增失敗：${error.message}`);
        }
    },

    async refreshCalendar() {
        const container = document.getElementById('calendarContainer');
        if (!container) return;
        try {
            const events = await DataManager.getCalendarEvents();
            if (!events.length) {
                container.innerHTML = '<div class="no-data">目前沒有行事曆事件</div>';
                return;
            }
            events.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
            container.innerHTML = `
                <div class="calendar-grid">
                    ${events.map(event => `
                        <div class="calendar-event">
                            <div class="card-title">${DataManager.escapeHtml(event.title)}</div>
                            <div class="card-detail">${DataManager.formatDateTime(event.start_at)} ~ ${DataManager.formatTime(event.end_at)}</div>
                            ${event.source ? `<div class="card-detail" style="font-size:12px;">來源：${DataManager.escapeHtml(event.source)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>`;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-warning">載入行事曆失敗：${DataManager.escapeHtml(error.message)}</div>`;
        }
    }
};
