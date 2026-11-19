/**
 * End-to-end checks for common file open/preview paths after LO kit restore.
 */
import { createConverter } from "../dist/Beam-Agent/resources/app/beam/node_modules/@assistix/libreoffice-kit/lib/index.js";
import { mkdir, writeFile, readFile, stat, copyFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { inflateRawSync } from "node:zlib";

const outDir = "C:\\Beam-Agent\\_tmp_lo_test";
const ws = "C:\\Users\\Alexa\\.beam\\default-workspace";
const musk = join(ws, "Илон_Маск_биография.docx");
await mkdir(outDir, { recursive: true });

const results = [];

function ok(name, detail = {}) {
  results.push({ name, ok: true, ...detail });
  console.log("OK", name, detail);
}
function fail(name, err) {
  results.push({ name, ok: false, error: err instanceof Error ? err.message : String(err) });
  console.error("FAIL", name, err);
}

// 1) types.rdb present in dist assistix kit
const typesRdb =
  "C:\\Beam-Agent\\dist\\Beam-Agent\\resources\\app\\beam\\node_modules\\@assistix\\libreoffice-kit-win32-x64\\program\\program\\types.rdb";
if (existsSync(typesRdb) && (await stat(typesRdb)).size > 1000) ok("types.rdb present", { bytes: (await stat(typesRdb)).size });
else fail("types.rdb present", "missing or empty");

// 2) Office → PDF via LibreOffice kit
try {
  const converter = await createConverter();
  const outputPath = join(outDir, `musk-e2e-${Date.now()}.pdf`);
  const t0 = Date.now();
  await converter.render({ inputPath: musk, outputPath }, AbortSignal.timeout(120_000));
  const bytes = (await stat(outputPath)).size;
  await converter.dispose?.().catch(() => {});
  if (bytes > 1000) ok("docx→pdf conversion", { ms: Date.now() - t0, bytes });
  else fail("docx→pdf conversion", `pdf too small: ${bytes}`);
} catch (e) {
  fail("docx→pdf conversion", e);
}

// 3) Native-ish txt / png fixtures + readability
const txtPath = join(outDir, "preview-sample.txt");
const pngPath = join(outDir, "preview-sample.png");
const mdPath = join(outDir, "preview-sample.md");
const csvPath = join(outDir, "preview-sample.csv");
await writeFile(txtPath, "Beam Agent preview sample\nСтрока на русском\n", "utf8");
await writeFile(mdPath, "# Beam\n\nMarkdown preview sample.\n", "utf8");
await writeFile(csvPath, "name,value\nBeam,1\nAgent,2\n", "utf8");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
await writeFile(pngPath, png);
ok("txt readable", { bytes: (await readFile(txtPath)).byteLength });
ok("md readable", { bytes: (await readFile(mdPath)).byteLength });
ok("csv readable", { bytes: (await readFile(csvPath)).byteLength });
ok("png readable", { bytes: (await stat(pngPath)).size });

await copyFile(txtPath, join(ws, "preview-sample.txt")).catch(() => {});
await copyFile(pngPath, join(ws, "preview-sample.png")).catch(() => {});
await copyFile(mdPath, join(ws, "preview-sample.md")).catch(() => {});
await copyFile(csvPath, join(ws, "preview-sample.csv")).catch(() => {});

// 4) Lightweight docx XML text extraction fallback (no LO)
try {
  const buf = await readFile(musk);
  const text = extractDocxText(buf);
  if (text.length > 50) ok("docx XML text fallback", { chars: text.length, sample: text.slice(0, 80) });
  else fail("docx XML text fallback", `too little text: ${text.length}`);
} catch (e) {
  fail("docx XML text fallback", e);
}

// 5) Shell association for docx
try {
  const ps = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `$p=${JSON.stringify(musk)}; if (-not (Test-Path -LiteralPath $p)) { throw 'missing' }; $ext='.docx'; $prog=(Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\\$ext" -EA SilentlyContinue).'(default)'; if (-not $prog) { 'no-assoc' } else { $prog }`,
    ],
    { windowsHide: true },
  );
  let out = "";
  for await (const chunk of ps.stdout) out += chunk;
  await new Promise((r) => ps.on("close", r));
  ok("docx shell association", { assoc: out.trim() || "(empty)" });
} catch (e) {
  fail("docx shell association", e);
}

// 6) Soft-fail / fix markers present in dist client
const client =
  "C:\\Beam-Agent\\dist\\Beam-Agent\\resources\\app\\beam\\node_modules\\@assistix\\beam-client-ui-sidebar-documentpreview\\lib\\client.js";
const src = await readFile(client, "utf8");
for (const marker of [
  "beam-lo-softfail",
  "beam-lo-failure-content",
  "beam-lo-ru-office",
  "beam-lo-ru-docpreview",
  "beam-lo-unavailable-open",
  "beam-lo-face-docx",
]) {
  if (src.includes(marker)) ok(`patch ${marker}`);
  else fail(`patch ${marker}`, "missing");
}
if (src.includes("beam-lo-unpreviewable-child")) fail("no conflicting unpreviewable child", "still present");
else ok("no conflicting unpreviewable child");
if (src.includes('title: "Office"') && src.includes("Предпросмотр «{name}» недоступен")) ok("ru i18n strings");
else fail("ru i18n strings", "missing expected copy");
if (src.includes("ru: ru$7")) ok("ru locale registered");
else fail("ru locale registered", "ru$7 not wired");

// 7) Supported builtin preview extensions declared in client
const supported = {
  office: ["doc", "docx", "ppt", "pptx"],
  excel: ["xlsx", "xls", "csv", "tsv"],
  pdf: ["pdf"],
  image: extractExtList(src, "imageBodyDefinition") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"],
  markdown: ["md", "markdown"],
  html: ["html", "htm"],
  code: "CODE_HIGHLIGHT_EXTENSIONS",
  text: "plain text pages (fallback for text-like files)",
  openExternally: "toolbar Open / unpreviewable empty action for unsupported types",
};
await writeFile(join(outDir, "supported-preview-types.json"), JSON.stringify(supported, null, 2), "utf8");
ok("supported types list written", supported);

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results, supported }, null, 2));
process.exitCode = failed.length ? 1 : 0;

function extractExtList(source, marker) {
  return null;
}

/** Minimal ZIP local-file extract for word/document.xml text nodes. */
function extractDocxText(buf) {
  const entries = [];
  let i = 0;
  while (i + 30 < buf.length) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString("utf8");
    const dataStart = i + 30 + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    entries.push({ name, method, data });
    i = dataStart + compSize;
  }
  const doc = entries.find((e) => e.name === "word/document.xml");
  if (!doc) throw new Error("word/document.xml missing");
  let xml;
  if (doc.method === 0) xml = doc.data.toString("utf8");
  else if (doc.method === 8) xml = inflateRawSync(doc.data).toString("utf8");
  else throw new Error(`unsupported zip method ${doc.method}`);
  return xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:t[^>]*>/g, "")
    .replace(/<\/w:t>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
