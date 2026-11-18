/**
 * Inject profile-footer Update button + poll/apply + badges + critical modal
 * into beam/dsh web frontend copies.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const HTML_TARGETS = [
  path.join(ROOT, 'runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html'),
  path.join(ROOT, 'runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html'),
  path.join(ROOT, 'dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html'),
  path.join(ROOT, 'dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html'),
  'C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html',
  'C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html',
]

const CSS_TARGETS = [
  path.join(ROOT, 'runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css'),
  path.join(ROOT, 'runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css'),
  path.join(ROOT, 'dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css'),
  path.join(ROOT, 'dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css'),
  'C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css',
  'C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css',
]

const CSS_BLOCK = `
/* ===== BEAM UPDATE BUTTON (profile foot) ===== */
#beam-side-limits .bsl-update {
  flex: none;
  display: none;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 0;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 179, 188, 0.45);
  background: rgba(0, 179, 188, 0.12);
  color: #b7f3ef;
  font: 600 11px/1 "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.01em;
  cursor: pointer;
  white-space: nowrap;
}
#beam-side-limits .bsl-update.is-visible { display: inline-flex; }
#beam-side-limits .bsl-update:hover {
  background: rgba(0, 179, 188, 0.22);
  border-color: rgba(0, 179, 188, 0.7);
  color: #e7fffc;
}
#beam-side-limits .bsl-update.is-busy {
  opacity: 0.75;
  pointer-events: none;
}
#beam-side-limits .bsl-update.is-error {
  border-color: rgba(220, 90, 90, 0.55);
  background: rgba(220, 90, 90, 0.12);
  color: #ffd0d0;
}
#beam-side-limits .bsl-update.is-critical {
  border-color: rgba(230, 96, 96, 0.6);
  background: rgba(230, 96, 96, 0.16);
  color: #ffd8d8;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-update {
  color: #0b6f73;
  background: rgba(0, 179, 188, 0.1);
  border-color: rgba(0, 140, 150, 0.35);
}

/* ===== BEAM CRITICAL UPDATE MODAL ===== */
#beam-critical-update {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(4, 12, 12, 0.72);
  backdrop-filter: blur(8px);
}
#beam-critical-update.is-open { display: flex; }
#beam-critical-update .bcu-card {
  width: min(440px, 100%);
  border-radius: 16px;
  border: 1px solid rgba(230, 96, 96, 0.45);
  background: linear-gradient(180deg, rgba(28, 18, 18, 0.98), rgba(12, 16, 16, 0.98));
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  padding: 22px 22px 18px;
  color: #f3efef;
}
#beam-critical-update .bcu-kicker {
  font: 700 11px/1.2 "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ff9d9d;
  margin-bottom: 10px;
}
#beam-critical-update .bcu-title {
  margin: 0 0 8px;
  font: 700 20px/1.25 "Segoe UI", system-ui, sans-serif;
}
#beam-critical-update .bcu-body {
  margin: 0 0 14px;
  font: 400 14px/1.5 "Segoe UI", system-ui, sans-serif;
  color: rgba(240, 220, 220, 0.86);
}
#beam-critical-update .bcu-meta {
  margin: 0 0 16px;
  font: 500 12px/1.4 "Segoe UI", system-ui, sans-serif;
  color: rgba(255, 200, 200, 0.78);
}
#beam-critical-update .bcu-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
#beam-critical-update .bcu-btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid rgba(230, 96, 96, 0.55);
  background: rgba(230, 96, 96, 0.2);
  color: #ffe0e0;
  font: 600 14px/1 "Segoe UI", system-ui, sans-serif;
  cursor: pointer;
}
#beam-critical-update .bcu-btn:disabled {
  opacity: 0.65;
  cursor: default;
}
#beam-critical-update .bcu-btn-secondary {
  border-color: rgba(180, 180, 180, 0.28);
  background: transparent;
  color: rgba(235, 230, 230, 0.88);
}
body.beam-critical-lock #root,
body.beam-critical-lock [data-beam-shell],
body.beam-critical-lock .app {
  pointer-events: none !important;
  user-select: none !important;
  filter: grayscale(0.15) brightness(0.72);
}
body.beam-critical-lock #beam-critical-update,
body.beam-critical-lock #beam-critical-update * {
  pointer-events: auto !important;
  filter: none !important;
  user-select: text !important;
}
`

const UPDATE_HELPERS = `
  /* beam-desktop-update-channel */
  let __beamUpdateInfo = null;
  let __beamUpdateBusy = false;
  let __beamUpdateError = "";
  let __beamUpdateCritical = false;
  const beamLocalVersion = async () => {
    try {
      const st = await window.dshDesktop?.updates?.status?.();
      if (st?.version) return String(st.version);
    } catch {}
    try {
      const r = await fetch(BRIDGE + "/assistix/update/status", { cache: "no-store" });
      const j = await r.json();
      if (j?.localVersion) return String(j.localVersion);
    } catch {}
    return "";
  };
  const ensureCriticalModal = () => {
    let el = document.getElementById("beam-critical-update");
    if (el) return el;
    el = document.createElement("div");
    el.id = "beam-critical-update";
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = '<div class="bcu-card">'
      + '<div class="bcu-kicker" data-bcu="kicker"></div>'
      + '<h2 class="bcu-title" data-bcu="title"></h2>'
      + '<p class="bcu-body" data-bcu="body"></p>'
      + '<p class="bcu-meta" data-bcu="meta"></p>'
      + '<div class="bcu-actions">'
      + '<button type="button" class="bcu-btn bcu-btn-secondary" data-bcu="about"></button>'
      + '<button type="button" class="bcu-btn" data-bcu="update"></button>'
      + '</div></div>';
    document.documentElement.appendChild(el);
    el.addEventListener("click", (ev) => {
      // Soft-block: ignore backdrop clicks; modal stays until updated.
      if (ev.target === el) ev.stopPropagation();
    });
    el.querySelector('[data-bcu="update"]')?.addEventListener("click", (ev) => {
      ev.preventDefault();
      applyBeamUpdate();
    });
    el.querySelector('[data-bcu="about"]')?.addEventListener("click", (ev) => {
      ev.preventDefault();
      try { openAppSettings?.("about"); } catch {}
      try {
        window.dispatchEvent(new CustomEvent("beam:open-settings", { detail: { section: "about" } }));
      } catch {}
    });
    document.addEventListener("keydown", (ev) => {
      if (!__beamUpdateCritical) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
    return el;
  };
  const syncUpdateBadges = () => {
    const show = !!(__beamUpdateInfo && __beamUpdateInfo.updateAvailable);
    const critical = !!__beamUpdateCritical;
    const mark = (host) => {
      if (!host) return;
      host.style.position = host.style.position || "relative";
      let badge = host.querySelector(":scope > .beam-update-badge");
      if (!show) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "beam-update-badge";
        badge.setAttribute("aria-hidden", "true");
        host.appendChild(badge);
      }
      badge.classList.toggle("is-critical", critical);
    };
    mark(document.querySelector('#beam-side-limits [data-act="settings"], #beam-side-limits .bsl-gear, #beam-side-limits button[title*="Settings"], #beam-side-limits button[title*="Настройки"]'));
    for (const host of document.querySelectorAll('[class*="navList"] button[data-beam-icon="about"], [role="dialog"] [class*="navList"] button:nth-child(4)')) {
      mark(host);
    }
  };
  const renderCriticalModal = () => {
    const el = ensureCriticalModal();
    const ru = isRu();
    const open = !!__beamUpdateCritical && !!(__beamUpdateInfo && __beamUpdateInfo.updateAvailable);
    el.classList.toggle("is-open", open);
    document.body.classList.toggle("beam-critical-lock", open);
    if (!open) return;
    const ver = __beamUpdateInfo?.version || "";
    el.querySelector('[data-bcu="kicker"]').textContent = ru ? "Критическое обновление" : "Critical update";
    el.querySelector('[data-bcu="title"]').textContent = ru ? "Требуется обновление" : "Update required";
    el.querySelector('[data-bcu="body"]').textContent = ru
      ? "Это обязательное обновление безопасности. Beam Agent будет заблокирован, пока вы не установите новую версию."
      : "This is a mandatory security update. Beam Agent stays locked until you install the new version.";
    el.querySelector('[data-bcu="meta"]').textContent = ver
      ? ((ru ? "Новая версия: " : "New version: ") + ver)
      : "";
    el.querySelector('[data-bcu="about"]').textContent = ru ? "О приложении" : "About";
    el.querySelector('[data-bcu="update"]').textContent = __beamUpdateBusy
      ? (ru ? "Обновление…" : "Updating…")
      : (ru ? ("Обновить" + (ver ? (" до " + ver) : "")) : ("Update" + (ver ? (" to " + ver) : "")));
    el.querySelector('[data-bcu="update"]').disabled = !!__beamUpdateBusy;
  };
  const refreshBeamUpdate = async () => {
    try {
      const local = await beamLocalVersion();
      let info = null;
      try {
        const r = await fetch(BRIDGE + "/assistix/update/check", { cache: "no-store" });
        info = await r.json();
      } catch {
        const q = local ? ("?current=" + encodeURIComponent(local)) : "?current=0.0.0";
        const r = await fetch("https://agent.assistix.org/api/check-update.php" + q, { cache: "no-store" });
        info = await r.json();
        if (info && local) info.localVersion = local;
      }
      if (!info?.ok) {
        __beamUpdateInfo = null;
        __beamUpdateCritical = false;
        renderCriticalModal();
        syncUpdateBadges();
        return null;
      }
      const available = !!info.updateAvailable;
      __beamUpdateInfo = available ? info : null;
      __beamUpdateCritical = !!(available && (info.critical || info.mandatory));
      __beamUpdateError = "";
      try {
        window.__beamUpdateInfo = __beamUpdateInfo;
        window.__beamUpdateCritical = __beamUpdateCritical;
        window.dispatchEvent(new CustomEvent("beam:update-checked", { detail: info }));
      } catch {}
      renderCriticalModal();
      syncUpdateBadges();
      return __beamUpdateInfo;
    } catch (e) {
      __beamUpdateError = String(e?.message || e);
      return null;
    }
  };
  const applyBeamUpdate = async () => {
    if (__beamUpdateBusy) return;
    __beamUpdateBusy = true;
    __beamUpdateError = "";
    renderCriticalModal();
    try { if (lastData) renderSide(lastData); } catch {}
    try {
      // Prefer bridge apply path (download + sha512 + silent install)
      let applied = false;
      try {
        const r = await fetch(BRIDGE + "/assistix/update/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "profile-button" }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j?.ok === false) throw new Error(j?.error || "update_failed");
        applied = true;
      } catch (bridgeErr) {
        if (window.dshDesktop?.updates?.open) {
          await window.dshDesktop.updates.open();
          applied = true;
        } else {
          throw bridgeErr;
        }
      }
      if (!applied) throw new Error("update_failed");
    } catch (e) {
      __beamUpdateError = String(e?.message || e);
      try { alert((isRu() ? "Ошибка обновления: " : "Update failed: ") + __beamUpdateError); } catch {}
    } finally {
      __beamUpdateBusy = false;
      try { await refreshBeamUpdate(); } catch {}
      try { if (lastData) renderSide(lastData); } catch {}
      renderCriticalModal();
      syncUpdateBadges();
    }
  };
  window.addEventListener("beam:update-checked", (ev) => {
    const info = ev?.detail;
    if (!info) return;
    const available = !!info.updateAvailable;
    __beamUpdateInfo = available ? info : null;
    __beamUpdateCritical = !!(available && (info.critical || info.mandatory));
    renderCriticalModal();
    syncUpdateBadges();
    try { if (lastData) renderSide(lastData); } catch {}
  });
  setTimeout(() => { refreshBeamUpdate().then(() => { try { if (lastData) renderSide(lastData); } catch {} }); }, 2500);
  setInterval(() => { refreshBeamUpdate().then(() => { try { if (lastData) renderSide(lastData); } catch {} }); }, 15 * 60 * 1000);
  setInterval(syncUpdateBadges, 4000);
`

function patchHtml(file) {
  if (!fs.existsSync(file)) {
    console.warn('skip missing', file)
    return false
  }
  let src = fs.readFileSync(file, 'utf8')
  let changed = false

  if (!src.includes('updateBtn:')) {
    src = src.replace(
      'builtWith: "Build with Beam",\n    },',
      'builtWith: "Build with Beam",\n      updateBtn: "Update",\n      updateBusy: "Updating…",\n      updateError: "Update failed",\n    },',
    )
    src = src.replace(
      'builtWith: "Собрано в Beam",',
      'builtWith: "Собрано в Beam",\n      updateBtn: "Обновить",\n      updateBusy: "Обновление…",\n      updateError: "Ошибка обновления",',
    )
    changed = true
  }

  // Refresh helpers block when marker exists (idempotent replace)
  if (src.includes('beam-desktop-update-channel')) {
    const re = /\/\* beam-desktop-update-channel \*\/[\s\S]*?setInterval\(\(\) => \{ refreshBeamUpdate\(\)\.then\(\(\) => \{ try \{ if \(lastData\) renderSide\(lastData\); \} catch \{\} \}\); \}, 15 \* 60 \* 1000\);/
    if (re.test(src)) {
      src = src.replace(re, UPDATE_HELPERS.trim())
      changed = true
    } else {
      // Broader replace from marker through next known anchor
      const start = src.indexOf('/* beam-desktop-update-channel */')
      const end = src.indexOf('const openLimitsModal = () => {', start)
      if (start >= 0 && end > start) {
        src = src.slice(0, start) + UPDATE_HELPERS.trim() + '\n  ' + src.slice(end)
        changed = true
      }
    }
  } else {
    const anchor = '  const openLimitsModal = () => {'
    if (!src.includes(anchor)) {
      console.warn('no openLimitsModal anchor', file)
    } else {
      src = src.replace(anchor, UPDATE_HELPERS + '\n' + anchor)
      changed = true
    }
  }

  // Insert Update button between profile and gear
  const oldFoot = 'const html = ringsBtn+\'<div class="bsl-foot-row">\'+profile+gear+\'</div>\';'
  const newFoot = `const updateLbl = __beamUpdateBusy ? (tr.updateBusy || (isRu() ? "Обновление…" : "Updating…")) : (tr.updateBtn || (isRu() ? "Обновить" : "Update"));
    const updateTitle = (__beamUpdateInfo && __beamUpdateInfo.version)
      ? ((isRu() ? "Обновить до " : "Update to ") + __beamUpdateInfo.version)
      : updateLbl;
    const updateBtn = (__beamUpdateInfo || __beamUpdateBusy)
      ? ('<button type="button" class="bsl-update is-visible'+(__beamUpdateBusy ? ' is-busy' : '')+(__beamUpdateError ? ' is-error' : '')+(__beamUpdateCritical ? ' is-critical' : '')+'" data-act="update" title="'+String(updateTitle).replace(/"/g,'&quot;')+'">'+String(updateLbl).replace(/</g,'')+'</button>')
      : '';
    const html = ringsBtn+'<div class="bsl-foot-row">'+profile+updateBtn+gear+'</div>';`
  if (src.includes(oldFoot)) {
    src = src.replace(oldFoot, newFoot)
    changed = true
  } else if (src.includes('data-act="update"') && !src.includes('__beamUpdateCritical ? \' is-critical\'')) {
    // Refresh existing foot snippet critical class
    src = src.replace(
      /const updateBtn = \(__beamUpdateInfo \|\| __beamUpdateBusy\)\s*\n\s*\? \('<button type="button" class="bsl-update is-visible'\+\(__beamUpdateBusy \? ' is-busy' : ''\)\+\(__beamUpdateError \? ' is-error' : ''\)\+'" data-act="update"/,
      'const updateBtn = (__beamUpdateInfo || __beamUpdateBusy)\n      ? (\'<button type="button" class="bsl-update is-visible\'+(__beamUpdateBusy ? \' is-busy\' : \'\')+(__beamUpdateError ? \' is-error\' : \'\')+(__beamUpdateCritical ? \' is-critical\' : \'\')+\'" data-act="update"',
    )
    changed = true
  } else if (!src.includes('data-act="update"')) {
    console.warn('foot row pattern missing', file)
  }

  // Bind click for update
  if (!src.includes("querySelector('[data-act=\"update\"]')")) {
    const gearBind = `el.querySelector('[data-act="settings"]')?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      closeBeamDialogs();
      openAppSettings();
    });`
    const withUpdate = `el.querySelector('[data-act="update"]')?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      applyBeamUpdate();
    });
    ` + gearBind
    if (src.includes(gearBind) && !src.includes('applyBeamUpdate();')) {
      src = src.replace(gearBind, withUpdate)
      changed = true
    }
  }

  // Bust lastSideHtml cache when update visibility changes
  if (!src.includes('__beamUpdateCritical') && src.includes('if (html === lastSideHtml && el.dataset.bound === "1")')) {
    src = src.replace(
      'if (html === lastSideHtml && el.dataset.bound === "1") {',
      'const sideKey = html + "|" + (__beamUpdateInfo?.version || "") + "|" + (__beamUpdateBusy ? "1" : "0") + "|" + (__beamUpdateCritical ? "c" : "");\n    if (sideKey === lastSideHtml && el.dataset.bound === "1") {',
    )
    src = src.replace('lastSideHtml = html;', 'lastSideHtml = sideKey;')
    changed = true
  } else if (src.includes('__beamUpdateInfo?.version || ""') && !src.includes('__beamUpdateCritical ? "c"')) {
    src = src.replace(
      'const sideKey = html + "|" + (__beamUpdateInfo?.version || "") + "|" + (__beamUpdateBusy ? "1" : "0");',
      'const sideKey = html + "|" + (__beamUpdateInfo?.version || "") + "|" + (__beamUpdateBusy ? "1" : "0") + "|" + (__beamUpdateCritical ? "c" : "");',
    )
    changed = true
  }

  if (changed) {
    fs.writeFileSync(file, src)
    console.log('✓ html', path.relative(ROOT, file).replace(/\\/g, '/') || file)
  } else {
    console.log('· html ok', file)
  }
  return changed
}

function patchCss(file) {
  if (!fs.existsSync(file)) {
    console.warn('skip missing css', file)
    return false
  }
  let src = fs.readFileSync(file, 'utf8')
  const marker = '/* ===== BEAM UPDATE BUTTON (profile foot) ===== */'
  if (src.includes(marker)) {
    const start = src.indexOf(marker)
    const next = src.indexOf('\n/* =====', start + marker.length)
    src = src.slice(0, start) + CSS_BLOCK.trim() + '\n' + (next > start ? src.slice(next).replace(/^\n+/, '') : '')
  } else {
    src = src.trimEnd() + '\n' + CSS_BLOCK + '\n'
  }
  fs.writeFileSync(file, src)
  console.log('✓ css', path.relative(ROOT, file).replace(/\\/g, '/') || file)
  return true
}

let n = 0
for (const f of HTML_TARGETS) if (patchHtml(f)) n++
for (const f of CSS_TARGETS) if (patchCss(f)) n++
console.log('patched', n, 'files')
