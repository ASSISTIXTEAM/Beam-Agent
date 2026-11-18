import fs from "node:fs";
import path from "node:path";

const ROOT = "c:/Users/Alexa/OneDrive/Documents/Beam Agent";
const checks = [];
for (const label of ["runtime", "dist"]) {
  const tree = label === "runtime"
    ? path.join(ROOT, "runtime/app/beam/node_modules/@assistix")
    : path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix");
  const files = {
    permUi: fs.readFileSync(path.join(tree, "beam-client-ui-permission-presets/lib/client.js"), "utf8"),
    permHost: fs.readFileSync(path.join(tree, "beam-permission-presets/lib/index.js"), "utf8"),
    sandbox: fs.readFileSync(path.join(tree, "beam-sandbox/lib/index.js"), "utf8"),
    modes: fs.readFileSync(path.join(tree, "beam-client-ui-agent-preset/lib/client.js"), "utf8"),
    approval: fs.readFileSync(path.join(tree, "beam-client-ui-approval/lib/client.js"), "utf8"),
    yml: fs.readFileSync(path.join(tree, "beam-base/cordis.patch.yml"), "utf8"),
  };
  const expect = [
    ["permUi View only", files.permUi.includes('"preset.readOnly": "View only"')],
    ["permUi RU", files.permUi.includes("Только просмотр") && files.permUi.includes("const accessRu")],
    ["permUi desc", files.permUi.includes("preset.readOnly.desc")],
    ["tool elevate", files.permHost.includes("request_elevated_access")],
    ["sandbox labels", files.sandbox.includes("Edit project") && files.sandbox.includes("request_elevated_access")],
    ["mode Auto", files.modes.includes('presetStandardName: "Auto"')],
    ["mode RU Auto", files.modes.includes('presetStandardName: "Авто"')],
    ["hide cordis", files.modes.includes('preset.id === "cordis"')],
    ["no DSH creator EN", !files.modes.includes("Customize DSH") && !files.modes.includes("to DSH.")],
    ["approval Allow", files.approval.includes('allowOnce: "Allow"') || files.approval.includes('"allowOnce": "Разрешить"')],
    ["yml names", files.yml.includes("name: Edit project") && files.yml.includes("name: View only")],
    ["no BEAM_BASE_URL in host", !files.permHost.includes("BEAM_BASE_URL")],
  ];
  for (const [name, ok] of expect) checks.push([label, name, ok]);
}
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  checks.push(["env", "no BEAM_BASE_URL", !/^BEAM_BASE_URL=/m.test(env)]);
}
for (const [a,b,ok] of checks) console.log(ok ? "PASS" : "FAIL", a, b);
console.log("failed", checks.filter(c => !c[2]).length);
