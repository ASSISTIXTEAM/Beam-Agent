import fs from "node:fs";

const p =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js";
let s = fs.readFileSync(p, "utf8");

const brainPath =
  "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4";

const brainFn = `function RunningWhaleTail() {
			return (0, react_jsx_runtime.jsx)("span", {
				className: ChatView_module_css_default.runningIcon,
				"aria-hidden": "true",
				style: { color: "#00B3BC", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16 },
				children: (0, react_jsx_runtime.jsx)("svg", {
					width: 16,
					height: 16,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "#00B3BC",
					strokeWidth: 2,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					style: { display: "block" },
					children: (0, react_jsx_runtime.jsx)("path", { d: ${JSON.stringify(brainPath)} })
				})
			});
		}`;

const start = s.indexOf("function RunningWhaleTail()");
if (start < 0) throw new Error("missing fn");
let depth = 0;
let seen = false;
let fnEnd = -1;
for (let i = start; i < s.length; i++) {
  if (s[i] === "{") {
    depth++;
    seen = true;
  } else if (s[i] === "}") {
    depth--;
    if (seen && depth === 0) {
      fnEnd = i + 1;
      break;
    }
  }
}
if (fnEnd < 0) throw new Error("no end");
s = s.slice(0, start) + brainFn + s.slice(fnEnd);
fs.writeFileSync(p, s);
console.log("brain icon ok");
