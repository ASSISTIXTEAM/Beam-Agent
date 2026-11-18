/**
 * Inject profile-footer Update button + poll/apply logic into beam/dsh web frontend copies.
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
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-update {
  color: #0b6f73;
  background: rgba(0, 179, 188, 0.1);
  border-color: rgba(0, 140, 150, 0.35);
}
`

const UPDATE_HELPERS = `
  /* beam-desktop-update-channel */
  let __beamUpdateInfo = null;
  let __beamUpdateBusy = false;
  let __beamUpdateError = "";
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
        return null;
      }
      const available = !!info.updateAvailable;
      __beamUpdateInfo = available ? info : null;
      __beamUpdateError = "";
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
    try {
      // Prefer Electron IPC updater (hash verify + Inno apply + task-safe restart)
      if (window.dshDesktop?.updates?.open) {
        await window.dshDesktop.updates.open();
        return;
      }
      const r = await fetch(BRIDGE + "/assistix/update/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "profile-button" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.error || "update_failed");
    } catch (e) {
      __beamUpdateError = String(e?.message || e);
      try { alert((isRu() ? "Ошибка обновления: " : "Update failed: ") + __beamUpdateError); } catch {}
    } finally {
      __beamUpdateBusy = false;
      try { await refreshBeamUpdate(); } catch {}
      try { if (lastData) renderSide(lastData); } catch {}
    }
  };
  setTimeout(() => { refreshBeamUpdate().then(() => { try { if (lastData) renderSide(lastData); } catch {} }); }, 2500);
  setInterval(() => { refreshBeamUpdate().then(() => { try { if (lastData) renderSide(lastData); } catch {} }); }, 15 * 60 * 1000);
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

  if (!src.includes('beam-desktop-update-channel')) {
    const anchor = '  const openLimitsModal = () => {'
    if (!src.includes(anchor)) {
      console.warn('no openLimitsModal anchor', file)
    } else {
      src = src.replace(anchor, UPDATE_HELPERS + '\n' + anchor)
      changed = true
    }
  }

  // Insert Update button between profile and gear
  const oldFoot = "const html = ringsBtn+'<div class=\"bsl-foot-row\">'+profile+gear+'</div>';"
  const newFoot = `const updateLbl = __beamUpdateBusy ? (tr.updateBusy || (isRu() ? "Обновление…" : "Updating…")) : (tr.updateBtn || (isRu() ? "Обновить" : "Update"));
    const updateTitle = (__beamUpdateInfo && __beamUpdateInfo.version)
      ? ((isRu() ? "Обновить до " : "Update to ") + __beamUpdateInfo.version)
      : updateLbl;
    const updateBtn = (__beamUpdateInfo || __beamUpdateBusy)
      ? ('<button type="button" class="bsl-update is-visible'+(__beamUpdateBusy ? ' is-busy' : '')+(__beamUpdateError ? ' is-error' : '')+'" data-act="update" title="'+String(updateTitle).replace(/"/g,'&quot;')+'">'+String(updateLbl).replace(/</g,'')+'</button>')
      : '';
    const html = ringsBtn+'<div class="bsl-foot-row">'+profile+updateBtn+gear+'</div>';`
  if (src.includes(oldFoot)) {
    src = src.replace(oldFoot, newFoot)
    changed = true
  } else if (!src.includes('data-act="update"')) {
    console.warn('foot row pattern missing', file)
  }

  // Bind click for update
  if (!src.includes('data-act="update"') || !src.includes("querySelector('[data-act=\"update\"]')")) {
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
  if (!src.includes('__beamUpdateInfo?.version || ""') && src.includes('if (html === lastSideHtml && el.dataset.bound === "1")')) {
    src = src.replace(
      'if (html === lastSideHtml && el.dataset.bound === "1") {',
      'const sideKey = html + "|" + (__beamUpdateInfo?.version || "") + "|" + (__beamUpdateBusy ? "1" : "0");\n    if (sideKey === lastSideHtml && el.dataset.bound === "1") {',
    )
    src = src.replace('lastSideHtml = html;', 'lastSideHtml = sideKey;')
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
  if (src.includes('BEAM UPDATE BUTTON')) {
    console.log('· css ok', file)
    return false
  }
  fs.writeFileSync(file, src.trimEnd() + '\n' + CSS_BLOCK + '\n')
  console.log('✓ css', path.relative(ROOT, file).replace(/\\/g, '/') || file)
  return true
}

let n = 0
for (const f of HTML_TARGETS) if (patchHtml(f)) n++
for (const f of CSS_TARGETS) if (patchCss(f)) n++
console.log('patched', n, 'files')
