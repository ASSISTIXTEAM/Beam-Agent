import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const md = `# Beam Badge

Add the official “powered by Beam” badge without recreating or restyling it.

## Assets

- Local PNG: [\`dsh-badge.png\`](dsh-badge.png), 726×120 source image; render at 121×20
- Shields.io image URL: \`https://img.shields.io/badge/powered_by-Beam-00B3BC?style=flat-square\`
- Project URL: \`https://agent.assistix.org\`

## Markdown

Use this linked badge in Markdown:

\`\`\`markdown
[![](https://img.shields.io/badge/powered_by-Beam-00B3BC?style=flat-square)](https://agent.assistix.org)
\`\`\`

If attribution should not be linked, use:

\`\`\`markdown
![](https://img.shields.io/badge/powered_by-Beam-00B3BC?style=flat-square)
\`\`\`

## Usage rules

- For GitHub or GitLab Markdown, use the Shields.io URL and link it to the project URL unless the user asks for an unlinked image.
- For Feishu and other systems that import remote images unreliably, upload \`dsh-badge.png\` from this skill directory instead of generating another badge.
- Preserve the badge's 121×20 dimensions and aspect ratio.
- Place the badge at the end of the attributed document or section unless the user specifies another position.
- Do not substitute another color, logo, label, or project URL.
`;

const files = [
  "runtime/app/beam/node_modules/@assistix/beam-skill-badge/assets/dsh-badge.md",
  "runtime/app/beam/node_modules/@assistix/beam-skill-badge/lib/index.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-skill-badge/assets/dsh-badge.md",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-skill-badge/lib/index.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-skill-badge/assets/dsh-badge.md",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-skill-badge/lib/index.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-skill-badge/assets/dsh-badge.md",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-skill-badge/lib/index.js",
];

for (const rel of files) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  if (rel.endsWith(".md")) {
    fs.writeFileSync(p, md);
    console.log("md", rel);
  } else {
    let s = fs.readFileSync(p, "utf8");
    s = s.replace(/powered-by-dsh attribution/g, "powered-by-Beam attribution");
    fs.writeFileSync(p, s);
    console.log("js", rel);
  }
}
