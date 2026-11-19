import fs from "node:fs";

const paths = [
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
  "C:/Beam-Agent/runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "C:/Beam-Agent/runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
];

const block = `
/* Titlebar sidebar toggle — duocolor mask */
[data-windows-titlebar] .wtg9ga_toggle svg,
[data-windows-titlebar] button.wtg9ga_toggle svg,
.wtg9ga_toggle .wtg9ga_panelIcon,
.wtg9ga_toggle svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/window-sidebar.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/window-sidebar.svg") center / contain no-repeat !important;
  opacity: 1 !important;
  overflow: hidden !important;
}
[data-windows-titlebar] .wtg9ga_toggle svg *,
[data-windows-titlebar] button.wtg9ga_toggle svg *,
.wtg9ga_toggle .wtg9ga_panelIcon *,
.wtg9ga_toggle svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
`;

for (const p of paths) {
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("Titlebar sidebar toggle — duocolor mask")) {
    console.log("already", p);
    continue;
  }
  s = s.trimEnd() + "\n" + block + "\n";
  fs.writeFileSync(p, s);
  console.log("patched", p);
}
