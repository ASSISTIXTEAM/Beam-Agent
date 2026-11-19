/**
 * Beam brand contrast + DeepSeek-blue kill pass:
 * 1) Remap leftover DeepSeek blues → Beam teal family
 * 2) Fix user-questions «Recommended» badge (cyan-on-cyan)
 * 3) RU label «Рекомендуется»
 * 4) Primary / Далее readable dark ink on Beam accent
 * Applied to runtime + dist web frontend + user-questions packages.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";

const WEBS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
];

const USER_Q = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-client-ui-user-questions/lib/client.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-user-questions/lib/client.js"),
];

const MARKER = "/* ===== BEAM brand contrast / recommended badge ===== */";
const CSS = `${MARKER}
/* Beam palette (authoritative) — not DeepSeek #4176e6 / #4D6BFE / #679EFE */
:root,
html,
body,
body[data-ds-dark-theme],
body[data-theme="dark"] {
  --beam: #00B3BC !important;
  --beam-bright: #2dd4bf !important;
  --beam-deep: #0d9488 !important;
  --beam-ink-on-accent: #042f2e !important;

  --dsw-static-deepseek-50: #e8f7f5 !important;
  --dsw-static-deepseek-100: #ccfbf1 !important;
  --dsw-static-deepseek-200: #99f6e4 !important;
  --dsw-static-deepseek-300: #5eead4 !important;
  --dsw-static-deepseek-400: #2dd4bf !important;
  --dsw-static-deepseek-450: #00B3BC !important;
  --dsw-static-deepseek-500: #00B3BC !important;
  --dsw-static-deepseek-600: #0d9488 !important;
  --dsw-static-deepseek-700-delete: #0f766e !important;
  --dsw-static-deepseek-800: #115e59 !important;
  --dsw-static-deepseek-900: #134e4a !important;

  --dsw-static-blue-400: #2dd4bf !important;
  --dsw-static-blue-450: #00B3BC !important;
  --dsw-static-blue-500: #00B3BC !important;
  --dsw-static-blue-600: #0d9488 !important;

  --dsw-alias-brand-primary: #00B3BC !important;
  --dsw-alias-brand-primary-new-colorprimary-new-color: #00B3BC !important;
  --dsw-alias-brand-text: #2dd4bf !important;
  --dsw-alias-button-primary-fill: #00B3BC !important;
  --dsw-alias-button-primary-hover: #0d9488 !important;
  --dsw-alias-state-business-primary: #00B3BC !important;
  --dsw-alias-link: #2dd4bf !important;
  --dsw-alias-button-info-fill: #00B3BC !important;
  --dsw-alias-button-info-hover: #0d9488 !important;
  --dsw-focus-ring-color: #00B3BC !important;
  --dsw-specific-sidebar-nav-item-active-accent: #00B3BC !important;
}

/*
 * User-questions Recommended badge:
 * Native CSS uses active-accent (bg) + button-info-fill (color).
 * After Beam remap both became teal → zero contrast.
 * Fix: solid Beam chip + dark ink (same as primary CTAs).
 */
.wnLwla_badge,
[class*="wnLwla_badge"],
[class*="_badge"].wnLwla_badge {
  background: var(--beam, #00B3BC) !important;
  color: var(--beam-ink-on-accent, #042f2e) !important;
  border: 0 !important;
  opacity: 1 !important;
  -webkit-text-fill-color: var(--beam-ink-on-accent, #042f2e) !important;
  mix-blend-mode: normal !important;
  filter: none !important;
}

/* Primary filled CTAs — dark ink on Beam accent (readable) */
button.bpm-btn.primary,
[data-variant="primary"][data-tone="brand"],
[data-variant="primary"][class*="Button"] {
  color: #042f2e !important;
  -webkit-text-fill-color: #042f2e !important;
}

/* Kill leftover DeepSeek blue strokes/fills on icons in chrome */
svg [stroke="#679EFE"],
svg [stroke="#4176e6"],
svg [stroke="#4D6BFE"],
svg [stroke="#4d6bfe"],
svg [stroke="#5686fe"],
svg [stroke="#7aaaff"],
svg [fill="#679EFE"],
svg [fill="#4176e6"],
svg [fill="#4D6BFE"],
svg [fill="#4d6bfe"],
svg [fill="#5686fe"],
svg [fill="#7aaaff"] {
  stroke: #00B3BC !important;
  fill: #00B3BC !important;
}

/* Tag tone=info chips: muted Beam wash + bright label (readable) */
[class*="_tag_"][data-tone="info"],
[data-tone="info"][class*="tag"] {
  background: color-mix(in srgb, var(--beam, #00B3BC) 16%, transparent) !important;
  color: var(--beam-bright, #2dd4bf) !important;
}

/* Selected option border in questions — Beam, not DeepSeek blue */
.wnLwla_optionSelected,
[class*="wnLwla_optionSelected"],
.wnLwla_option[aria-checked="true"] {
  border-color: color-mix(in srgb, var(--beam, #00B3BC) 45%, transparent) !important;
}
`;

function upsertOverride(file) {
  if (!fs.existsSync(file)) return false;
  let css = fs.readFileSync(file, "utf8");
  if (css.includes(MARKER)) {
    const start = css.indexOf(MARKER);
    const next = css.indexOf("\n/* =====", start + MARKER.length);
    const end = next > start ? next : css.length;
    css = css.slice(0, start) + CSS + (next > start ? "\n" + css.slice(end).replace(/^\n+/, "") : "\n");
  } else {
    css = css.trimEnd() + "\n\n" + CSS + "\n";
  }
  fs.writeFileSync(file, css);
  return true;
}

function patchUserQuestions(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  let changed = false;

  // RU dictionary inside beam-ru region
  if (s.includes("// #region beam-ru")) {
    const next = s.replace(
      /\/\/ #region beam-ru[\s\S]*?\/\/ #endregion beam-ru/,
      (block) => {
        let b = block;
        if (b.includes('"option.recommended": "Recommended"') || b.includes('"option.recommended":"Recommended"')) {
          b = b.replace(/"option\.recommended":\s*"Recommended"/g, '"option.recommended": "Рекомендуется"');
          changed = true;
        }
        if (b.includes('"option.recommended": "推荐"')) {
          b = b.replace(/"option\.recommended":\s*"推荐"/g, '"option.recommended": "Рекомендуется"');
          changed = true;
        }
        // Also translate leftover EN action labels if still English in RU block
        b = b
          .replace(/"custom\.placeholder":\s*"Type your answer"/g, '"custom.placeholder": "Введите свой ответ"')
          .replace(/"plan\.header":\s*"Plan review"/g, '"plan.header": "Проверка плана"')
          .replace(/"plan\.decline":\s*"Refuse"/g, '"plan.decline": "Отклонить"')
          .replace(/"plan\.discuss":\s*"Request changes"/g, '"plan.discuss": "Запросить правки"');
        return b;
      }
    );
    if (next !== s) {
      s = next;
      changed = true;
    }
  }

  // Hard-fix badge colors inside embedded CSS string (defense in depth)
  if (s.includes("wnLwla_badge") && s.includes("dsw-specific-sidebar-nav-item-active-accent")) {
    const before = s;
    s = s.replace(
      /\.wnLwla_badge\{[^}]*\}/,
      ".wnLwla_badge{border-radius:var(--dsw-radius-xs);background:#00B3BC;color:#042f2e;padding:0 4px;font-size:11px;font-weight:600;line-height:18px}"
    );
    if (s !== before) changed = true;
  }

  // Accept RU synonym in recommended suffix parser
  if (s.includes("parseRecommendedLabel") && !s.includes("рекомендуется")) {
    const before = s;
    s = s.replace(
      /\(\(\?:recommended\|推荐\)\)/g,
      "((?:recommended|推荐|рекомендуется|рекоменд.))"
    );
    if (s !== before) changed = true;
  }

  if (changed) fs.writeFileSync(file, s);
  return changed;
}

let ov = 0;
for (const web of WEBS) {
  const file = path.join(web, "assets/beam-override.css");
  const ok = upsertOverride(file);
  console.log("override", path.relative(ROOT, file), ok);
  if (ok) ov++;
}

let uq = 0;
for (const file of USER_Q) {
  const ok = patchUserQuestions(file);
  console.log("user-questions", path.relative(ROOT, file), ok);
  if (ok) uq++;
}

if (ov < 1) {
  console.error("No overrides patched");
  process.exit(1);
}
console.log("Done. overrides=", ov, "userQuestions=", uq);
