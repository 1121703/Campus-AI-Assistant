document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passInput  = document.getElementById('login-password');

  /* 顯示行內錯誤訊息 */
  function showError(msg) {
    let el = document.getElementById('login-error');
    if (!el) {
      el = document.createElement('p');
      el.id = 'login-error';
      el.style.cssText = 'color:#e87272;margin-top:1em;text-align:center;font-size:.9em;';
      form.appendChild(el);
    }
    el.textContent = msg;
  }
  function clearError() {
    const el = document.getElementById('login-error');
    if (el) el.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email    = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      showError('請填寫 Email 和密碼。');
      return;
    }
    if (password.length < 8) {
      showError('密碼至少需要 8 個字元。');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '登入中…';

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || '登入失敗，請稍後再試。');
        return;
      }

      /* 儲存登入資訊 */
      localStorage.setItem('auth_user_id',    data.user_id);
      localStorage.setItem('auth_session_id', data.session_id);
      localStorage.setItem('auth_name',       data.name);

      /* 導向儀表板 */
      window.location.href = '/dashboard/dashboard.html';

    } catch (err) {
      showError('無法連接伺服器，請確認伺服器已啟動。');
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = '登入';
    }
  });
});
