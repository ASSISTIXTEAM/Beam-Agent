/**
 * Verify LibreOffice kit can convert the Musk biography docx after types.rdb restore.
 */
import { createConverter } from "../dist/Beam-Agent/resources/app/beam/node_modules/@assistix/libreoffice-kit/lib/index.js";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";

const inputPath = "C:\\Users\\Alexa\\.beam\\default-workspace\\Илон_Маск_биография.docx";
const outDir = "C:\\Beam-Agent\\_tmp_lo_test";
const outputPath = join(outDir, "musk-verify.pdf");

await mkdir(outDir, { recursive: true });

console.log("discovering converter...");
const converter = await createConverter();
console.log("backend ok, rendering...");
const t0 = Date.now();
try {
  const result = await converter.render({ inputPath, outputPath }, AbortSignal.timeout(120_000));
  const info = await stat(outputPath);
  console.log(JSON.stringify({
    ok: true,
    ms: Date.now() - t0,
    pdfBytes: info.size,
    missingFonts: result.missingFonts?.length ?? 0,
  }, null, 2));
} catch (err) {
  console.error(JSON.stringify({
    ok: false,
    ms: Date.now() - t0,
    name: err?.name,
    code: err?.code,
    message: err?.message,
    cause: err?.cause?.message ?? String(err?.cause ?? ""),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await converter.dispose?.().catch(() => {});
}
