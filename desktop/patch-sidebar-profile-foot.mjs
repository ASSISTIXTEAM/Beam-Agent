/**
 * Sidebar foot UX:
 * 1) Hide native AccountMenu «Ещё» / More above usage rings
 * 2) Profile plaque (avatar/name/email) — click → Profile window (account only)
 * 3) Gear → app Settings
 * 4) Usage rings → separate Limits window (Tide / Flare / Pine)
 *
 * Profile + Limits use native Beam dialog surfaces (same tokens as Settings chrome),
 * not a teal-bordered DIY card.
 *
 * Patches runtime + dist @assistix/beam-web-frontend (index.html injector + beam-override.css).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const ICONS_SRC = "C:/Users/Alexa/Downloads/icons";
const WEBS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
];

function recolorSvg(svg) {
  return svg
    .replace(/\sfill="(?!none)[^"]*"/gi, ' fill="currentColor"')
    .replace(/\sstroke="(?!none)[^"]*"/gi, ' stroke="currentColor"')
    .replace(/fill:(?!none)#[0-9a-fA-F]{3,8}/gi, "fill:currentColor")
    .replace(/stroke:(?!none)#[0-9a-fA-F]{3,8}/gi, "stroke:currentColor")
    .replace(/#374957/gi, "currentColor")
    .replace(/#000000|#000\b/gi, "currentColor");
}

/** Ensure settings gear lives under beam-icons (no runtime Downloads dependency). */
function ensureFootIcons(assetsDir) {
  const boldOut = path.join(assetsDir, "beam-icons", "bold");
  const fillOut = path.join(assetsDir, "beam-icons", "fill");
  fs.mkdirSync(boldOut, { recursive: true });
  fs.mkdirSync(fillOut, { recursive: true });
  const pairs = [
    ["bold/fi-br-settings.svg", path.join(boldOut, "settings.svg")],
    ["fill/fi-sr-settings.svg", path.join(fillOut, "settings.svg")],
  ];
  let n = 0;
  for (const [rel, dest] of pairs) {
    const src = path.join(ICONS_SRC, rel);
    if (!fs.existsSync(src)) continue;
    fs.writeFileSync(dest, recolorSvg(fs.readFileSync(src, "utf8")));
    n++;
  }
  return n;
}

const CSS_MARKER = "/* ===== BEAM sidebar profile foot ===== */";
const CSS_BLOCK = `${CSS_MARKER}
/* Hide native AccountMenu («Ещё» / More) — Beam foot owns profile + gear */
[class*="settingsArea"] ._5Qcc8a_root,
[class*="settingsArea"] button._5Qcc8a_trigger,
[class*="settingsArea"] button[aria-haspopup="menu"] {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  clip: rect(0 0 0 0) !important;
  border: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
/* Collapse empty launcher chrome so rings sit cleanly above profile row */
[class*="settingsArea"] [class*="triggerRow"] {
  min-height: 0 !important;
  margin: 0 !important;
  gap: 4px !important;
}
[class*="settingsArea"] [class*="triggerRow"] > ._5Qcc8a_root {
  flex: 0 !important;
  min-width: 0 !important;
  width: 0 !important;
  height: 0 !important;
}

/* Compact foot — avatar + name | gear (no email, no dual cards) */
#beam-side-limits {
  margin-bottom: 6px !important;
  padding: 2px 2px 4px !important;
  overflow: visible !important;
}
#beam-side-limits .bsl-foot-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  width: 100% !important;
  min-height: 44px !important;
  padding: 2px 2px 2px !important;
  box-sizing: border-box !important;
}
#beam-side-limits .bsl-profile {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 4px 4px !important;
  border-radius: 12px !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  color: inherit !important;
  text-align: left !important;
  cursor: pointer !important;
  font-family: inherit !important;
  transition: background 0.18s ease, opacity 0.18s ease !important;
}
#beam-side-limits .bsl-profile:hover,
#beam-side-limits .bsl-profile[aria-expanded="true"] {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 0 !important;
  box-shadow: none !important;
}
#beam-side-limits .bsl-profile.is-guest {
  background: transparent !important;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-profile {
  background: transparent !important;
  border: 0 !important;
  color: var(--beam-light-ink) !important;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-profile:hover,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-profile[aria-expanded="true"] {
  background: rgba(10, 36, 34, 0.05) !important;
}
#beam-side-limits .bsl-avatar {
  width: 36px !important;
  height: 36px !important;
  border-radius: 10px !important;
  overflow: hidden !important;
  flex-shrink: 0 !important;
  background: linear-gradient(145deg, #2a3a38, #1a2826 60%) !important;
  display: grid !important;
  place-items: center !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  color: #c5ddd9 !important;
  border: 0 !important;
}
#beam-side-limits .bsl-avatar.is-guest {
  background: var(--beam-elev-2, #1a2826) !important;
  color: var(--beam-muted) !important;
  border: 0 !important;
}
#beam-side-limits .bsl-avatar img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block !important;
  border-radius: 10px !important;
}
#beam-side-limits .bsl-usercol {
  flex: 1 !important;
  min-width: 0 !important;
  text-align: left !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 0 !important;
  justify-content: center !important;
}
#beam-side-limits .bsl-name {
  font-size: 14px !important;
  font-weight: 600 !important;
  line-height: 1.2 !important;
  letter-spacing: 0.01em !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  color: var(--beam-ink, #e8f7f5) !important;
}
/* Avatar + display name only — never show email in foot */
#beam-side-limits .bsl-email,
#beam-side-limits .bsl-usercol .bsl-email {
  display: none !important;
  height: 0 !important;
  width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
  opacity: 0 !important;
  font-size: 0 !important;
  line-height: 0 !important;
  max-height: 0 !important;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-name {
  color: var(--beam-light-ink) !important;
}
#beam-side-limits .bsl-logout,
#beam-side-limits .bsl-profile .bsl-logout {
  display: none !important;
}
#beam-side-limits .bsl-gear {
  flex: none !important;
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  border-radius: 10px !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--beam-muted, #8aa9a4) !important;
  display: grid !important;
  place-items: center !important;
  cursor: pointer !important;
  padding: 0 !important;
  transition: color 0.18s ease, background 0.18s ease !important;
}
#beam-side-limits .bsl-gear:hover,
#beam-side-limits .bsl-gear[aria-pressed="true"] {
  border: 0 !important;
  background: rgba(255, 255, 255, 0.05) !important;
  color: var(--beam-ink, #e8f7f5) !important;
  box-shadow: none !important;
}
#beam-side-limits .bsl-gear .bsl-gear-ico {
  width: 20px !important;
  height: 20px !important;
  display: block !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
}
#beam-side-limits .bsl-gear svg { display: none !important; }
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-gear {
  background: transparent !important;
  border: 0 !important;
  color: var(--beam-light-muted) !important;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-gear:hover,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-gear[aria-pressed="true"] {
  background: rgba(10, 36, 34, 0.06) !important;
  color: var(--beam-light-ink) !important;
}

/* Clickable weekly-limits control — ring + Tide/Flare/Pine label under EACH */
#beam-side-limits .bsl-rings {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: space-between !important;
  gap: 6px !important;
  width: 100% !important;
  height: auto !important;
  min-height: 72px !important;
  margin: 0 0 4px !important;
  padding: 10px 8px 10px !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  border-radius: 14px !important;
  background: rgba(255, 255, 255, 0.03) !important;
  color: inherit !important;
  cursor: pointer !important;
  font: inherit !important;
  overflow: visible !important;
  box-sizing: border-box !important;
  transition: border-color 0.2s, background 0.2s !important;
}
#beam-side-limits .bsl-rings:hover,
#beam-side-limits .bsl-rings[aria-expanded="true"] {
  border-color: rgba(255, 255, 255, 0.1) !important;
  background: rgba(255, 255, 255, 0.045) !important;
  box-shadow: none !important;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-rings {
  border-color: rgba(10, 36, 34, 0.08) !important;
  background: rgba(10, 36, 34, 0.04) !important;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-rings:hover,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-rings[aria-expanded="true"] {
  background: rgba(10, 36, 34, 0.06) !important;
}
#beam-side-limits .bsl-ring,
#beam-side-limits .bsl-rings .bsl-ring {
  flex: 1 1 0 !important;
  min-width: 0 !important;
  width: auto !important;
  height: auto !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  overflow: visible !important;
}
#beam-side-limits .bsl-chart {
  position: relative !important;
  width: 44px !important;
  height: 44px !important;
  flex: none !important;
}
#beam-side-limits .bsl-chart svg {
  width: 44px !important;
  height: 44px !important;
  display: block !important;
}
#beam-side-limits .bsl-pct {
  font-size: 10px !important;
}
/* Model names MUST stay visible under rings (Tide / Flare / Pine) */
#beam-side-limits .bsl-label,
#beam-side-limits .bsl-rings .bsl-label,
#beam-side-limits .bsl-ring > .bsl-label {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: static !important;
  width: auto !important;
  max-width: 100% !important;
  min-height: 14px !important;
  height: auto !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: 11px !important;
  font-weight: 650 !important;
  line-height: 1.2 !important;
  letter-spacing: 0.01em !important;
  color: #b7d0cb !important;
  text-align: center !important;
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
  pointer-events: none !important;
  clip: auto !important;
  clip-path: none !important;
  transform: none !important;
  font-family: "Savona", "Segoe UI", system-ui, sans-serif !important;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-label,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-rings .bsl-label,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-ring > .bsl-label {
  color: #3d5c57 !important;
}

/*
 * Profile + Limits dialogs — match Beam Settings chrome:
 * muted surface, soft hairline, no teal glow DIY card.
 */
#beam-profile-modal,
#beam-limits-modal {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: "Savona", "Segoe UI", system-ui, sans-serif;
  color: var(--beam-ink);
}
#beam-profile-modal[hidden],
#beam-limits-modal[hidden] { display: none !important; }
#beam-profile-modal .bpm-mask,
#beam-limits-modal .bpm-mask {
  position: absolute;
  inset: 0;
  background: rgba(2, 8, 7, 0.62);
  backdrop-filter: blur(6px);
}
#beam-profile-modal .bpm-panel,
#beam-limits-modal .bpm-panel {
  position: relative;
  width: min(420px, 100%);
  max-height: min(86vh, 720px);
  overflow: auto;
  border-radius: var(--dsw-radius-panel, 16px);
  border: 1px solid var(--beam-line);
  background: var(--dsw-alias-bg-layer-2, var(--beam-elev));
  color: var(--beam-ink);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.48);
  padding: 0;
}
#beam-limits-modal .bpm-panel {
  width: min(520px, 100%);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-profile-modal .bpm-panel,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-limits-modal .bpm-panel {
  background: var(--beam-light-surface);
  border-color: var(--beam-light-line);
  color: var(--beam-light-ink);
  box-shadow: 0 24px 64px rgba(10, 36, 34, 0.18);
}
#beam-profile-modal .bpm-top,
#beam-limits-modal .bpm-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 16px 10px;
  border-bottom: 1px solid var(--beam-line);
  min-height: 54px;
  box-sizing: border-box;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-profile-modal .bpm-top,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-limits-modal .bpm-top {
  border-bottom-color: var(--beam-light-line);
}
#beam-profile-modal .bpm-title,
#beam-limits-modal .bpm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: 0;
}
#beam-profile-modal .bpm-close,
#beam-limits-modal .bpm-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--beam-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: grid;
  place-items: center;
  flex: none;
}
#beam-profile-modal .bpm-close:hover,
#beam-limits-modal .bpm-close:hover {
  color: var(--beam-ink);
  background: var(--beam-elev);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-profile-modal .bpm-close:hover,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-limits-modal .bpm-close:hover {
  color: var(--beam-light-ink);
  background: var(--beam-light-elev-2);
}
#beam-profile-modal .bpm-body,
#beam-limits-modal .bpm-body {
  padding: 16px;
}
#beam-profile-modal .bpm-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
#beam-profile-modal .bpm-av {
  width: 56px;
  height: 56px;
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--beam-elev-2);
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
  color: var(--beam-ink);
  border: 1px solid var(--beam-line);
}
#beam-profile-modal .bpm-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
#beam-profile-modal .bpm-name { margin: 0; font-size: 17px; font-weight: 700; }
#beam-profile-modal .bpm-email {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--beam-muted);
  word-break: break-all;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-profile-modal .bpm-email {
  color: var(--beam-light-muted);
}
#beam-profile-modal .bpm-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: #042f2e;
  background: var(--beam, #00B3BC);
  border: 0;
}
#beam-profile-modal .bpm-note,
#beam-limits-modal .bpm-note {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--beam-muted);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-profile-modal .bpm-note,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-limits-modal .bpm-note {
  color: var(--beam-light-muted);
}
#beam-profile-modal .bpm-actions {
  display: grid;
  gap: 8px;
}
#beam-profile-modal .bpm-btn {
  width: 100%;
  border-radius: 12px;
  padding: 11px 14px;
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  background: var(--beam-elev);
  color: var(--beam-ink);
  border: 1px solid var(--beam-line);
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}
#beam-profile-modal .bpm-btn:hover {
  background: var(--beam-elev-2);
  border-color: rgba(255, 255, 255, 0.12);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-profile-modal .bpm-btn {
  background: var(--beam-light-elev);
  border-color: var(--beam-light-line);
  color: var(--beam-light-ink);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-profile-modal .bpm-btn:hover {
  background: var(--beam-light-elev-2);
}
#beam-profile-modal .bpm-btn.primary {
  background: var(--beam);
  color: #042f2e;
  border-color: transparent;
  text-align: center;
  font-weight: 700;
}
#beam-profile-modal .bpm-btn.primary:hover {
  background: var(--beam-deep);
  border-color: transparent;
  color: #042f2e;
}
#beam-profile-modal .bpm-btn.danger {
  color: #fecaca;
  border-color: rgba(239, 68, 68, 0.28);
  background: rgba(239, 68, 68, 0.08);
}
#beam-profile-modal .bpm-btn.danger:hover {
  background: rgba(239, 68, 68, 0.16);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-profile-modal .bpm-btn.danger {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.06);
}

/* Limits window — Settings-density rows (not DIY teal cards) */
#beam-limits-modal .bpm-body {
  padding: 12px 16px 16px;
}
#beam-limits-modal .bpm-note {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--dsw-alias-label-secondary, var(--beam-muted));
}
#beam-limits-modal .blm-list {
  display: grid;
  gap: 0;
  border: 1px solid var(--dsw-alias-border-l2, var(--beam-line));
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, var(--beam-surface));
  overflow: hidden;
}
#beam-limits-modal .blm-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1, var(--beam-line-soft));
  background: transparent;
}
#beam-limits-modal .blm-card:last-child {
  border-bottom: 0;
}
#beam-limits-modal .blm-card:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.03));
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-limits-modal .blm-list {
  background: var(--beam-light-elev);
  border-color: var(--beam-light-line);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-limits-modal .blm-card {
  border-bottom-color: var(--beam-light-line);
}
#beam-limits-modal .blm-meta {
  min-width: 0;
}
#beam-limits-modal .blm-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-primary, var(--beam-ink));
}
#beam-limits-modal .blm-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
#beam-limits-modal .blm-tag {
  margin: 0 0 0 auto;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-tertiary, var(--beam-soft));
}
#beam-limits-modal .blm-name .blm-tag {
  margin-left: auto;
}
#beam-limits-modal .blm-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--dsw-alias-label-secondary, var(--beam-muted));
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-limits-modal .blm-desc {
  color: var(--beam-light-muted);
}
#beam-limits-modal .blm-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, var(--beam-soft));
}
#beam-limits-modal .blm-bar {
  margin-top: 6px;
  height: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-limits-modal .blm-bar {
  background: rgba(10, 36, 34, 0.08);
}
#beam-limits-modal .blm-bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
}
#beam-limits-modal .blm-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-top: 4px;
}
#beam-limits-modal .bpm-btn {
  width: auto;
  min-width: 96px;
  border-radius: var(--dsw-radius-md, 10px);
  padding: 8px 14px;
  font: inherit;
  font-weight: 500;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  background: transparent;
  color: var(--dsw-alias-label-primary, var(--beam-ink));
  border: 1px solid var(--dsw-alias-border-l2, var(--beam-line));
  text-align: center;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
#beam-limits-modal .bpm-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, var(--beam-elev-2));
}
#beam-limits-modal .bpm-btn.primary {
  background: var(--beam);
  color: #042f2e;
  border-color: transparent;
  font-weight: 600;
}
#beam-limits-modal .bpm-btn.primary:hover {
  background: var(--beam-deep);
  color: #042f2e;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-limits-modal .bpm-btn {
  color: var(--beam-light-ink);
  border-color: var(--beam-light-line);
}
#beam-limits-modal .blm-ring-wrap {
  width: 40px;
  flex: none;
}
#beam-limits-modal .blm-ring-wrap .bsl-chart {
  width: 40px;
  height: 40px;
  margin: 0 auto;
}
#beam-limits-modal .blm-ring-wrap .bsl-chart svg {
  width: 40px;
  height: 40px;
}
#beam-limits-modal .blm-ring-wrap .bsl-pct {
  font-size: 9px;
  color: var(--dsw-alias-label-secondary, var(--beam-muted));
}
`;

/** Flaticon bold settings via beam-icons mask (copied into assets; no Downloads path at runtime) */
const GEAR_SVG = '<span class="bsl-gear-ico" aria-hidden="true"></span>';

function stripOrphanProfileModalCss(css) {
  // Older finish/stalled patches left a bottom-left teal popover block outside our marker.
  // Match only the root rule `#beam-profile-modal {` (not descendant selectors).
  const markerAt = css.indexOf(CSS_MARKER);
  if (markerAt < 0) return css;
  const before = css.slice(0, markerAt);
  const start = before.search(/\n#beam-profile-modal\s*\{/);
  if (start < 0) return css;
  return before.slice(0, start) + "\n\n" + css.slice(markerAt);
}

function softenLegacyFootCards(css) {
  // Older FINISH / base rules painted dual cards; keep structure but force transparent chrome.
  // Early "circles only" block must also allow Tide/Flare/Pine labels under rings.
  return css
    .replace(
      /\/\* Three circles in a row[^*]*\*\/\s*#beam-side-limits \.bsl-rings \{[\s\S]*?#beam-side-limits \.bsl-pct \{[\s\S]*?\}\s*body:not\(\[data-ds-dark-theme\]\):not\(\[data-theme="dark"\]\) #beam-side-limits \.bsl-pct \{[\s\S]*?\}/,
      `/* Three rings + Tide / Flare / Pine labels under each */
#beam-side-limits .bsl-rings {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  padding: 10px 8px;
  overflow: visible;
  height: auto;
  min-height: 72px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-sizing: border-box;
}
#beam-side-limits .bsl-ring {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  overflow: visible;
}
#beam-side-limits .bsl-chart {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}
#beam-side-limits .bsl-chart svg { display: block; width: 44px; height: 44px; }
#beam-side-limits .bsl-pct {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--beam-ink);
  pointer-events: none;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-pct {
  color: var(--beam-light-ink);
}
#beam-side-limits .bsl-label {
  display: block;
  visibility: visible;
  opacity: 1;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.2;
  color: #b7d0cb;
  text-align: center;
  white-space: nowrap;
}`
    )
    .replace(
      /\/\* Profile plaque under rings \*\/\s*#beam-side-limits \.bsl-profile \{[\s\S]*?#beam-side-limits \.bsl-profile\.is-guest \{[\s\S]*?\}\s*body:not\(\[data-ds-dark-theme\]\):not\(\[data-theme="dark"\]\) #beam-side-limits \.bsl-profile \{[\s\S]*?\}/,
      `/* Profile plaque under rings — superseded by minimal foot (kept for cascade order) */
#beam-side-limits .bsl-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 4px 4px;
  border-radius: 12px;
  background: transparent;
  border: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
#beam-side-limits .bsl-profile:hover { background: rgba(255,255,255,0.04); }
#beam-side-limits .bsl-profile.is-guest { background: transparent; }
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-side-limits .bsl-profile {
  background: transparent;
  border: 0;
  color: var(--beam-light-ink);
}`
    )
    .replace(
      /\/\* ===== BEAM FINISH: sidebar foot \+ profile modal ===== \*\/\s*#beam-side-limits \.bsl-foot-row \{[\s\S]*?#beam-side-limits \.bsl-gear:hover \{[\s\S]*?\}/,
      `/* ===== BEAM FINISH: sidebar foot + profile modal ===== */
/* Dual-card chrome removed — see BEAM sidebar profile foot */
#beam-side-limits .bsl-foot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
#beam-side-limits .bsl-foot-row .bsl-profile {
  flex: 1;
  min-width: 0;
}
#beam-side-limits .bsl-gear {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 0;
  background: transparent;
  color: var(--beam-muted, #8aa9a4);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}
#beam-side-limits .bsl-gear svg { display: none; }
#beam-side-limits .bsl-gear:hover {
  background: rgba(255,255,255,0.05);
  color: var(--beam-ink, #e8f7f5);
}`
    );
}

function upsertCss(file) {
  if (!fs.existsSync(file)) return false;
  let css = fs.readFileSync(file, "utf8");
  css = stripOrphanProfileModalCss(css);
  css = softenLegacyFootCards(css);
  if (css.includes(CSS_MARKER)) {
    const start = css.indexOf(CSS_MARKER);
    const next = css.indexOf("\n/* =====", start + CSS_MARKER.length);
    const end = next > start ? next : css.length;
    css = css.slice(0, start) + CSS_BLOCK + (next > start ? css.slice(end) : "");
  } else {
    css = css.trimEnd() + "\n\n" + CSS_BLOCK + "\n";
  }
  fs.writeFileSync(file, css);
  return true;
}

function patchHtml(file) {
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes("const renderSide = (data) => {")) {
    console.log("  no renderSide", path.relative(ROOT, file));
    return false;
  }

  // Upsert i18n (also refresh hints if an older patch already injected keys)
  if (!html.includes("profileTitle:")) {
    html = html.replace(
      /limits: "Weekly limits", guest: "Guest", login: "Sign in", logout: "Sign out", refresh: "Refresh",/,
      'limits: "Weekly limits", guest: "Guest", login: "Sign in", logout: "Sign out", refresh: "Refresh",\n' +
        '      profileTitle: "Profile", settings: "Settings", openId: "Open ASSISTIX ID",\n' +
        '      profileHint: "Account and sign-in for Beam Agent.",\n' +
        '      openSettingsFromProfile: "Open app settings", usageWeek: "Weekly limits",\n' +
        '      limitsTitle: "Limits", limitsHint: "Weekly usage for Tide, Flare, and Pine.",'
    );
    html = html.replace(
      /limits: "Лимиты недели", guest: "Гость", login: "Войти", logout: "Выйти", refresh: "Обновить",/,
      'limits: "Лимиты недели", guest: "Гость", login: "Войти", logout: "Выйти", refresh: "Обновить",\n' +
        '      profileTitle: "Профиль", settings: "Настройки", openId: "Открыть ASSISTIX ID",\n' +
        '      profileHint: "Аккаунт и вход в Beam Agent.",\n' +
        '      openSettingsFromProfile: "Открыть настройки приложения", usageWeek: "Лимиты недели",\n' +
        '      limitsTitle: "Лимиты", limitsHint: "Недельные лимиты Tide, Flare и Pine.",'
    );
  } else {
    html = html
      .replace(
        /profileHint: "Account, usage limits, and sign-in for Beam Agent\."/,
        'profileHint: "Account and sign-in for Beam Agent."'
      )
      .replace(
        /profileHint: "Аккаунт, лимиты и вход в Beam Agent\."/,
        'profileHint: "Аккаунт и вход в Beam Agent."'
      )
      .replace(
        /openSettingsFromProfile: "Open app Settings"/,
        'openSettingsFromProfile: "Open app settings"'
      );
    if (!html.includes("limitsTitle:")) {
      html = html.replace(
        /openSettingsFromProfile: "Open app settings", usageWeek: "Weekly usage",/,
        'openSettingsFromProfile: "Open app settings", usageWeek: "Weekly limits",\n' +
          '      limitsTitle: "Limits", limitsHint: "Weekly usage for Tide, Flare, and Pine.",'
      );
      html = html.replace(
        /openSettingsFromProfile: "Открыть настройки приложения", usageWeek: "Лимиты недели",/,
        'openSettingsFromProfile: "Открыть настройки приложения", usageWeek: "Лимиты недели",\n' +
          '      limitsTitle: "Лимиты", limitsHint: "Недельные лимиты Tide, Flare и Pine.",'
      );
      // Fallback if usageWeek wording differs
      if (!html.includes("limitsTitle:")) {
        html = html.replace(
          /usageWeek: "Weekly usage",/,
          'usageWeek: "Weekly limits",\n      limitsTitle: "Limits", limitsHint: "Weekly usage for Tide, Flare, and Pine.",'
        );
        html = html.replace(
          /usageWeek: "Лимиты недели",/,
          'usageWeek: "Лимиты недели",\n      limitsTitle: "Лимиты", limitsHint: "Недельные лимиты Tide, Flare и Pine.",'
        );
      }
    }
  }

  const enhanceStart = html.indexOf("  const enhanceLimitsPage = (data) => {");
  if (enhanceStart < 0) throw new Error("enhanceLimitsPage not found");
  // Re-runs must replace prior helper injection (gearSvg…renderSide), not stack duplicates.
  // Prefer the earliest gearSvg before enhanceLimitsPage so leftover helper stacks are removed.
  const gearBefore = html.indexOf("  const gearSvg = ");
  const renderSideStart = html.lastIndexOf("  const renderSide = (data) => {", enhanceStart);
  if (renderSideStart < 0 || renderSideStart > enhanceStart) return false;
  const blockStart =
    gearBefore >= 0 && gearBefore < enhanceStart ? gearBefore : renderSideStart;

  const NEW_RENDER = `  const gearSvg = ${JSON.stringify(GEAR_SVG)};

  const findAccountMenuTrigger = () => {
    const area = document.querySelector('[class*="settingsArea"]');
    if (!area) return null;
    return (
      area.querySelector("button._5Qcc8a_trigger") ||
      area.querySelector('button[aria-haspopup="menu"]') ||
      [...area.querySelectorAll("button")].find((b) => /^(Ещё|More|更多)$/i.test((b.innerText || "").trim())) ||
      null
    );
  };

  const hideNativeMoreControl = () => {
    const root = findSidebarRoot();
    if (!root) return;
    for (const el of root.querySelectorAll("button, [role='button']")) {
      if (el.closest("#beam-side-limits,#beam-auth-gate,#beam-profile-modal,#beam-limits-modal")) continue;
      const label = (el.innerText || "").trim().replace(/\\s+/g, " ");
      const aria = (el.getAttribute("aria-label") || "").trim();
      const isMore = /^(Ещё|More|更多)$/i.test(label) || /^(Ещё|More|更多)$/i.test(aria);
      const inFoot = !!el.closest('[class*="footArea"], [class*="settingsArea"]');
      if (isMore && inFoot) {
        el.setAttribute("data-beam-hidden-more", "1");
        el.style.cssText = "position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;";
        const host = el.closest("._5Qcc8a_root") || el.parentElement;
        if (host && host !== el) {
          host.setAttribute("data-beam-hidden-more", "1");
          host.style.cssText = "position:absolute!important;width:0!important;height:0!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;flex:0!important;min-width:0!important;";
        }
      }
    }
  };

  // Auth gate is overlay chrome — must NOT block sidebar profile/rings footer.
  const isBeamDialogOpen = () =>
    !!document.querySelector("#beam-profile-modal:not([hidden]),#beam-limits-modal:not([hidden])");

  const isBlockingModalOpen = () => {
    // Never skip footer for auth-gate (signed-out / login UI).
    if (document.querySelector(".ReactModal__Overlay")) return true;
    if (isBeamDialogOpen()) return true;
    return [...document.querySelectorAll('[aria-modal="true"]')].some((el) => {
      if (el.closest("#beam-profile-modal,#beam-limits-modal,#beam-auth-gate,#beam-side-limits")) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    });
  };

  const pickSettingsSection = (section) => {
    const key = String(section || "general").toLowerCase();
    const map = {
      general: /^(Общие|General|通用)/i,
      account: /^(Профиль|Profile|Account|Аккаунт|账号)/i,
      profile: /^(Профиль|Profile|Account|Аккаунт|账号)/i,
      limits: /^(Лимиты|Limits)/i,
      voice: /^(Голосовой|Voice|语音)/i,
    };
    const re = map[key] || map.general;
    const tryClick = () => {
      try {
        if (window.__beamSettingsNav?.openSection) {
          const id = key === "profile" ? "account" : key;
          window.__beamSettingsNav.openSection(id);
          return true;
        }
      } catch {}
      const panel = document.querySelector('[class*="AnXs9G_panel"], [role="dialog"]');
      const scope = panel || document;
      const btn = [...scope.querySelectorAll("button, [role='tab']")].find((el) => {
        const label = (el.innerText || el.textContent || "").trim().split("\\n")[0].trim();
        return re.test(label);
      });
      if (btn) { btn.click(); return true; }
      return false;
    };
    if (!tryClick()) setTimeout(tryClick, 120);
  };

  const openAppSettings = (section) => {
    try {
      if (window.__beamSettingsNav?.openSection) {
        const id = section === "profile" ? "account" : (section || "general");
        window.__beamSettingsNav.openSection(id);
        return;
      }
      if (window.__beamSettingsNav?.open) {
        window.__beamSettingsNav.open();
        if (section) setTimeout(() => pickSettingsSection(section), 80);
        return;
      }
    } catch {}
    /* beam-finish-open-settings-gear */
    const gear = document.querySelector('[data-beam-settings-gear="1"]');
    if (gear) {
      try { gear.click(); } catch {}
      if (section && typeof pickSettingsSection === "function") setTimeout(() => pickSettingsSection(section), 80);
      return;
    }
    const trigger = findAccountMenuTrigger();
    if (trigger) {
      const prev = trigger.getAttribute("style") || "";
      trigger.style.cssText = "position:fixed!important;left:12px!important;bottom:12px!important;width:44px!important;height:44px!important;opacity:0.01!important;pointer-events:auto!important;z-index:2147483001!important;";
      try { trigger.click(); } catch {}
      const pick = () => {
        const item = [...document.querySelectorAll('[role="menuitem"]')].find((el) =>
          /настрой|settings|preferences|设置/i.test((el.innerText || el.textContent || "").trim())
        );
        if (item) {
          item.click();
          trigger.style.cssText = prev;
          if (section && typeof pickSettingsSection === "function") setTimeout(() => pickSettingsSection(section), 80);
          return true;
        }
        return false;
      };
      if (!pick()) {
        setTimeout(() => {
          if (!pick()) {
            trigger.style.cssText = prev;
            try {
              document.dispatchEvent(new KeyboardEvent("keydown", { key: ",", code: "Comma", ctrlKey: true, bubbles: true, cancelable: true }));
            } catch {}
            if (section && typeof pickSettingsSection === "function") setTimeout(() => pickSettingsSection(section), 120);
          }
        }, 60);
      }
      return;
    }
    try {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: ",", code: "Comma", ctrlKey: true, bubbles: true, cancelable: true }));
    } catch {}
    if (section && typeof pickSettingsSection === "function") setTimeout(() => pickSettingsSection(section), 120);
  };

  if (!window.__beamOpenSettingsBound) {
    window.__beamOpenSettingsBound = true;
    window.addEventListener("beam:open-settings", (ev) => {
      try { openAppSettings(ev?.detail?.section || "general"); } catch {}
    });
  }

  const setFootExpanded = (which, open) => {
    const side = document.getElementById("beam-side-limits");
    if (!side) return;
    side.querySelector(".bsl-profile")?.setAttribute("aria-expanded", which === "profile" && open ? "true" : "false");
    side.querySelector('[data-act="limits"]')?.setAttribute("aria-expanded", which === "limits" && open ? "true" : "false");
  };

  const closeProfileModal = () => {
    const modal = document.getElementById("beam-profile-modal");
    if (modal) {
      modal.hidden = true;
      modal.querySelector(".bpm-panel")?.removeAttribute("aria-modal");
    }
    setFootExpanded("profile", false);
  };

  const closeLimitsModal = () => {
    const modal = document.getElementById("beam-limits-modal");
    if (modal) {
      modal.hidden = true;
      modal.querySelector(".bpm-panel")?.removeAttribute("aria-modal");
    }
    setFootExpanded("limits", false);
  };

  const closeBeamDialogs = () => {
    closeProfileModal();
    closeLimitsModal();
  };

  const ensureProfileModal = () => {
    let modal = document.getElementById("beam-profile-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "beam-profile-modal";
    modal.hidden = true;
    modal.innerHTML = '<div class="bpm-mask" data-act="close"></div><div class="bpm-panel" role="dialog" aria-labelledby="beam-profile-title"></div>';
    document.documentElement.appendChild(modal);
    modal.addEventListener("click", (ev) => {
      const act = ev.target?.closest?.("[data-act]")?.getAttribute("data-act");
      if (act === "close") closeProfileModal();
      if (act === "logout") {
        ev.preventDefault();
        closeProfileModal();
        (async () => {
          try { await fetch(BRIDGE + "/assistix/logout", { method: "POST" }); } catch {}
          refresh({ force: true });
        })();
      }
      if (act === "login") {
        closeProfileModal();
        passwordErr = "";
        ensureAuthGate(lastData || { signedIn: false }, { force: false });
      }
      if (act === "settings") {
        closeProfileModal();
        openAppSettings();
      }
      if (act === "open-id") {
        try { window.open("https://id.assistix.org/profile/", "_blank", "noopener,noreferrer"); } catch {}
      }
      if (act === "refresh") {
        refresh({ force: true });
        setTimeout(() => renderProfileModal(lastData || { quotas: {} }), 200);
      }
    });
    return modal;
  };

  const ensureLimitsModal = () => {
    let modal = document.getElementById("beam-limits-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "beam-limits-modal";
    modal.hidden = true;
    modal.innerHTML = '<div class="bpm-mask" data-act="close"></div><div class="bpm-panel" role="dialog" aria-labelledby="beam-limits-title"></div>';
    document.documentElement.appendChild(modal);
    modal.addEventListener("click", (ev) => {
      const act = ev.target?.closest?.("[data-act]")?.getAttribute("data-act");
      if (act === "close") closeLimitsModal();
      if (act === "refresh") {
        refresh({ force: true });
        setTimeout(() => renderLimitsModal(lastData || { quotas: {} }), 200);
      }
      if (act === "settings") {
        closeLimitsModal();
        openAppSettings();
      }
    });
    return modal;
  };

  if (!window.__beamDialogEscBound) {
    window.__beamDialogEscBound = true;
    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      const profile = document.getElementById("beam-profile-modal");
      const limits = document.getElementById("beam-limits-modal");
      if (profile && !profile.hidden) { closeProfileModal(); return; }
      if (limits && !limits.hidden) closeLimitsModal();
    });
  }

  const renderProfileModal = (data) => {
    closeLimitsModal();
    const modal = ensureProfileModal();
    const panel = modal.querySelector(".bpm-panel");
    if (!panel) return;
    const tr = t();
    const user = data?.user;
    const signed = !!data?.signedIn && !!user;
    const avInner = signed && user.avatar_url
      ? '<img src="'+String(user.avatar_url).replace(/"/g,'&quot;')+'" alt="">'
      : (signed ? String(user.display_name||user.name||user.email||'A').trim().slice(0,2).toUpperCase() : 'AX');
    const name = signed ? (user.display_name || user.name || 'ASSISTIX') : tr.guest;
    const email = signed ? (user.email || '') : (isRu() ? 'Войдите через ASSISTIX ID' : 'Sign in with ASSISTIX ID');
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML =
      '<div class="bpm-top"><h2 class="bpm-title" id="beam-profile-title">' + tr.profileTitle + '</h2>'
      + '<button type="button" class="bpm-close" data-act="close" aria-label="Close">×</button></div>'
      + '<div class="bpm-body">'
      + '<div class="bpm-head"><div class="bpm-av">' + avInner + '</div>'
      + '<div><p class="bpm-name">' + String(name).replace(/</g,"") + '</p>'
      + '<p class="bpm-email">' + String(email).replace(/</g,"") + '</p>'
      + (signed ? '<span class="bpm-badge">ASSISTIX ID</span>' : '') + '</div></div>'
      + '<p class="bpm-note">' + (tr.profileHint || '') + '</p>'
      + '<div class="bpm-actions">'
      + (signed
        ? '<button type="button" class="bpm-btn" data-act="open-id">' + tr.openId + '</button>'
          + '<button type="button" class="bpm-btn" data-act="refresh">' + tr.refresh + '</button>'
          + '<button type="button" class="bpm-btn primary" data-act="settings">' + tr.openSettingsFromProfile + '</button>'
          + '<button type="button" class="bpm-btn danger" data-act="logout">' + tr.logout + '</button>'
        : '<button type="button" class="bpm-btn primary" data-act="login">' + tr.login + '</button>'
          + '<button type="button" class="bpm-btn" data-act="settings">' + tr.openSettingsFromProfile + '</button>')
      + '</div></div>';
    modal.hidden = false;
    setFootExpanded("profile", true);
  };

  const renderLimitsModal = (data) => {
    closeProfileModal();
    const modal = ensureLimitsModal();
    const panel = modal.querySelector(".bpm-panel");
    if (!panel) return;
    const tr = t();
    const meta = {
      tide: { tag: tr.tideTag || "Fast", desc: tr.tideDesc || "" },
      flare: { tag: tr.flareTag || "Balanced", desc: tr.flareDesc || "" },
      pine: { tag: tr.pineTag || "Deep", desc: tr.pineDesc || "" },
    };
    const cards = modelsFrom(data).map((m) => {
      const pct = Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
      const info = meta[m.id] || { tag: "", desc: "" };
      return '<div class="blm-card">'
        + '<div class="blm-ring-wrap"><div class="bsl-chart">'+ringSvg(pct, m.color)+'<div class="bsl-pct">'+pct+'%</div></div></div>'
        + '<div class="blm-meta"><p class="blm-name"><span class="blm-dot" style="background:'+m.color+'"></span>'+m.name
        + (info.tag ? '<span class="blm-tag">'+info.tag+'</span>' : '') + '</p>'
        + (info.desc ? '<p class="blm-desc">'+info.desc+'</p>' : '')
        + '<div class="blm-row"><span>'+(tr.usageWeek || tr.limits)+'</span><span>'+fmt(m.used)+' / '+fmt(m.limit)+'</span></div>'
        + '<div class="blm-bar"><span style="width:'+pct+'%;background:'+m.color+'"></span></div>'
        + '</div></div>';
    }).join("");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML =
      '<div class="bpm-top"><h2 class="bpm-title" id="beam-limits-title">' + (tr.limitsTitle || tr.usageWeek || tr.limits) + '</h2>'
      + '<button type="button" class="bpm-close" data-act="close" aria-label="Close">×</button></div>'
      + '<div class="bpm-body">'
      + '<p class="bpm-note">' + (tr.limitsHint || tr.usageWeek || '') + '</p>'
      + '<div class="blm-list">' + cards + '</div>'
      + '<div class="blm-actions">'
      + '<button type="button" class="bpm-btn" data-act="refresh">' + tr.refresh + '</button>'
      + '<button type="button" class="bpm-btn primary" data-act="settings">' + tr.openSettingsFromProfile + '</button>'
      + '</div></div>';
    modal.hidden = false;
    setFootExpanded("limits", true);
  };

  const openProfileModal = () => {
    /* beam-profile-via-settings */
    closeBeamDialogs();
    openAppSettings("account");
  };

  const openLimitsModal = () => {
    /* beam-limits-via-settings */
    closeBeamDialogs();
    openAppSettings("limits");
  };

  const renderSide = (data) => {
    const root = findSidebarRoot();
    if (!root) return;
    if (isBlockingModalOpen()) return;
    if (isGateFormInteractive()) return;

    hideNativeMoreControl();

    const foot = root.querySelector('[class*="footArea"]') || root;
    let el = document.getElementById("beam-side-limits");
    if (!el) {
      el = document.createElement("div");
      el.id = "beam-side-limits";
      if (foot.firstChild) foot.insertBefore(el, foot.firstChild);
      else foot.appendChild(el);
    } else if (el.parentElement !== foot) {
      if (foot.firstChild) foot.insertBefore(el, foot.firstChild);
      else foot.appendChild(el);
    } else if (foot.firstChild !== el) {
      foot.insertBefore(el, foot.firstChild);
    }

    const tr = t();
    const user = data?.user;
    const signed = !!data?.signedIn && !!user;
    const models = modelsFrom(data);
    try {
      window.__beamLimitsSnapshot = {
        models: models.map((m) => ({
          id: m.id, name: m.name, color: m.color, used: m.used, limit: m.limit,
          tag: (t()[(m.id + "Tag")] || ""),
          desc: (t()[(m.id + "Desc")] || "")
        })),
        at: Date.now()
      };
      window.dispatchEvent(new CustomEvent("beam:limits-updated"));
      /* Clear sticky exhausted banner when selected model still has gauge headroom. */
      try {
        let selected = "";
        try {
          const prefs = JSON.parse(localStorage.getItem("beam-model-prefs") || "{}");
          selected = String(prefs.lastManual || "").toLowerCase();
        } catch {}
        const row = models.find((m) => m.id === selected) || null;
        if (row && (Number(row.used) || 0) < Math.max(1, Number(row.limit) || 1)) {
          window.dispatchEvent(new CustomEvent("beam:dismiss-quota-notice", { detail: { model: selected, reason: "selected-has-quota" } }));
        }
        const prev = window.__beamLastExhaustedIds || [];
        const nowEx = models.filter((m) => (Number(m.used) || 0) >= Math.max(1, Number(m.limit) || 1)).map((m) => m.id);
        window.__beamLastExhaustedIds = nowEx;
        if (prev.some((id) => !nowEx.includes(id))) {
          window.dispatchEvent(new CustomEvent("beam:dismiss-quota-notice", { detail: { reason: "gauge-recovered" } }));
        }
      } catch {}
    } catch {}
    const rings = models.map((m) => {
      const pct = Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
      const label = String(m.name || ({ tide: "Tide", flare: "Flare", pine: "Pine" }[m.id] || m.id)).replace(/</g,"");
      const title = label + ": " + fmt(m.used) + " / " + fmt(m.limit);
      return '<div class="bsl-ring" data-id="'+m.id+'" title="'+title.replace(/"/g,"&quot;")+'" style="--ring-color:'+m.color+'">'
        + '<div class="bsl-chart">'+ringSvg(pct, m.color)+'<div class="bsl-pct">'+pct+'%</div></div>'
        + '<span class="bsl-label" data-model="'+m.id+'">'+label+'</span>'
        + '</div>';
    }).join("");

    const avInner = signed && user.avatar_url
      ? '<img src="'+String(user.avatar_url).replace(/"/g,'&quot;')+'" alt="">'
      : (signed ? String(user.display_name||user.name||user.email||'A').trim().slice(0,2).toUpperCase() : 'AX');
    const name = signed ? (user.display_name || user.name || 'ASSISTIX') : tr.guest;
    const limitsLabel = (tr.limitsTitle || tr.usageWeek || tr.limits || "Limits").replace(/"/g, "&quot;");
    const profile = '<button type="button" class="bsl-profile'+(signed ? '' : ' is-guest')+'" data-act="profile" aria-haspopup="dialog" aria-expanded="false" title="'+tr.profileTitle+'">'
      + '<div class="bsl-avatar'+(signed ? '' : ' is-guest')+'">'+avInner+'</div>'
      + '<div class="bsl-usercol"><div class="bsl-name">'+String(name).replace(/</g,"")+'</div></div>'
      + '</button>';
    const gear = '<button type="button" class="bsl-gear" data-act="settings" aria-label="'+tr.settings+'" title="'+tr.settings+'">'+gearSvg+'</button>';
    const ringsBtn = '<button type="button" class="bsl-rings" data-act="limits" aria-haspopup="dialog" aria-expanded="false" aria-label="'+limitsLabel+'" title="'+limitsLabel+'">'+rings+'</button>';
    const html = ringsBtn+'<div class="bsl-foot-row">'+profile+gear+'</div>';

    if (html === lastSideHtml && el.dataset.bound === "1") {
      hideNativeMoreControl();
      return;
    }
    lastSideHtml = html;
    el.innerHTML = html;
    el.dataset.bound = "1";
    el.querySelector('[data-act="profile"]')?.addEventListener("click", () => {
      if (!signed) {
        passwordErr = "";
        ensureAuthGate(lastData || { signedIn: false }, { force: false });
        const g = gateEl();
        try { g?.querySelector('[name="email"]')?.focus(); } catch {}
        return;
      }
      openProfileModal();
    });
    el.querySelector('[data-act="limits"]')?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openLimitsModal();
    });
    el.querySelector('[data-act="settings"]')?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      closeBeamDialogs();
      openAppSettings();
    });
    hideNativeMoreControl();
  };

`;

  html = html.slice(0, blockStart) + NEW_RENDER + html.slice(enhanceStart);

  html = html.replace(
    "renderSide(lastData || { quotas: {} });\n        enhanceLimitsPage(lastData || { quotas: {} });",
    "hideNativeMoreControl();\n        renderSide(lastData || { quotas: {} });\n        enhanceLimitsPage(lastData || { quotas: {} });"
  );

  // Protect custom dialogs from rewrite walker / mutation filters
  html = html.replace(
    /#beam-auth-gate,#beam-side-limits,#beam-limits-panel(?:,#beam-profile-modal(?:,#beam-limits-modal)?)?/g,
    "#beam-auth-gate,#beam-side-limits,#beam-limits-panel,#beam-profile-modal,#beam-limits-modal"
  );

  // node.id short-circuit in mutation observer — keep limits modal too
  if (html.includes('node.id === "beam-limits-panel") return true;') && !html.includes('node.id === "beam-limits-modal"')) {
    html = html.replace(
      'node.id === "beam-auth-gate" || node.id === "beam-side-limits" || node.id === "beam-limits-panel"',
      'node.id === "beam-auth-gate" || node.id === "beam-side-limits" || node.id === "beam-limits-panel" || node.id === "beam-profile-modal" || node.id === "beam-limits-modal"'
    );
  }

  fs.writeFileSync(file, html);
  return true;
}

let ok = 0;
for (const web of WEBS) {
  console.log("→", path.relative(ROOT, web));
  const iconsN = ensureFootIcons(path.join(web, "assets"));
  const cssOk = upsertCss(path.join(web, "assets/beam-override.css"));
  const htmlOk = patchHtml(path.join(web, "index.html"));
  console.log("  icons:", iconsN, "css:", cssOk, "html:", htmlOk);
  if (cssOk && htmlOk) ok++;
}
if (ok < 1) {
  console.error("No trees patched");
  process.exit(1);
}
console.log("Done. Patched", ok, "tree(s).");
