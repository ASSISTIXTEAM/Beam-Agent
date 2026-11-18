/* BEAM AGENT — client core */
(function () {
  'use strict';

  function sanitizePublicError(raw) {
    var s = String(raw || '').trim();
    if (!s) return 'Модель ASSISTIX временно недоступна. Попробуйте другую или повторите позже.';
    var lower = s.toLowerCase();
    var blocked = ['nvidia', 'ionet', 'io.net', 'openai', 'anthropic', 'qwen', 'mistral', 'kimi', 'moonshot', 'gpt-', 'claude', 'gemini', 'integrate.api', 'api_key', 'opendataloader', 'docling', 'http_'];
    for (var i = 0; i < blocked.length; i++) {
      if (lower.indexOf(blocked[i]) !== -1) return 'Модель ASSISTIX временно недоступна. Попробуйте другую или повторите позже.';
    }
    if (/\b(mistral|llama|phi-3|nemo|mixtral|deepseek)\b/i.test(s)) return 'Модель ASSISTIX временно недоступна. Попробуйте другую или повторите позже.';
    return s.length > 180 ? s.slice(0, 177) + '…' : s;
  }

  var API_BASE = location.origin + '/api/';

  var Theme = {
    get: function () { return localStorage.getItem('acx-theme') || 'auto'; },
    apply: function (t) {
      var root = document.documentElement;
      if (t === 'auto') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', t);
      root.style.colorScheme = this.effective() === 'dark' ? 'dark' : 'light';
    },
    init: function () { this.apply(this.get()); },
    effective: function () {
      var t = this.get();
      if (t !== 'auto') return t;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    _originFromEvent: function (ev) {
      var x = window.innerWidth * 0.5;
      var y = window.innerHeight * 0.12;
      if (ev && typeof ev.clientX === 'number') {
        x = ev.clientX;
        y = ev.clientY;
      } else if (ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect) {
        var r = ev.currentTarget.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      }
      var maxR = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      return { x: x, y: y, r: Math.ceil(maxR) + 24 };
    },
    _setCssOrigin: function (origin) {
      var root = document.documentElement;
      root.style.setProperty('--theme-x', origin.x + 'px');
      root.style.setProperty('--theme-y', origin.y + 'px');
      root.style.setProperty('--theme-r', origin.r + 'px');
    },
    set: function (next, ev) {
      var self = this;
      var prevEff = this.effective();
      localStorage.setItem('acx-theme', next);
      var origin = this._originFromEvent(ev);
      this._setCssOrigin(origin);
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var applyNow = function () { self.apply(next); };

      if (reduced) {
        applyNow();
        return next;
      }

      // View Transitions API — circular wipe from the click
      if (document.startViewTransition) {
        document.documentElement.classList.add('theme-animating');
        var vt = document.startViewTransition(applyNow);
        Promise.resolve(vt.finished).catch(function () {}).then(function () {
          document.documentElement.classList.remove('theme-animating');
        });
        return next;
      }

      // Fallback circle wipe overlay
      var nextEff = (function () {
        if (next === 'auto') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return next;
      })();
      if (nextEff === prevEff) {
        applyNow();
        return next;
      }
      var wipe = document.createElement('div');
      wipe.className = 'acx-theme-wipe';
      var wipeBg = nextEff === 'dark' ? '#05100f' : '#fbfdfd';
      wipe.style.setProperty('--theme-wipe-bg', wipeBg);
      document.body.appendChild(wipe);
      // force layout then expand
      void wipe.offsetWidth;
      wipe.classList.add('is-on');
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        applyNow();
        wipe.remove();
      };
      wipe.addEventListener('transitionend', finish);
      setTimeout(finish, 700);
      return next;
    },
    // Кнопка — только два положения. «Системная» остаётся в настройках.
    cycle: function (ev) {
      var next = this.effective() === 'dark' ? 'light' : 'dark';
      return this.set(next, ev);
    }
  };
  Theme.init();

  var ICONS = {
    spark: '<svg viewBox="0 0 24 24" fill="none"><path d="M13.2607 1.03418C12.8247 0.916465 12.3633 1.10596 12.1357 1.49609L5.13574 13.4961C4.95544 13.8053 4.95453 14.1876 5.13281 14.498C5.31115 14.8085 5.64193 15 6 15H10V22C10 22.4518 10.3031 22.8479 10.7393 22.9658C11.1753 23.0835 11.6367 22.894 11.8643 22.5039L18.8643 10.5039C19.0446 10.1947 19.0455 9.81238 18.8672 9.50195C18.6888 9.19146 18.3581 9 18 9H14V2C14 1.54822 13.6969 1.15208 13.2607 1.03418Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.40212 6.67343C3.14274 4.33899 5.54532 2.62543 7.66803 3.63092L19.6124 9.28879C21.9001 10.3724 21.9001 13.6276 19.6124 14.7112L7.66803 20.3691C5.54532 21.3746 3.14274 19.661 3.40212 17.3266L3.88285 13H12C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11H3.88285L3.40212 6.67343Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M11 13V18C11 18.5523 11.4477 19 12 19C12.5523 19 13 18.5523 13 18V13H18C18.5523 13 19 12.5523 19 12C19 11.4477 18.5523 11 18 11H13V6C13 5.44772 12.5523 5 12 5C11.4477 5 11 5.44772 11 6V11H6C5.44772 11 5 11.4477 5 12C5 12.5523 5.44772 13 6 13H11Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none"><path d="M21.5 5.99902C21.5 5.44674 21.0523 4.99902 20.5 4.99902H3.5C2.94772 4.99902 2.5 5.44674 2.5 5.99902C2.5 6.55131 2.94772 6.99902 3.5 6.99902H20.5C21.0523 6.99902 21.5 6.55131 21.5 5.99902ZM20.5 10.999C21.0523 10.999 21.5 11.4467 21.5 11.999C21.5 12.5513 21.0523 12.999 20.5 12.999H3.5C2.94772 12.999 2.5 12.5513 2.5 11.999C2.5 11.4467 2.94772 10.999 3.5 10.999H20.5ZM20.5 17C21.0523 17 21.5 17.4477 21.5 18C21.5 18.5523 21.0523 19 20.5 19H3.5C2.94772 19 2.5 18.5523 2.5 18C2.5 17.4477 2.94772 17 3.5 17H20.5Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none"><path d="M15.793 6.79297C16.1835 6.40244 16.8165 6.40244 17.207 6.79297C17.5976 7.18349 17.5976 7.81651 17.207 8.20703L13.4141 12L17.207 15.793C17.5976 16.1835 17.5976 16.8165 17.207 17.207C16.8165 17.5976 16.1835 17.5976 15.793 17.207L12 13.4141L8.20703 17.207C7.81651 17.5976 7.18349 17.5976 6.79297 17.207C6.40244 16.8165 6.40244 16.1835 6.79297 15.793L10.5859 12L6.79297 8.20703C6.40244 7.81651 6.40244 7.18349 6.79297 6.79297C7.18349 6.40244 7.81651 6.40244 8.20703 6.79297L12 10.5859L15.793 6.79297Z" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none"><path d="M15.793 6.79297C16.1835 6.40244 16.8165 6.40244 17.207 6.79297C17.5976 7.18349 17.5976 7.81651 17.207 8.20703L13.4141 12L17.207 15.793C17.5976 16.1835 17.5976 16.8165 17.207 17.207C16.8165 17.5976 16.1835 17.5976 15.793 17.207L12 13.4141L8.20703 17.207C7.81651 17.5976 7.18349 17.5976 6.79297 17.207C6.40244 16.8165 6.40244 16.1835 6.79297 15.793L10.5859 12L6.79297 8.20703C6.40244 7.81651 6.40244 7.18349 6.79297 6.79297C7.18349 6.40244 7.81651 6.40244 8.20703 6.79297L12 10.5859L15.793 6.79297Z" fill="currentColor"/></svg>',
    paperclip: '<svg viewBox="0 0 24 24" fill="none"><path d="M13 17V9C13 8.44772 12.5523 8 12 8C11.4477 8 11 8.44772 11 9V17C11 18.6569 12.3432 20 14 20C15.6569 20 17 18.6569 17 17V9C17 6.23858 14.7614 4 12 4C9.23859 4 7.00002 6.23858 7.00002 9V15C7.00002 15.5523 6.5523 16 6.00002 16C5.44773 16 5.00002 15.5523 5.00002 15V9C5.00002 5.13401 8.13402 2 12 2C15.866 2 19 5.13401 19 9V17C19 19.7614 16.7614 22 14 22C11.2386 22 9.00002 19.7614 9.00002 17V9C9.00002 7.34315 10.3432 6 12 6C13.6569 6 15 7.34315 15 9V17C15 17.5523 14.5523 18 14 18C13.4477 18 13 17.5523 13 17Z" fill="currentColor"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12ZM15 9L11.3074 9.73851C10.5157 9.89686 9.89686 10.5157 9.73851 11.3074L9 15L12.6926 14.2615C13.4843 14.1031 14.1031 13.4843 14.2615 12.6926L15 9Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C12.5523 2 13 2.44772 13 3V4C13 4.55228 12.5523 5 12 5C11.4477 5 11 4.55228 11 4V3C11 2.44772 11.4477 2 12 2ZM2 12C2 11.4477 2.44772 11 3 11H4C4.55228 11 5 11.4477 5 12C5 12.5523 4.55228 13 4 13H3C2.44772 13 2 12.5523 2 12ZM19 12C19 11.4477 19.4477 11 20 11H21C21.5523 11 22 11.4477 22 12C22 12.5523 21.5523 13 21 13H20C19.4477 13 19 12.5523 19 12ZM13 20C13 19.4477 12.5523 19 12 19C11.4477 19 11 19.4477 11 20V21C11 21.5523 11.4477 22 12 22C12.5523 22 13 21.5523 13 21V20ZM18.3638 16.9498C17.9733 16.5592 17.3402 16.5592 16.9496 16.9498C16.5591 17.3403 16.5591 17.9734 16.9496 18.364L17.6567 19.0711C18.0473 19.4616 18.6804 19.4616 19.071 19.0711C19.4615 18.6805 19.4615 18.0474 19.071 17.6569L18.3638 16.9498ZM4.92888 4.92888C5.3194 4.53836 5.95257 4.53836 6.34309 4.92888L7.0502 5.63599C7.44072 6.02651 7.44072 6.65968 7.0502 7.0502C6.65968 7.44072 6.02651 7.44072 5.63599 7.0502L4.92888 6.34309C4.53836 5.95257 4.53836 5.3194 4.92888 4.92888ZM7.05037 18.364C7.44089 17.9734 7.44089 17.3403 7.05037 16.9498C6.65984 16.5592 6.02668 16.5592 5.63616 16.9498L4.92905 17.6569C4.53852 18.0474 4.53852 18.6805 4.92905 19.0711C5.31957 19.4616 5.95274 19.4616 6.34326 19.0711L7.05037 18.364ZM19.0711 4.92888C19.4616 5.3194 19.4616 5.95257 19.0711 6.34309L18.364 7.0502C17.9735 7.44072 17.3403 7.44072 16.9498 7.0502C16.5593 6.65968 16.5593 6.02651 16.9498 5.63599L17.6569 4.92888C18.0474 4.53836 18.6806 4.53836 19.0711 4.92888ZM7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none"><path d="M17 11.9999C13.6863 11.9999 11 9.31361 11 5.9999C11 5.11294 11.1917 4.27343 11.5352 3.51846C11.6872 3.18432 11.6443 2.79362 11.4229 2.50088C11.2012 2.20811 10.8366 2.06048 10.4736 2.11611C5.67507 2.85168 2.00007 6.99562 2 11.9999C2 17.5227 6.47715 21.9999 12 21.9999C17.5228 21.9999 22 17.5227 22 11.9999C22 11.9065 21.9986 11.8134 21.9961 11.7206C21.986 11.3533 21.7752 11.021 21.4473 10.8554C21.1192 10.6898 20.7264 10.7176 20.4248 10.9276C19.454 11.6039 18.2747 11.9999 17 11.9999Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none"><path d="M4.0762 11.6172C3.92142 11.9909 4.007 12.421 4.293 12.707L11.293 19.707C11.6835 20.0976 12.3165 20.0976 12.7071 19.707L19.7071 12.707C19.9931 12.421 20.0786 11.9909 19.9239 11.6172C19.769 11.2436 19.4044 11 19 11L13 11L13 5C13 4.44771 12.5523 4 12 4C11.4477 4 11 4.44771 11 5L11 11L5.00003 11C4.59561 11 4.23101 11.2436 4.0762 11.6172Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    sidebarClose: '<svg viewBox="0 0 24 24" fill="none"><path d="M12.3828 4.07617C12.0091 3.92139 11.579 4.00697 11.293 4.29297L4.29297 11.293C3.90244 11.6835 3.90244 12.3165 4.29297 12.707L11.293 19.707C11.579 19.993 12.0091 20.0786 12.3828 19.9238C12.7564 19.769 13 19.4044 13 19V13H19C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11H13V5C13 4.59558 12.7564 4.23098 12.3828 4.07617Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    sidebarOpen: '<svg viewBox="0 0 24 24" fill="none"><path d="M11.6172 19.9238C11.9909 20.0786 12.421 19.993 12.707 19.707L19.707 12.707C20.0976 12.3165 20.0976 11.6835 19.707 11.293L12.707 4.29297C12.421 4.00697 11.9909 3.92139 11.6172 4.07617C11.2436 4.23098 11 4.59559 11 5L11 11L5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13L11 13L11 19C11 19.4044 11.2436 19.769 11.6172 19.9238Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none"><path d="M18.793 6.79272C19.1835 6.4022 19.8165 6.40221 20.207 6.79272C20.5976 7.18324 20.5975 7.81626 20.207 8.20679L10.707 17.7068C10.5195 17.8943 10.2652 17.9998 10 17.9998C9.73478 17.9998 9.4805 17.8943 9.29297 17.7068L4.79297 13.2068C4.40246 12.8163 4.40245 12.1832 4.79297 11.7927C5.1835 11.4022 5.81652 11.4022 6.20703 11.7927L10 15.5857L18.793 6.79272Z" fill="currentColor"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 16V3C3 2.44772 3.44772 2 4 2H16C16.5523 2 17 2.44772 17 3C17 3.55228 16.5523 4 16 4H5V16C5 16.5523 4.55228 17 4 17C3.44772 17 3 16.5523 3 16ZM21 19C21 20.6569 19.6569 22 18 22H10C8.34315 22 7 20.6569 7 19V7C7 6.44772 7.44772 6 8 6H20C20.5523 6 21 6.44772 21 7V19Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none"><path d="M17.4629 3.62281C15.8928 2.59688 14.016 1.99976 12 1.99976C6.47715 1.99976 2 6.47691 2 11.9998C2 12.552 2.44772 12.9998 3 12.9998C3.55228 12.9998 4 12.552 4 11.9998C4 7.58148 7.58172 3.99976 12 3.99976C13.4613 3.99976 14.8309 4.39115 16.0101 5.0756L14.793 6.29272C14.507 6.57872 14.4214 7.00889 14.5762 7.38257C14.731 7.75617 15.0956 7.99976 15.5 7.99976L19.5 7.99976C20.0523 7.99976 20.5 7.55204 20.5 6.99976V2.99976C20.5 2.59534 20.2564 2.23074 19.8828 2.07593C19.5091 1.92115 19.079 2.00673 18.793 2.29272L17.4629 3.62281ZM7.9899 18.9239L9.20703 17.7068C9.49303 17.4208 9.57861 16.9906 9.42383 16.6169C9.26902 16.2433 8.90442 15.9998 8.5 15.9998L4.5 15.9998C3.94772 15.9998 3.5 16.4475 3.5 16.9998L3.5 20.9998C3.5 21.4042 3.74359 21.7688 4.11719 21.9236C4.49086 22.0784 4.92103 21.9928 5.20703 21.7068L6.53712 20.3767C8.10723 21.4026 9.98404 21.9998 12 21.9998C17.5228 21.9998 22 17.5226 22 11.9998C22 11.4475 21.5523 10.9998 21 10.9998C20.4477 10.9998 20 11.4475 20 11.9998C20 16.418 16.4183 19.9998 12 19.9998C10.5387 19.9998 9.16906 19.6084 7.9899 18.9239Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="none"><path d="M17 20C18.6569 20 20 18.6569 20 17V7C20 5.34315 18.6569 4 17 4H7C5.34315 4 4 5.34315 4 7V17C4 18.6569 5.34315 20 7 20H17Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20L5 16L16.5858 4.41421C17.3668 3.63317 18.6332 3.63316 19.4142 4.41421L19.5858 4.58579C20.3668 5.36683 20.3668 6.63316 19.5858 7.41421L8 19L4 20Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/><path d="M5 16L4 20L8 19L18 9L15 6L5 16Z" fill="currentColor"/><path d="M15 6L18 9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/><path d="M13 20H21" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/></svg>',
    branch: '<svg viewBox="0 0 24 24" fill="none"><path d="M11 21V22C11 22.5523 11.4477 23 12 23C12.5523 23 13 22.5523 13 22V21C13.5523 21 14 20.5523 14 20C14 19.4477 13.5523 19 13 19V5C13.5523 5 14 4.55228 14 4C14 3.44772 13.5523 3 13 3V2C13 1.44772 12.5523 1 12 1C11.4477 1 11 1.44772 11 2V3H6C4.34315 3 3 4.34315 3 6V18C3 19.6569 4.34315 21 6 21H11ZM19 17V18C19 18.5523 18.5523 19 18 19H17C16.4477 19 16 19.4477 16 20C16 20.5523 16.4477 21 17 21H18C19.6569 21 21 19.6569 21 18V17C21 16.4477 20.5523 16 20 16C19.4477 16 19 16.4477 19 17ZM19 11V13C19 13.5523 19.4477 14 20 14C20.5523 14 21 13.5523 21 13V11C21 10.4477 20.5523 10 20 10C19.4477 10 19 10.4477 19 11ZM19 6V7C19 7.55228 19.4477 8 20 8C20.5523 8 21 7.55228 21 7V6C21 4.34315 19.6569 3 18 3H17C16.4477 3 16 3.44772 16 4C16 4.55228 16.4477 5 17 5H18C18.5523 5 19 5.44772 19 6Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none"><path d="M13 17C13 17.5523 12.5523 18 12 18C11.4477 18 11 17.5523 11 17L11 10L7 10C6.59558 10 6.23098 9.75641 6.07617 9.38281C5.92139 9.00914 6.00697 8.57897 6.29297 8.29297L11.293 3.29297C11.6835 2.90245 12.3165 2.90245 12.707 3.29297L17.707 8.29297C17.993 8.57897 18.0786 9.00914 17.9238 9.38281C17.769 9.75642 17.4044 10 17 10L13 10L13 17ZM19 20C19 19.4477 18.5523 19 18 19H6C5.44772 19 5 19.4477 5 20C5 20.5523 5.44772 21 6 21H18C18.5523 21 19 20.5523 19 20Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21.9999C17.5229 21.9999 22 17.5228 22 11.9999C22 6.47709 17.5229 1.99994 12 1.99994C6.47717 1.99994 2.00002 6.47709 2.00002 11.9999C2.00002 13.5219 2.34221 14.9662 2.95217 16.2597L2.02052 20.7988C1.95295 21.128 2.05531 21.4693 2.29299 21.707C2.53067 21.9446 2.87192 22.047 3.20119 21.9794L7.73927 21.0478C9.03302 21.658 10.4777 21.9999 12 21.9999Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 2C4.44772 2 4 2.44772 4 3V19C4 20.6569 5.34315 22 7 22H17C18.6569 22 20 20.6569 20 19V8C20 7.73478 19.8946 7.48043 19.7071 7.29289L14.7071 2.29289C14.5196 2.10536 14.2652 2 14 2H5ZM14 4.41421L17.5858 8H14V4.41421ZM8 13C8 12.4477 8.44772 12 9 12H15C15.5523 12 16 12.4477 16 13C16 13.5523 15.5523 14 15 14H9C8.44772 14 8 13.5523 8 13ZM8 17C8 16.4477 8.44772 16 9 16H15C15.5523 16 16 16.4477 16 17C16 17.5523 15.5523 18 15 18H9C8.44772 18 8 17.5523 8 17Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 2C4.44772 2 4 2.44772 4 3V19C4 20.6569 5.34315 22 7 22H17C18.6569 22 20 20.6569 20 19V8C20 7.73478 19.8946 7.48043 19.7071 7.29289L14.7071 2.29289C14.5196 2.10536 14.2652 2 14 2H5ZM14 4.41421L17.5858 8H14V4.41421ZM7.99999 10.5C7.99999 9.67157 8.67157 9 9.49999 9H9.50999C10.3384 9 11.01 9.67157 11.01 10.5V10.51C11.01 11.3384 10.3384 12.01 9.50999 12.01H9.49999C8.67157 12.01 7.99999 11.3384 7.99999 10.51V10.5ZM12.7071 13.2929C12.3165 12.9024 11.6834 12.9024 11.2929 13.2929L7.29286 17.2929C6.90233 17.6834 6.90233 18.3166 7.29286 18.7071C7.68338 19.0976 8.31654 19.0976 8.70707 18.7071L12 15.4142L15.2929 18.7071C15.6834 19.0976 16.3165 19.0976 16.7071 18.7071C17.0976 18.3166 17.0976 17.6834 16.7071 17.2929L12.7071 13.2929Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none"><path d="M19 1H17C16.4477 1 16 1.44772 16 2C16 2.55228 16.4477 3 17 3L19 3C19.5523 3 20 2.55228 20 2C20 1.44772 19.5523 1 19 1ZM22 17C22 18.6569 20.6569 20 19 20H5C3.34315 20 2 18.6569 2 17V5C2 4.44772 2.44772 4 3 4H21C21.5523 4 22 4.44772 22 5V17ZM12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    research: '<svg viewBox="0 0 24 24" fill="none"><path d="M18 4V7H21C21.5523 7 22 7.44772 22 8V18C22 19.6569 20.6569 21 19 21H17H5C3.34315 21 2 19.6569 2 18V4C2 3.44772 2.44772 3 3 3H17C17.5523 3 18 3.44772 18 4ZM20 18C20 18.5523 19.5523 19 19 19C18.4477 19 18 18.5523 18 18V9H20V18ZM6 8C6 7.44772 6.44772 7 7 7H13C13.5523 7 14 7.44772 14 8C14 8.55228 13.5523 9 13 9H7C6.44772 9 6 8.55228 6 8ZM8 12C8 11.4477 8.44772 11 9 11H13C13.5523 11 14 11.4477 14 12C14 12.5523 13.5523 13 13 13H9C8.44772 13 8 12.5523 8 12Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    lightbulb: '<svg viewBox="0 0 24 24" fill="none"><path d="M16.8223 1.43066C16.6355 1.16109 16.328 1 16 1H9.50001C9.11115 1 8.76296 1.22447 8.59864 1.56641L8.54005 1.71973L5.04005 13.7197C4.95193 14.0218 5.01144 14.3478 5.2002 14.5996C5.38906 14.8514 5.68525 15 6.00001 15H9.8672L9.00782 21.876C8.9503 22.3362 9.21671 22.7758 9.65138 22.9375C10.086 23.0991 10.5748 22.9405 10.832 22.5547L18.832 10.5547C19.0366 10.2479 19.0557 9.85344 18.8818 9.52832C18.7078 9.20316 18.3688 9 18 9H14.4434L16.9365 2.35156C17.0516 2.04459 17.0089 1.70019 16.8223 1.43066Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    agent: '<svg viewBox="0 0 24 24" fill="none"><path d="M15.7068 6.70679C16.0973 6.31626 16.0973 5.6831 15.7068 5.29257L12.7071 2.29289C12.3166 1.90237 11.6834 1.90237 11.2929 2.29289L8.29321 5.29257C7.90269 5.6831 7.90269 6.31626 8.29321 6.70679L11.2929 9.70647C11.6834 10.097 12.3166 10.097 12.7071 9.70647L15.7068 6.70679ZM15.7068 18.7068L12.7071 21.7065C12.3166 22.097 11.6834 22.097 11.2929 21.7065L8.29321 18.7068C7.90269 18.3163 7.90269 17.6831 8.29321 17.2926L11.2929 14.2929C11.6834 13.9024 12.3166 13.9024 12.7071 14.2929L15.7068 17.2926C16.0973 17.6831 16.0973 18.3163 15.7068 18.7068ZM21.7068 11.2926C22.0973 11.6831 22.0973 12.3163 21.7068 12.7068L18.7071 15.7065C18.3166 16.097 17.6834 16.097 17.2929 15.7065L14.2932 12.7068C13.9027 12.3163 13.9027 11.6831 14.2932 11.2926L17.2929 8.29289C17.6834 7.90237 18.3166 7.90237 18.7071 8.29289L21.7068 11.2926ZM9.70679 12.7068L6.70711 15.7065C6.31658 16.097 5.68342 16.097 5.29289 15.7065L2.29321 12.7068C1.90269 12.3163 1.90269 11.6831 2.29321 11.2926L5.29289 8.29289C5.68342 7.90237 6.31658 7.90237 6.70711 8.29289L9.70679 11.2926C10.0973 11.6831 10.0973 12.3163 9.70679 12.7068Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none"><path d="M2 5C2 4.44772 2.44772 4 3 4H10C10.2652 4 10.5196 4.10536 10.7071 4.29289L12.4142 6H21C21.5523 6 22 6.44772 22 7V17C22 18.6569 20.6569 20 19 20H5C3.34315 20 2 18.6569 2 17V5ZM7 10C6.44772 10 6 10.4477 6 11C6 11.5523 6.44772 12 7 12H9C9.55228 12 10 11.5523 10 11C10 10.4477 9.55228 10 9 10H7ZM7 14C6.44772 14 6 14.4477 6 15C6 15.5523 6.44772 16 7 16H9C9.55228 16 10 15.5523 10 15C10 14.4477 9.55228 14 9 14H7ZM12 11C12 10.4477 12.4477 10 13 10H17C17.5523 10 18 10.4477 18 11V15C18 15.5523 17.5523 16 17 16H13C12.4477 16 12 15.5523 12 15V11ZM14 12V14H16V12H14Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none"><path d="M18.207 4.79297C14.7789 1.36489 9.22103 1.36489 5.79294 4.79297C2.36485 8.22106 2.36486 13.7789 5.79294 17.207L11.2929 22.707C11.4805 22.8946 11.7348 23 12 23C12.2652 23 12.5195 22.8946 12.707 22.707L18.207 17.207C21.6351 13.7789 21.6351 8.22106 18.207 4.79297ZM10.5 11C10.5 10.1716 11.1715 9.50001 12 9.50001H12.01C12.8384 9.50001 13.51 10.1716 13.51 11V11.01C13.51 11.8384 12.8384 12.51 12.01 12.51H12C11.1715 12.51 10.5 11.8384 10.5 11.01V11Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none"><path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 5.19129 15.0183 5.37868 15.0527 5.56055L7.9375 9.71094C7.41523 9.2685 6.73945 9 6 9C4.34315 9 3 10.3431 3 12C3 13.6569 4.34315 15 6 15C6.73968 15 7.41517 14.7308 7.9375 14.2881L15.0527 18.4385C15.0182 18.6206 15 18.8084 15 19C15 20.6569 16.3431 22 18 22C19.6569 22 21 20.6569 21 19C21 17.3431 19.6569 16 18 16C17.2603 16 16.5839 16.2682 16.0615 16.7109L8.94629 12.5605C8.98076 12.3786 9 12.1913 9 12C9 11.8083 8.98088 11.6207 8.94629 11.4385L16.0615 7.28809C16.5839 7.73105 17.2601 8 18 8Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none"><path d="M18.0293 16.6152C19.2602 15.0761 20 13.1245 20 11C20 6.02944 15.9706 2 11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C13.1245 20 15.0761 19.2602 16.6152 18.0293L20.293 21.707C20.6835 22.0976 21.3165 22.0976 21.707 21.707C22.0976 21.3165 22.0976 20.6835 21.707 20.293L18.0293 16.6152ZM11 5C14.3137 5 17 7.68629 17 11C17 12.6571 16.3291 14.1553 15.2422 15.2422C14.1553 16.3291 12.6571 17 11 17C7.68629 17 5 14.3137 5 11C5 7.68629 7.68629 5 11 5Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none"><path d="M8.99984 3.22263C8.99984 2.75606 9.32248 2.3515 9.77735 2.24769C11.2596 1.90944 12.7791 1.92079 14.2224 2.2501C14.6773 2.35389 14.9999 2.75846 14.9999 3.22504L14.9999 5.07178C14.9999 5.84158 15.8333 6.3227 16.4999 5.9378L18.101 5.01345C18.5054 4.77993 19.0176 4.85747 19.3349 5.20022C19.8331 5.73857 20.279 6.33981 20.6601 7.00004C21.0413 7.66024 21.3391 8.34696 21.5562 9.04761C21.6944 9.49371 21.5054 9.97608 21.101 10.2096L19.4999 11.134C18.8332 11.5189 18.8332 12.4811 19.4999 12.866L21.0993 13.7894C21.5034 14.0227 21.6924 14.5044 21.5548 14.9503C21.1184 16.3648 20.3684 17.6865 19.3344 18.801C19.0171 19.143 18.5054 19.2201 18.1013 18.9869L16.4999 18.0623C15.8333 17.6774 14.9999 18.1585 14.9999 18.9283L14.9999 20.7775C14.9999 21.244 14.6773 21.6486 14.2224 21.7524C12.7402 22.0906 11.2206 22.0793 9.77738 21.75C9.32249 21.6462 8.99983 21.2416 8.99983 20.775L8.99984 18.9282C8.99984 18.1584 8.1665 17.6773 7.49983 18.0622L5.89878 18.9866C5.49432 19.2201 4.98209 19.1426 4.66487 18.7998C4.16664 18.2615 3.72081 17.6602 3.33964 17C2.95846 16.3398 2.66069 15.6531 2.44359 14.9524C2.30537 14.5063 2.49433 14.0239 2.89879 13.7904L4.49981 12.8661C5.16647 12.4812 5.16648 11.5189 4.49981 11.134L2.9005 10.2107C2.49643 9.97737 2.30739 9.49565 2.44495 9.04981C2.88139 7.63526 3.63134 6.31361 4.66537 5.1991C4.98271 4.85707 5.49439 4.77994 5.89845 5.01322L7.49984 5.93778C8.1665 6.32268 8.99984 5.84155 8.99983 5.07175L8.99984 3.22263ZM12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 4V18C3 19.6569 4.34315 21 6 21H18C19.6569 21 21 19.6569 21 18V13C21 12.4477 20.5523 12 20 12C19.4477 12 19 12.4477 19 13V18C19 18.5523 18.5523 19 18 19H6C5.44772 19 5 18.5523 5 18V5H11C11.5523 5 12 4.55228 12 4C12 3.44772 11.5523 3 11 3H4C3.44772 3 3 3.44772 3 4ZM19.293 9.70703L17.5 7.91406L9.70703 15.707C9.31651 16.0976 8.68349 16.0976 8.29297 15.707C7.90244 15.3165 7.90244 14.6835 8.29297 14.293L16.0859 6.5L14.293 4.70703C14.007 4.42103 13.9214 3.99086 14.0762 3.61719C14.231 3.24359 14.5956 3 15 3H20C20.5523 3 21 3.44772 21 4V9C21 9.40442 20.7564 9.76902 20.3828 9.92383C20.0091 10.0786 19.579 9.99303 19.293 9.70703Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none"><path d="M17 11C19.2091 11 21 9.20914 21 7C21 4.79086 19.2091 3 17 3C14.7909 3 13 4.79086 13 7C13 9.20914 14.7909 11 17 11ZM11 17C11 19.2091 9.20914 21 7 21C4.79086 21 3 19.2091 3 17C3 14.7909 4.79086 13 7 13C9.20914 13 11 14.7909 11 17ZM21 19C21 20.1046 20.1046 21 19 21H15C13.8954 21 13 20.1046 13 19V14C13 13.4477 13.4477 13 14 13H20C20.5523 13 21 13.4477 21 14V19ZM11 9C11 10.1046 10.1046 11 9 11H5C3.89543 11 3 10.1046 3 9V4C3 3.44772 3.44772 3 4 3H10C10.5523 3 11 3.44772 11 4V9Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    incognito: '<svg viewBox="0 0 24 24" fill="none"><path d="M4.70703 3.29297C4.31651 2.90244 3.68349 2.90244 3.29297 3.29297C2.90244 3.68349 2.90244 4.31651 3.29297 4.70703L4.96385 6.37791C3.22992 7.71617 1.8881 9.53758 1.06851 11.6362C0.977163 11.8701 0.977163 12.1299 1.06851 12.3638C2.80329 16.8059 6.8839 20 12 20C13.9346 20 15.7308 19.5414 17.3096 18.7237L19.293 20.707C19.6835 21.0976 20.3165 21.0976 20.707 20.707C21.0976 20.3165 21.0976 19.6835 20.707 19.293L18.2086 16.7945C18.1946 16.7796 18.1802 16.7652 18.1654 16.7513L14.844 13.4299C14.8389 13.4246 14.8337 13.4193 14.8285 13.4141C14.8233 13.4089 14.818 13.4037 14.8127 13.3987L10.6013 9.18726C10.5963 9.18197 10.5911 9.17672 10.5859 9.17151C10.5807 9.16628 10.5754 9.16112 10.5701 9.15603L7.24759 5.83353C7.23358 5.81863 7.21917 5.80423 7.2044 5.79033L4.70703 3.29297ZM9.29242 10.7065C9.10497 11.0981 9 11.5368 9 12C9 13.6569 10.3431 15 12 15C12.4632 15 12.9019 14.895 13.2935 14.7076L9.29242 10.7065ZM10.846 6.06646C11.222 6.02263 11.6069 6 12 6C16.0743 6 19.3807 8.44349 20.9189 12C20.5782 12.7873 20.1506 13.5201 19.6477 14.1836C19.3141 14.6238 19.4005 15.251 19.8407 15.5846C20.2808 15.9182 20.9081 15.8318 21.2417 15.3917C21.9346 14.4773 22.504 13.4585 22.9315 12.3638C23.0228 12.1299 23.0228 11.8701 22.9315 11.6362C21.1967 7.1941 17.1161 4 12 4C11.53 4 11.0678 4.02706 10.6144 4.07992C10.0659 4.14387 9.67301 4.64042 9.73696 5.18898C9.80091 5.73755 10.2975 6.13041 10.846 6.06646Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15C14.2091 15 16 13.2091 16 11V6C16 3.79086 14.2091 2 12 2C9.79086 2 8 3.79086 8 6V11C8 13.2091 9.79086 15 12 15ZM4 11C4 10.4477 4.44772 10 5 10C5.55228 10 6 10.4477 6 11C6 14.3137 8.68629 17 12 17C15.3137 17 18 14.3137 18 11C18 10.4477 18.4477 10 19 10C19.5523 10 20 10.4477 20 11C20 15.0796 16.9463 18.446 13 18.9381V21C13 21.5523 12.5523 22 12 22C11.4477 22 11 21.5523 11 21V18.9381C7.05369 18.446 4 15.0796 4 11Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none"><path d="M17 9H19C19.5523 9 20 9.44772 20 10V19C20 20.6569 18.6569 22 17 22H7C5.34315 22 4 20.6569 4 19V10C4 9.44772 4.44772 9 5 9H7V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V9ZM15 9V7C15 5.34315 13.6569 4 12 4C10.3431 4 9 5.34315 9 7V9H15ZM13 15.5C13 14.6716 13.6716 14 14.5 14H14.51C15.3384 14 16.01 14.6716 16.01 15.5V15.51C16.01 16.3384 15.3384 17.01 14.51 17.01H14.5C13.6716 17.01 13 16.3384 13 15.51V15.5Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>'
  };

  var MODEL_META = {
    TIDE: {
      color: '#f97316',
      soft: 'rgba(249, 115, 22, 0.16)',
      ball: { hi: '#FFE4BC', mid: '#f97316', dark: '#c2410c', shadow: '#9a3412' }
    },
    FLAIR: {
      color: '#3b82f6',
      soft: 'rgba(59, 130, 246, 0.16)',
      ball: { hi: '#BCD9FE', mid: '#3C82F5', dark: '#2E57C0', shadow: '#2D56C0' }
    },
    PINE: {
      color: '#22c55e',
      soft: 'rgba(34, 197, 94, 0.16)',
      ball: { hi: '#BBF7D0', mid: '#22c55e', dark: '#15803d', shadow: '#166534' }
    },
    GUEST: {
      color: '#6f9490',
      soft: 'rgba(168, 144, 184, 0.16)',
      ball: { hi: '#EDE4F5', mid: '#6f9490', dark: '#7c6694', shadow: '#6b5b7a' }
    },
    PIXELFRAME: {
      color: '#d946ef',
      soft: 'rgba(217, 70, 239, 0.16)',
      ball: { hi: '#F5D0FE', mid: '#d946ef', dark: '#86198f', shadow: '#701a75' }
    }
  };

  var _modelBallSeq = 0;

  function modelBall(key, size) {
    var meta = modelMeta(key);
    var ball = meta.ball || { hi: meta.color, mid: meta.color, dark: meta.color, shadow: meta.color };
    var s = size || 16;
    _modelBallSeq += 1;
    var uid = 'acxBall' + _modelBallSeq;
    return '<svg class="acx-model-ball" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<filter id="' + uid + 'f" x="-40%" y="-20%" width="180%" height="180%" color-interpolation-filters="sRGB">' +
      '<feDropShadow dx="0" dy="1.6" stdDeviation="1.1" flood-color="' + ball.shadow + '" flood-opacity="0.62"/>' +
      '</filter>' +
      '<radialGradient id="' + uid + 'g" cx="35%" cy="24%" r="72%" fx="28%" fy="18%">' +
      '<stop stop-color="' + ball.hi + '"/>' +
      '<stop offset="0.495192" stop-color="' + ball.mid + '"/>' +
      '<stop offset="1" stop-color="' + ball.dark + '"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<circle cx="12" cy="10.5" r="8.2" fill="url(#' + uid + 'g)" filter="url(#' + uid + 'f)"/>' +
      '</svg>';
  }

  function modelClass(key) {
    return 'mdl-' + String(key || 'TIDE').toLowerCase();
  }

  function modelMeta(key) {
    return MODEL_META[key] || MODEL_META.TIDE;
  }

  function icon(name, size) {
    var s = size || 20;
    var raw = ICONS[name] || '';
    if (!raw) return '';
    return raw.replace('<svg ', '<svg width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false" ');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function linkifyBareUrls(html) {
    var slots = [];
    // Protect existing anchors / void media / code so we don't double-wrap.
    html = String(html || '').replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, function (m) {
      slots.push(m);
      return '\u0000U' + (slots.length - 1) + '\u0000';
    });
    html = html.replace(/<(img|br|hr)\b[^>]*>/gi, function (m) {
      slots.push(m);
      return '\u0000U' + (slots.length - 1) + '\u0000';
    });
    html = html.replace(/<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/gi, function (m) {
      slots.push(m);
      return '\u0000U' + (slots.length - 1) + '\u0000';
    });
    // Bare URLs in prose (not attribute values — no match after = or quotes).
    html = html.replace(/(^|[\s([{«„])((?:https?:\/\/|www\.)[^\s<]+)/gi, function (_, lead, raw) {
      var trail = '';
      var url = raw.replace(/[.,;:!?…»"')\]]+$/g, function (m) {
        trail = m;
        return '';
      });
      if (!url || /^(https?:\/\/)$/i.test(url)) return lead + raw;
      var href = /^www\./i.test(url) ? ('https://' + url) : url;
      if (!/^https?:\/\//i.test(href)) return lead + raw;
      return lead + '<a href="' + href + '" target="_blank" rel="noreferrer noopener">' + url + '</a>' + trail;
    });
    return html.replace(/\u0000U(\d+)\u0000/g, function (_, i) {
      return slots[Number(i)] || '';
    });
  }

  function inlineMd(s) {
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(((?:https?:\/\/|\/api\/|data:image\/)[^)\s]+)\)/g, function (_, alt, url) {
      var fig = figureFromAlt(alt);
      var src = imgProxy(url);
      var cap = fig.caption || alt;
      return '<img class="acx-md-inline-img acx-md-inline-img--' + fig.size + ' is-loading" src="' + src + '" alt="' + cap + '" loading="lazy">';
    });
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
    s = linkifyBareUrls(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    return s;
  }

  function parseTableRow(line) {
    var cells = String(line || '').trim();
    if (!cells.startsWith('|')) return null;
    cells = cells.replace(/^\|/, '').replace(/\|$/, '');
    return cells.split('|').map(function (c) { return c.trim(); });
  }

  function isTableSepRow(cells) {
    if (!cells || !cells.length) return false;
    return cells.every(function (c) { return /^:?-{2,}:?$/.test(c); });
  }

  function tableHtml(headerCells, bodyRows) {
    var html = '<table class="acx-md-table"><thead><tr>';
    headerCells.forEach(function (c) { html += '<th>' + inlineMd(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    bodyRows.forEach(function (row) {
      html += '<tr>';
      row.forEach(function (c) { html += '<td>' + inlineMd(c) + '</td>'; });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function figureFromAlt(cap) {
    cap = String(cap || '');
    var prefix = cap.match(/^(small|medium|large|wide):\s*(.*)$/i);
    if (prefix) {
      return { size: prefix[1].toLowerCase(), caption: prefix[2] || '' };
    }
    var suffix = cap.match(/^(.*)\s*\|\s*(small|medium|large|wide)\s*$/i);
    if (suffix) {
      return { size: suffix[2].toLowerCase(), caption: suffix[1].trim() };
    }
    return { size: 'medium', caption: cap };
  }

  function imgProxy(url) {
    url = String(url || '').trim();
    if (!url || url.indexOf('/api/img.php') !== -1) return url;
    if (/^\/api\//i.test(url) || /^data:image\//i.test(url)) return url;
    if (!/^https?:\/\//i.test(url)) return url;
    return '/api/img.php?url=' + encodeURIComponent(url);
  }

  function figureBlockHtml(cap, url) {
    var fig = figureFromAlt(cap);
    var cls = 'acx-md-figure acx-md-figure--' + fig.size;
    var src = imgProxy(url);
    var caption = fig.caption || '';
    var html = '<figure class="' + cls + '" data-img-src="' + esc(url) + '">' +
      '<img src="' + esc(src) + '" alt="' + esc(caption) + '" loading="lazy">';
    if (caption) html += '<figcaption>' + inlineMd(caption) + '</figcaption>';
    html += '</figure>';
    return html;
  }

  function imageStageHtml() {
    return '<div class="acx-img-stage" aria-hidden="true">' +
      '<canvas class="acx-img-dots"></canvas>' +
      '<div class="acx-img-pct"><span class="acx-img-pct-n" data-pct="-1"></span><span class="acx-img-pct-s">%</span></div>' +
      '</div>';
  }

  function pctLabel(key, fallback) {
    try {
      if (window.ACX_I18N && window.ACX_I18N.t) return window.ACX_I18N.t(key);
    } catch (e) {}
    return fallback;
  }

  function imageToolsHtml() {
    return '<div class="acx-img-tools" role="group">' +
      '<button type="button" class="acx-img-tool" data-img-act="copy" title="' + esc(pctLabel('action.copyImage', 'Copy image')) + '">' + icon('copy', 16) + '</button>' +
      '<button type="button" class="acx-img-tool" data-img-act="download" title="' + esc(pctLabel('action.downloadImage', 'Download')) + '">' + icon('download', 16) + '</button>' +
      '</div>';
  }

  function figureImageUrl(host) {
    if (!host) return '';
    var img = host.querySelector ? host.querySelector('img') : null;
    return String((host.getAttribute && host.getAttribute('data-img-src')) || (img && img.currentSrc) || (img && img.src) || '').trim();
  }

  function bindImageTools(host) {
    if (!host || host.querySelector('.acx-img-tools')) return;
    if (host.classList && host.classList.contains('is-loading')) return;
    host.insertAdjacentHTML('beforeend', imageToolsHtml());
    host.querySelectorAll('[data-img-act]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var act = btn.getAttribute('data-img-act');
        var url = figureImageUrl(host);
        if (!url) return;
        if (act === 'download') downloadCanvasImage(url, btn);
        else copyCanvasImage(url, btn);
      });
    });
  }

  function downloadCanvasImage(url, btn) {
    fetch(url, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        var a = document.createElement('a');
        var href = URL.createObjectURL(blob);
        a.href = href;
        a.download = 'assistix-pixelframe.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(href); }, 1500);
        if (btn) btn.classList.add('is-ok');
      })
      .catch(function () {});
  }

  function copyCanvasImage(url, btn) {
    fetch(url, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        if (navigator.clipboard && window.ClipboardItem) {
          var type = blob.type && blob.type.indexOf('image/') === 0 ? blob.type : 'image/png';
          return navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(url);
        }
        throw new Error('no-clipboard');
      })
      .then(function () {
        if (btn) {
          btn.classList.add('is-ok');
          setTimeout(function () { btn.classList.remove('is-ok'); }, 1200);
        }
      })
      .catch(function () {});
  }

  function reducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function ensureImageStage(host) {
    if (!host || !host.appendChild) return null;
    var stage = host.querySelector('.acx-img-stage');
    if (!stage) {
      host.insertAdjacentHTML('afterbegin', imageStageHtml());
      stage = host.querySelector('.acx-img-stage');
    }
    return stage;
  }

  function setStagePercent(host, value) {
    var box = host && host.querySelector('.acx-img-pct-n');
    if (!box) return;
    var p = Math.max(0, Math.min(100, Math.round(value)));
    if (box._acxPct === p) return;
    box._acxPct = p;
    var str = String(p);
    if (box.childElementCount !== str.length) {
      var html = '';
      for (var i = 0; i < str.length; i++) {
        html += '<span class="acx-img-digit"><span class="acx-img-digit-col">';
        for (var d = 0; d < 10; d++) html += '<span>' + d + '</span>';
        html += '</span></span>';
      }
      box.innerHTML = html;
    }
    var cols = box.querySelectorAll('.acx-img-digit-col');
    for (var c = 0; c < cols.length; c++) {
      var digit = parseInt(str.charAt(c), 10) || 0;
      cols[c].style.transform = 'translateY(-' + digit * 10 + '%)';
    }
    box.setAttribute('data-pct', String(p));
    host.setAttribute('data-progress', String(p));
    var stage = host.querySelector('.acx-img-stage');
    if (stage) stage.setAttribute('aria-valuenow', String(p));
  }

  function stopImageStage(host) {
    var st = host && host._acxStage;
    if (!st) return;
    st.dead = true;
    if (st.raf) cancelAnimationFrame(st.raf);
    if (st.ro && st.ro.disconnect) st.ro.disconnect();
    if (st.unlisten) st.unlisten();
    host._acxStage = null;
  }

  function startImageStage(host, opts) {
    opts = opts || {};
    var stage = ensureImageStage(host);
    if (!stage) return null;
    if (host._acxStage && !host._acxStage.dead) {
      if (opts.progress != null) host._acxStage.target = opts.progress;
      return host._acxStage;
    }
    var canvas = stage.querySelector('.acx-img-dots');
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    stage.setAttribute('role', 'progressbar');
    stage.setAttribute('aria-valuemin', '0');
    stage.setAttribute('aria-valuemax', '100');
    var st = {
      dead: false,
      raf: 0,
      shown: 0,
      target: opts.progress != null ? opts.progress : 0,
      t0: performance.now(),
      ptr: null,
      finger: false,
      ghosts: [],
      dots: [],
      gap: 18
    };
    host._acxStage = st;
    setStagePercent(host, st.target);

    function layout() {
      var rect = stage.getBoundingClientRect();
      var w = Math.max(1, rect.width);
      var h = Math.max(1, rect.height);
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (w < 8 || h < 8) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var gap = w < 280 ? 16 : 18;
      st.gap = gap;
      var cols = Math.max(6, Math.floor(w / gap));
      var rows = Math.max(6, Math.floor(h / gap));
      var ox = (w - (cols - 1) * gap) / 2;
      var oy = (h - (rows - 1) * gap) / 2;
      st.dots = [];
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          st.dots.push({ x: ox + x * gap, y: oy + y * gap, p: (x * 12.9898 + y * 78.233) % 1 });
        }
      }
    }

    function touchFoci(now, w, h) {
      if (st.finger && st.ptr) {
        return [{ x: st.ptr.x, y: st.ptr.y, r: Math.max(64, Math.min(w, h) * 0.3), power: 1 }];
      }
      var t = (now - st.t0) / 1000;
      return [
        {
          x: w * (0.50 + 0.34 * Math.sin(t * 0.62)),
          y: h * (0.48 + 0.30 * Math.cos(t * 0.47 + 0.6)),
          r: Math.min(w, h) * (0.22 + 0.04 * Math.sin(t * 0.9)),
          power: 0.78
        },
        {
          x: w * (0.38 + 0.28 * Math.cos(t * 0.39 + 1.7)),
          y: h * (0.58 + 0.24 * Math.sin(t * 0.71 + 0.2)),
          r: Math.min(w, h) * 0.20,
          power: 0.55
        },
        {
          x: w * (0.62 + 0.22 * Math.sin(t * 0.91 + 2.4)),
          y: h * (0.36 + 0.22 * Math.cos(t * 0.53 + 1.3)),
          r: Math.min(w, h) * 0.16,
          power: 0.42
        }
      ];
    }

    function draw(now) {
      if (st.dead) return;
      var rect = stage.getBoundingClientRect();
      var w = rect.width;
      var h = rect.height;
      ctx.clearRect(0, 0, w, h);
      var t = (now - st.t0) / 1000;
      var foci = touchFoci(now, w, h);
      var fill = getComputedStyle(host).getPropertyValue('--acx-400').trim() || '#14b8a6';
      for (var i = 0; i < st.dots.length; i++) {
        var d = st.dots[i];
        var wave = 0.42 + 0.38 * Math.sin(t * 1.55 + d.x * 0.038 + d.y * 0.034 + d.p * 6);
        wave += 0.16 * Math.sin(t * 0.7 + d.y * 0.02 - d.x * 0.012);
        var boost = 0;
        for (var f = 0; f < foci.length; f++) {
          var focus = foci[f];
          var dx = d.x - focus.x;
          var dy = d.y - focus.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var hit = Math.exp(-(dist * dist) / (2 * focus.r * focus.r)) * focus.power;
          if (hit > boost) boost = hit;
        }
        var r = 1.05 + wave * 1.15 + boost * 3.8;
        var a = 0.14 + wave * 0.24 + boost * 0.78;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(20,184,166,' + Math.min(0.96, a).toFixed(3) + ')';
        if (fill && fill.charAt(0) === '#' && boost > 0.18) {
          ctx.fillStyle = fill;
          ctx.globalAlpha = Math.min(0.96, a);
        }
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    function loop(now) {
      if (st.dead) return;
      if (!opts.hold) {
        var elapsed = (now - st.t0) / 1000;
        var auto = 92 * (1 - Math.exp(-elapsed / 22));
        if (auto > st.target) st.target = auto;
      }
      st.shown += (st.target - st.shown) * 0.08;
      if (Math.abs(st.target - st.shown) > 0.4) setStagePercent(host, st.shown);
      else if (st.target >= 100 && st.shown < 99.5) {
        st.shown = 100;
        setStagePercent(host, 100);
      }
      draw(now);
      st.raf = requestAnimationFrame(loop);
    }

    function localPoint(ev) {
      var r = stage.getBoundingClientRect();
      var src = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      return { x: src.clientX - r.left, y: src.clientY - r.top };
    }
    function onMove(ev) {
      if (!st.finger && ev.pointerType !== 'touch' && !ev.buttons) return;
      st.ptr = localPoint(ev);
    }
    function onDown(ev) {
      st.finger = true;
      st.ptr = localPoint(ev);
      if (stage.setPointerCapture) {
        try { stage.setPointerCapture(ev.pointerId); } catch (err) {}
      }
      if (ev.pointerType === 'touch') ev.preventDefault();
    }
    function onUp(ev) {
      st.finger = false;
      st.ptr = null;
      if (ev && stage.releasePointerCapture && ev.pointerId != null) {
        try { stage.releasePointerCapture(ev.pointerId); } catch (err) {}
      }
    }
    stage.addEventListener('pointerdown', onDown, { passive: false });
    stage.addEventListener('pointermove', onMove, { passive: true });
    stage.addEventListener('pointerup', onUp, { passive: true });
    stage.addEventListener('pointercancel', onUp, { passive: true });
    st.unlisten = function () {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
    };
    st.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null;
    if (st.ro) st.ro.observe(stage);
    layout();
    if (reducedMotion()) {
      setStagePercent(host, st.target);
      draw(performance.now());
    } else {
      st.raf = requestAnimationFrame(loop);
    }
    return st;
  }

  function revealHostImage(host, img) {
    if (!host || !img || host._acxRevealing) return;
    if (!img.naturalWidth) return;
    host._acxRevealing = true;
    var finish = function () {
      host.classList.remove('is-loading', 'is-revealing');
      host.classList.add('is-ready', 'has-shot');
      img.style.filter = '';
      img.style.transform = '';
      stopImageStage(host);
      var stage = host.querySelector('.acx-img-stage');
      if (stage) stage.remove();
      bindImageTools(host);
      var wrap = host.closest && host.closest('.c-ai-wrap');
      var body = wrap && wrap.querySelector('.c-ai-body');
      if (body && body.querySelector('.acx-stream-wait') && !body.querySelector('img, figure, .acx-md-figure')) {
        body.innerHTML = '';
        body.classList.remove('is-streaming');
      }
      dropPendingIfImageReady(wrap || host);
    };
    var st = host._acxStage;
    if (st) st.target = 100;
    setStagePercent(host, 100);
    host.classList.add('is-revealing');
    host.classList.remove('is-loading');
    if (reducedMotion()) {
      finish();
      return;
    }
    var done = false;
    var once = function () {
      if (done) return;
      done = true;
      finish();
    };
    img.addEventListener('animationend', once, { once: true });
    setTimeout(once, 1400);
  }

  function bindImageSkeleton(img, host) {
    if (!img || !host) return;
    if (host.classList.contains('is-ready') && host.classList.contains('has-shot')) return;
    // Уже сгенерированная картинка (открытие чата из истории): показываем сразу,
    // без анимации генерации. Анимация только у живого pending-слота.
    if (!host.classList.contains('acx-img-pending') && img.complete && img.naturalWidth) {
      host.classList.remove('is-loading');
      host.classList.add('is-ready', 'has-shot');
      var doneStage = host.querySelector('.acx-img-stage');
      if (doneStage) doneStage.remove();
      bindImageTools(host);
      return;
    }
    if (host.classList) host.classList.add('is-loading');
    if (host.tagName !== 'IMG') startImageStage(host, { progress: host._acxStage ? host._acxStage.target : 8 });
    var go = function () {
      if (img.naturalWidth) revealHostImage(host, img);
    };
    if (img.complete && img.naturalWidth) {
      go();
    } else {
      img.addEventListener('load', go, { once: true });
    }
  }

  function pollGenImage(url, onReady, onTick) {
    if (!url) return function () {};
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (onTick) onTick(Math.min(90, 8 + tries * 1.1));
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      fetch(url + sep + 'poll=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })
        .then(function (r) {
          if (r.status === 200) {
            clearInterval(timer);
            if (onTick) onTick(100);
            onReady(url);
          }
        })
        .catch(function () {});
      if (tries > 90) clearInterval(timer);
    }, 280);
    return function () { clearInterval(timer); };
  }

  function mountPendingImage(aiEl, meta) {
    if (!aiEl) return null;
    var wrap = aiEl.querySelector('.c-ai-wrap') || aiEl;
    if (readyCanvasImage(wrap)) return null;
    var id = meta && meta.id ? String(meta.id) : '';
    var url = meta && meta.url ? String(meta.url) : (id ? '/api/genimg.php?id=' + encodeURIComponent(id) : '');
    var slot = id
      ? wrap.querySelector('.acx-img-pending[data-pending-id="' + id + '"]')
      : wrap.querySelector('.acx-img-pending');
    if (!slot) {
      slot = document.createElement('figure');
      slot.className = 'acx-md-figure acx-md-figure--medium acx-img-pending is-loading';
      slot.innerHTML = imageStageHtml();
      var body = wrap.querySelector('.c-ai-body');
      var metaEl = wrap.querySelector('.c-ai-meta');
      if (body && body.nextSibling) wrap.insertBefore(slot, body.nextSibling);
      else if (metaEl) wrap.insertBefore(slot, metaEl);
      else wrap.appendChild(slot);
    } else if (!slot.querySelector('.acx-img-stage')) {
      slot.insertAdjacentHTML('afterbegin', imageStageHtml());
    }
    if (id) slot.setAttribute('data-pending-id', id);
    if (url) slot.setAttribute('data-pending-url', url);
    startImageStage(slot, { progress: 3 });
    sweepDuplicateCanvasImages(wrap);
    var canPoll = /^\/api\/genimg\.php\?id=[a-f0-9]{16,}/i.test(url);
    if (canPoll && !slot._acxPoll) {
      slot._acxPoll = pollGenImage(url, function (readyUrl) {
        promotePendingImage(slot, readyUrl);
      }, function (p) {
        if (slot._acxStage) slot._acxStage.target = Math.max(slot._acxStage.target, p);
      });
    }
    return slot;
  }

  function promotePendingImage(slot, url) {
    if (!slot || !url) return;
    if (slot._acxPoll) {
      try { slot._acxPoll(); } catch (e) {}
      slot._acxPoll = null;
    }
    if (slot._acxStage) slot._acxStage.target = 100;
    setStagePercent(slot, 100);
    var img = slot.querySelector('img.acx-img-shot');
    if (!img) {
      img = document.createElement('img');
      img.className = 'acx-img-shot';
      img.alt = '';
      slot.appendChild(img);
    }
    bindImageSkeleton(img, slot);
    img.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
    sweepDuplicateCanvasImages(slot);
  }

  function clearPendingImages(container, id) {
    if (!container || !container.closest) return;
    var wrap = container.closest('.c-ai-wrap') || container;
    var sel = id
      ? '.acx-img-pending[data-pending-id="' + String(id).replace(/"/g, '') + '"]'
      : '.acx-img-pending';
    wrap.querySelectorAll(sel).forEach(function (slot) {
      if (slot._acxPoll) {
        try { slot._acxPoll(); } catch (e) {}
      }
      stopImageStage(slot);
      slot.remove();
    });
  }

  function clearResolvedPendingImages(container) {
    sweepDuplicateCanvasImages(container);
  }

  function stripWidgetMarkers(md) {
    if (window.ACXWidgets && window.ACXWidgets.stripMarkers) {
      return window.ACXWidgets.stripMarkers(md);
    }
    return String(md || '').replace(/\[\[ACX:(weather|constant|entity)\|[^\]]+\]\]\n?/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function renderMarkdown(md, opts) {
    md = stripWidgetMarkers(md);
    opts = opts || {};
    var headingIds = opts.headingIds || '';
    var headingIndex = 0;
    var lines = String(md || '').replace(/\r/g, '').split('\n');
    var html = '', listType = null, inCode = false, codeBuf = '', codeLang = '';
    function flushList() { if (listType) { html += listType === 'ol' ? '</ol>' : '</ul>'; listType = null; } }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var fence = line.match(/^```(\w*)?\s*$/);
      if (fence) {
        if (inCode) {
          html += codeBlockHtml(codeLang, codeBuf);
          codeBuf = '';
          codeLang = '';
          inCode = false;
        } else {
          flushList();
          codeLang = (fence[1] || '').trim();
          inCode = true;
        }
        continue;
      }
      if (inCode) { codeBuf += (codeBuf ? '\n' : '') + line; continue; }

      var tableRow = parseTableRow(line);
      if (tableRow) {
        var nextRow = i + 1 < lines.length ? parseTableRow(lines[i + 1]) : null;
        if (nextRow && isTableSepRow(nextRow)) {
          flushList();
          var bodyRows = [];
          i += 2;
          while (i < lines.length) {
            var bodyRow = parseTableRow(lines[i]);
            if (!bodyRow) { i--; break; }
            bodyRows.push(bodyRow);
            i++;
          }
          html += tableHtml(tableRow, bodyRows);
          continue;
        }
      }

      if (!line.trim()) { flushList(); continue; }

      var imgBlock = line.match(/^!\[([^\]]*)\]\(((?:https?:\/\/|\/api\/|data:image\/)[^)\s]+)\)\s*$/);
      if (imgBlock) {
        flushList();
        html += figureBlockHtml(imgBlock[1] || '', imgBlock[2]);
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
        flushList();
        html += '<hr class="acx-md-hr">';
        continue;
      }

      var bq = line.match(/^>\s?(.*)$/);
      if (bq) {
        flushList();
        html += '<blockquote class="acx-md-quote">' + inlineMd(bq[1]) + '</blockquote>';
        continue;
      }

      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushList();
        var lvl = h[1].length;
        var idAttr = headingIds ? ' id="' + headingIds + '-' + (headingIndex++) + '"' : '';
        html += '<h' + lvl + idAttr + '>' + inlineMd(h[2]) + '</h' + lvl + '>';
        continue;
      }
      var ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
      var ul = line.match(/^\s*[-*•]\s+(.*)$/);
      if (ol) { if (listType !== 'ol') { flushList(); html += '<ol>'; listType = 'ol'; } html += '<li>' + inlineMd(ol[2]) + '</li>'; continue; }
      if (ul) { if (listType !== 'ul') { flushList(); html += '<ul>'; listType = 'ul'; } html += '<li>' + inlineMd(ul[1]) + '</li>'; continue; }
      flushList();
      html += '<p>' + inlineMd(line) + '</p>';
    }
    if (inCode) html += codeBlockHtml(codeLang, codeBuf);
    flushList();
    return html;
  }

  function codeLangLabel(lang) {
    var labels = {
      js: 'JavaScript', javascript: 'JavaScript',
      ts: 'TypeScript', typescript: 'TypeScript',
      py: 'Python', python: 'Python',
      html: 'HTML', css: 'CSS', json: 'JSON',
      bash: 'Bash', sh: 'Shell', shell: 'Shell',
      sql: 'SQL', php: 'PHP', rust: 'Rust', go: 'Go',
      rb: 'Ruby', md: 'Markdown', yaml: 'YAML', yml: 'YAML',
      xml: 'XML', java: 'Java', cpp: 'C++', c: 'C'
    };
    var l = String(lang || '').trim().toLowerCase();
    if (labels[l]) return labels[l];
    if (!l) return 'Code';
    return l.charAt(0).toUpperCase() + l.slice(1);
  }

  function codeCopyLabel() {
    var i18n = typeof window !== 'undefined' ? window.ACX_I18N : null;
    return (i18n && i18n.t('action.copy')) || 'Copy';
  }

  function codeBlockHtml(lang, code) {
    var label = codeLangLabel(lang);
    var cls = lang ? ('language-' + String(lang).trim().toLowerCase()) : 'language-plaintext';
    var copyLbl = codeCopyLabel();
    return '<div class="acx-code-wrap">' +
      '<div class="acx-code-inner">' +
      '<div class="acx-code-head">' +
      '<span class="acx-code-lang">' + esc(label) + '</span>' +
      '<div class="acx-code-actions">' +
      '<button type="button" class="acx-code-copy" title="' + esc(copyLbl) + '" aria-label="' + esc(copyLbl) + '">' + icon('copy', 16) + '</button>' +
      '</div></div>' +
      '<div class="acx-code-body"><pre><code class="' + esc(cls) + '">' + esc(code) + '</code></pre></div>' +
      '</div></div>';
  }

  function relocalizeCodeCopyButtons(root) {
    root = root || document;
    var copyLbl = codeCopyLabel();
    root.querySelectorAll('.acx-code-copy').forEach(function (btn) {
      btn.title = copyLbl;
      btn.setAttribute('aria-label', copyLbl);
    });
  }

  function enhanceMarkdown(container) {
    if (!container) return;
    var wrap = container.closest ? (container.closest('.c-ai-wrap') || container) : container;
    if (wrap.querySelector && wrap.querySelector('.acx-img-pending:not(.is-ready)')) {
      sweepDuplicateCanvasImages(container);
      return;
    }
    container.querySelectorAll('.acx-code-copy').forEach(function (btn) {
      if (btn._acxCopyBound) return;
      btn._acxCopyBound = true;
      btn.addEventListener('click', function () {
        var pre = btn.closest('.acx-code-wrap');
        var code = pre && pre.querySelector('code');
        if (!code) return;
        var text = code.textContent || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            btn.classList.add('is-copied');
            btn.innerHTML = icon('check', 16);
            setTimeout(function () {
              btn.classList.remove('is-copied');
              btn.innerHTML = icon('copy', 16);
            }, 1400);
          });
        }
      });
    });
    container.querySelectorAll('.acx-md-figure img').forEach(function (img) {
      var fig = img.closest('.acx-md-figure');
      if (!fig) return;
      if (fig.classList.contains('is-ready') || (img.complete && img.naturalWidth)) bindImageTools(fig);
      var raw = fig.getAttribute('data-img-src') || img.getAttribute('src') || '';
      if (raw && /^(?:https?:\/\/|\/api\/|data:image\/)/i.test(raw)) img.src = imgProxy(raw);
      var cap = fig.querySelector('figcaption');
      if (!cap && (img.getAttribute('alt') || raw)) {
        cap = document.createElement('figcaption');
        cap.textContent = img.getAttribute('alt') || '';
        fig.appendChild(cap);
      } else if (cap && !cap.textContent.trim() && img.getAttribute('alt')) {
        cap.textContent = img.getAttribute('alt');
      }
      bindImageSkeleton(img, fig);
    });
    container.querySelectorAll('.acx-md-inline-img').forEach(function (img) {
      var raw = img.getAttribute('src') || '';
      if (raw && /^(?:https?:\/\/|\/api\/|data:image\/)/i.test(raw)) img.src = imgProxy(raw);
      bindImageSkeleton(img, img);
    });
    clearResolvedPendingImages(container);
    if (window.hljs) {
      container.querySelectorAll('pre code').forEach(function (block) {
        if (block.classList.contains('hljs')) return;
        try { window.hljs.highlightElement(block); } catch (e) {}
      });
    }
    if (window.ACXArtifacts) window.ACXArtifacts.enhance(container);
    if (window.ACXEnhance && window.ACXEnhance.enhanceMessage) {
      window.ACXEnhance.enhanceMessage(container);
    }
  }

  function getMarkdownPlainText(container) {
    if (!container) return '';
    var clone = container.cloneNode(true);
    clone.querySelectorAll('.acx-code-wrap').forEach(function (w) {
      var code = w.querySelector('code');
      if (code) w.replaceWith(document.createTextNode('\n```\n' + (code.textContent || '') + '\n```\n'));
    });
    return (clone.textContent || '').trim();
  }

  function streamWaitHtml(label) {
    var text = String(label || '').trim();
    return '<div class="acx-stream-inner acx-stream-wait" role="status" aria-live="polite">' +
      '<span class="acx-stream-pulse" aria-hidden="true"></span>' +
      '<span class="acx-stream-status" data-stream-status>' + esc(text) + '</span>' +
      '</div>';
  }

  function setStreamWaitStatus(container, label) {
    if (!container) return;
    var text = String(label || '').trim();
    if (!text) return;
    var wait = container.querySelector('.acx-stream-wait');
    if (!wait) {
      if (!container.querySelector('.acx-stream-inner') && !(container.textContent || '').trim()) {
        container.innerHTML = streamWaitHtml(text);
      }
      return;
    }
    var el = wait.querySelector('[data-stream-status]');
    if (!el) {
      wait.innerHTML = '<span class="acx-stream-pulse" aria-hidden="true"></span>' +
        '<span class="acx-stream-status" data-stream-status></span>';
      el = wait.querySelector('[data-stream-status]');
    }
    if (el.textContent === text) return;
    el.classList.add('is-swap');
    window.setTimeout(function () {
      if (!el.isConnected) return;
      el.textContent = text;
      el.classList.remove('is-swap');
    }, 120);
  }

  /* TextSplit — blur word reveal (scattered + top-to-bottom wave) */
  var TS_STAGGER = 12;
  var TS_REVEAL_MIN = 16;
  var TS_REVEAL_MAX = 72;
  var TS_TRANSITION_MS = 220;
  var TS_SKIP_TAGS = { PRE: 1, CODE: 1, SVG: 1, FIGURE: 1, IMG: 1 };

  function tsRandomDelay() {
    return TS_REVEAL_MIN + Math.random() * (TS_REVEAL_MAX - TS_REVEAL_MIN);
  }

  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function resetStreamState(inner) {
    if (!inner) return;
    if (inner._tsTimers) {
      inner._tsTimers.forEach(function (id) { clearTimeout(id); });
      inner._tsTimers = [];
    }
    inner._tsCommitted = 0;
    inner._tsScheduledUpTo = 0;
  }

  function nodeToStreamHtml(node, state, committed) {
    if (node.nodeType === 3) {
      var text = node.textContent;
      if (!text) return '';
      var parts = text.split(/(\s+)/);
      var out = '';
      for (var pi = 0; pi < parts.length; pi++) {
        var part = parts[pi];
        if (/^\s+$/.test(part)) {
          out += part.indexOf('\n') !== -1 ? part.replace(/\n/g, '<br>') : part;
          continue;
        }
        if (!part) continue;
        var cls = 'ts-word' + (state.wi < committed ? ' ts-in' : '');
        out += '<span class="' + cls + '" data-wi="' + state.wi + '">' + esc(part) + '</span>';
        state.wi++;
      }
      return out;
    }
    if (node.nodeType === 1) {
      var tag = node.tagName;
      if (TS_SKIP_TAGS[tag]) return node.outerHTML;
      var open = '<' + tag.toLowerCase();
      for (var ai = 0; ai < node.attributes.length; ai++) {
        var at = node.attributes[ai];
        open += ' ' + at.name + '="' + escAttr(at.value) + '"';
      }
      open += '>';
      var inner = '';
      for (var ci = 0; ci < node.childNodes.length; ci++) {
        inner += nodeToStreamHtml(node.childNodes[ci], state, committed);
      }
      return open + inner + '</' + tag.toLowerCase() + '>';
    }
    return '';
  }

  function renderStreamWordsHtml(md, committed) {
    var root = document.createElement('div');
    root.innerHTML = renderMarkdown(md || '');
    var state = { wi: 0 };
    var html = '';
    for (var i = 0; i < root.childNodes.length; i++) {
      html += nodeToStreamHtml(root.childNodes[i], state, committed);
    }
    return { html: html, total: state.wi };
  }

  function scheduleTsWords(inner, from, to, scattered, opts) {
    if (!inner || from >= to) return;
    if (!inner._tsTimers) inner._tsTimers = [];
    opts = opts || {};
    var stagger = opts.stagger || TS_STAGGER;
    var revealMin = opts.revealMin || TS_REVEAL_MIN;
    var revealMax = opts.revealMax || TS_REVEAL_MAX;
    var start = Math.max(from, inner._tsScheduledUpTo || 0);
    if (start >= to) return;
    var useScatter = scattered !== false;
    var jitterSpan = Math.max(20, (revealMax - revealMin) * 0.38);
    for (var wi = start; wi < to; wi++) {
      (function (idx) {
        var rowBias = (idx - start) * stagger;
        var jitter = useScatter ? Math.random() * jitterSpan : 0;
        var delay = revealMin + rowBias + jitter;
        var id = setTimeout(function () {
          var el = inner.querySelector('[data-wi="' + idx + '"]');
          if (el) {
            el.classList.add('ts-in');
            inner._tsCommitted = Math.max(inner._tsCommitted || 0, idx + 1);
          }
        }, delay);
        inner._tsTimers.push(id);
      })(wi);
    }
    inner._tsScheduledUpTo = to;
  }

  function resolveStreamOpts(opts) {
    opts = opts || {};
    if (opts.finish) {
      return {
        stagger: 11,
        revealMin: 22,
        revealMax: 68,
        scattered: false,
        finishFast: false,
        finishCap: 2400
      };
    }
    if (opts.slow) {
      return {
        stagger: opts.stagger || 68,
        revealMin: opts.revealMin || 160,
        revealMax: opts.revealMax || 780,
        scattered: opts.scattered !== false
      };
    }
    return {
      stagger: opts.stagger || TS_STAGGER,
      revealMin: opts.revealMin || TS_REVEAL_MIN,
      revealMax: opts.revealMax || TS_REVEAL_MAX,
      scattered: opts.scattered !== false
    };
  }

  function tsSettleMs(streamOpts, pendingWords) {
    pendingWords = Math.max(0, pendingWords || 0);
    var opts = streamOpts || resolveStreamOpts();
    var cap = opts.finishCap || 9000;
    var tailPad = opts.finishFast ? 48 : 180;
    var floor = TS_TRANSITION_MS + (opts.finishFast ? 80 : 420);
    return Math.min(
      Math.max(
        opts.revealMax + pendingWords * opts.stagger + TS_TRANSITION_MS + tailPad,
        floor
      ),
      cap
    );
  }

  function markContainerRevealing(container, on) {
    if (!container) return;
    container.classList.toggle('is-revealing', !!on);
  }

  function afterPaint(fn) {
    requestAnimationFrame(function () {
      requestAnimationFrame(fn);
    });
  }

  function stripPendingGenMarkdown(md, el) {
    var wrap = el && el.closest ? (el.closest('.c-ai-wrap') || el) : null;
    if (!wrap || !wrap.querySelector || !wrap.querySelector('.acx-img-pending')) return md;
    return String(md || '')
      .replace(/!\[[^\]]*\]\((?:https?:\/\/[^)\s]+)?\/api\/genimg\.php\?id=[a-f0-9]{8,}[^)]*\)/gi, '')
      .replace(/!\[[^\]]*\]\(\/api\/genimg\.php\?id=[a-f0-9]{8,}[^)]*\)/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function readyCanvasImage(wrap) {
    if (!wrap || !wrap.querySelectorAll) return null;
    var nodes = wrap.querySelectorAll('.c-ai-body img, .acx-md-figure:not(.acx-img-pending) img, .acx-img-pending.is-ready img, .acx-img-pending.has-shot img');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].naturalWidth) return nodes[i];
    }
    return null;
  }

  function dropPendingIfImageReady(container) {
    if (!container || !container.closest) return;
    var wrap = container.closest('.c-ai-wrap') || container;
    var pending = wrap.querySelectorAll('.acx-img-pending:not(.is-ready)');
    if (!pending.length) return;
    var ready = readyCanvasImage(wrap);
    if (!ready) return;
    if (ready.closest && ready.closest('.acx-img-pending')) {
      wrap.querySelectorAll('.acx-md-figure:not(.acx-img-pending)').forEach(function (fig) { fig.remove(); });
      return;
    }
    pending.forEach(function (slot) {
      if (slot._acxPoll) {
        try { slot._acxPoll(); } catch (e) {}
      }
      stopImageStage(slot);
      slot.remove();
    });
    var fig = ready.closest && ready.closest('.acx-md-figure');
    if (fig) bindImageTools(fig);
  }

  function genimgUrlFromText(text) {
    var m = String(text || '').match(/(\/api\/genimg\.php\?id=[a-f0-9]{8,}[^)\s]*)/i);
    return m ? m[1] : '';
  }

  function settleCanvasImage(el, md) {
    if (!el) return;
    var wrap = el.querySelector ? (el.querySelector('.c-ai-wrap') || el.closest && el.closest('.c-ai-wrap') || el) : el;
    var url = genimgUrlFromText(md);
    var pending = wrap.querySelector && wrap.querySelector('.acx-img-pending');
    var ready = readyCanvasImage(wrap);
    if (ready && ready.naturalWidth && pending && !pending.classList.contains('is-ready')) {
      dropPendingIfImageReady(wrap);
      return;
    }
    if (pending && url) {
      promotePendingImage(pending, url);
      wrap.querySelectorAll('.c-ai-body .acx-md-figure, .c-ai-body img').forEach(function (n) {
        if (!n.closest || !n.closest('.acx-img-pending')) n.remove();
      });
    }
    dropPendingIfImageReady(wrap);
    setTimeout(function () { dropPendingIfImageReady(wrap); }, 160);
    setTimeout(function () { dropPendingIfImageReady(wrap); }, 700);
    setTimeout(function () { dropPendingIfImageReady(wrap); }, 1800);
  }

  function sweepDuplicateCanvasImages(container) {
    dropPendingIfImageReady(container);
  }

  function genimgIdFromUrl(u) {
    var m = String(u || '').match(/genimg\.php\?id=([a-f0-9]+)/i);
    return m ? m[1].toLowerCase() : '';
  }

  function syncStreamMarkdown(container, md, opts) {
    if (!container) return;
    var streamOpts = resolveStreamOpts(opts);
    container.classList.add('is-streaming');
    markContainerRevealing(container, true);
    md = stripPendingGenMarkdown(md || '', container);
    md = stripWidgetMarkers(md);

    if (!md.trim()) {
      if (!container.querySelector('.acx-stream-inner')) {
        container.innerHTML = streamWaitHtml('');
      }
      return;
    }
    var inner = container.querySelector('.acx-stream-inner');
    if (!inner || inner.classList.contains('acx-stream-wait')) {
      inner = document.createElement('div');
      inner.className = 'acx-stream-inner';
      container.innerHTML = '';
      container.appendChild(inner);
      resetStreamState(inner);
    }
    if (inner._tsTimers) {
      inner._tsTimers.forEach(function (id) { clearTimeout(id); });
      inner._tsTimers = [];
    }
    var committed = inner._tsCommitted || 0;
    var built = renderStreamWordsHtml(md, committed);
    inner.innerHTML = built.html;
    inner._tsScheduledUpTo = committed;
    if (built.total > committed) {
      afterPaint(function () {
        if (!inner.isConnected) return;
        scheduleTsWords(inner, committed, built.total, streamOpts.scattered, streamOpts);
      });
    }
  }

  function finishStreamMarkdown(container, md, opts) {
    if (!container) return;
    var wrap = container.closest ? (container.closest('.c-ai-wrap') || container) : container;
    var hasPending = !!(wrap && wrap.querySelector && wrap.querySelector('.acx-img-pending'));
    md = stripPendingGenMarkdown(md || '', container);
    var streamOpts = resolveStreamOpts(opts);
    syncStreamMarkdown(container, md, opts);
    var inner = container.querySelector('.acx-stream-inner');
    var finalize = function () {
      if (inner && inner._tsTimers) inner._tsTimers.forEach(function (id) { clearTimeout(id); });
      resetStreamState(inner);
      container.classList.remove('is-streaming');
      markContainerRevealing(container, false);
      if (!String(md || '').trim() && hasPending) {
        if (!container.querySelector('.acx-stream-wait')) {
          container.innerHTML = streamWaitHtml('');
        }
        container.classList.add('is-streaming');
        return;
      }
      if (hasPending) {
        if (!container.querySelector('.acx-stream-wait')) {
          container.innerHTML = streamWaitHtml('');
        }
        container.classList.add('is-streaming');
        sweepDuplicateCanvasImages(container);
        return;
      }
      container.innerHTML = renderMarkdown(md);
      enhanceMarkdown(container);
      if (!/!\[[^\]]*\]\([^)]+\)/.test(md)) clearPendingImages(container);
    };
    if (!inner || inner.classList.contains('acx-stream-wait')) {
      finalize();
      return;
    }
    var total = inner.querySelectorAll('.ts-word').length;
    var committed = inner._tsCommitted || 0;
    if (total > committed) {
      if (inner._tsTimers) {
        inner._tsTimers.forEach(function (id) { clearTimeout(id); });
        inner._tsTimers = [];
      }
      inner._tsScheduledUpTo = committed;
      afterPaint(function () {
        if (!inner.isConnected) return;
        scheduleTsWords(inner, committed, total, streamOpts.scattered !== false, streamOpts);
      });
    }
    setTimeout(finalize, tsSettleMs(streamOpts, total - committed));
  }

  function revealMarkdown(container, md, opts) {
    if (!container) return;
    opts = opts || {};
    md = md || '';
    container.classList.add('acx-md');
    container.classList.remove('is-streaming', 'is-revealing');
    if (opts.static || opts.instant) {
      container.innerHTML = renderMarkdown(md);
      enhanceMarkdown(container);
      return;
    }
    if (!md.trim()) {
      container.innerHTML = renderMarkdown(md);
      enhanceMarkdown(container);
      return;
    }

    container.classList.add('is-revealing');
    container.innerHTML = '';
    var inner = document.createElement('div');
    inner.className = 'acx-stream-inner';
    container.appendChild(inner);
    resetStreamState(inner);

    var built = renderStreamWordsHtml(md, 0);
    inner.innerHTML = built.html;
    var streamOpts = resolveStreamOpts();

    if (built.total > 0) {
      afterPaint(function () {
        if (!inner.isConnected) return;
        scheduleTsWords(inner, 0, built.total, true, streamOpts);
      });
    }

    setTimeout(function () {
      if (!container.isConnected) return;
      var curInner = container.querySelector('.acx-stream-inner');
      if (curInner && curInner._tsTimers) {
        curInner._tsTimers.forEach(function (id) { clearTimeout(id); });
      }
      markContainerRevealing(container, false);
      container.innerHTML = renderMarkdown(md);
      enhanceMarkdown(container);
    }, tsSettleMs(streamOpts, built.total));
  }

  function extractStreamParts(j) {
    if (!j || typeof j !== 'object') return { content: '', reasoning: '' };
    // Own server event (used by real-time streaming before the upstream finishes).
    if (typeof j.delta === 'string' || typeof j.reasoning === 'string') {
      return { content: typeof j.delta === 'string' ? j.delta : '', reasoning: typeof j.reasoning === 'string' ? j.reasoning : '' };
    }
    var choice = j.choices && j.choices[0];
    if (!choice) return { content: '', reasoning: '' };
    var block = choice.delta || choice.message || {};
    return {
      content: block.content || block.text || '',
      reasoning: block.reasoning_content || ''
    };
  }

  function extractStreamPiece(j) {
    var parts = extractStreamParts(j);
    return parts.content || parts.reasoning || '';
  }

  var CJK_RE = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/;

  function userExpectsCjk(text) {
    text = String(text || '');
    if (!text) return false;
    if (CJK_RE.test(text)) return true;
    var t = text.toLowerCase();
    return /китай|япон|корей|иероглиф|кандзи|hanzi|kanji|chinese|japanese|cinese|giappon|mandarin|по-китайски|на китайском|in chinese/.test(t);
  }

  function stripCjkLeaks(text, uiLang, userContext) {
    text = String(text || '');
    if (!text || userExpectsCjk(userContext || '')) return text;
    var lang = String(uiLang || 'en').slice(0, 2);
    if (lang !== 'ru' && lang !== 'en' && lang !== 'it') return text;
    if (!CJK_RE.test(text)) return text;
    return text
      .replace(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\[\s*\]/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }

  function parseSseEvents(text, handlers) {
    handlers = handlers || {};
    var lines = text.split(/\r?\n/);
    var eventName = 'message';
    var dataLines = [];
    function flush() {
      if (!dataLines.length) return;
      var data = dataLines.join('\n');
      dataLines = [];
      var fn = handlers[eventName] || handlers.message;
      if (!fn) return;
      try { fn(JSON.parse(data)); } catch (e) {}
      eventName = 'message';
    }
    lines.forEach(function (line) {
      if (line === '') { flush(); return; }
      if (line.indexOf('event:') === 0) eventName = line.slice(6).trim();
      else if (line.indexOf('data:') === 0) dataLines.push(line.slice(5).trim());
    });
    flush();
  }

  function parseSseStreamChunk(text, handlers) {
    handlers = handlers || {};
    var events = text.split(/\n\n/);
    events.forEach(function (block) {
      if (!block.trim()) return;
      var eventName = 'message';
      var dataLines = [];
      block.split(/\r?\n/).forEach(function (line) {
        if (line.indexOf('event:') === 0) eventName = line.slice(6).trim();
        else if (line.indexOf('data:') === 0) dataLines.push(line.slice(5).trim());
      });
      if (!dataLines.length) return;
      var dataStr = dataLines.join('\n');
      if (dataStr === '[DONE]') return;
      try {
        var j = JSON.parse(dataStr);
        if (eventName === 'research' && handlers.onResearch) {
          handlers.onResearch(j);
          return;
        }
        if (eventName === 'research_progress' && handlers.onResearchProgress) {
          handlers.onResearchProgress(j);
          return;
        }
        if (eventName === 'research_skeleton' && handlers.onResearchSkeleton) {
          handlers.onResearchSkeleton(j);
          return;
        }
        if (eventName === 'research_report' && handlers.onResearchReport) {
          handlers.onResearchReport(j);
          return;
        }
        if (eventName === 'sources' && handlers.onSources) {
          handlers.onSources(j);
          return;
        }
        if (eventName === 'widgets' && handlers.onWidgets) {
          handlers.onWidgets(j);
          return;
        }
        if (eventName === 'memory' && handlers.onMemory) {
          handlers.onMemory(j);
          return;
        }
        // Рассуждение модели — отдельным событием, чтобы показывать на лету.
        if (eventName === 'reasoning') {
          var rContent = (j && typeof j.content === 'string') ? j.content : '';
          if (rContent && handlers.onReasoning) handlers.onReasoning(rContent);
          return;
        }
        // Сервер подчистил уже показанный текст (язык/бренд) — заменяем целиком.
        if (eventName === 'reply_replace') {
          if (handlers.onReplace) handlers.onReplace(String((j && j.content) || ''));
          return;
        }
        if (eventName === 'status' && handlers.onStatus) {
          handlers.onStatus(j);
          return;
        }
        if (eventName === 'image_pending' && handlers.onImagePending) {
          handlers.onImagePending(j);
          return;
        }
        if (eventName === 'image_failed' && handlers.onImageFailed) {
          handlers.onImageFailed(j);
          return;
        }
        if (eventName.indexOf('agent_') === 0 && handlers.onAgent) {
          handlers.onAgent(eventName, j);
          return;
        }
        if (eventName === 'stream_error' && handlers.onError) {
          handlers._streamErrored = true;
          handlers.onError(j.error || 'error');
          return;
        }
        var parts = extractStreamParts(j);
        if (parts.reasoning && handlers.onReasoning) handlers.onReasoning(parts.reasoning);
        if (parts.content && handlers.onToken) handlers.onToken(parts.content);
      } catch (e) {}
    });
  }

  var API = {
    bootstrap: function () {
      return fetch('/api/bootstrap.php', { credentials: 'same-origin' }).then(function (r) { return r.json(); });
    },
    history: function (params) {
      var q = new URLSearchParams(params || {}).toString();
      return fetch('/api/chat.php' + (q ? '?' + q : ''), { credentials: 'same-origin' }).then(function (r) { return r.json(); });
    },
    share: function (token) {
      return fetch(API_BASE + 'share.php?t=' + encodeURIComponent(String(token)), { credentials: 'same-origin' }).then(function (r) { return r.json(); });
    },
    chatPost: function (body) {
      return fetch('/api/chat.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json(); });
    },
    upload: function (file, meta, opts) {
      opts = opts || {};
      var onUploadProgress = opts.onUploadProgress || null;
      return new Promise(function (resolve, reject) {
        var fd = new FormData();
        fd.append('file', file);
        if (meta && meta.conversation_id) fd.append('conversation_id', String(meta.conversation_id));
        var xhr = new XMLHttpRequest();
        xhr.open('POST', API_BASE + 'upload.php', true);
        xhr.withCredentials = true;
        if (xhr.upload && onUploadProgress) {
          xhr.upload.onprogress = function (ev) {
            if (ev.lengthComputable) onUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          };
        }
        if (opts.onXhr) opts.onXhr(xhr);
        xhr.onload = function () {
          try {
            var j = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 400) reject(new Error(sanitizePublicError(j.error || ('HTTP ' + xhr.status))));
            else resolve(j);
          } catch (e) {
            reject(new Error('bad_response'));
          }
        };
        xhr.onerror = function () { reject(new Error('upload_failed')); };
        xhr.send(fd);
      });
    },
    extractPdf: function (id, opts) {
      opts = opts || {};
      var onProgress = opts.onProgress || function () {};
      var onDone = opts.onDone || function () {};
      var onError = opts.onError || function () {};
      var url = API_BASE + 'extract.php?id=' + encodeURIComponent(String(id)) + '&stream=1';
      var aborted = false;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;

      function finishErr(msg) {
        if (aborted) return;
        onError(msg || 'extract_failed');
      }

      fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'text/event-stream' },
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        if (aborted) return;
        if (!r.ok) {
          return r.text().then(function (t) {
            var msg = 'extract_failed';
            try { var j = JSON.parse(t); if (j.error) msg = sanitizePublicError(j.error); } catch (e) {}
            throw new Error(msg);
          });
        }
        var ctype = (r.headers.get('content-type') || '').toLowerCase();
        if (ctype.indexOf('json') !== -1) {
          return r.json().then(function (j) {
            if (j.success && j.attachment) onDone(j);
            else finishErr(j.error || 'extract_failed');
          });
        }
        if (!r.body || !window.ReadableStream) {
          return r.text().then(function (t) {
            parseSseEvents(t, {
              progress: onProgress,
              done: onDone,
              error: function (j) { finishErr((j && j.error) || 'extract_failed'); }
            });
          });
        }
        var reader = r.body.getReader();
        var dec = new TextDecoder();
        var buf = '';
        function pump() {
          return reader.read().then(function (res) {
            if (aborted) return;
            if (res.done) {
              if (buf) {
                parseSseEvents(buf, {
                  progress: onProgress,
                  done: onDone,
                  error: function (j) { finishErr((j && j.error) || 'extract_failed'); }
                });
              }
              return;
            }
            buf += dec.decode(res.value, { stream: true });
            var parts = buf.split(/\n\n/);
            buf = parts.pop() || '';
            parts.forEach(function (chunk) {
              if (chunk.trim()) {
                parseSseEvents(chunk, {
                  progress: onProgress,
                  done: onDone,
                  error: function (j) { finishErr((j && j.error) || 'extract_failed'); }
                });
              }
            });
            return pump();
          });
        }
        return pump();
      }).catch(function (e) {
        if (aborted) return;
        finishErr((e && e.message) ? e.message : 'extract_failed');
      });

      return {
        abort: function () {
          aborted = true;
          if (ctrl) try { ctrl.abort(); } catch (e) {}
        }
      };
    },
    chatStream: function (payload, opts) {
      opts = opts || {};
      var onToken = opts.onToken || function () {};
      var onReasoning = opts.onReasoning || function () {};
      var onSources = opts.onSources || function () {};
      var onResearch = opts.onResearch || function () {};
      var onResearchProgress = opts.onResearchProgress || function () {};
      var onResearchSkeleton = opts.onResearchSkeleton || function () {};
      var onResearchReport = opts.onResearchReport || function () {};
      var onWidgets = opts.onWidgets || function () {};
      var onMemory = opts.onMemory || function () {};
      var onAgent = opts.onAgent || function () {};
      var onStatus = opts.onStatus || function () {};
      var onImagePending = opts.onImagePending || function () {};
      var onImageFailed = opts.onImageFailed || function () {};
      var onDone = opts.onDone || function () {};
      var onError = opts.onError || function () {};
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var jobId = '';
      try {
        jobId = (crypto.randomUUID ? crypto.randomUUID() : '').replace(/-/g, '');
      } catch (e) { jobId = ''; }
      if (!jobId || jobId.length < 16) {
        jobId = '';
        for (var i = 0; i < 32; i++) jobId += Math.floor(Math.random() * 16).toString(16);
      }
      payload = Object.assign({}, payload, { job_id: jobId });
      var seen = 0;
      var evSeen = 0;
      var finished = false;
      var pollFail = 0;
      var streamHandlers = {
        onToken: function (piece) { deliverLive(piece); },
        onReasoning: onReasoning,
        onReplace: opts.onReplace || function () {},
        onSources: onSources,
        onResearch: onResearch,
        onResearchProgress: onResearchProgress,
        onResearchSkeleton: onResearchSkeleton,
        onResearchReport: onResearchReport,
        onWidgets: onWidgets,
        onMemory: onMemory,
        onAgent: onAgent,
        onStatus: onStatus,
        onImagePending: onImagePending,
        onImageFailed: onImageFailed,
        onError: onError
      };

      function finish(meta) {
        if (finished) return;
        finished = true;
        stopPollLoop();
        // Страховка от обрезанного прокси-буфером SSE: журнал знает текст
        // целиком. Дописываем хвост, которого не хватает на экране.
        if (contentSource === 'live' && pollText.length > liveText.length
            && pollText.slice(0, liveText.length) === liveText) {
          applyContent(pollText.slice(liveText.length));
          liveText = pollText;
        }
        flushPollPending();
        onDone(meta || {});
      }

      // Два канала доставки одного и того же текста: живой SSE и журнал
      // (stream_poll). На shared-хостинге прокси иногда склеивает SSE в один
      // пакет — тогда текст идёт из журнала. Побеждает тот, кто первым принёс
      // контент; второй дублировать не может. Статусы/события/финал всегда
      // берём из журнала — он же и завершает ход.
      var contentSource = null;
      var pollRunning = false;
      var pollPending = '';
      var pollText = '';
      var liveText = '';
      var pollGraceUntil = Date.now() + 120;
      var metaSent = false;

      function applyContent(piece) {
        if (!piece) return;
        if (opts.onToken) opts.onToken(piece);
      }

      function deliverLive(piece) {
        if (!piece) return;
        liveText += piece;
        if (contentSource === 'poll') return;
        if (!contentSource) {
          contentSource = 'live';
          pollPending = '';
          // SSE работает — снимаем параллельный опрос, чтобы не занимать
          // второй php-cgi слот на shared-хостинге.
          stopPollLoop();
        }
        applyContent(piece);
      }

      function deliverPoll(delta) {
        if (!delta) return;
        pollText += delta;
        if (contentSource === 'live') return;
        if (contentSource === 'poll') {
          applyContent(delta);
          return;
        }
        // Канал ещё не выбран: копим и ждём ~0.12 c. Если живой SSE успеет —
        // он и выиграет, без задержки на опрос.
        pollPending += delta;
        if (Date.now() >= pollGraceUntil) flushPollPending();
        else setTimeout(flushPollPending, Math.max(0, pollGraceUntil - Date.now()) + 5);
      }

      function flushPollPending() {
        if (finished || contentSource || !pollPending) return;
        contentSource = 'poll';
        var out = pollPending;
        pollPending = '';
        applyContent(out);
      }

      function applyPoll(j) {
        if (!j || finished) return;
        var delta = typeof j.delta === 'string' ? j.delta : '';
        if (delta) deliverPoll(delta);
        if (typeof j.n === 'number' && j.n > seen) seen = j.n;
        var evs = j.events || [];
        evs.forEach(function (ev) {
          if (!ev || !ev.event) return;
          if (ev.event === 'meta') {
            if (!metaSent && ev.data && ev.data.conversation_id && opts.onMeta) {
              metaSent = true;
              opts.onMeta({ conversation_id: parseInt(ev.data.conversation_id, 10), model_key: ev.data.model_key });
            }
            return;
          }
          parseSseStreamChunk('event: ' + ev.event + '\ndata: ' + JSON.stringify(ev.data || {}) + '\n\n', streamHandlers);
        });
        evSeen = typeof j.event_count === 'number' ? j.event_count : evSeen + evs.length;
        if (j.status === 'error') {
          streamHandlers._streamErrored = true;
          onError(j.error || 'error');
          finish();
          return true;
        }
        if (j.status === 'done') {
          finish();
          return true;
        }
        return false;
      }

      // Длинный опрос: один запрос ждёт до 700 мс появления новых байтов.
      // Так текст приходит почти мгновенно и без нагрузки из сотен запросов в секунду.
      function tickPoll() {
        if (finished || !pollRunning) return;
        fetch(API_BASE + 'stream_poll.php?id=' + encodeURIComponent(jobId) + '&n=' + seen + '&e=' + evSeen + '&wait=700', {
          credentials: 'same-origin',
          cache: 'no-store'
        }).then(function (r) { return r.json(); }).then(function (j) {
          pollFail = 0;
          if (applyPoll(j)) return;
          if (pollRunning) setTimeout(tickPoll, 15);
        }).catch(function () {
          pollFail += 1;
          if (pollFail > 12) { finish(); return; }
          if (pollRunning) setTimeout(tickPoll, 350);
        });
      }

      function startPollLoop() {
        if (pollRunning || finished) return;
        pollRunning = true;
        setTimeout(tickPoll, 10);
      }

      function stopPollLoop() {
        pollRunning = false;
      }

      // Страховка: тело SSE закрылось, а статус в журнале всё ещё running
      // (например, шатдаун-хук не успел записать done) — не подвешиваем UI.
      var streamEnded = false;
      function onStreamEnded() {
        if (streamEnded) return;
        streamEnded = true;
        setTimeout(function () {
          if (finished) return;
          flushPollPending();
          finish();
        }, 600);
      }

      startPollLoop();

      fetch(API_BASE + 'stream.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            var msg = 'HTTP ' + r.status;
            try { var j = JSON.parse(t); if (j.error) msg = sanitizePublicError(j.error); } catch (e) {}
            throw new Error(msg);
          });
        }
        var conv = r.headers.get('X-Conversation-Id');
        var local = r.headers.get('X-Guest-Local-Id');
        var modelKey = r.headers.get('X-Model-Key');
        var modelFallbackFrom = r.headers.get('X-Model-Fallback-From');
        var metaPayload = {};
        if (conv) metaPayload.conversation_id = parseInt(conv, 10);
        if (local) metaPayload.local_id = local;
        if (modelKey) metaPayload.model_key = modelKey;
        if (modelFallbackFrom) metaPayload.model_fallback_from = modelFallbackFrom;
        if (Object.keys(metaPayload).length && opts.onMeta) opts.onMeta(metaPayload);

        var ctype = (r.headers.get('content-type') || '').toLowerCase();
        if (ctype.indexOf('json') !== -1) {
          return r.json().then(function (j) { throw new Error(sanitizePublicError(j.error || 'Ошибка')); });
        }
        // Без стриминга в браузере — ответ приходит целиком, контент есть в теле.
        function consumeRaw(text) {
          if (!text) return;
          parseSseStreamChunk(text, streamHandlers);
        }
        if (!r.body || !window.ReadableStream) {
          return r.text().then(function (t) { consumeRaw(t); onStreamEnded(); });
        }
        var reader = r.body.getReader();
        var dec = new TextDecoder();
        var buf = '';
        function handleEventChunk(block) {
          if (!block.trim()) return;
          // Тело может быть сырым апстримом (без "event:") — парсер это переварит.
          parseSseStreamChunk(block + '\n\n', streamHandlers);
        }
        function pump() {
          return reader.read().then(function (res) {
            if (res.done) {
              if (buf) handleEventChunk(buf);
              buf = '';
              onStreamEnded();
              return;
            }
            buf += dec.decode(res.value, { stream: true });
            var idx;
            while ((idx = buf.indexOf('\n\n')) !== -1) {
              var block = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              handleEventChunk(block);
            }
            return pump();
          });
        }
        return pump();
      }).catch(function (e) {
        if (e && e.name === 'AbortError') {
          finish({ aborted: true });
          return;
        }
        if (!finished) onError((e && e.message) ? e.message : 'Ошибка соединения');
        finish();
      });

      return { abort: function () { try { ctrl && ctrl.abort(); } catch (e) {} finish({ aborted: true }); } };
    },
    chatAction: function (body) {
      return fetch(API_BASE + 'chat.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      }).then(function (r) { return r.json(); });
    },
    linkPreview: function (url) {
      var q = new URLSearchParams({ url: url }).toString();
      return fetch(API_BASE + 'link_preview.php?' + q, { credentials: 'same-origin' }).then(function (r) { return r.json(); });
    },
    entityEnrich: function (queries, lang) {
      return fetch(API_BASE + 'entity_enrich.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: queries || [], lang: lang || 'ru' })
      }).then(function (r) { return r.json(); });
    },
    updateProfile: function (body) {
      return fetch(API_BASE + 'profile.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      }).then(function (r) { return r.json(); });
    },
    uploadAvatar: function (file) {
      var fd = new FormData();
      fd.append('avatar', file);
      return fetch(API_BASE + 'avatar.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd
      }).then(function (r) { return r.json(); });
    }
  };

  var Scrollbars = {
    _timers: typeof WeakMap !== 'undefined' ? new WeakMap() : null,
    _bound: typeof WeakSet !== 'undefined' ? new WeakSet() : null,
    _mo: null,
    SELECTOR: [
      '.acx-scroll',
      '.c-profile-modal-scroll',
      '.c-rpanel-scroll',
      '.c-think-body',
      '.c-modelsel-pop',
      '.c-agent-console',
      '.c-visual-rail',
      '.acx-code-body'
    ].join(','),

    init: function (root) {
      var scope = root || document;
      var nodes = scope.querySelectorAll ? scope.querySelectorAll(this.SELECTOR) : [];
      for (var i = 0; i < nodes.length; i++) this.bind(nodes[i]);
      if (!this._mo && typeof MutationObserver !== 'undefined' && !root) {
        var self = this;
        this._mo = new MutationObserver(function (mutations) {
          for (var m = 0; m < mutations.length; m++) {
            var nodesAdd = mutations[m].addedNodes;
            for (var n = 0; n < nodesAdd.length; n++) {
              var node = nodesAdd[n];
              if (!node || node.nodeType !== 1) continue;
              if (node.matches && node.matches(self.SELECTOR)) self.bind(node);
              if (node.querySelectorAll) {
                var nested = node.querySelectorAll(self.SELECTOR);
                for (var j = 0; j < nested.length; j++) self.bind(nested[j]);
              }
            }
          }
        });
        this._mo.observe(document.documentElement, { childList: true, subtree: true });
      }
    },

    bind: function (el) {
      if (!el || el.nodeType !== 1) return;
      if (!el.classList.contains('acx-scroll')) el.classList.add('acx-scroll');
      if (this._bound && this._bound.has(el)) {
        this.refresh(el);
        return;
      }
      if (this._bound) this._bound.add(el);
      var self = this;
      el.addEventListener('scroll', function () { self.onScroll(el); }, { passive: true });
      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function () { self.refresh(el); });
        ro.observe(el);
        if (el.firstElementChild) ro.observe(el.firstElementChild);
        el._acxScrollRo = ro;
      }
      this.refresh(el);
    },

    refresh: function (el) {
      if (!el) return;
      var y = el.scrollHeight > el.clientHeight + 2;
      var x = el.scrollWidth > el.clientWidth + 2;
      el.classList.toggle('has-scroll-y', y);
      el.classList.toggle('has-scroll-x', x);
      el.classList.toggle('has-scroll', y || x);
    },

    onScroll: function (el) {
      el.classList.add('is-scrolling');
      if (this._timers) {
        var prev = this._timers.get(el);
        if (prev) clearTimeout(prev);
        var self = this;
        this._timers.set(el, setTimeout(function () {
          el.classList.remove('is-scrolling');
          self._timers.delete(el);
        }, 900));
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Scrollbars.init(); });
  } else {
    Scrollbars.init();
  }

  window.ACX = {
    Theme: Theme,
    Scrollbars: Scrollbars,
    icon: icon,
    esc: esc,
    sanitizePublicError: sanitizePublicError,
    stripCjkLeaks: stripCjkLeaks,
    renderMarkdown: renderMarkdown,
    imgProxy: imgProxy,
    streamWaitHtml: streamWaitHtml,
    setStreamWaitStatus: setStreamWaitStatus,
    mountPendingImage: mountPendingImage,
    clearPendingImages: clearPendingImages,
    sweepDuplicateCanvasImages: sweepDuplicateCanvasImages,
    settleCanvasImage: settleCanvasImage,
    bindImageTools: bindImageTools,
    syncStreamMarkdown: syncStreamMarkdown,
    finishStreamMarkdown: finishStreamMarkdown,
    revealMarkdown: revealMarkdown,
    enhanceMarkdown: enhanceMarkdown,
    relocalizeCodeCopyButtons: relocalizeCodeCopyButtons,
    getMarkdownPlainText: getMarkdownPlainText,
    parseSseStreamChunk: parseSseStreamChunk,
    API: API,
    MODES: [
      { key: 'chat', label: 'Чат', desc: 'Обычный диалог', icon: 'chat' },
      { key: 'web', label: 'Веб', desc: 'Поиск в интернете', icon: 'globe' },
      { key: 'documents', label: 'Документы', desc: 'Анализ PDF и файлов', icon: 'file' },
      { key: 'image', label: 'Изображение', desc: 'OCR и решение задач', icon: 'image' },
      { key: 'research', label: 'Исследование', desc: 'Развёрнутый отчёт', icon: 'research' },
      { key: 'reasoning', label: 'Рассуждение', desc: 'Мысли модели и ответ', icon: 'lightbulb' }
    ],
    MODEL_META: MODEL_META,
    modelClass: modelClass,
    modelMeta: modelMeta,
    modelBall: modelBall
  };
})();
