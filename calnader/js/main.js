// 行事曆主程式
class CalendarApp {
  constructor() {
    this.currentDate = new Date();
    this.currentView = 'month'; // 'month', 'week', 'day'
    this.selectedDate = new Date();
    this.init();
  }

  async init() {
    // 檢查認證
    const userId = App.requireAuth();
    if (!userId) return;

    // 繼續或建立跨頁 session，並啟動 heartbeat
    App.startOrContinueSession(userId).then(() => App.startHeartbeat());

    // 顯示載入狀態
    this.showLoadingState();

    // 載入資料
    const loaded = await calendarAPI.loadAllData();
    
    if (!loaded) {
      console.warn('資料加載失敗，使用預設值');
      // 使用預設空資料繼續運行
    }

    this.currentView = calendarAPI.settings?.default_view || 'month';

    // 初始化 UI
    this.setupEventListeners();
    this.render();
    this.hideLoadingState();
  }

  showLoadingState() {
    const container = document.getElementById('calendar-container');
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.65);">載入中...</div>';
    }
  }

  hideLoadingState() {
    // 移除載入狀態
  }

  setupEventListeners() {
    // 視圖切換
    document.getElementById('btn-month-view')?.addEventListener('click', () => this.setView('month'));
    document.getElementById('btn-week-view')?.addEventListener('click', () => this.setView('week'));
    document.getElementById('btn-day-view')?.addEventListener('click', () => this.setView('day'));

    // 日期導航
    document.getElementById('btn-today')?.addEventListener('click', () => this.goToToday());
    document.getElementById('btn-prev')?.addEventListener('click', () => this.goToPrevious());
    document.getElementById('btn-next')?.addEventListener('click', () => this.goToNext());

    // 移除新增按鈕上的「新增」兩個字
    const btnAddTask = document.getElementById('btn-add-task');
    if (btnAddTask && btnAddTask.textContent.includes('新增')) {
      btnAddTask.textContent = btnAddTask.textContent.replace(/新增/g, '');
    }
    const btnAddEvent = document.getElementById('btn-add-event');
    if (btnAddEvent && btnAddEvent.textContent.includes('新增')) {
      btnAddEvent.textContent = btnAddEvent.textContent.replace(/新增/g, '');
    }

    // 新增事件
    btnAddTask?.addEventListener('click', () => this.openAddTaskModal());
    btnAddEvent?.addEventListener('click', () => this.openAddEventModal());

    // 模態框
    document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-save')?.addEventListener('click', () => this.saveEvent());

    // 登出
    document.getElementById('btn-logout')?.addEventListener('click', () => authManager.logout());
  }

  setView(view) {
    this.currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-' + view + '-view')?.classList.add('active');
    this.render();
  }

  goToToday() {
    this.currentDate = new Date();
    this.render();
  }

  goToPrevious() {
    if (this.currentView === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    } else if (this.currentView === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() - 7);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
    }
    this.render();
  }

  goToNext() {
    if (this.currentView === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    } else if (this.currentView === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
    }
    this.render();
  }

  render() {
    this.updateHeader();
    
    const container = document.getElementById('calendar-container');
    if (!container) return;

    if (this.currentView === 'month') {
      container.innerHTML = this.renderMonthView();
    } else if (this.currentView === 'week') {
      container.innerHTML = this.renderWeekView();
    } else {
      container.innerHTML = this.renderDayView();
      // 自動捲到目前時間
      requestAnimationFrame(() => {
        const body = container.querySelector('.day-timeline-body');
        if (body) {
          const now = new Date();
          const scrollTo = Math.max(0, (now.getHours() * 64) - 160);
          body.scrollTop = scrollTo;
        }
      });
    }

    this.attachCalendarEventListeners();
    this.renderEventList();
  }

  updateHeader() {
    const monthName = CalendarUtils.getMonthName(this.currentDate.getMonth());
    const year = this.currentDate.getFullYear();
    const headerText = document.getElementById('header-date');
    
    if (this.currentView === 'month') {
      headerText.textContent = `${year}年 ${monthName}`;
    } else if (this.currentView === 'week') {
      const weekStart = this.getWeekStart(this.currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      headerText.textContent = `${CalendarUtils.formatDate(weekStart)} - ${CalendarUtils.formatDate(weekEnd)}`;
    } else {
      headerText.textContent = `${year}年${CalendarUtils.getMonthName(this.currentDate.getMonth())}${this.currentDate.getDate()}日 ${CalendarUtils.getDayName(this.currentDate.getDay())}`;
    }
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  renderMonthView() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = CalendarUtils.getDaysInMonth(year, month);
    const firstDay = CalendarUtils.getFirstDayOfMonth(year, month);

    let html = '<div class="calendar-month"><div class="weekdays">';

    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    weekdays.forEach(day => {
      html += `<div class="weekday-header">${day}</div>`;
    });
    html += '</div><div class="days">';

    for (let i = 0; i < firstDay; i++) {
      html += '<div class="day empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = CalendarUtils.isToday(date);
      const tasks = calendarAPI.getTasksByDate(date);
      const events = calendarAPI.getEventsByDate(date);

      html += `<div class="day ${isToday ? 'today' : ''}" data-date="${CalendarUtils.formatDate(date)}">
        <div class="day-number">${day}</div>
        <div class="day-events">`;

      tasks.slice(0, 2).forEach(task => {
        const isOverdue = CalendarUtils.isOverdue(task.due_at);
        html += `<div class="event event-task ${task.status === 'completed' ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" 
                  data-task-id="${task.task_id}" title="${task.title}">
          <span class="event-icon">${task.status === 'completed' ? '☑' : '☐'}</span>
          <span class="event-title">${task.title.substring(0, 10)}</span>
        </div>`;
      });

      events.slice(0, 2).forEach(event => {
        html += `<div class="event event-activity" data-event-id="${event.event_id}" title="${event.title}">
          <span class="event-icon">📅</span>
          <span class="event-title">${event.title.substring(0, 10)}</span>
        </div>`;
      });

      if (tasks.length + events.length > 4) {
        html += `<div class="event-more">...</div>`;
      }

      html += '</div></div>';
    }

    html += '</div></div>';
    return html;
  }

  renderWeekView() {
    const weekStart = this.getWeekStart(this.currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }

    let html = '<div class="calendar-week">';
    
    days.forEach(date => {
      const tasks = calendarAPI.getTasksByDate(date);
      const events = calendarAPI.getEventsByDate(date);

      html += `<div class="week-day">
        <div class="week-day-header">
          <div class="day-name">${CalendarUtils.getDayName(date.getDay())}</div>
          <div class="day-date">${date.getDate()}</div>
        </div>
        <div class="week-day-events">`;

      tasks.forEach(task => {
        const isOverdue = CalendarUtils.isOverdue(task.due_at);
        html += `<div class="event event-task ${task.status === 'completed' ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" 
                  data-task-id="${task.task_id}">
          <span class="event-title">${task.title}</span>
          <span class="event-time">${CalendarUtils.formatTime(task.due_at)}</span>
        </div>`;
      });

      events.forEach(event => {
        html += `<div class="event event-activity" data-event-id="${event.event_id}">
          <span class="event-title">${event.title}</span>
          <span class="event-time">${CalendarUtils.formatTime(event.start_at)} - ${CalendarUtils.formatTime(event.end_at)}</span>
        </div>`;
      });

      html += '</div></div>';
    });

    html += '</div>';
    return html;
  }

  renderDayView() {
    const date   = this.currentDate;
    const tasks  = calendarAPI.getTasksByDate(date);
    const events = calendarAPI.getEventsByDate(date);

    const HOUR_H  = 64;
    const TOTAL_H = 24 * HOUR_H;
    const isToday = CalendarUtils.isToday(date);
    const now     = new Date();
    const nowMins = isToday ? now.getHours() * 60 + now.getMinutes() : -1;

    // ── 建立統一項目清單，計算分鐘位置 ────────────────────────────────
    const items = [];
    events.forEach(ev => {
      const s = new Date(ev.start_at), e = new Date(ev.end_at);
      const sMins = s.getHours() * 60 + s.getMinutes();
      const eMins = Math.max(sMins + 30, e.getHours() * 60 + e.getMinutes());
      items.push({ kind: 'event', data: ev, sMins, eMins });
    });
    tasks.forEach(task => {
      const due = new Date(task.due_at);
      const sMins = due.getHours() * 60 + due.getMinutes();
      items.push({ kind: 'task', data: task, sMins, eMins: sMins + 52 });
    });

    // ── 分欄演算法（貪婪，依開始時間排序）────────────────────────────
    items.sort((a, b) => a.sMins - b.sMins || b.eMins - a.eMins);
    const colEnds = [];
    items.forEach(item => {
      let col = colEnds.findIndex(end => end <= item.sMins);
      if (col === -1) { col = colEnds.length; colEnds.push(0); }
      colEnds[col] = item.eMins;
      item.col = col;
    });
    items.forEach(item => {
      const overlap = items.filter(o => o.sMins < item.eMins && o.eMins > item.sMins);
      item.numCols = Math.max(...overlap.map(o => o.col)) + 1;
    });

    // ── header ────────────────────────────────────────────────────────
    let html = `<div class="day-timeline">
      <div class="day-timeline-header">
        <div class="day-view-date">${CalendarUtils.formatDate(date, 'YYYY年MM月DD日')}</div>
        <div class="day-view-weekday">${CalendarUtils.getDayName(date.getDay())}</div>
      </div>
      <div class="day-timeline-body">
        <div class="tl-time-col">`;

    for (let h = 0; h < 24; h++) {
      html += `<div class="tl-time-slot" style="height:${HOUR_H}px">
        <span class="tl-time-label">${String(h).padStart(2,'0')}:00</span>
      </div>`;
    }

    html += `</div><div class="tl-events-col" style="height:${TOTAL_H}px">`;

    for (let h = 0; h < 24; h++) {
      html += `<div class="tl-hour-line" style="top:${h * HOUR_H}px"></div>`;
      html += `<div class="tl-half-line" style="top:${h * HOUR_H + HOUR_H / 2}px"></div>`;
    }

    if (nowMins >= 0) {
      const top = (nowMins / 60) * HOUR_H;
      html += `<div class="tl-now-line" style="top:${top}px"><span class="tl-now-dot"></span></div>`;
    }

    // ── 渲染項目（含並排定位）────────────────────────────────────────
    items.forEach(item => {
      const top    = (item.sMins / 60) * HOUR_H;
      const height = ((item.eMins - item.sMins) / 60) * HOUR_H;
      const colW   = 100 / item.numCols;
      const leftPct = item.col * colW;
      const style  = `top:${top}px;height:${height}px;left:calc(${leftPct}% + 3px);width:calc(${colW}% - 6px);`;

      if (item.kind === 'event') {
        const ev = item.data;
        html += `<div class="tl-event tl-event-activity" style="${style}" data-event-id="${ev.event_id}">
          <div class="tl-event-title">${ev.title}</div>
          <div class="tl-event-sub">${CalendarUtils.formatTime(ev.start_at)} – ${CalendarUtils.formatTime(ev.end_at)}${ev.location ? ' · ' + ev.location : ''}</div>
        </div>`;
      } else {
        const task = item.data;
        const isCompleted = task.status === 'completed';
        const isOverdue   = CalendarUtils.isOverdue(task.due_at);
        const cls = `tl-event tl-event-task${isCompleted ? ' completed' : ''}${isOverdue ? ' overdue' : ''}`;
        html += `<div class="${cls}" style="${style}" data-task-id="${task.task_id}">
          <div class="tl-event-title">${task.status === 'completed' ? '☑' : '☐'} ${task.title}</div>
          <div class="tl-event-sub">截止 ${CalendarUtils.formatTime(task.due_at)}${task.course ? ' · ' + task.course : ''}</div>
        </div>`;
      }
    });

    html += `</div></div></div>`;
    return html;
  }

  renderEventList() {
    const listContainer = document.getElementById('event-list');
    if (!listContainer) return;

    const year  = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const tasks = calendarAPI.getTasksByMonth(year, month);

    const pending   = tasks.filter(t => t.status !== 'completed').sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    const completed = tasks.filter(t => t.status === 'completed').sort((a, b) => new Date(b.due_at) - new Date(a.due_at));

    let html = '<div class="event-list">';

    if (tasks.length === 0) {
      html += '<p class="empty-message">此月份沒有任務</p>';
    } else {
      pending.forEach(task => {
        const isOverdue = CalendarUtils.isOverdue(task.due_at);
        html += `<div class="list-item task-item ${isOverdue ? 'overdue' : ''}" data-task-id="${task.task_id}">
          <button class="sidebar-check-btn" aria-label="標記完成"></button>
          <div class="item-content">
            <div class="item-title">${task.title}</div>
            <div class="item-meta">${task.course ? task.course + ' • ' : ''}${CalendarUtils.formatDate(task.due_at, 'MM/DD HH:mm')}</div>
          </div>
        </div>`;
      });

      if (completed.length > 0) {
        html += `<div style="margin-top:22px;padding-top:14px;border-top:1px dashed rgba(255,255,255,0.15);">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.4);margin-bottom:10px;">已完成</p>`;
        completed.forEach(task => {
          html += `<div class="list-item task-item completed" data-task-id="${task.task_id}">
            <input type="checkbox" class="task-checkbox" checked>
            <div class="item-content" style="opacity:0.5;text-decoration:line-through;">
              <div class="item-title">${task.title}</div>
              <div class="item-meta">${task.course || ''}</div>
            </div>
            <button class="btn-complete-small" title="撤銷完成">↺</button>
          </div>`;
        });
        html += '</div>';
      }
    }

    html += '</div>';
    listContainer.innerHTML = html;

    // 方形框點擊：淡出 + 高度收縮 → 標記完成
    listContainer.querySelectorAll('.sidebar-check-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const item   = btn.closest('[data-task-id]');
        const taskId = item?.dataset.taskId;
        if (!taskId || item.dataset.completing) return;
        item.dataset.completing = '1';

        // 第一階段：淡出 + 右移
        item.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        item.style.opacity    = '0';
        item.style.transform  = 'translateX(18px)';

        await new Promise(r => setTimeout(r, 230));

        // 第二階段：高度收縮，下方往上填
        const h = item.offsetHeight;
        item.style.transition  = 'max-height 0.2s ease, margin 0.2s ease, padding 0.2s ease';
        item.style.overflow    = 'hidden';
        item.style.maxHeight   = h + 'px';
        requestAnimationFrame(() => {
          item.style.maxHeight    = '0';
          item.style.marginTop    = '0';
          item.style.marginBottom = '0';
          item.style.paddingTop   = '0';
          item.style.paddingBottom = '0';
        });

        await new Promise(r => setTimeout(r, 220));

        await calendarAPI.completeTask(taskId);
        this.render();
      });
    });
  }

  attachCalendarEventListeners() {
    document.querySelectorAll('.day[data-date]').forEach(day => {
      day.addEventListener('click', (e) => {
        if (!e.target.closest('.event')) {
          const clicked = new Date(day.dataset.date);
          this.selectedDate = clicked;
          this.currentDate  = clicked;
          this.setView('day');
        }
      });
    });

    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        e.stopPropagation();
        const taskId = e.target.closest('[data-task-id]')?.dataset.taskId;
        if (taskId) {
          const task = calendarAPI.tasks.find(t => t.task_id === taskId);
          if (task) {
            if (e.target.checked) {
              await calendarAPI.completeTask(taskId);
            } else {
              await calendarAPI.updateTask(taskId, { status: 'pending', completed_at: null });
            }
            this.render();
          }
        }
      });
    });

    document.querySelectorAll('.btn-complete, .btn-complete-small').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskId = e.target.closest('[data-task-id]')?.dataset.taskId;
        if (taskId) {
          const task = calendarAPI.tasks.find(t => t.task_id === taskId);
          if (task) {
            if (task.status === 'completed') {
              await calendarAPI.updateTask(taskId, { status: 'pending', completed_at: null });
            } else {
              await calendarAPI.completeTask(taskId);
            }
            this.render();
          }
        }
      });
    });

    document.querySelectorAll('.btn-delete, .btn-delete-small').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); 
        const eventId = e.target.closest('[data-event-id]')?.dataset.eventId;
        
        if (eventId && confirm('確定要刪除此活動嗎？')) {
          await calendarAPI.deleteEvent(eventId);
          this.render();
        }
      });
    });

    document.querySelectorAll('.event').forEach(event => {
      event.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-delete') && !e.target.closest('.btn-complete') && !e.target.closest('.task-checkbox')) {
          const taskId = event.dataset.taskId;
          const eventId = event.dataset.eventId;
          if (taskId) this.openEditTaskModal(taskId);
          if (eventId) this.openEditEventModal(eventId);
        }
      });
    });

    // 時間軸事件點擊（日視圖）
    document.querySelectorAll('.tl-event').forEach(el => {
      el.addEventListener('click', () => {
        const taskId  = el.dataset.taskId;
        const eventId = el.dataset.eventId;
        if (taskId)  this.openEditTaskModal(taskId);
        if (eventId) this.openEditEventModal(eventId);
      });
    });
  }

  openAddTaskModal() {
    this.currentEditingItem = null;
    this.openModal('task');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueInput = document.getElementById('task-due');
    if (dueInput) {
      dueInput.value = tomorrow.toISOString().slice(0, 16);
    }
  }

  openAddEventModal() {
    this.currentEditingItem = null;
    this.openModal('event');
    const start = new Date();
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    
    const startInput = document.getElementById('event-start');
    const endInput = document.getElementById('event-end');
    if (startInput) startInput.value = start.toISOString().slice(0, 16);
    if (endInput) endInput.value = end.toISOString().slice(0, 16);
  }

  openEditTaskModal(taskId) {
    const task = calendarAPI.tasks.find(t => t.task_id === taskId);
    if (task) {
      this.currentEditingItem = task;
      this.openModal('task');
    }
  }

  openEditEventModal(eventId) {
    const event = calendarAPI.events.find(e => e.event_id === eventId);
    if (event) {
      this.currentEditingItem = event;
      this.openModal('event');
    }
  }

  // --- 重點修改區域開始：動態替換 Modal 標題 ---
  openModal(type) {
    this.currentModalType = type;
    const modal = document.getElementById('modal');
    const form = document.getElementById('modal-form');
    
    // 尋找 Modal 的標題元素
    // 假設你 HTML 裡有設 id="modal-title"；如果沒有，它會嘗試抓取最像標題的元素
    let modalTitle = document.getElementById('modal-title') || modal.querySelector('.modal-title, h2, h3, div > span');

    // 如果還是找不到，嘗試找內容完全是「新增事件」的元素來替換
    if (!modalTitle) {
      const allElements = modal.querySelectorAll('*');
      for (let el of allElements) {
        if (el.textContent.trim() === '新增事件' && el.children.length === 0) {
          modalTitle = el;
          break;
        }
      }
    }
    
    if (type === 'task') {
      form.innerHTML = this.getTaskFormHTML();
      if (modalTitle) modalTitle.textContent = this.currentEditingItem ? '編輯任務' : '任務';
    } else {
      form.innerHTML = this.getEventFormHTML();
      if (modalTitle) modalTitle.textContent = this.currentEditingItem ? '編輯活動' : '活動';
    }

    if (this.currentEditingItem) {
      this.fillModalForm(this.currentEditingItem);
    }

    // 刪除按鈕：編輯任務或活動時顯示
    const footer = modal.querySelector('.modal-footer');
    const oldDeleteBtn = document.getElementById('modal-delete');
    if (oldDeleteBtn) oldDeleteBtn.remove();
    footer.style.justifyContent = 'flex-end';

    const isEditTask  = type === 'task'  && this.currentEditingItem?.task_id;
    const isEditEvent = type === 'event' && this.currentEditingItem?.event_id;

    if (isEditTask || isEditEvent) {
      const deleteBtn = document.createElement('button');
      deleteBtn.id = 'modal-delete';
      deleteBtn.className = 'btn btn-delete-task';
      deleteBtn.textContent = isEditTask ? '刪除任務' : '刪除活動';
      deleteBtn.addEventListener('click', () => isEditTask ? this.deleteCurrentTask() : this.deleteCurrentEvent());
      footer.insertBefore(deleteBtn, footer.firstChild);
      footer.style.justifyContent = 'space-between';
    }

    modal.classList.add('active');
  }
  // --- 重點修改區域結束 ---

  closeModal() {
    document.getElementById('modal').classList.remove('active');
  }

  async deleteCurrentTask() {
    if (!this.currentEditingItem?.task_id) return;
    try {
      await calendarAPI.deleteTask(this.currentEditingItem.task_id);
      this.closeModal();
      this.render();
      this.showNotification('任務已刪除', 'success');
    } catch (error) {
      this.showNotification('刪除失敗：' + error.message, 'error');
    }
  }

  async deleteCurrentEvent() {
    if (!this.currentEditingItem?.event_id) return;
    try {
      await calendarAPI.deleteEvent(this.currentEditingItem.event_id);
      this.closeModal();
      this.render();
      this.showNotification('活動已刪除', 'success');
    } catch (error) {
      this.showNotification('刪除失敗：' + error.message, 'error');
    }
  }

  getTaskFormHTML() {
    return `
      <div class="form-group">
        <label for="task-title">任務標題</label>
        <input type="text" id="task-title" placeholder="輸入任務標題" required>
      </div>
      <div class="form-group">
        <label for="task-course">課程名稱</label>
        <input type="text" id="task-course" placeholder="課程名稱（選填）">
      </div>
      <div class="form-group">
        <label for="task-due">截止時間</label>
        <input type="datetime-local" id="task-due" required>
      </div>
      <div class="form-group">
        <label for="task-status">是否完成</label>
        <select id="task-status">
          <option value="pending" selected>未完成</option>
          <option value="completed">已完成</option>
        </select>
      </div>
      <div class="form-group">
        <label for="task-note">備註</label>
        <textarea id="task-note" placeholder="輸入備註（選填）" rows="3"></textarea>
      </div>
    `;
  }

  getEventFormHTML() {
    return `
      <div class="form-group">
        <label for="event-title">活動標題</label>
        <input type="text" id="event-title" placeholder="輸入活動標題" required>
      </div>
      <div class="form-group">
        <label for="event-location">地點</label>
        <input type="text" id="event-location" placeholder="地點（選填）">
      </div>
      <div class="form-group">
        <label for="event-start">開始時間</label>
        <input type="datetime-local" id="event-start" required>
      </div>
      <div class="form-group">
        <label for="event-end">結束時間</label>
        <input type="datetime-local" id="event-end" required>
      </div>
      <div class="form-group">
        <label for="event-note">備註</label>
        <textarea id="event-note" placeholder="輸入備註（選填）" rows="3"></textarea>
      </div>
    `;
  }

  toLocalInput(isoStr) {
    const d = new Date(isoStr);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  fillModalForm(item) {
    if (item.task_id) {
      document.getElementById('task-title').value = item.title;
      document.getElementById('task-course').value = item.course;
      document.getElementById('task-due').value = this.toLocalInput(item.due_at);
      document.getElementById('task-status').value = item.status === 'completed' ? 'completed' : 'pending';
      document.getElementById('task-note').value = item.note;
    } else {
      document.getElementById('event-title').value = item.title;
      document.getElementById('event-location').value = item.location;
      document.getElementById('event-start').value = this.toLocalInput(item.start_at);
      document.getElementById('event-end').value = this.toLocalInput(item.end_at);
      document.getElementById('event-note').value = item.note;
    }
  }

  async saveEvent() {
    const saveBtn = document.getElementById('modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';

    try {
      if (this.currentModalType === 'task') {
        await this.saveTask();
      } else {
        await this.saveEventData();
      }
      
      this.showNotification('成功保存！', 'success');
    } catch (error) {
      console.error('Save error:', error);
      this.showNotification('保存失敗：' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存';
    }
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#3d503d' : '#663d3d'};
      color: ${type === 'success' ? '#8fd98f' : '#f59999'};
      border-radius: 5px;
      border: 1px solid rgba(255,255,255,0.125);
      z-index: 2000;
      animation: slideIn 0.3s ease;
      max-width: 300px;
      word-break: break-word;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  async saveTask() {
    const titleEl = document.getElementById('task-title');
    const courseEl = document.getElementById('task-course');
    const dueEl = document.getElementById('task-due');
    const statusEl = document.getElementById('task-status');
    const noteEl = document.getElementById('task-note');

    const title = titleEl?.value?.trim() || '';
    const course = courseEl?.value?.trim() || '';
    const due = dueEl?.value || '';
    const status = statusEl?.value || 'pending';
    const note = noteEl?.value?.trim() || '';
    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    if (!title || title.length === 0) {
      throw new Error('請填寫任務標題');
    }
    if (!due || due.length === 0) {
      throw new Error('請設定截止時間');
    }

    const dueDateTime = new Date(due);
    if (isNaN(dueDateTime.getTime())) {
      throw new Error('截止時間格式錯誤');
    }

    const dueISO = dueDateTime.toISOString();

    if (this.currentEditingItem?.task_id) {
      await calendarAPI.updateTask(this.currentEditingItem.task_id, {
        title, course, due_at: dueISO, status, completed_at: completedAt, note
      });
    } else {
      await calendarAPI.addTask({ title, course, due_at: dueISO, status, completed_at: completedAt, note });
    }

    this.closeModal();
    this.render();
  }

  async saveEventData() {
    const titleEl = document.getElementById('event-title');
    const locationEl = document.getElementById('event-location');
    const startEl = document.getElementById('event-start');
    const endEl = document.getElementById('event-end');
    const noteEl = document.getElementById('event-note');

    const title = titleEl?.value?.trim() || '';
    const location = locationEl?.value?.trim() || '';
    const start = startEl?.value || '';
    const end = endEl?.value || '';
    const allDay = false;
    const note = noteEl?.value?.trim() || '';

    if (!title || title.length === 0) {
      throw new Error('請填寫活動標題');
    }
    if (!start || start.length === 0 || !end || end.length === 0) {
      throw new Error('請設定開始與結束時間');
    }

    const startDateTime = new Date(start);
    const endDateTime = new Date(end);

    if (isNaN(startDateTime.getTime())) {
      throw new Error('開始時間格式錯誤');
    }
    if (isNaN(endDateTime.getTime())) {
      throw new Error('結束時間格式錯誤');
    }
    if (endDateTime <= startDateTime) {
      throw new Error('結束時間必須晚於開始時間');
    }

    const startISO = startDateTime.toISOString();
    const endISO = endDateTime.toISOString();

    if (this.currentEditingItem?.event_id) {
      await calendarAPI.updateEvent(this.currentEditingItem.event_id, {
        title, location, start_at: startISO, end_at: endISO, all_day: allDay, note
      });
    } else {
      await calendarAPI.addEvent({ title, location, start_at: startISO, end_at: endISO, all_day: allDay, note });
    }

    this.closeModal();
    this.render();
  }
}

// 初始化應用
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new CalendarApp();
});