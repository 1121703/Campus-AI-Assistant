// API 管理模塊
class CalendarAPI {
  constructor(baseUrl = '/data/', apiUrl = '/api/calendar') {
    this.baseUrl = baseUrl;
    this.apiUrl = apiUrl;
    this.useBackendAPI = true;
    this.tasks = [];
    this.events = [];
    this.auditLog = [];
    this.settings = null;
    this.lastError = null;
  }

  // 加載所有數據
  async loadAllData() {
    try {
      await Promise.all([
        this.loadTasks(),
        this.loadEvents(),
        this.loadAuditLog(),
        this.loadSettings()
      ]);
      return true;
    } catch (error) {
      console.error('Failed to load data:', error);
      return false;
    }
  }

  // 加載任務
  async loadTasks() {
    try {
      if (this.useBackendAPI) {
        const response = await fetch(this.apiUrl + '/tasks', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authManager.getToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('後端伺服器無法連接');
        }
        
        const data = await response.json();
        this.tasks = data.items || data.tasks || [];
        return this.tasks;
      } else {
        const response = await fetch(this.baseUrl + 'calendar_tasks.json');
        const data = await response.json();
        this.tasks = data.items || [];
        return this.tasks;
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      // 嘗試從本地 JSON 降級
      if (this.useBackendAPI) {
        try {
          const response = await fetch(this.baseUrl + 'calendar_tasks.json');
          const data = await response.json();
          this.tasks = data.items || [];
          return this.tasks;
        } catch (e) {
          this.tasks = [];
          return [];
        }
      }
      this.tasks = [];
      return [];
    }
  }

  // 加載活動
  async loadEvents() {
    try {
      if (this.useBackendAPI) {
        const response = await fetch(this.apiUrl + '/events', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authManager.getToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('後端伺服器無法連接');
        }
        
        const data = await response.json();
        this.events = data.items || data.events || [];
        return this.events;
      } else {
        const response = await fetch(this.baseUrl + 'calendar_events.json');
        const data = await response.json();
        this.events = data.items || [];
        return this.events;
      }
    } catch (error) {
      console.error('Failed to load events:', error);
      // 嘗試從本地 JSON 降級
      if (this.useBackendAPI) {
        try {
          const response = await fetch(this.baseUrl + 'calendar_events.json');
          const data = await response.json();
          this.events = data.items || [];
          return this.events;
        } catch (e) {
          this.events = [];
          return [];
        }
      }
      this.events = [];
      return [];
    }
  }

  // 加載審計日誌
  async loadAuditLog() {
    try {
      if (this.useBackendAPI) {
        const response = await fetch(this.apiUrl + '/audit-log', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authManager.getToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('後端伺服器無法連接');
        }
        
        const data = await response.json();
        this.auditLog = data.items || data.logs || [];
        return this.auditLog;
      } else {
        const response = await fetch(this.baseUrl + 'calendar_audit_log.json');
        const data = await response.json();
        this.auditLog = data.items || [];
        return this.auditLog;
      }
    } catch (error) {
      console.error('Failed to load audit log:', error);
      // 嘗試從本地 JSON 降級
      if (this.useBackendAPI) {
        try {
          const response = await fetch(this.baseUrl + 'calendar_audit_log.json');
          const data = await response.json();
          this.auditLog = data.items || [];
          return this.auditLog;
        } catch (e) {
          this.auditLog = [];
          return [];
        }
      }
      this.auditLog = [];
      return [];
    }
  }

  // 加載設定
  async loadSettings() {
    try {
      if (this.useBackendAPI) {
        const response = await fetch(this.apiUrl + '/settings', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authManager.getToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('後端伺服器無法連接');
        }
        
        const data = await response.json();
        this.settings = data.settings || this.getDefaultSettings();
        return this.settings;
      } else {
        const response = await fetch(this.baseUrl + 'calendar_settings.json');
        const data = await response.json();
        const userSettings = data.items?.find(s => s.user_id === authManager.currentUser.id);
        this.settings = userSettings || data.items?.[0] || this.getDefaultSettings();
        return this.settings;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // 嘗試從本地 JSON 降級
      if (this.useBackendAPI) {
        try {
          const response = await fetch(this.baseUrl + 'calendar_settings.json');
          const data = await response.json();
          const userSettings = data.items?.find(s => s.user_id === authManager.currentUser.id);
          this.settings = userSettings || data.items?.[0] || this.getDefaultSettings();
          return this.settings;
        } catch (e) {
          this.settings = this.getDefaultSettings();
          return this.settings;
        }
      }
      this.settings = this.getDefaultSettings();
      return this.settings;
    }
  }

  // 預設設定
  getDefaultSettings() {
    return {
      user_id: authManager.currentUser?.id || 'u_0001',
      default_view: 'month',
      week_start: 'mon',
      show_completed_tasks: true,
      updated_at: new Date().toISOString()
    };
  }

  // 新增任務
  async addTask(taskData) {
    if (this.useBackendAPI) {
      try {
        // 調用後端 API
        const response = await fetch(this.apiUrl + '/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authManager.getToken()}`
          },
          body: JSON.stringify({
            title: taskData.title,
            course: taskData.course || '',
            due_at: taskData.due_at,
            source: taskData.source || 'manual',
            note: taskData.note || '',
            user_id: authManager.currentUser?.id || 'u_0001'
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Backend API error:', error);
          throw new Error(error.error || '新增任務失敗');
        }

        const result = await response.json();
        const task = result.task;
        this.tasks.push(task);
        return task;
      } catch (error) {
        console.error('Failed to add task via API:', error);
        // 降級到本地操作
        return this.addTaskLocal(taskData);
      }
    } else {
      return this.addTaskLocal(taskData);
    }
  }

  // 本地新增任務（降級方案）
  addTaskLocal(taskData) {
    const task = {
      task_id: this.generateId('t_'),
      user_id: authManager.currentUser.id,
      title: taskData.title,
      course: taskData.course || '',
      due_at: taskData.due_at,
      status: 'pending',
      completed_at: null,
      source: taskData.source || 'manual',
      note: taskData.note || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.tasks.push(task);
    this.addAuditLog('create_task', task.task_id, { source: task.source });
    return task;
  }

  // 新增活動
  async addEvent(eventData) {
    if (this.useBackendAPI) {
      try {
        // 調用後端 API
        const response = await fetch(this.apiUrl + '/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authManager.getToken()}`
          },
          body: JSON.stringify({
            title: eventData.title,
            start_at: eventData.start_at,
            end_at: eventData.end_at,
            all_day: eventData.all_day || false,
            location: eventData.location || '',
            note: eventData.note || '',
            source: eventData.source || 'manual',
            linked_suggestion_id: eventData.linked_suggestion_id || null,
            user_id: authManager.currentUser?.id || 'u_0001'
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Backend API error:', error);
          throw new Error(error.error || '新增活動失敗');
        }

        const result = await response.json();
        const event = result.event;
        this.events.push(event);
        return event;
      } catch (error) {
        console.error('Failed to add event via API:', error);
        // 降級到本地操作
        return this.addEventLocal(eventData);
      }
    } else {
      return this.addEventLocal(eventData);
    }
  }

  // 本地新增活動（降級方案）
  addEventLocal(eventData) {
    const event = {
      event_id: this.generateId('e_'),
      user_id: authManager.currentUser.id,
      title: eventData.title,
      start_at: eventData.start_at,
      end_at: eventData.end_at,
      all_day: eventData.all_day || false,
      location: eventData.location || '',
      note: eventData.note || '',
      source: eventData.source || 'manual',
      linked_suggestion_id: eventData.linked_suggestion_id || null,
      status: 'active',
      created_at: new Date().toISOString()
    };
    this.events.push(event);
    this.addAuditLog('create_event', event.event_id, { source: event.source });
    return event;
  }

  // 更新任務
  async updateTask(taskId, updates) {
    if (this.useBackendAPI) {
      try {
        const response = await fetch(this.apiUrl + `/tasks/${taskId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authManager.getToken()}`
          },
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '更新任務失敗');
        }

        const result = await response.json();
        const taskIndex = this.tasks.findIndex(t => t.task_id === taskId);
        if (taskIndex !== -1) {
          this.tasks[taskIndex] = result.task;
        }
        return result.task;
      } catch (error) {
        console.error('Failed to update task via API:', error);
        // 降級到本地操作
        const task = this.tasks.find(t => t.task_id === taskId);
        if (task) {
          Object.assign(task, updates);
          task.updated_at = new Date().toISOString();
          this.addAuditLog('update_task', taskId, { updates });
        }
        return task;
      }
    } else {
      const task = this.tasks.find(t => t.task_id === taskId);
      if (task) {
        Object.assign(task, updates);
        task.updated_at = new Date().toISOString();
        this.addAuditLog('update_task', taskId, { updates });
      }
      return task;
    }
  }

  // 更新活動
  async updateEvent(eventId, updates) {
    if (this.useBackendAPI) {
      try {
        const response = await fetch(this.apiUrl + `/events/${eventId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authManager.getToken()}`
          },
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '更新活動失敗');
        }

        const result = await response.json();
        const eventIndex = this.events.findIndex(e => e.event_id === eventId);
        if (eventIndex !== -1) {
          this.events[eventIndex] = result.event;
        }
        return result.event;
      } catch (error) {
        console.error('Failed to update event via API:', error);
        // 降級到本地操作
        const event = this.events.find(e => e.event_id === eventId);
        if (event) {
          Object.assign(event, updates);
          this.addAuditLog('update_event', eventId, { updates });
        }
        return event;
      }
    } else {
      const event = this.events.find(e => e.event_id === eventId);
      if (event) {
        Object.assign(event, updates);
        this.addAuditLog('update_event', eventId, { updates });
      }
      return event;
    }
  }

  // 完成任務
  async completeTask(taskId) {
    if (this.useBackendAPI) {
      try {
        const response = await fetch(this.apiUrl + `/tasks/${taskId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authManager.getToken()}`
          },
          body: JSON.stringify({})
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '完成任務失敗');
        }

        const result = await response.json();
        const taskIndex = this.tasks.findIndex(t => t.task_id === taskId);
        if (taskIndex !== -1) {
          this.tasks[taskIndex] = result.task;
        }
        return result.task;
      } catch (error) {
        console.error('Failed to complete task via API:', error);
        // 降級到本地操作
        const task = this.tasks.find(t => t.task_id === taskId);
        if (task) {
          task.status = 'completed';
          task.completed_at = new Date().toISOString();
          task.updated_at = new Date().toISOString();
          this.addAuditLog('complete_task', taskId, {});
        }
        return task;
      }
    } else {
      const task = this.tasks.find(t => t.task_id === taskId);
      if (task) {
        task.status = 'completed';
        task.completed_at = new Date().toISOString();
        task.updated_at = new Date().toISOString();
        this.addAuditLog('complete_task', taskId, {});
      }
      return task;
    }
  }

  // 刪除任務（軟刪除）
  async deleteTask(taskId) {
    if (this.useBackendAPI) {
      try {
        const response = await fetch(this.apiUrl + `/tasks/${taskId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authManager.getToken()}`
          }
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '刪除任務失敗');
        }

        const result = await response.json();
        const taskIndex = this.tasks.findIndex(t => t.task_id === taskId);
        if (taskIndex !== -1) {
          this.tasks[taskIndex] = result.task || { ...this.tasks[taskIndex], status: 'archived' };
        }
        return this.tasks[taskIndex];
      } catch (error) {
        console.error('Failed to delete task via API:', error);
        // 降級到本地操作
        const task = this.tasks.find(t => t.task_id === taskId);
        if (task) {
          task.status = 'archived';
          task.updated_at = new Date().toISOString();
          this.addAuditLog('delete_task', taskId, {});
        }
        return task;
      }
    } else {
      const task = this.tasks.find(t => t.task_id === taskId);
      if (task) {
        task.status = 'archived';
        task.updated_at = new Date().toISOString();
        this.addAuditLog('delete_task', taskId, {});
      }
      return task;
    }
  }

  // 刪除活動（軟刪除）
  async deleteEvent(eventId) {
    if (this.useBackendAPI) {
      try {
        const response = await fetch(this.apiUrl + `/events/${eventId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authManager.getToken()}`
          }
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '刪除活動失敗');
        }

        const result = await response.json();
        const eventIndex = this.events.findIndex(e => e.event_id === eventId);
        if (eventIndex !== -1) {
          this.events[eventIndex] = result.event || { ...this.events[eventIndex], status: 'cancelled' };
        }
        return this.events[eventIndex];
      } catch (error) {
        console.error('Failed to delete event via API:', error);
        // 降級到本地操作
        const event = this.events.find(e => e.event_id === eventId);
        if (event) {
          event.status = 'cancelled';
          this.addAuditLog('delete_event', eventId, {});
        }
        return event;
      }
    } else {
      const event = this.events.find(e => e.event_id === eventId);
      if (event) {
        event.status = 'cancelled';
        this.addAuditLog('delete_event', eventId, {});
      }
      return event;
    }
  }

  // 新增審計日誌
  addAuditLog(action, targetId, detail = {}) {
    const log = {
      log_id: this.generateId('cal_'),
      user_id: authManager.currentUser.id,
      action,
      target_id: targetId,
      ts: new Date().toISOString(),
      detail
    };
    this.auditLog.push(log);
    return log;
  }

  // 生成 ID (snake_case 命名規範)
  generateId(prefix) {
    // 前綴: t_ (task), e_ (event), cal_ (audit log)
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return prefix + (timestamp + randomStr).toUpperCase().substr(-6);
  }

  // 獲取特定日期的任務（用本地時間比對）
  getTasksByDate(date) {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    return this.tasks.filter(task => {
      if (task.status === 'archived') return false;
      const due = new Date(task.due_at);
      return due.getFullYear() === y && due.getMonth() === m && due.getDate() === d;
    });
  }

  // 獲取特定日期的活動（用本地時間比對，支援跨日活動）
  getEventsByDate(date) {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    const dayStart = new Date(y, m, d, 0, 0, 0);
    const dayEnd   = new Date(y, m, d, 23, 59, 59);
    return this.events.filter(event => {
      if (event.status === 'cancelled') return false;
      const start = new Date(event.start_at);
      const end   = new Date(event.end_at);
      return start <= dayEnd && end >= dayStart;
    });
  }

  // 獲取特定月份的任務
  getTasksByMonth(year, month) {
    return this.tasks.filter(task => {
      if (task.status === 'archived') return false;
      const dueDate = new Date(task.due_at);
      return dueDate.getFullYear() === year && dueDate.getMonth() === month;
    });
  }

  // 獲取特定月份的活動
  getEventsByMonth(year, month) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    return this.events.filter(event => {
      if (event.status === 'cancelled') return false;
      const eventStart = new Date(event.start_at);
      const eventEnd = new Date(event.end_at);
      return eventEnd >= monthStart && eventStart <= monthEnd;
    });
  }
}

// 全域 API 實例
const calendarAPI = new CalendarAPI();
