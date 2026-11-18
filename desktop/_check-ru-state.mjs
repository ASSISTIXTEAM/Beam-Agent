import fs from "node:fs";
import path from "node:path";

const roots = [
  "runtime/app/dsh/node_modules/@deepseek-ai",
  "dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai",
];

function check(label, file, checks) {
  const ok = fs.existsSync(file);
  console.log(`\n[${label}] ${path.basename(path.dirname(path.dirname(file)))}/${path.basename(file)} exists=${ok}`);
  if (!ok) return;
  const d = fs.readFileSync(file, "utf8");
  for (const [name, fn] of Object.entries(checks)) {
    console.log(" ", name, fn(d));
  }
}

for (const root of roots) {
  console.log("\n====", root);
  check("conversation", path.join(root, "dsh-client-ui-conversation/lib/client.js"), {
    "Into the Unknown": (d) => d.includes("Into the Unknown"),
    "Build with Beam": (d) => d.includes("Build with Beam"),
    "hero.preview Preview": (d) => d.includes('"hero.preview": "Preview"'),
    "has const ru": (d) => /\bconst ru\b/.test(d),
    "locale.register ru": (d) => /locale\.register\([^)]*ru/.test(d),
    "HeroFish img": (d) => /function HeroFish[\s\S]{0,400}img/.test(d),
    "HeroFish FishLogo/svg": (d) => /function HeroFish[\s\S]{0,800}(FishLogo|svg)/.test(d),
  });

  check("locale", path.join(root, "dsh-client-locale/lib/client.js"), {
    'LOCALE_IDS ["en","ru"]': (d) => d.includes('LOCALE_IDS = ["en", "ru"]'),
    "const ru$1": (d) => d.includes("const ru$1"),
    "zh still registered common": (d) => /COMMON_NS[\s\S]{0,80}zh/.test(d),
  });

  check("sidebar", path.join(root, "dsh-client-ui-sidebar/lib/client.js"), {
    "brand.localBuild EN": (d) => d.includes("brand.localBuild"),
    "localBuildVersion Preview?": (d) => {
      const m = d.match(/function localBuildVersion\(\)\s*\{[^}]+\}/);
      return m ? m[0] : "n/a";
    },
  });

  const html = path.join(root, "dsh-web-frontend/dist/index.html");
  check("index.html", html, {
    "rewriteLeafText": (d) => d.includes("rewriteLeafText"),
    "Build with": (d) => d.includes("Build with"),
    "isRu": (d) => d.includes("isRu"),
  });

  const css = path.join(root, "dsh-web-frontend/dist/assets/beam-override.css");
  check("beam-override", css, {
    "hero preview hide?": (d) => /hero|preview|buildVersion|fish/i.test(d),
    "logo filter": (d) => d.includes("brandMark") || d.includes("filter"),
    "len": (d) => d.length,
  });
}
