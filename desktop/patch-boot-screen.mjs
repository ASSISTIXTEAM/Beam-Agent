/**
 * Redesign DSH boot splash: Beam mark + Savona + teal brand.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const WEB_DIRS = [
  path.join(ROOT, "dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
].filter((p) => fs.existsSync(p));

const logoSvg = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");

const BOOT_CSS = `
/* ===== BEAM boot splash ===== */
@font-face {
  font-family: "Savona";
  src: url("./fonts/savona/Savona-Medium.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Savona";
  src: url("./fonts/savona/Savona-Semibold.woff2") format("woff2");
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Savona";
  src: url("./fonts/savona/Savona-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

[data-dsh-boot],
[class*="_boot_u7vgf"] {
  --dsh-boot-label-primary: #e8f7f5 !important;
  --dsh-boot-label-secondary: #9ec9c3 !important;
  --dsh-boot-label-tertiary: #7aaba4 !important;
  --dsh-boot-brand: #00B3BC !important;
  --dsh-boot-bg: #041210 !important;
  --dsh-boot-border: rgba(0, 179, 188, 0.18) !important;
  --dsh-boot-arc: 96deg !important;
  --dsw-alias-brand-primary: #00B3BC !important;
  --dsw-alias-bg-base: #041210 !important;
  --dsw-alias-label-primary: #e8f7f5 !important;
  --dsw-alias-label-tertiary: #9ec9c3 !important;
  --dsw-alias-border-l2: rgba(0, 179, 188, 0.2) !important;
  height: 100% !important;
  display: grid !important;
  place-items: center !important;
  background:
    radial-gradient(880px 520px at 18% -10%, rgba(0, 179, 188, 0.30), transparent 58%),
    radial-gradient(720px 420px at 100% 0%, rgba(45, 212, 191, 0.12), transparent 52%),
    radial-gradient(640px 420px at 50% 115%, rgba(13, 148, 136, 0.14), transparent 55%),
    #041210 !important;
  font-family: "Savona", "Segoe UI", system-ui, sans-serif !important;
}

[data-dsh-boot] [class*="_card_"],
[class*="_boot_u7vgf"] [class*="_card_"] {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 18px !important;
  padding: 8px 12px !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  min-width: 0 !important;
}

/* Mark + Savona title */
[data-dsh-boot] [class*="_wordmark_"],
[class*="_boot_u7vgf"] [class*="_wordmark_"] {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 16px !important;
  width: auto !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  background: none !important;
  color: #e8f7f5 !important;
  font-family: "Savona", "Segoe UI", system-ui, sans-serif !important;
  font-size: 22px !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: 0.03em !important;
  text-transform: none !important;
  overflow: visible !important;
}
[data-dsh-boot] [class*="_wordmark_"]::before,
[class*="_boot_u7vgf"] [class*="_wordmark_"]::before {
  content: "" !important;
  display: block !important;
  width: 64px !important;
  height: 66px !important;
  background: url("./beam-mark.svg") center / contain no-repeat !important;
  filter: drop-shadow(0 0 18px rgba(0, 179, 188, 0.38));
  animation: beam-boot-breathe 2.6s ease-in-out infinite;
}
[data-dsh-boot] [class*="_wordmark_"]::after,
[class*="_boot_u7vgf"] [class*="_wordmark_"]::after {
  content: none !important;
  display: none !important;
}

/* Teal brand spinner */
[data-dsh-boot] [class*="_spinner_"],
[class*="_boot_u7vgf"] [class*="_spinner_"],
[data-dsh-boot-spinner] {
  width: 26px !important;
  height: 26px !important;
  margin: 6px auto 0 !important;
  border: 2px solid rgba(0, 179, 188, 0.18) !important;
  border-top-color: #00B3BC !important;
  border-right-color: #2dd4bf !important;
  border-radius: 50% !important;
  background: transparent !important;
  box-shadow: 0 0 0 6px rgba(0, 179, 188, 0.06) !important;
  animation: beam-boot-spin 0.85s linear infinite !important;
  color: transparent !important;
}
[data-dsh-boot] [class*="_spinner_"]::after,
[class*="_boot_u7vgf"] [class*="_spinner_"]::after,
[data-dsh-boot-spinner]::after {
  content: none !important;
  display: none !important;
  background: none !important;
  -webkit-mask: none !important;
  mask: none !important;
}

[data-dsh-boot] [class*="_hint_"],
[class*="_boot_u7vgf"] [class*="_hint_"] {
  margin: 2px 0 0 !important;
  font-family: "Savona", "Segoe UI", system-ui, sans-serif !important;
  font-weight: 500 !important;
  font-size: 13px !important;
  line-height: 1.35 !important;
  letter-spacing: 0.02em !important;
  color: #9ec9c3 !important;
  text-align: center !important;
}

@keyframes beam-boot-spin {
  to { transform: rotate(360deg); }
}
@keyframes beam-boot-breathe {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 14px rgba(0, 179, 188, 0.28));
  }
  50% {
    transform: scale(1.045);
    filter: drop-shadow(0 0 24px rgba(45, 212, 191, 0.46));
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-dsh-boot] [class*="_spinner_"],
  [data-dsh-boot-spinner],
  [data-dsh-boot] [class*="_wordmark_"]::before {
    animation: none !important;
  }
}
`;

function patchJs(jsPath) {
  if (!fs.existsSync(jsPath)) return false;
  let s = fs.readFileSync(jsPath, "utf8");
  const before = s;
  s = s.replace(/Yn\(Kn\.wordmark,\s*"(?:BEAM|HARNESS)"\)/g, 'Yn(Kn.wordmark,"Beam Agent")');
  s = s.replace(
    /Yn\(Kn\.hint,\s*"(?:Loading Beam[…\.]{1,3}|Loading plugins[…\.]{1,3})"\)/g,
    'Yn(Kn.hint,"Загрузка Beam Agent…")'
  );
  s = s.replaceAll('wordmark,"BEAM"', 'wordmark,"Beam Agent"');
  s = s.replaceAll('wordmark,"HARNESS"', 'wordmark,"Beam Agent"');
  s = s.replaceAll('hint,"Loading Beam…"', 'hint,"Загрузка Beam Agent…"');
  s = s.replaceAll('hint,"Loading Beam..."', 'hint,"Загрузка Beam Agent…"');
  s = s.replaceAll('hint,"Loading plugins…"', 'hint,"Загрузка Beam Agent…"');
  s = s.replaceAll('hint,"Loading plugins..."', 'hint,"Загрузка Beam Agent…"');
  if (s === before && !s.includes("Загрузка Beam Agent")) {
    s = s.replace(/Loading Beam[…\.]*/g, "Загрузка Beam Agent…");
    s = s.replace(/Loading plugins[…\.]*/g, "Загрузка Beam Agent…");
  }
  fs.writeFileSync(jsPath, s);
  return s.includes("Beam Agent") && s.includes("Загрузка Beam Agent");
}

function patchCss(cssPath, assetsDir) {
  fs.writeFileSync(path.join(assetsDir, "beam-mark.svg"), logoSvg);
  let css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
  css = css.replace(/\/\* ===== BEAM boot splash ===== \*\/[\s\S]*$/g, "").trimEnd();
  css += "\n" + BOOT_CSS;
  fs.writeFileSync(cssPath, css);
  return true;
}

for (const web of WEB_DIRS) {
  const assets = path.join(web, "assets");
  const js = path.join(assets, "index-BXV-oxvX.js");
  const css = path.join(assets, "beam-override.css");
  console.log("→", web);
  console.log("  mark+js", patchJs(js));
  console.log("  css", patchCss(css, assets));
}

console.log("✓ Beam boot splash redesigned");
