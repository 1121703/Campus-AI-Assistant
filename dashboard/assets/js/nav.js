/* ===================================================
   campus-nav.js  –  shared header + sidebar component
   Usage: <script src="assets/js/nav.js"></script>
   Drop this anywhere in <body>; it self-injects.
   =================================================== */
(function () {
  'use strict';

  /* ── Guard: inject only once per page ── */
  if (document.getElementById('campus-nav-styles')) return;

  /* ── Navigation items ── */
  var NAV = [
    {
      href: '/dashboard/dashboard.html', label: '儀表板',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
    },
    {
      href: '/calnader/calendar.html', label: '行事曆',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
    },
    {
      href: '/ai-assistant/ai-assistant.html', label: 'AI 助手',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>'
    },
    {
      href: '/game/game.html', label: '遊戲',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="8" width="20" height="8" rx="4"/></svg>'
    },
    {
      href: '/psych/psych_index.html', label: '心理測驗',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>'
    }
  ];

  var ICON_BRAND = [
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4c5c96" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>',
      '<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>',
      '<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>',
    '</svg>'
  ].join('');

  /* ── Detect active page ── */
  function activePage() {
    var seg = window.location.pathname.split('/').pop();
    return seg || 'index.html';
  }

  /* ── Build nav link list ── */
  function navLinks() {
    var current = activePage();
    return NAV.map(function (item) {
      var itemFile = item.href.split('/').pop();
      var cls = 'nav-link' + (current === itemFile ? ' active' : '');
      return '<a href="' + item.href + '" class="' + cls + '">' + item.icon + item.label + '</a>';
    }).join('');
  }

  /* ── Build full markup ── */
  function buildHTML() {
    return [
      '<div class="sidebar-overlay" id="sidebarOverlay"></div>',

      '<aside class="sidebar" id="sidebar" aria-hidden="true">',
        '<div class="sidebar-head">',
          '<div class="sidebar-brand">',
            '<div class="sidebar-brand-icon">', ICON_BRAND, '</div>',
            '<span>Campus AI</span>',
          '</div>',
          '<button class="sidebar-close" id="closeSidebar" aria-label="關閉選單" style="background:transparent;border:none;padding:0;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:6px;">',
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
            '</svg>',
          '</button>',
        '</div>',
        '<nav class="sidebar-nav" aria-label="主導覽">', navLinks(), '</nav>',
        '<button class="nav-logout" data-logout>',
          '<svg viewBox="0 0 24 24" fill="none" stroke="#e87272" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
            '<polyline points="16 17 21 12 16 7"/>',
            '<line x1="21" y1="12" x2="9" y2="12"/>',
          '</svg>',
          '登出',
        '</button>',
      '</aside>',

      '<header class="site-header glass" id="siteHeader">',
        '<a href="/dashboard/dashboard.html" class="site-logo">',
          '<div class="logo-icon">', ICON_BRAND, '</div>',
          '<span class="grad">Campus AI</span>',
        '</a>',
        '<button class="menu-toggle" id="menuToggle" aria-label="開啟選單" aria-expanded="false" aria-controls="sidebar" style="background:transparent;border:none;padding:7px;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:8px;">',
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            '<line x1="4" y1="6" x2="20" y2="6"/>',
            '<line x1="4" y1="12" x2="20" y2="12"/>',
            '<line x1="4" y1="18" x2="20" y2="18"/>',
          '</svg>',
        '</button>',
      '</header>'
    ].join('');
  }

  /* ── Wire sidebar toggle ── */
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

  /* ── Inject Google Fonts if not already present ── */
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

  /* ── CSS ── */
  var CSS = [
    '/* campus-nav shared styles */',
    '.glass{background:rgba(53,56,73,.96);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.12);box-shadow:0 2px 16px rgba(0,0,0,.45);}',
    '.grad{background:linear-gradient(135deg,#4c5c96,#7985b0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}',

    /* Header */
    '.site-header{position:fixed;top:0;left:0;right:0;height:60px;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 22px;}',
    '.site-logo{display:flex;align-items:center;gap:10px;font-family:"Raleway",sans-serif;font-size:1.1rem;font-weight:700;color:#fff;text-decoration:none;}',
    '.logo-icon{width:34px;height:34px;border-radius:9px;background:rgba(76,92,150,.2);border:1px solid rgba(76,92,150,.4);display:flex;align-items:center;justify-content:center;}',
    '.menu-toggle{width:38px;height:38px;border:none;background:transparent;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:background .2s;}',
    '.menu-toggle:hover{background:rgba(76,92,150,.2);}',

    /* Sidebar overlay */
    '.sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);z-index:150;opacity:0;pointer-events:none;transition:opacity .3s;}',
    '.sidebar-overlay.open{opacity:1;pointer-events:auto;}',

    /* Sidebar panel */
    '.sidebar{position:fixed;top:0;right:0;width:268px;height:100%;background:#353849;border-left:1px solid rgba(255,255,255,.125);z-index:200;transform:translateX(100%);transition:transform .3s ease-out;display:flex;flex-direction:column;padding:22px;}',
    '.sidebar.open{transform:translateX(0);}',
    '.sidebar-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px;}',
    '.sidebar-brand{display:flex;align-items:center;gap:10px;font-family:"Raleway",sans-serif;font-weight:700;font-size:.95rem;color:#fff;}',
    '.sidebar-brand-icon{width:36px;height:36px;border-radius:50%;background:rgba(76,92,150,.2);display:flex;align-items:center;justify-content:center;}',
    '.sidebar-close{width:30px;height:30px;border:none;background:transparent;color:rgba(255,255,255,.65);cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:all .2s;}',
    '.sidebar-close:hover{background:#3d4051;color:#fff;}',
    '.sidebar-nav{flex:1;display:flex;flex-direction:column;gap:3px;}',

    /* Nav links */
    '.nav-link{display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:9px;color:rgba(255,255,255,.65);font-size:.9375rem;transition:all .2s;text-decoration:none;}',
    '.nav-link:hover{background:#3d4051;color:#fff;}',
    '.nav-link.active{background:rgba(76,92,150,.2);color:#4c5c96;}',
    '.nav-link svg{width:17px;height:17px;flex-shrink:0;}',
    '.nav-logout{display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:9px;color:#e87272;font-size:.9375rem;transition:all .2s;border:none;background:transparent;cursor:pointer;width:100%;text-align:left;}',
    '.nav-logout:hover{background:rgba(232,114,114,.1);}',
    '.nav-logout svg{width:17px;height:17px;}'
  ].join('\n');

  /* ── Init ── */
  function init() {
    ensureFonts();
    var style = document.createElement('style');
    style.id = 'campus-nav-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('afterbegin', buildHTML());
    wireToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
