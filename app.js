/* AI Chinese 6.0 · 概念原型 · 轻交互（2026-10-14）
   概念演示用：未展开入口统一出提示条；「今天」点一下回到顶部；
   首页每日卡片流 / 今日清单打勾 / 链接参数透传 */
(function () {
  var toastEl = document.querySelector('.toast');
  var toastTimer = null;

  function showToast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove('show'); }, 2000);
  }

  document.querySelectorAll('[data-toast]').forEach(function (el) {
    el.addEventListener('click', function () {
      showToast(el.getAttribute('data-toast') || '概念页面暂未展开');
    });
  });

  document.querySelectorAll('[data-top]').forEach(function (el) {
    el.addEventListener('click', function () {
      /* 桌面宽屏：滚的是手机框里的内容区；手机端：滚的是页面 */
      var scroller = document.querySelector('.app > main');
      if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) {
        scroller.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  /* 手机状态栏：时间跟着真实时间走 */
  var statusTimeEl = document.querySelector('[data-status-time]');
  if (statusTimeEl) {
    var syncStatusTime = function () {
      var now = new Date();
      statusTimeEl.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    syncStatusTime();
    window.setInterval(syncStatusTime, 20000);
  }

  /* 目标首页倒计时：从 URL 读 ?days=（没有就保留页面里写死的默认天数） */
  var daysEl = document.querySelector('[data-days]');
  if (daysEl) {
    var rawDays = new URLSearchParams(window.location.search).get('days');
    if (rawDays !== null && rawDays.trim() !== '') {
      var daysValue = Number(rawDays);
      if (isFinite(daysValue) && daysValue >= 0) daysEl.textContent = String(Math.round(daysValue));
    }
  }

  /* 「我的」入口：把当前目标与倒计时参数带过去（首页 → 我的，数字口径一致） */
  var profileLink = document.querySelector('[data-profile-link]');
  if (profileLink) {
    var pageParams = new URLSearchParams(window.location.search);
    var profileQuery = new URLSearchParams();
    profileQuery.set('goal', document.body.dataset.goal || 'work');
    var carryDays = pageParams.get('days');
    if (carryDays !== null && carryDays.trim() !== '') profileQuery.set('days', carryDays);
    var carryDate = pageParams.get('date');
    if (carryDate !== null && carryDate.trim() !== '') profileQuery.set('date', carryDate);
    profileLink.setAttribute('href', 'profile.html?' + profileQuery.toString());
  }

  /* 链接参数透传：把当前 goal / days / date 带进目标页（数字口径一致） */
  var carryParams = new URLSearchParams(window.location.search);
  document.querySelectorAll('[data-carry-params]').forEach(function (el) {
    var href = el.getAttribute('href');
    if (!href || href.indexOf('://') > -1) return;
    var url = new URL(href, window.location.href);
    ['goal', 'days', 'date'].forEach(function (key) {
      var value = carryParams.get(key);
      if (value !== null && value !== '' && !url.searchParams.get(key)) url.searchParams.set(key, value);
    });
    el.setAttribute('href', url.pathname.split('/').pop() + url.search);
  });

  /* 首页 · 每日卡片流：默认停在「今天」，圆点 / 桌面箭头翻看 */
  var flow = document.querySelector('[data-day-flow]');
  if (flow) {
    var dayCards = flow.querySelectorAll('.day-card');
    var dotsWrap = document.querySelector('[data-flow-dots]');
    var prevBtn = document.querySelector('[data-flow-prev]');
    var nextBtn = document.querySelector('[data-flow-next]');
    var FLOW_GAP = 12;

    var flowStep = function () { return dayCards[0].offsetWidth + FLOW_GAP; };
    var flowMax = function () { return flow.scrollWidth - flow.clientWidth; };

    /* 默认停在最右的「今天」 */
    flow.scrollLeft = flowMax();

    var dots = [];
    if (dotsWrap) {
      for (var di = 0; di < dayCards.length; di += 1) {
        (function (idx) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'flow-dot';
          dot.setAttribute('aria-label', dayCards[idx].getAttribute('aria-label') || ('第 ' + (idx + 1) + ' 天'));
          dot.addEventListener('click', function () {
            flow.scrollTo({ left: idx * flowStep(), behavior: 'smooth' });
          });
          dotsWrap.appendChild(dot);
          dots.push(dot);
        })(di);
      }
    }

    var syncFlow = function () {
      var i = Math.max(0, Math.min(dayCards.length - 1, Math.round(flow.scrollLeft / flowStep())));
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
      if (prevBtn) prevBtn.disabled = flow.scrollLeft <= 2;
      if (nextBtn) nextBtn.disabled = flow.scrollLeft >= flowMax() - 2;
    };
    flow.addEventListener('scroll', function () { window.requestAnimationFrame(syncFlow); });
    if (prevBtn) prevBtn.addEventListener('click', function () { flow.scrollBy({ left: -flowStep(), behavior: 'smooth' }); });
    if (nextBtn) nextBtn.addEventListener('click', function () { flow.scrollBy({ left: flowStep(), behavior: 'smooth' }); });
    window.addEventListener('resize', function () {
      flow.scrollLeft = Math.min(flow.scrollLeft, flowMax());
      syncFlow();
    });
    syncFlow();
  }

  /* 首页 · 堆叠日期卡（职场页）：拖动跟手 + 松手吸附；圆点 / 桌面箭头切换 */
  var deck = document.querySelector("[data-card-deck]");
  if (deck) {
    var deckCards = Array.prototype.slice.call(deck.querySelectorAll(".deck-card"));
    var deckDotsWrap = document.querySelector("[data-deck-dots]");
    var deckPrev = document.querySelector("[data-deck-prev]");
    var deckNext = document.querySelector("[data-deck-next]");
    var deckIndex = deckCards.length - 1; /* 默认最前：今天 */
    var deckDots = [];
    var deckDrag = null;
    var deckSuppressClick = false;
    var DECK_THRESHOLD = 70;

    var applyDeck = function () {
      deck.classList.remove("is-dragging");
      deckCards.forEach(function (card, i) {
        var slot = (deckIndex - i + deckCards.length) % deckCards.length;
        card.classList.toggle("slot-0", slot === 0);
        card.classList.toggle("slot-1", slot === 1);
        card.classList.toggle("slot-2", slot === 2);
        card.style.transform = "";
        card.inert = slot !== 0;
        card.setAttribute("aria-hidden", slot === 0 ? "false" : "true");
      });
      deckDots.forEach(function (dot, i) { dot.classList.toggle("is-active", i === deckIndex); });
      if (deckPrev) deckPrev.disabled = deckIndex <= 0;
      if (deckNext) deckNext.disabled = deckIndex >= deckCards.length - 1;
    };

    var setDeck = function (idx) {
      deckIndex = Math.max(0, Math.min(deckCards.length - 1, idx));
      applyDeck();
    };

    if (deckDotsWrap) {
      deckCards.forEach(function (card, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "flow-dot";
        dot.setAttribute("aria-label", card.getAttribute("aria-label") || ("第 " + (i + 1) + " 天"));
        dot.addEventListener("click", function () { setDeck(i); });
        deckDotsWrap.appendChild(dot);
        deckDots.push(dot);
      });
    }
    if (deckPrev) deckPrev.addEventListener("click", function () { setDeck(deckIndex - 1); });
    if (deckNext) deckNext.addEventListener("click", function () { setDeck(deckIndex + 1); });

    var frontCard = function () {
      for (var k = 0; k < deckCards.length; k += 1) {
        if (deckCards[k].classList.contains("slot-0")) return deckCards[k];
      }
      return deckCards[deckIndex];
    };

    deck.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      var front = frontCard();
      if (!front || !front.contains(e.target)) return;
      deckDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, active: false, front: front };
      deckSuppressClick = false;
    });

    window.addEventListener("pointermove", function (e) {
      if (!deckDrag || e.pointerId !== deckDrag.id) return;
      var dx = e.clientX - deckDrag.x;
      var dy = e.clientY - deckDrag.y;
      if (!deckDrag.active) {
        if (Math.abs(dx) < 6) return;
        if (Math.abs(dx) <= Math.abs(dy)) { deckDrag = null; return; } /* 竖向就让页面滚 */
        deckDrag.active = true;
        deckSuppressClick = true;
        deck.classList.add("is-dragging");
      }
      e.preventDefault();
      deckDrag.dx = dx;
      deckDrag.front.style.transform = "translate3d(" + dx + "px, 0, 0)";
    }, { passive: false });

    var endDeckDrag = function (e) {
      if (!deckDrag || e.pointerId !== deckDrag.id) return;
      var drag = deckDrag;
      deckDrag = null;
      if (!drag.active) return;
      var shift = drag.dx > DECK_THRESHOLD ? -1 : (drag.dx < -DECK_THRESHOLD ? 1 : 0);
      deckIndex = Math.max(0, Math.min(deckCards.length - 1, deckIndex + shift));
      void deck.offsetWidth; /* 让吸附动画从松手位置接着走 */
      applyDeck();
    };
    window.addEventListener("pointerup", endDeckDrag);
    window.addEventListener("pointercancel", function (e) {
      if (!deckDrag || e.pointerId !== deckDrag.id) return;
      deckDrag = null;
      applyDeck();
    });

    /* 拖动过就不触发卡内按钮的 click */
    deck.addEventListener("click", function (e) {
      if (!deckSuppressClick) return;
      deckSuppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    applyDeck();
  }

  /* 首页 · 今日清单：圆圈手动打勾，4 条全勾上后卡片转完成态 */
  var todayCard = document.querySelector('[data-today-card]');
  if (todayCard) {
    var checkBtns = todayCard.querySelectorAll('.task-check');
    var syncToday = function () {
      var allDone = Array.prototype.every.call(checkBtns, function (btn) {
        return btn.closest('.task').classList.contains('done');
      });
      todayCard.classList.toggle('is-complete', allDone);
    };
    Array.prototype.forEach.call(checkBtns, function (btn) {
      btn.addEventListener('click', function () {
        var task = btn.closest('.task');
        var done = task.classList.toggle('done');
        btn.setAttribute('aria-pressed', done ? 'true' : 'false');
        syncToday();
      });
    });
    syncToday();
  }

  /* 首页 · 「开始今天的任务」：高亮第一条 */
  document.querySelectorAll('[data-start-today]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var firstTask = document.querySelector('[data-today-card] .task');
      if (firstTask) firstTask.classList.add('is-focus');
    });
  });

})();
