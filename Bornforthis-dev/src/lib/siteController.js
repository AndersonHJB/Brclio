import { initializeFinderWindow } from './finderController';

let hasInitialized = false;

export function initializeSite() {
  if (hasInitialized) return undefined;
  hasInitialized = true;

  const listenerRecords = [];
  const timeoutIds = new Set();
  const intervalIds = new Set();
  const animationFrameIds = new Set();
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);

  EventTarget.prototype.addEventListener = function(type, listener, options) {
    listenerRecords.push([this, type, listener, options]);
    return originalAddEventListener.call(this, type, listener, options);
  };

  function setTimeout(callback, delay, ...args) {
    const timeoutId = nativeSetTimeout(() => {
      timeoutIds.delete(timeoutId);
      callback(...args);
    }, delay);
    timeoutIds.add(timeoutId);
    return timeoutId;
  }

  function clearTimeout(timeoutId) {
    timeoutIds.delete(timeoutId);
    nativeClearTimeout(timeoutId);
  }

  function setInterval(callback, delay, ...args) {
    const intervalId = nativeSetInterval(callback, delay, ...args);
    intervalIds.add(intervalId);
    return intervalId;
  }

  function clearInterval(intervalId) {
    intervalIds.delete(intervalId);
    nativeClearInterval(intervalId);
  }

  function requestAnimationFrame(callback) {
    const frameId = nativeRequestAnimationFrame((timestamp) => {
      animationFrameIds.delete(frameId);
      callback(timestamp);
    });
    animationFrameIds.add(frameId);
    return frameId;
  }

  'use strict';

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ===== STATE ===== */
  var typingDone = false;
  var launched = false;   // user has zoomed into the desktop
  var looping = false;

  /* ============================================
     TAB ROUTER (hash-based)
     ============================================ */
  var TABS = ['home', 'works', 'system'];
  var pillNav = document.getElementById('pillNav');
  var canvasFrame = document.getElementById('canvasFrame');
  var canvasLoaded = false;

  function currentTab() {
    var h = location.hash.replace('#', '');
    return TABS.indexOf(h) >= 0 ? h : 'home';
  }

  function applyScrollLock() {
    // Scroll locked only on home tab before launch
    var lock = currentTab() === 'home' && !launched;
    document.documentElement.classList.toggle('scroll-unlocked', !lock);
  }

  function switchTab(tab) {
    TABS.forEach(function(t) {
      document.getElementById('page-' + t).classList.toggle('active', t === tab);
    });
    pillNav.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    if (tab === 'system' && !canvasLoaded) {
      canvasFrame.src = canvasFrame.dataset.src;
      canvasLoaded = true;
    }
    // Force top: immediately and after layout settles (defeats scroll anchoring)
    window.scrollTo(0, 0);
    requestAnimationFrame(function() {
      window.scrollTo(0, 0);
      requestAnimationFrame(function() { window.scrollTo(0, 0); });
    });
    applyScrollLock();
    if (tab === 'home') scheduleDesktopReflow();
  }

  pillNav.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (btn) location.hash = btn.dataset.tab;
  });
  window.addEventListener('hashchange', function() {
    switchTab(currentTab());
  });

  /* ============================================
     MENUBAR CLOCK
     ============================================ */
  var mbClock = document.getElementById('mbClock');
  function tickClock() {
    var d = new Date();
    mbClock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  tickClock();
  setInterval(tickClock, 30000);

  /* ============================================
     TERMINAL TYPING (first visit) / SKIP (return)
     ============================================ */
  var VISITED_KEY = 'esther_visited';
  var isReturnVisitor = false;
  try { isReturnVisitor = !!localStorage.getItem(VISITED_KEY); } catch (e) {}

  var terminalData = [
    { type: 'cmd', prompt: '$ ', text: 'whoami' },
    { type: 'output', prefix: '> ', text: 'ESTHER不二' },
    { type: 'blank' },
    { type: 'cmd', prompt: '$ ', text: 'cat about.md' },
    { type: 'output', prefix: '> ', text: '在AI时代认真生活的女生' },
    { type: 'output', prefix: '  ', text: 'INTJ / 跟Agent搭档的第1年' },
    { type: 'output', prefix: '  ', text: '南大/米理建筑 → AI ColaOS building' },
    { type: 'blank' },
    { type: 'cmd', prompt: '$ ', text: 'echo "1 person + AI = 1 team"' },
    { type: 'gold', prefix: '> ', text: '1 person + AI = 1 team' },
    { type: 'blank' },
    { type: 'cmd', prompt: '$ ', text: 'open esther-os.app', cursor: true }
  ];

  var container = document.getElementById('terminalLines');
  var heroCta = document.getElementById('heroCta');

  function renderLine(item) {
    var div = document.createElement('div');
    div.className = 'term-line';
    if (item.type === 'blank') {
      div.innerHTML = '&nbsp;';
    } else if (item.type === 'cmd') {
      var html = '<span class="term-prompt">' + item.prompt + '</span><span class="term-cmd">' + item.text + '</span>';
      if (item.cursor) html += '<span class="cursor" id="mainCursor"></span>';
      div.innerHTML = html;
    } else if (item.type === 'output') {
      div.innerHTML = '<span class="term-output">' + item.prefix + item.text + '</span>';
    } else if (item.type === 'gold') {
      div.innerHTML = '<span class="term-gold">' + item.prefix + item.text + '</span>';
    }
    container.appendChild(div);
    return div;
  }

  function finishIntro() {
    typingDone = true;
    heroCta.classList.add('visible');
    pillNav.classList.remove('hidden-during-intro');
    try { localStorage.setItem(VISITED_KEY, '1'); } catch (e) {}
  }

  if (isReturnVisitor) {
    // Return visitor: terminal shows instantly (no typing), then auto zoom into desktop
    terminalData.forEach(function(item) { renderLine(item).classList.add('visible'); });
    finishIntro();
    setTimeout(launch, 700);
  } else {
    // First visit: full line-by-line typing intro
    var divs = [];
    var lineDelay = 0;
    terminalData.forEach(function(item) {
      var div = renderLine(item);
      if (item.type === 'blank') { lineDelay += 200; }
      else if (item.type === 'cmd') { lineDelay += 400; div.style.animationDelay = lineDelay + 'ms'; lineDelay += 600; }
      else if (item.type === 'output') { lineDelay += 150; div.style.animationDelay = lineDelay + 'ms'; lineDelay += 300; }
      else if (item.type === 'gold') { lineDelay += 150; div.style.animationDelay = lineDelay + 'ms'; lineDelay += 400; }
      divs.push(div);
      setTimeout(function() { div.classList.add('visible'); }, 50);
    });

    var typingTimeout = setTimeout(finishIntro, lineDelay + 600);

    var skipTyping = function() {
      if (typingDone) return;
      clearTimeout(typingTimeout);
      divs.forEach(function(d) { d.style.animationDelay = '0ms'; d.classList.add('visible'); });
      finishIntro();
    };

    document.getElementById('heroSection').addEventListener('click', function() {
      if (!typingDone) skipTyping();
    });
    document.addEventListener('keydown', function(e) {
      if (!typingDone && e.key !== 'Enter') skipTyping();
    });
  }

  /* ============================================
     LAUNCH: terminal → progress bar → ZOOM INTO SCREEN
     ============================================ */
  function launch() {
    if (launched || !typingDone || currentTab() !== 'home') return;
    launched = true; // guard re-entry; desktop unlocks after zoom

    heroCta.classList.remove('visible');
    heroCta.classList.add('hidden');

    var cursorEl = document.getElementById('mainCursor');
    if (cursorEl) cursorEl.remove();

    var launchLine = document.createElement('div');
    launchLine.className = 'term-line';
    launchLine.innerHTML = '<span class="term-output">> launching...</span>';
    container.appendChild(launchLine);
    setTimeout(function() { launchLine.classList.add('visible'); }, 50);

    var progressLine = document.createElement('div');
    progressLine.className = 'term-line';
    progressLine.innerHTML = '<span class="term-prompt" id="progressText">[░░░░░░░░░░░░] 0%</span>';
    container.appendChild(progressLine);
    setTimeout(function() { progressLine.classList.add('visible'); }, 300);

    var progress = 0;
    var barLength = 12;
    setTimeout(function() {
      var progressText = document.getElementById('progressText');
      var interval = setInterval(function() {
        progress += 1;
        if (progress > barLength) {
          clearInterval(interval);
          beginZoom();
          return;
        }
        var filled = '', empty = '';
        for (var i = 0; i < barLength; i++) {
          if (i < progress) filled += '█'; else empty += '░';
        }
        var pct = Math.round((progress / barLength) * 100);
        if (progressText) progressText.textContent = '[' + filled + empty + '] ' + pct + '%';
      }, 80);
    }, 500);
  }

  function beginZoom() {
    var wrapper = document.getElementById('macbookWrapper');
    var screen = document.getElementById('macbookScreen');
    var terminal = document.getElementById('terminal');
    var overlay = document.getElementById('transitionOverlay');

    var screenRect = screen.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    var scale = Math.max(vw / screenRect.width, vh / screenRect.height) * 1.05;

    var screenCenterX = screenRect.left + screenRect.width / 2;
    var screenCenterY = screenRect.top + screenRect.height / 2;
    var wrapperRect = wrapper.getBoundingClientRect();
    var wrapperCenterX = wrapperRect.left + wrapperRect.width / 2;
    var wrapperCenterY = wrapperRect.top + wrapperRect.height / 2;
    var offsetX = screenCenterX - wrapperCenterX;
    var offsetY = screenCenterY - wrapperCenterY;
    var tx = vw / 2 - (wrapperCenterX + offsetX * scale);
    var ty = vh / 2 - (wrapperCenterY + offsetY * scale);

    setTimeout(function() { terminal.classList.add('scale-through'); }, 200);

    wrapper.classList.add('zoom-transition');
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        wrapper.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
      });
    });

    setTimeout(function() { overlay.classList.add('active'); }, 1200);

    setTimeout(function() {
      // While covered: hide hero, land on desktop top
      document.getElementById('heroSection').style.display = 'none';
      applyScrollLock();
      window.scrollTo(0, 0);
      setTimeout(function() { overlay.classList.remove('active'); }, 250);
    }, 1800);
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !launched) launch();
  });
  document.getElementById('macbookBezel').addEventListener('click', function() {
    if (typingDone) launch();
  });
  heroCta.addEventListener('click', launch);

  /* ============================================
     DESKTOP WINDOW MANAGER
     ============================================ */
  var surface = document.getElementById('desktopSurface');
  var winZ = 100;
  var openCount = 0;
  var minimizedWindowButtons = new WeakMap();
  var windowShelf;
  var windowShelfItems;
  var desktopReflowPending = false;

  function windowTitle(win) {
    return win.dataset.title || win.dataset.hrefSrc || '窗口';
  }

  function ensureWindowShelf() {
    if (windowShelf) return windowShelf;

    windowShelf = document.createElement('div');
    windowShelf.className = 'finder-window-shelf';
    windowShelf.dataset.finderWindowShelf = '';
    windowShelf.setAttribute('role', 'region');
    windowShelf.setAttribute('aria-label', '已收起的窗口');
    windowShelf.hidden = true;

    var shelfLabel = document.createElement('span');
    shelfLabel.className = 'finder-window-shelf-label';
    shelfLabel.textContent = '已收起';
    windowShelf.appendChild(shelfLabel);

    windowShelfItems = document.createElement('div');
    windowShelfItems.className = 'finder-window-shelf-items';
    windowShelf.appendChild(windowShelfItems);
    surface.appendChild(windowShelf);
    return windowShelf;
  }

  function syncWindowShelf() {
    if (!windowShelf) return;
    windowShelf.hidden = !windowShelfItems?.childElementCount;
  }

  function removeWindowShelfButton(win) {
    minimizedWindowButtons.get(win)?.remove();
    minimizedWindowButtons.delete(win);
    syncWindowShelf();
  }

  function restoreWindow(win) {
    if (!win?.isConnected) return;
    win.classList.remove('is-minimized');
    win.removeAttribute('aria-hidden');
    removeWindowShelfButton(win);
  }

  function setFinderActivity(activeWindow) {
    var activeFinder = activeWindow?.classList.contains('finder-window') ? activeWindow : null;
    surface.querySelectorAll('.finder-window').forEach(function(candidate) {
      candidate.classList.toggle('is-active', candidate === activeFinder);
    });

    var focusedElement = document.activeElement;
    var focusedFinder = focusedElement instanceof HTMLElement
      ? focusedElement.closest('.finder-window')
      : null;
    if (focusedFinder && focusedFinder !== activeFinder) {
      focusedElement.blur();
    }
  }

  function focusFrontmostWindow() {
    var windows = Array.from(surface.children).filter(function(candidate) {
      return candidate.classList.contains('os-window')
        && !candidate.classList.contains('is-minimized');
    });
    var frontmost = windows.sort(function(left, right) {
      return (Number(left.style.zIndex) || 0) - (Number(right.style.zIndex) || 0);
    }).at(-1);
    setFinderActivity(frontmost);
    if (frontmost?.classList.contains('finder-window')) {
      frontmost.querySelector('[data-finder-content]')?.focus({ preventScroll: true });
    } else {
      frontmost?.focus({ preventScroll: true });
    }
  }

  function focusWindow(win) {
    if (!win?.isConnected) return;
    var wasMinimized = win.classList.contains('is-minimized');
    restoreWindow(win);
    if (wasMinimized && win.classList.contains('finder-window')) clampFinderWindow(win);
    win.style.zIndex = ++winZ;
    setFinderActivity(win);
    if (win.classList.contains('finder-window')) {
      win.querySelector('[data-finder-content]')?.focus({ preventScroll: true });
    } else {
      win.focus({ preventScroll: true });
    }
  }

  function closeWindow(win) {
    if (!win) return;
    removeWindowShelfButton(win);
    win.remove();
    focusFrontmostWindow();
  }

  function minimizeWindow(win) {
    if (!win?.isConnected
      || !win.classList.contains('finder-window')
      || win.classList.contains('is-minimized')) return;
    ensureWindowShelf();

    var restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'finder-window-shelf-item';
    restoreButton.title = `恢复 ${windowTitle(win)}`;
    restoreButton.setAttribute('aria-label', `恢复 ${windowTitle(win)}`);

    var indicator = document.createElement('span');
    indicator.className = 'finder-window-shelf-dot';
    indicator.setAttribute('aria-hidden', 'true');
    var label = document.createElement('span');
    label.className = 'finder-window-shelf-name';
    label.textContent = windowTitle(win);
    var action = document.createElement('span');
    action.className = 'finder-window-shelf-action';
    action.textContent = '恢复';
    restoreButton.append(indicator, label, action);
    restoreButton.addEventListener('click', function(event) {
      event.stopPropagation();
      focusWindow(win);
    });

    minimizedWindowButtons.set(win, restoreButton);
    windowShelfItems.appendChild(restoreButton);
    windowShelf.hidden = false;
    win.classList.add('is-minimized');
    win.setAttribute('aria-hidden', 'true');
    focusFrontmostWindow();
  }

  function clampFinderWindow(win) {
    if (!win?.isConnected
      || !win.classList.contains('finder-window')
      || win.classList.contains('is-minimized')
      || win.classList.contains('is-maximized')
      || surface.clientWidth === 0
      || surface.clientHeight === 0) return;

    var smallViewport = window.innerWidth <= 768;
    var sideInset = smallViewport ? 6 : 8;
    var topInset = smallViewport ? 6 : 8;
    var bottomInset = smallViewport ? 70 : 82;
    var surfaceWidth = surface.clientWidth || window.innerWidth;
    var surfaceHeight = surface.clientHeight || window.innerHeight;
    var maxWidth = Math.max(0, surfaceWidth - sideInset * 2);
    var maxHeight = Math.max(0, surfaceHeight - topInset - bottomInset);
    var currentWidth = win.offsetWidth;
    var currentHeight = win.offsetHeight;

    if (currentWidth > maxWidth) win.style.width = `${maxWidth}px`;
    if (currentHeight > maxHeight) win.style.height = `${maxHeight}px`;

    var maxLeft = Math.max(sideInset, surfaceWidth - win.offsetWidth - sideInset);
    var maxTop = Math.max(topInset, surfaceHeight - win.offsetHeight - bottomInset);
    win.style.left = `${Math.min(Math.max(win.offsetLeft, sideInset), maxLeft)}px`;
    win.style.top = `${Math.min(Math.max(win.offsetTop, topInset), maxTop)}px`;
  }

  function iconSafeBounds(icon) {
    var sideInset = 8;
    var topInset = 8;
    var bottomInset = window.innerWidth <= 768 ? 72 : 84;
    return {
      minLeft: sideInset,
      minTop: topInset,
      maxLeft: Math.max(sideInset, surface.clientWidth - icon.offsetWidth - sideInset),
      maxTop: Math.max(topInset, surface.clientHeight - icon.offsetHeight - bottomInset),
    };
  }

  function rememberDraggedIconPosition(icon) {
    if (!icon?.isConnected || surface.clientWidth === 0 || surface.clientHeight === 0) return;
    var bounds = iconSafeBounds(icon);
    var left = Math.min(Math.max(icon.offsetLeft, bounds.minLeft), bounds.maxLeft);
    var top = Math.min(Math.max(icon.offsetTop, bounds.minTop), bounds.maxTop);
    var horizontalRange = bounds.maxLeft - bounds.minLeft;
    var verticalRange = bounds.maxTop - bounds.minTop;

    icon.style.right = 'auto';
    icon.style.left = `${left}px`;
    icon.style.top = `${top}px`;
    icon.dataset.desktopCustomPosition = 'true';
    icon.dataset.desktopXRatio = String(horizontalRange > 0
      ? (left - bounds.minLeft) / horizontalRange
      : 0);
    icon.dataset.desktopYRatio = String(verticalRange > 0
      ? (top - bounds.minTop) / verticalRange
      : 0);
  }

  function reflowDraggedDesktopIcons() {
    if (surface.clientWidth === 0 || surface.clientHeight === 0) return;
    surface.querySelectorAll('.desktop-icons > .dicon[data-desktop-custom-position="true"]').forEach(function(icon) {
      var bounds = iconSafeBounds(icon);
      var xRatio = Math.min(Math.max(Number(icon.dataset.desktopXRatio) || 0, 0), 1);
      var yRatio = Math.min(Math.max(Number(icon.dataset.desktopYRatio) || 0, 0), 1);
      icon.style.right = 'auto';
      icon.style.left = `${bounds.minLeft + (bounds.maxLeft - bounds.minLeft) * xRatio}px`;
      icon.style.top = `${bounds.minTop + (bounds.maxTop - bounds.minTop) * yRatio}px`;
    });
  }

  function reflowDesktopSurface() {
    if (surface.clientWidth === 0 || surface.clientHeight === 0) return;
    Array.from(surface.children).forEach(function(candidate) {
      if (candidate.classList.contains('finder-window')) clampFinderWindow(candidate);
    });
    reflowDraggedDesktopIcons();
  }

  function scheduleDesktopReflow() {
    if (desktopReflowPending) return;
    desktopReflowPending = true;
    requestAnimationFrame(function() {
      desktopReflowPending = false;
      reflowDesktopSurface();
    });
  }

  function toggleMaximize(win, maxButton) {
    if (!win?.isConnected || !win.classList.contains('finder-window')) return;
    restoreWindow(win);
    var maximized = win.classList.toggle('is-maximized');
    if (maxButton) {
      maxButton.setAttribute('aria-pressed', String(maximized));
      maxButton.setAttribute('aria-label', maximized ? '还原窗口' : '最大化窗口');
      maxButton.title = maximized ? '还原窗口' : '最大化窗口';
    }
    if (!maximized) clampFinderWindow(win);
    focusWindow(win);
  }

  function createTrafficControls(enhanced = false) {
    var traffic = document.createElement('div');
    traffic.className = 'os-traffic';
    if (!enhanced) {
      traffic.innerHTML = '<span class="tl-close"></span><span class="tl-min"></span><span class="tl-max"></span>';
      return traffic;
    }

    [
      ['tl-close', '关闭窗口'],
      ['tl-min', '最小化窗口'],
      ['tl-max', '最大化窗口'],
    ].forEach(function([className, label]) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.setAttribute('aria-label', label);
      button.title = label;
      if (className === 'tl-max') button.setAttribute('aria-pressed', 'false');
      traffic.appendChild(button);
    });
    return traffic;
  }

  function wireWindowControls(win, traffic, dragbar, enhanced = false) {
    var closeButton = traffic.querySelector('.tl-close');
    var minimizeButton = traffic.querySelector('.tl-min');
    var maximizeButton = traffic.querySelector('.tl-max');

    closeButton.addEventListener('click', function(event) {
      event.stopPropagation();
      closeWindow(win);
    });
    if (enhanced) {
      minimizeButton.addEventListener('click', function(event) {
        event.stopPropagation();
        minimizeWindow(win);
      });
      maximizeButton.addEventListener('click', function(event) {
        event.stopPropagation();
        toggleMaximize(win, maximizeButton);
      });
    }

    win.addEventListener('pointerdown', function() {
      if (win.classList.contains('is-minimized')) return;
      win.style.zIndex = ++winZ;
      setFinderActivity(win);
    });

    dragbar.addEventListener('pointerdown', function(event) {
      if (enhanced && (event.button !== 0 || win.classList.contains('is-maximized'))) return;
      event.preventDefault();
      var startX = event.clientX, startY = event.clientY;
      var origX = win.offsetLeft, origY = win.offsetTop;
      function onMove(moveEvent) {
        win.style.left = (origX + moveEvent.clientX - startX) + 'px';
        win.style.top = (origY + moveEvent.clientY - startY) + 'px';
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (enhanced) clampFinderWindow(win);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
    if (enhanced) {
      dragbar.addEventListener('dblclick', function(event) {
        event.preventDefault();
        toggleMaximize(win, maximizeButton);
      });
    }
  }

  surface.addEventListener('pointerdown', function(event) {
    setFinderActivity(event.target.closest('.os-window'));
  }, true);

  function addResize(win) {
    var handle = document.createElement('div');
    handle.className = 'os-resize';
    win.appendChild(handle);
    handle.addEventListener('pointerdown', function(e) {
      if (win.classList.contains('is-maximized')) return;
      e.preventDefault();
      e.stopPropagation();
      var startX = e.clientX, startY = e.clientY;
      var startW = win.offsetWidth, startH = win.offsetHeight;
      var iframes = win.querySelectorAll('iframe');
      iframes.forEach(function(f) { f.style.pointerEvents = 'none'; });
      function onMove(ev) {
        var newW = Math.max(280, startW + ev.clientX - startX);
        var newH = Math.max(200, startH + ev.clientY - startY);
        win.style.width = newW + 'px';
        win.style.height = newH + 'px';
      }
      function onUp() {
        iframes.forEach(function(f) { f.style.pointerEvents = ''; });
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (win.classList.contains('finder-window')) clampFinderWindow(win);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  function templateWindow(tpl) {
    return tpl.content ? tpl.content.firstElementChild : tpl.firstElementChild;
  }

  function openWindow(tplId) {
    // If already open, bring to front
    var existing = surface.querySelector('.os-window[data-from="' + tplId + '"]');
    if (existing) {
      focusWindow(existing);
      return;
    }

    var tpl = document.getElementById(tplId);
    if (!tpl) return;
    var sourceWindow = templateWindow(tpl);
    if (!sourceWindow) return;
    var win = sourceWindow.cloneNode(true);
    win.dataset.from = tplId;

    // Build chrome: macOS traffic lights + invisible drag bar
    var dragbar = document.createElement('div');
    dragbar.className = 'os-dragbar';
    win.insertBefore(dragbar, win.firstChild);

    var finderControls = win.classList.contains('finder-window');
    var traffic = createTrafficControls(finderControls);
    win.insertBefore(traffic, win.firstChild);

    // Cascade position (Cola window centered, others cascade)
    var isSmall = window.innerWidth <= 768;
    var isCola = win.classList.contains('cola-window');
    if (isCola) {
      var surfW = surface.offsetWidth || window.innerWidth;
      var surfH = surface.offsetHeight || window.innerHeight;
      var winW = Math.min(720, surfW * 0.92);
      var winH = Math.min(560, surfH * 0.78);
      win.style.left = Math.max(8, (surfW - winW) / 2) + 'px';
      win.style.top = Math.max(8, (surfH - winH) / 2 - 20) + 'px';
    } else {
      var baseX = isSmall ? 12 : 150;
      var baseY = isSmall ? 60 : 60;
      var offset = (openCount % 5) * (isSmall ? 16 : 36);
      win.style.left = (baseX + offset) + 'px';
      win.style.top = (baseY + offset) + 'px';
    }
    win.style.zIndex = ++winZ;
    openCount++;

    wireWindowControls(win, traffic, dragbar, finderControls);

    // "open works" style jump buttons
    win.querySelectorAll('[data-goto]').forEach(function(btn) {
      btn.addEventListener('click', function() { location.hash = btn.dataset.goto; });
    });

    addResize(win);
    surface.appendChild(win);
    if (win.classList.contains('finder-window')) {
      initializeFinderWindow(win, tplId, {
        openIframeWindow: openIframeWindow,
        openTemplateWindow: openWindow,
      });
      setFinderActivity(win);
      requestAnimationFrame(function() {
        clampFinderWindow(win);
        win.querySelector('[data-finder-content]')?.focus({ preventScroll: true });
      });
    } else {
      win.tabIndex = -1;
      setFinderActivity(win);
      requestAnimationFrame(function() { win.focus({ preventScroll: true }); });
    }
  }

  function openIframeWindow(url, title) {
    // If already open, bring to front
    var existing = surface.querySelector('.os-window[data-href-src="' + url + '"]');
    if (existing) {
      focusWindow(existing);
      return;
    }

    var win = document.createElement('div');
    win.className = 'os-window';
    win.dataset.hrefSrc = url;
    win.tabIndex = -1;

    var dragbar = document.createElement('div');
    dragbar.className = 'os-dragbar';
    win.appendChild(dragbar);

    var traffic = createTrafficControls();
    win.appendChild(traffic);

    var body = document.createElement('div');
    body.className = 'os-body os-body-iframe';
    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:0 0 10px 10px;overscroll-behavior:contain;';
    body.appendChild(iframe);
    win.appendChild(body);

    var isSmall = window.innerWidth <= 768;
    var surfW = surface.offsetWidth || window.innerWidth;
    var surfH = surface.offsetHeight || window.innerHeight;
    var winW = Math.min(700, surfW * 0.88);
    var winH = Math.min(520, surfH * 0.75);
    win.style.width = winW + 'px';
    win.style.height = winH + 'px';
    var offset = (openCount % 5) * (isSmall ? 16 : 30);
    win.style.left = Math.max(8, (surfW - winW) / 2 + offset) + 'px';
    win.style.top = Math.max(8, (surfH - winH) / 2 - 20 + offset) + 'px';
    win.style.zIndex = ++winZ;
    openCount++;

    wireWindowControls(win, traffic, dragbar);

    // External open button (top-right)
    var extBtn = document.createElement('div');
    extBtn.className = 'os-external';
    extBtn.title = '在新窗口打开';
    extBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    extBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      window.open(url, '_blank');
    });
    win.appendChild(extBtn);

    addResize(win);
    surface.appendChild(win);
    setFinderActivity(win);
    requestAnimationFrame(function() { win.focus({ preventScroll: true }); });
  }

  // Make icons draggable + clickable (macOS style)
  surface.querySelectorAll('.dicon').forEach(function(icon) {
    icon.addEventListener('pointerdown', function(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      var dragging = false;
      var startX = e.clientX, startY = e.clientY;
      var rect = icon.getBoundingClientRect();
      var surfRect = surface.getBoundingClientRect();
      var origX = rect.left - surfRect.left;
      var origY = rect.top - surfRect.top;

      function onMove(ev) {
        var dx = ev.clientX - startX;
        var dy = ev.clientY - startY;
        if (!dragging && Math.abs(dx) <= 4 && Math.abs(dy) <= 4) return;
        if (!dragging) {
          dragging = true;
          // Only a real drag should replace the icon's responsive right anchor.
          icon.style.right = 'auto';
          icon.style.left = origX + 'px';
          icon.style.top = origY + 'px';
        }
        icon.style.left = (origX + dx) + 'px';
        icon.style.top = (origY + dy) + 'px';
      }
      function finishDrag() {
        if (dragging) rememberDraggedIconPosition(icon);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', finishDrag);
        document.removeEventListener('pointercancel', finishDrag);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', finishDrag);
      document.addEventListener('pointercancel', finishDrag);
    });
    icon.addEventListener('dblclick', function() {
      if (icon.dataset.href) {
        openIframeWindow(icon.dataset.href, icon.querySelector('.dicon-label').textContent);
      } else if (icon.dataset.win) {
        openWindow(icon.dataset.win);
      }
    });
  });

  window.addEventListener('resize', scheduleDesktopReflow);

  surface.addEventListener('click', function(e) {
    var closeAction = e.target.closest('[data-close-window]');
    if (closeAction) {
      closeWindow(closeAction.closest('.os-window'));
    }
  });

  // Folder icon dblclick → open iframe window on desktop
  surface.addEventListener('dblclick', function(e) {
    if (e.target.closest('.finder-window')) return;
    // Handle data-win (open template window)
    var fiWin = e.target.closest('.folder-icon[data-win]');
    if (fiWin) {
      openWindow(fiWin.dataset.win);
      return;
    }
    var fi = e.target.closest('.folder-icon[data-href]');
    if (!fi) return;
    var url = fi.dataset.href;
    var label = fi.querySelector('.folder-icon-label').textContent;
    openIframeWindow(url, label);
  });

  /* ============================================
     STAR WALLPAPER MOUSE INTERACTION
     ============================================ */
  (function() {
    var wpStars = surface.querySelectorAll('.wp-star');
    var mx = -9999, my = -9999;
    var radius = 130;

    surface.addEventListener('mousemove', function(e) {
      mx = e.clientX;
      my = e.clientY;
    });

    function updateStars() {
      wpStars.forEach(function(star) {
        var rect = star.getBoundingClientRect();
        var sx = rect.left + rect.width / 2;
        var sy = rect.top + rect.height / 2;
        var dx = sx - mx;
        var dy = sy - my;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius) {
          var force = (1 - dist / radius) * 20;
          var angle = Math.atan2(dy, dx);
          var pushX = Math.cos(angle) * force;
          var pushY = Math.sin(angle) * force;
          var scale = 1 + (1 - dist / radius) * 0.4;
          star.style.setProperty('--push', 'translate(' + pushX + 'px, ' + pushY + 'px) scale(' + scale + ')');
          star.classList.add('disturbed');
        } else {
          star.style.setProperty('--push', 'translate(0, 0) scale(1)');
          star.classList.remove('disturbed');
        }
      });
      requestAnimationFrame(updateStars);
    }
    requestAnimationFrame(updateStars);

    // Click to spawn a star
    surface.addEventListener('click', function(e) {
      // Don't spawn on icon/window interactions
      if (e.target.closest('.dicon, .os-window, .desktop-sticker, .finder-window-shelf')) return;
      var star = document.createElement('span');
      star.className = 'click-star';
      star.textContent = '\u2726';
      var size = 6 + Math.random() * 10;
      star.style.fontSize = size + 'px';
      star.style.left = (e.clientX - size / 2) + 'px';
      star.style.top = (e.clientY - size / 2) + 'px';
      document.body.appendChild(star);
      setTimeout(function() { star.remove(); }, 750);
    });
  })();

  /* ============================================
     DRAGGABLE STICKER
     ============================================ */
  (function() {
    var sticker = document.getElementById('buerSticker');
    if (!sticker) return;
    sticker.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var origX = sticker.offsetLeft, origY = sticker.offsetTop;
      // Switch from bottom/right to top/left positioning
      sticker.style.bottom = 'auto';
      sticker.style.right = 'auto';
      sticker.style.left = origX + 'px';
      sticker.style.top = origY + 'px';

      function onMove(ev) {
        sticker.style.left = (origX + ev.clientX - startX) + 'px';
        sticker.style.top = (origY + ev.clientY - startY) + 'px';
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  })();

  /* ============================================
     EXIT ZOOM-OUT (scroll-driven)
     ============================================ */
  var exitSection = document.getElementById('exitSection');
  var exitCanvasContent = document.getElementById('exitCanvasContent');
  var exitMacbook = document.getElementById('exitMacbook');
  var goodbyeScreen = document.getElementById('goodbyeScreen');
  var exitScreenEl = document.getElementById('exitScreen');
  var exitStickyEl = document.getElementById('exitSticky');

  var isMobile = window.innerWidth <= 768;
  var screenW = isMobile ? 348 : 680;
  var screenH = isMobile ? 260 : 440;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  var ticking = false;
  function onScroll() {
    if (!launched || looping || currentTab() !== 'home') return;
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(function() {
      ticking = false;

      var rect = exitSection.getBoundingClientRect();
      var sectionHeight = exitSection.offsetHeight;
      var vh = window.innerHeight;
      var scrolled = -rect.top;
      var scrollableDistance = sectionHeight - vh;
      if (scrollableDistance <= 0) return;

      var progress = Math.max(0, Math.min(1, scrolled / scrollableDistance));

      // Phase 1: 0 → 0.5 - MacBook scales down from full-screen to normal
      var p1 = Math.min(1, progress / 0.5);
      var ep = easeInOutCubic(p1);
      exitMacbook.style.opacity = 1;
      var baseScale = Math.max(window.innerWidth / screenW, vh / screenH) * 1.05;
      var macScale = baseScale - (baseScale - 1) * ep;
      exitMacbook.style.transform = 'scale(' + macScale + ')';

      // Phase 2: 0.3 → 0.6 - goodbye screen fades in
      if (progress >= 0.3) {
        var p2 = Math.min(1, (progress - 0.3) / 0.3);
        goodbyeScreen.classList.add('visible');
        goodbyeScreen.style.opacity = easeInOutCubic(p2);
      } else {
        goodbyeScreen.classList.remove('visible');
        goodbyeScreen.style.opacity = 0;
      }

      // Phase 3: 0.6 → 1 - settled
      if (progress >= 0.6) {
        exitMacbook.style.transform = 'scale(1)';
        goodbyeScreen.style.opacity = 1;
        goodbyeScreen.classList.add('visible');
      }
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function() {
    isMobile = window.innerWidth <= 768;
    screenW = isMobile ? 348 : 680;
    screenH = isMobile ? 260 : 440;
  });

  /* ============================================
     LOOP: Say Hi → terminal types → Enter → desktop
     ============================================ */
  function triggerLoop() {
    if (looping || !launched) return;
    looping = true;

    goodbyeScreen.style.transition = 'opacity 0.6s ease';
    goodbyeScreen.style.opacity = '0';
    exitScreenEl.style.transition = 'background 0.6s ease';
    exitScreenEl.style.background = '#2B7FD8';

    setTimeout(function() {
      var termArea = document.createElement('div');
      termArea.id = 'loopTerminal';
      termArea.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:#2B7FD8;padding:16px 20px;font-family:"Fira Code",monospace;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.9);overflow:hidden;z-index:10;';

      var titlebar = document.createElement('div');
      titlebar.style.cssText = 'display:flex;align-items:center;gap:7px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.15);margin-bottom:14px;';
      ['#ff5f57','#ffbd2e','#28ca41'].forEach(function(c) {
        var dot = document.createElement('span');
        dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:' + c + ';';
        titlebar.appendChild(dot);
      });
      var titleText = document.createElement('span');
      titleText.style.cssText = 'color:rgba(255,255,255,0.5);font-size:11px;margin-left:auto;margin-right:auto;font-family:sans-serif;';
      titleText.textContent = 'esther@universe ~ zsh';
      titlebar.appendChild(titleText);
      termArea.appendChild(titlebar);

      var termLines = document.createElement('div');
      termArea.appendChild(termLines);
      exitScreenEl.appendChild(termArea);

      var lineDelay = 0;
      var loopTypingDone = false;
      var loopLaunched = false;

      terminalData.forEach(function(item) {
        var div = document.createElement('div');
        div.style.cssText = 'white-space:pre-wrap;opacity:0;transform:translateY(6px);transition:opacity 0.3s ease,transform 0.3s ease;';
        if (item.type === 'blank') { div.innerHTML = '&nbsp;'; lineDelay += 200; }
        else if (item.type === 'cmd') {
          var html = '<span style="color:#F4D758;font-weight:700">' + item.prompt + '</span><span style="color:#fff;font-weight:500">' + item.text + '</span>';
          if (item.cursor) html += '<span style="display:inline-block;width:9px;height:17px;background:#fff;vertical-align:middle;margin-left:2px;animation:blink 1s step-end infinite" id="loopCursor"></span>';
          div.innerHTML = html;
          lineDelay += 400;
        } else if (item.type === 'output') {
          div.innerHTML = '<span style="color:rgba(255,255,255,0.85)">' + item.prefix + item.text + '</span>';
          lineDelay += 150;
        } else if (item.type === 'gold') {
          div.innerHTML = '<span style="background:#F4D758;color:#1E5BA8;font-weight:700;font-size:13px;padding:1px 6px;border-radius:3px">' + item.prefix + item.text + '</span>';
          lineDelay += 150;
        }
        termLines.appendChild(div);
        (function(el, delay) {
          setTimeout(function() { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }, delay);
        })(div, lineDelay);
        if (item.type === 'cmd') lineDelay += 600;
        else if (item.type === 'output') lineDelay += 300;
        else if (item.type === 'gold') lineDelay += 400;
      });

      setTimeout(function() {
        loopTypingDone = true;
        var hint = document.createElement('div');
        hint.style.cssText = 'text-align:center;margin-top:16px;font-size:11px;color:rgba(30,91,168,0.5);opacity:0;transition:opacity 0.5s ease;';
        hint.textContent = 'press enter to launch ↵';
        termLines.appendChild(hint);
        setTimeout(function() { hint.style.opacity = '1'; }, 100);
      }, lineDelay + 600);

      function skipLoopTyping() {
        if (loopTypingDone) return;
        loopTypingDone = true;
        termLines.querySelectorAll('div').forEach(function(l) {
          l.style.opacity = '1';
          l.style.transform = 'translateY(0)';
        });
      }

      function loopLaunch() {
        if (loopLaunched || !loopTypingDone) return;
        loopLaunched = true;

        var cursor = document.getElementById('loopCursor');
        if (cursor) cursor.remove();

        var launchLine = document.createElement('div');
        launchLine.style.cssText = 'white-space:pre-wrap;opacity:0;transition:opacity 0.3s ease;';
        launchLine.innerHTML = '<span style="color:#2B7FD8">> launching...</span>';
        termLines.appendChild(launchLine);
        setTimeout(function() { launchLine.style.opacity = '1'; }, 50);

        setTimeout(function() {
          var overlay = document.getElementById('transitionOverlay');
          overlay.classList.add('active');

          setTimeout(function() {
            if (termArea.parentNode) termArea.parentNode.removeChild(termArea);

            // Reset exit section state
            exitMacbook.style.transition = 'none';
            exitMacbook.style.transform = '';
            exitMacbook.style.opacity = '1';
            goodbyeScreen.classList.remove('visible');
            goodbyeScreen.style.opacity = '0';
            goodbyeScreen.style.transition = 'none';
            exitScreenEl.style.background = '';
            exitScreenEl.style.transition = 'none';
            exitCanvasContent.style.transform = '';
            exitCanvasContent.style.opacity = '1';
            exitCanvasContent.style.filter = '';

            // Land back on the desktop top
            window.scrollTo(0, 0);
            void document.body.offsetHeight;

            exitMacbook.style.transition = '';
            goodbyeScreen.style.transition = '';
            exitScreenEl.style.transition = '';

            setTimeout(function() {
              overlay.classList.remove('active');
              looping = false;
            }, 300);
          }, 400);
        }, 500);
      }

      function onLoopKey(e) {
        if (e.key === 'Enter') loopLaunch();
        else if (!loopTypingDone) skipLoopTyping();
      }
      function onLoopClick() {
        if (!loopTypingDone) { skipLoopTyping(); return; }
        loopLaunch();
      }
      document.addEventListener('keydown', onLoopKey);
      exitScreenEl.addEventListener('click', onLoopClick);

      var cleanupInterval = setInterval(function() {
        if (!looping) {
          document.removeEventListener('keydown', onLoopKey);
          exitScreenEl.removeEventListener('click', onLoopClick);
          clearInterval(cleanupInterval);
        }
      }, 500);
    }, 700);
  }

  document.getElementById('backToTopLink').addEventListener('click', function(e) {
    e.preventDefault();
    triggerLoop();
  });

  // Auto-trigger loop when user keeps scrolling at the very bottom
  var lastScrollY = 0;
  window.addEventListener('scroll', function() {
    if (!launched || looping || currentTab() !== 'home') return;
    var currentY = window.scrollY || window.pageYOffset;
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (currentY >= maxScroll - 50 && currentY > lastScrollY) triggerLoop();
    lastScrollY = currentY;
  }, { passive: true });

  // Init
  switchTab(currentTab());

  return function disposeSite() {
    timeoutIds.forEach((timeoutId) => nativeClearTimeout(timeoutId));
    intervalIds.forEach((intervalId) => nativeClearInterval(intervalId));
    animationFrameIds.forEach((frameId) => nativeCancelAnimationFrame(frameId));
    listenerRecords.forEach(([target, type, listener, options]) => {
      originalRemoveEventListener.call(target, type, listener, options);
    });
    if (EventTarget.prototype.addEventListener !== originalAddEventListener) {
      EventTarget.prototype.addEventListener = originalAddEventListener;
    }
    hasInitialized = false;
  };
}
