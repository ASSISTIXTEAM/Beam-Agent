import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "C:/Beam-Agent";
const DSH = path.join(
  ROOT,
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai"
);
const WEB = path.join(DSH, "dsh-web-frontend/dist");
const ASSETS = path.join(WEB, "assets");

const logoSvg = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");
const wordSvg = fs.readFileSync(path.join(ROOT, "logo-beam-agent.svg"), "utf8");
const toCC = (s) => s.replaceAll('fill="#00B3BC"', 'fill="currentColor"');
const dataUri = (s) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(toCC(s));
const LOGO = dataUri(logoSvg);
const WORD = dataUri(wordSvg);
const BEAM_BODY =
  "M738.178 118.454L1033.91 630.64C1125.1 788.578 1011.11 986 828.727 986H237.273C54.8922 986 -59.0957 788.578 32.0947 630.64L327.822 118.453C419.012 -39.4846 646.988 -39.4844 738.178 118.454ZM663.389 373.889C663.389 301.601 604.788 243 532.5 243C460.212 243 401.611 301.601 401.611 373.889C401.611 446.177 460.212 504.778 532.5 504.778C604.788 504.778 663.389 446.177 663.389 373.889ZM842 731.75C842 644.075 765.142 573 670.333 573H395.667C300.858 573 224 644.075 224 731.75C224 784.355 270.115 827 327 827H739C795.885 827 842 784.355 842 731.75Z";

// 1) index JS: fish + boot only
{
  const indexJs = path.join(ASSETS, "index-BXV-oxvX.js");
  let js = fs.readFileSync(indexJs, "utf8");
  const fishStart = js.indexOf("M22.9168 1.43018");
  if (fishStart >= 0) {
    const quote = js[fishStart - 1];
    const fishEnd = js.indexOf(quote, fishStart);
    js = js.slice(0, fishStart) + BEAM_BODY + js.slice(fishEnd);
    js = js.replaceAll("{width:23.16,height:17.04}", "{width:1066,height:1107}");
    js = js.replaceAll("0 0 23.16 17.04", "0 0 1066 1107");
  }
  js = js.split('wordmark,"HARNESS"').join('wordmark,"BEAM"');
  js = js.split("Loading plugins…").join("Loading Beam…");
  js = js.split("DeepSeek Harness").join("Beam Agent");
  fs.writeFileSync(indexJs, js);
  console.log("index js patched");
}

// 2) models catalog
{
  const llm = path.join(DSH, "dsh-llm-deepseek/lib/index.js");
  let s = fs.readFileSync(llm, "utf8");
  s = s.replace(
    /DEFAULT_MODELS = \[[\s\S]*?\];/,
    `DEFAULT_MODELS = [{
\tid: "tide",
\tname: "Tide",
\tdescription: "Быстрая модель Beam — до 1M токенов",
\tcontextWindow: OFFICIAL_CONTEXT_WINDOW,
\tinputModalities: ["text", "image"],
\tsystemPromptUpdate: "in-history",
\ttoolUpdate: "addition-only"
}, {
\tid: "flare",
\tname: "Flare",
\tdescription: "Сбалансированная модель Beam — до 500K токенов",
\tcontextWindow: 524288,
\tinputModalities: ["text", "image"],
\tsystemPromptUpdate: "in-history",
\ttoolUpdate: "addition-only"
}, {
\tid: "pine",
\tname: "Pine",
\tdescription: "Сильный режим Beam — до 10K токенов",
\tcontextWindow: 16384
}];`
  );
  if (s.includes('PUBLIC_BASE_URL = "https://api.deepseek.com/anthropic"')) {
    s = s.replace(
      'PUBLIC_BASE_URL = "https://api.deepseek.com/anthropic"',
      'PUBLIC_BASE_URL = "http://127.0.0.1:17865/anthropic"'
    );
  }
  fs.writeFileSync(llm, s);
  console.log("models ok");
}

// 3) provider display
{
  const apiKey = path.join(DSH, "dsh-llm-deepseek-api-key/lib/index.js");
  let s = fs.readFileSync(apiKey, "utf8");
  s = s.replaceAll('displayName: "DeepSeek"', 'displayName: "Beam Agent"');
  s = s.replaceAll("displayName: 'DeepSeek'", "displayName: 'Beam Agent'");
  s = s.replaceAll('providerName: "DeepSeek"', 'providerName: "Beam Agent"');
  s = s.replaceAll("providerName: 'DeepSeek'", "providerName: 'Beam Agent'");
  s = s.replaceAll('displayName: "Assistix"', 'displayName: "Beam Agent"');
  s = s.replaceAll('providerName: "Assistix"', 'providerName: "Beam Agent"');
  s = s.replaceAll('displayName: "Beam"', 'displayName: "Beam Agent"');
  s = s.replaceAll('providerName: "Beam"', 'providerName: "Beam Agent"');
  fs.writeFileSync(apiKey, s);
}

// 4) run existing safe patch scripts via dynamic import
await import("./patch-hero.mjs");
await import("./patch-brand-official.mjs");
await import("./patch-settings-models.mjs");

// 5) system prompt
{
  const p = path.join(DSH, "dsh-system-prompt/lib/index.js");
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(
    /text: "You are an AI agent powered by Beam Agent\."/,
    'text: "You are Beam Agent by ASSISTIX. Your models are Tide, Flare, and Pine. Never mention DeepSeek, Harness, API keys, or backend model ids."'
  );
  s = s.replace(
    /text: "You are Beam Agent by ASSISTIX\.[\s\S]*?"/,
    'text: "You are Beam Agent by ASSISTIX. Your models are Tide, Flare, and Pine. Never mention DeepSeek, Harness, API keys, or backend model ids."'
  );
  fs.writeFileSync(p, s);
}

// 6) CSS + injector (from polish, condensed) — spawn polish steps 5-6 by reading polish file is heavy; inline minimal
await import("./polish-beam.mjs");

console.log("reapply-safe complete");
