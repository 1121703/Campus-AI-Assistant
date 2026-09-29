// 認證檢查模塊
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
  }

  // 檢查認證狀態
  checkAuth() {
    // 檢查 localStorage 中的 token/session
    const token = localStorage.getItem('auth_token');
    const userId = localStorage.getItem('user_id');
    const sessionCookie = this.getCookie('session_id');

    if (token && userId) {
      this.isAuthenticated = true;
      this.currentUser = {
        id: userId,
        token: token
      };
      return true;
    }

    if (sessionCookie) {
      this.isAuthenticated = true;
      this.currentUser = {
        id: this.getCookie('user_id') || 'u_0001',
        token: sessionCookie
      };
      return true;
    }

    // 模擬認證（開發模式）
    // 實務上應連接真實的認證服務
    const mockAuth = this.getMockAuth();
    if (mockAuth) {
      this.isAuthenticated = true;
      this.currentUser = mockAuth;
      return true;
    }

    return false;
  }

  // 獲取 Cookie
  getCookie(name) {
    const nameEQ = name + '=';
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return cookie.substring(nameEQ.length, cookie.length);
      }
    }
    return null;
  }

  // 模擬認證（開發用）
  getMockAuth() {
    // 此處可設定模擬用戶，實務上應移除
    return {
      id: 'u_0001',
      token: 'mock_token_' + Date.now()
    };
  }

  // 設定認證
  setAuth(userId, token) {
    localStorage.setItem('user_id', userId);
    localStorage.setItem('auth_token', token);
    this.currentUser = { id: userId, token };
    this.isAuthenticated = true;
  }

  // 清除認證
  clearAuth() {
    localStorage.removeItem('user_id');
    localStorage.removeItem('auth_token');
    this.isAuthenticated = false;
    this.currentUser = null;
  }

  // 取得認證 Token
  getToken() {
    return this.currentUser?.token || localStorage.getItem('auth_token') || '';
  }

  // 登出
  logout() {
    this.clearAuth();
    window.location.href = 'login.html';
  }
}

// 全域認證實例
const authManager = new AuthManager();
