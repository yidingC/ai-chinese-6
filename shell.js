/* AI Chinese 6.0 · 公区壳脚本（一改全改）
   往 .shell-screen 里注入：状态栏 / Home 条 / 悬浮胶囊导航；画布居中，窗口不够大时整块等比缩小。
   页面只需在 <body> 上标当前页：data-tab="today|an|calendar|me"。
   导航链接、当前项高亮、日历占位提示都在这一个文件里改。 */
(function () {
  var scriptEl = document.currentScript;
  var src = (scriptEl && scriptEl.getAttribute('src')) || 'shell.js';
  var base = src.replace(/shell\.js.*$/, '');   /* review/ 下的页面会拿到 '../' */

  var ICON = {
    today: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3.9 11.3 12 4.3l8.1 7"/><path d="M6.3 9.6v9.6h11.4V9.6"/></svg>',
    an: '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><circle cx="9" cy="10.4" r="1.15" fill="currentColor" stroke="none"/><circle cx="15" cy="10.4" r="1.15" fill="currentColor" stroke="none"/><path d="M8.8 14.6c1.9 1.9 4.5 1.9 6.4 0"/></svg>',
    calendar: '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3.6" y="5.2" width="16.8" height="15" rx="3"/><path d="M3.6 9.6h16.8M8.2 3.4v3.4M15.8 3.4v3.4"/></svg>',
    me: '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="8.4" r="3.7"/><path d="M4.8 20.2c1-4.2 3.8-6.4 7.2-6.4s6.2 2.2 7.2 6.4"/></svg>'
  };

  /* 四个 tab 的落点。今天页 = goal-work.html（职场版首页，其余目标首页接新版时再跟着换） */
  var TABS = [
    { key: 'today',    label: '今天', icon: ICON.today,    href: base + 'goal-work.html' },
    { key: 'an',       label: '小安', icon: ICON.an,       href: base + 'xiaolan.html' },
    { key: 'calendar', label: '日历', icon: ICON.calendar, href: base + 'calendar.html' },
    { key: 'me',       label: '我的', icon: ICON.me,       href: base + 'profile.html' }
  ];

  var screen = document.querySelector('.shell-screen');
  if (!screen) { console.warn('[shell] 没找到 .shell-screen，公区壳没有注入'); return; }
  var current = (document.body && document.body.dataset.tab) || 'today';
  var keep = window.location.search || '';   /* 切 tab 时把 ?goal= / ?days= / ?date= 带上，演示上下文不丢 */
  var toastTimer = null;

  function showToast(text) {
    var el = screen.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      screen.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('show'); }, 2000);
  }

  function scrollTop() {
    var main = document.querySelector('.shell-main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* 状态栏 */
  var st = document.createElement('div');
  st.className = 'shell-st';
  st.setAttribute('aria-hidden', 'true');
  st.textContent = '11:20';
  var si = document.createElement('div');
  si.className = 'shell-si';
  si.setAttribute('aria-hidden', 'true');
  si.innerHTML = '5G <span class="shell-bat"></span>';
  screen.appendChild(st);
  screen.appendChild(si);

  /* 悬浮导航 */
  var nav = document.createElement('nav');
  nav.className = 'shell-nav';
  nav.setAttribute('aria-label', '底部导航');
  TABS.forEach(function (tab) {
    var el = tab.href ? document.createElement('a') : document.createElement('button');
    if (tab.href) el.href = tab.href + (keep && tab.href.indexOf('?') < 0 ? keep : ''); else el.type = 'button';
    el.className = 'nv' + (tab.key === current ? ' is-active' : '');
    el.id = 'nav' + tab.key.charAt(0).toUpperCase() + tab.key.slice(1);
    el.setAttribute('aria-label', tab.label);
    el.innerHTML = tab.icon + '<span class="nv-label">' + tab.label + '</span>';
    if (tab.key === current) {
      el.setAttribute('aria-current', 'page');
      el.addEventListener('click', function (e) { e.preventDefault(); scrollTop(); });
    }
    if (tab.toast) {
      el.addEventListener('click', function (e) { e.preventDefault(); showToast(tab.toast); });
    }
    nav.appendChild(el);
  });
  screen.appendChild(nav);

  /* Home 条 */
  var hbar = document.createElement('div');
  hbar.className = 'shell-hbar';
  hbar.setAttribute('aria-hidden', 'true');
  screen.appendChild(hbar);

  /* 桌面预览居中 + 窗口不够大时等比缩小（不出滚动条） */
  function fit() {
    var k = Math.min(1, window.innerWidth / 390, window.innerHeight / 844);
    screen.style.transform = 'scale(' + k + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  /* —— 切页到达滑动：页面瞬时切换，落地后胶囊从上一次 tab 的槽位滑到当前槽位 ——
     让真胶囊自己飞（FLIP）：不克隆、不交接、不动 DOM，所有帧都是同一个元素。
     上一次 tab 记在 sessionStorage；直接开链接 / 刷新不动。?vtslow=1 放慢 5 倍，方便录帧；
     系统「减少动态效果」时不动。 */
  try {
    var STORE = 'ac6.lastTab';
    var lastTab = null;
    try { lastTab = sessionStorage.getItem(STORE); } catch (e) {}
    try { sessionStorage.setItem(STORE, current); } catch (e) {}
    var keys = TABS.map(function (t) { return t.key; });
    var fromIdx = keys.indexOf(lastTab), toIdx = keys.indexOf(current);
    var noMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var slow = /vtslow/.test(window.location.search);
    if (!noMotion && fromIdx > -1 && toIdx > -1 && fromIdx !== toIdx) {
      var pill = nav.querySelector('.nv.is-active');
      if (pill) {
        var GAP = 11, PAD = 10.5, WACT = 90, WCIR = 46;
        var slotX = function (i, act) { var x = PAD; for (var j = 0; j < i; j++) x += (j === act ? WACT : WCIR) + GAP; return x; };
        var fromX = slotX(fromIdx, fromIdx);
        /* 量精确位置；除以缩放系数，兼容窗口不够大时的等比缩小 */
        var navR = nav.getBoundingClientRect();
        var pillR = pill.getBoundingClientRect();
        var k = navR.width / 282;
        var toX = (pillR.left - navR.left) / k;
        pill.style.zIndex = '2';   /* 飞行时压过途中经过的圆钮 */
        var anim = pill.animate(
          [{ transform: 'translateX(' + (fromX - toX) + 'px)' },
           { transform: 'translateX(0)' }],
          { duration: slow ? 1400 : 280, easing: 'cubic-bezier(.30,1.06,.36,1)' }
        );
        var settle = function () { pill.style.zIndex = ''; };
        anim.finished.then(settle, settle);
      }
    }
  } catch (e) {}

  window.Shell = { screen: screen, fit: fit, toast: showToast, tab: current };
})();
