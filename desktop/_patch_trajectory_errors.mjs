import fs from "fs";

const paths = [
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-trajectory/lib/client.js",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-trajectory/lib/client.js",
];

const needle =
  'if (node.isError) return node.error === void 0 ? "error" : `${node.error.name}: ${node.error.code}`;';
const replacement = `if (node.isError) {
				const code = node.error?.code || "";
				const map = {
					SERVER: "Ошибка связи с моделью",
					EMPTY_RESPONSE: "Пустой ответ модели",
					RATE_LIMIT: "Лимит запросов",
					AUTH: "Нужен вход",
					TIMEOUT: "Таймаут",
					TRANSPORT: "Ошибка сети",
					QUOTA: "Лимит токенов",
				};
				if (map[code]) return map[code];
				return node.error === void 0 ? "ошибка" : String(node.error.message || code || "ошибка");
			}`;

for (const p of paths) {
  if (!fs.existsSync(p)) {
    console.log("skip missing", p);
    continue;
  }
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes(needle)) {
    console.log("needle missing", p);
    continue;
  }
  s = s.replace(needle, replacement);
  fs.writeFileSync(p, s);
  console.log("patched", p);
}
