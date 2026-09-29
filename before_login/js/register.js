document.addEventListener('DOMContentLoaded', () => {
  const form       = document.getElementById('register-form');
  const nameInput  = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const passInput  = document.getElementById('reg-password');

  /* 顯示行內錯誤訊息 */
  function showError(msg) {
    let el = document.getElementById('reg-error');
    if (!el) {
      el = document.createElement('p');
      el.id = 'reg-error';
      el.style.cssText = 'color:#e87272;margin-top:1em;text-align:center;font-size:.9em;';
      form.appendChild(el);
    }
    el.textContent = msg;
  }
  function showSuccess(msg) {
    let el = document.getElementById('reg-error');
    if (!el) {
      el = document.createElement('p');
      el.id = 'reg-error';
      el.style.cssText = 'color:#5bbf8a;margin-top:1em;text-align:center;font-size:.9em;';
      form.appendChild(el);
    }
    el.style.color = '#5bbf8a';
    el.textContent = msg;
  }
  function clearMsg() {
    const el = document.getElementById('reg-error');
    if (el) { el.textContent = ''; el.style.color = '#e87272'; }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsg();

    const name     = nameInput.value.trim();
    const email    = emailInput.value.trim();
    const password = passInput.value;

    if (!name) {
      showError('姓名不能為空。');
      return;
    }
    if (!email) {
      showError('請填寫 Email。');
      return;
    }
    if (password.length < 8) {
      showError('密碼至少需要 8 個字元。');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '註冊中…';

    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || '註冊失敗，請稍後再試。');
        return;
      }

      showSuccess('✅ 註冊成功！3 秒後跳轉至登入頁…');
      form.reset();

      setTimeout(() => {
        window.location.href = '/before_login/login.html';
      }, 3000);

    } catch (err) {
      showError('無法連接伺服器，請確認伺服器已啟動。');
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = '註冊';
    }
  });
});
