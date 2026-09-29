/* ===================================================
   nav-prelogin.js  –  shared header + sidebar for pre-login pages
   Usage: <script src="js/nav-prelogin.js"></script>
   =================================================== */
(function () {
  'use strict';

  if (document.getElementById('campus-nav-styles')) return;

  var NAV = [
    {
      href: 'login.html', label: '登入',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>'
    },
    {
      href: 'register.html', label: '註冊',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>'
    }
  ];

  var ICON_BRAND = [
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4c5c96" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>',
      '<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>',
      '<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>',
    '</svg>'
  ].join('');

  function activePage() {
    var seg = window.location.pathname.split('/').pop();
    return seg || 'final.html';
  }

  function navLinks() {
    var current = activePage();
    return NAV.map(function (item) {
      var cls = 'nav-link' + (current === item.href ? ' active' : '');
      return '<a href="' + item.href + '" class="' + cls + '">' + item.icon + item.label + '</a>';
    }).join('');
  }

  /*
   * Structure:
   *   - .menu-toggle  → fixed top-right, ALWAYS visible (outside the header)
   *   - .site-header  → fixed top, starts translateY(-100%), slides in on scroll
   *   - .sidebar      → slide-in panel from right
   */
  function buildHTML() {
    return [
      '<div class="sidebar-overlay" id="sidebarOverlay"></div>',

      '<aside class="sidebar" id="sidebar" aria-hidden="true">',
        '<div class="sidebar-head">',
          '<div class="sidebar-brand">',
            '<div class="sidebar-brand-icon">', ICON_BRAND, '</div>',
            '<span>Campus AI</span>',
          '</div>',
          '<button class="sidebar-close" id="closeSidebar" aria-label="關閉選單">',
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
            '</svg>',
          '</button>',
        '</div>',
        '<nav class="sidebar-nav" aria-label="主導覽">', navLinks(), '</nav>',
      '</aside>',

      /* Header: only the logo — slides in on scroll */
      '<header class="site-header glass" id="siteHeader">',
        '<a href="final.html" class="site-logo">',
          '<div class="logo-icon">', ICON_BRAND, '</div>',
          '<span class="grad">Campus AI</span>',
        '</a>',
      '</header>',

      /* Hamburger: always visible, fixed, independent of header */
      '<button class="menu-toggle" id="menuToggle" aria-label="開啟選單" aria-expanded="false" aria-controls="sidebar">',
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">',
          '<line x1="4" y1="6" x2="20" y2="6"/>',
          '<line x1="4" y1="12" x2="20" y2="12"/>',
          '<line x1="4" y1="18" x2="20" y2="18"/>',
        '</svg>',
      '</button>'
    ].join('');
  }

  function wireToggle() {
    var toggle   = document.getElementById('menuToggle');
    var bar      = document.getElementById('sidebar');
    var overlay  = document.getElementById('sidebarOverlay');
    var closeBtn = document.getElementById('closeSidebar');
    if (!toggle || !bar || !overlay) return;

    function open() {
      bar.classList.add('open');
      overlay.classList.add('open');
      bar.removeAttribute('aria-hidden');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      bar.classList.remove('open');
      overlay.classList.remove('open');
      bar.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* Scroll-reveal: header slides down after scrolling past 80px.
     On login/register, always visible (no hero banner to cover). */
  function wireScroll() {
    var header  = document.getElementById('siteHeader');
    var current = activePage();

    if (current === 'login.html' || current === 'register.html') {
      header.classList.add('nav-visible');
      return;
    }

    var threshold = 80;
    function update() {
      if (window.scrollY > threshold) {
        header.classList.add('nav-visible');
      } else {
        header.classList.remove('nav-visible');
      }
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function ensureFonts() {
    if (document.querySelector('link[href*="Raleway"]')) return;
    var l1 = document.createElement('link'); l1.rel = 'preconnect'; l1.href = 'https://fonts.googleapis.com';
    var l2 = document.createElement('link'); l2.rel = 'preconnect'; l2.href = 'https://fonts.gstatic.com'; l2.crossOrigin = '';
    var l3 = document.createElement('link'); l3.rel = 'stylesheet';
    l3.href = 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&family=Source+Sans+Pro:ital,wght@0,400;0,600;1,400&display=swap';
    document.head.appendChild(l1);
    document.head.appendChild(l2);
    document.head.appendChild(l3);
  }

  var CSS = [
    /* Glass utility */
    '.glass{background:rgba(46,49,65,.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}',
    '.grad{background:linear-gradient(135deg,#4c5c96,#7985b0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}',

    /* Header: hides above viewport initially, slides down on .nav-visible */
    '.site-header{position:fixed;top:0;left:0;right:0;height:60px;z-index:999;display:flex;align-items:center;padding:0 22px;transform:translateY(-100%);transition:transform .45s cubic-bezier(.4,0,.2,1);}',
    '.site-header.nav-visible{transform:translateY(0);}',

    /* Logo — strip the template dotted underline */
    '.site-logo{display:flex;align-items:center;gap:10px;font-family:"Raleway",sans-serif;font-size:1.1rem;font-weight:700;color:#fff;text-decoration:none;border-bottom:none !important;}',
    '.site-logo *{border-bottom:none !important;}',
    '.logo-icon{width:34px;height:34px;border-radius:9px;background:rgba(76,92,150,.2);border:1px solid rgba(76,92,150,.4) !important;box-shadow:none !important;display:flex;align-items:center;justify-content:center;}',

    /* Hamburger: always fixed at top-right, above header (z-index 1001) */
    '.menu-toggle{position:fixed !important;top:11px !important;right:22px !important;z-index:1001;width:38px !important;height:38px !important;min-height:0 !important;line-height:1 !important;padding:0 !important;border:none !important;box-shadow:none !important;background:transparent !important;color:#fff !important;cursor:pointer;display:flex !important;align-items:center !important;justify-content:center !important;border-radius:8px !important;transition:background .2s;text-transform:none !important;letter-spacing:0 !important;font-size:1rem !important;white-space:normal !important;}',
    '.menu-toggle:hover{background:rgba(76,92,150,.25) !important;}',

    /* Sidebar overlay */
    '.sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);z-index:1050;opacity:0;pointer-events:none;transition:opacity .3s;}',
    '.sidebar-overlay.open{opacity:1;pointer-events:auto;}',

    /* Sidebar panel */
    '.sidebar{position:fixed;top:0;right:0;width:268px;height:100%;background:#353849;border-left:1px solid rgba(255,255,255,.125);z-index:1100;transform:translateX(100%);transition:transform .3s ease-out;display:flex;flex-direction:column;padding:22px;}',
    '.sidebar.open{transform:translateX(0);}',
    '.sidebar-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px;}',
    '.sidebar-brand{display:flex;align-items:center;gap:10px;font-family:"Raleway",sans-serif;font-weight:700;font-size:.95rem;color:#fff;}',
    '.sidebar-brand-icon{width:36px;height:36px;border-radius:50%;background:rgba(76,92,150,.2);display:flex;align-items:center;justify-content:center;}',

    /* Sidebar close button — override template button styles */
    '.sidebar-close{width:30px !important;height:30px !important;min-height:0 !important;line-height:1 !important;padding:0 !important;border:none !important;box-shadow:none !important;background:transparent !important;color:rgba(255,255,255,.65) !important;cursor:pointer;display:flex !important;align-items:center !important;justify-content:center !important;border-radius:6px !important;transition:all .2s;text-transform:none !important;}',
    '.sidebar-close:hover{background:#3d4051 !important;color:#fff !important;}',

    /* Nav links */
    '.sidebar-nav{flex:1;display:flex;flex-direction:column;gap:3px;}',
    '.nav-link{display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:9px;color:rgba(255,255,255,.65);font-size:.9375rem;transition:all .2s;text-decoration:none;border-bottom:none !important;}',
    '.nav-link:hover{background:#3d4051;color:#fff !important;}',
    '.nav-link.active{background:rgba(76,92,150,.2);color:#4c5c96 !important;}',
    '.nav-link svg{width:17px;height:17px;flex-shrink:0;}'
  ].join('\n');

  function init() {
    ensureFonts();
    var style = document.createElement('style');
    style.id = 'campus-nav-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('afterbegin', buildHTML());
    wireToggle();
    wireScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
