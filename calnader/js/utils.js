// 工具函數模塊
class CalendarUtils {
  // 獲取當月的所有天數
  static getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  // 獲取月份的第一天是星期幾
  static getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  }

  // 格式化日期時間
  static formatDateTime(dateString, format = 'YYYY-MM-DD HH:mm') {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes);
  }

  // 格式化日期（僅日期）
  static formatDate(dateString, format = 'YYYY-MM-DD') {
    return this.formatDateTime(dateString, format);
  }

  // 格式化時間
  static formatTime(dateString, format = 'HH:mm') {
    return this.formatDateTime(dateString, format);
  }

  // 判斷是否同一天（用本地時間比對，避免 UTC 時區偏移）
  static isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth()    === d2.getMonth()    &&
           d1.getDate()     === d2.getDate();
  }

  // 判斷是否今天
  static isToday(dateString) {
    return this.isSameDay(new Date(), dateString);
  }

  // 判斷是否過期
  static isOverdue(dateString) {
    return new Date(dateString) < new Date() && !this.isToday(dateString);
  }

  // 獲取相對日期文字（如 "今天", "明天", "昨天"）
  static getRelativeDateText(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.isSameDay(date, today)) return '今天';
    if (this.isSameDay(date, tomorrow)) return '明天';
    if (this.isSameDay(date, yesterday)) return '昨天';

    return this.formatDate(dateString, 'MM/DD');
  }

  // 獲取星期名稱
  static getDayName(dayIndex) {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return days[dayIndex % 7];
  }

  // 獲取月份名稱
  static getMonthName(monthIndex) {
    const months = [
      '1月', '2月', '3月', '4月', '5月', '6月',
      '7月', '8月', '9月', '10月', '11月', '12月'
    ];
    return months[monthIndex];
  }

  // 取得中文工作日名稱
  static getWeekdayName(date) {
    const day = date.getDay();
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return days[day];
  }

  // 計算兩個日期之間的天數
  static daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // ISO 字符串轉本地日期時間
  static toLocalDateTime(isoString) {
    return new Date(isoString);
  }

  // 本地日期時間轉 ISO 字符串
  static toISOString(date) {
    return new Date(date).toISOString();
  }

  // 獲取優先級樣式類
  static getPriorityClass(priority) {
    const priorityMap = {
      'high': 'priority-high',
      'normal': 'priority-normal',
      'low': 'priority-low'
    };
    return priorityMap[priority] || 'priority-normal';
  }

  // 獲取事件類型樣式
  static getEventTypeClass(isTask) {
    return isTask ? 'event-task' : 'event-activity';
  }
}
