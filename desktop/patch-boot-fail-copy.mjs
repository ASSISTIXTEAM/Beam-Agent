import fs from "node:fs";

const p =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js";
let s = fs.readFileSync(p, "utf8");
s = s.replaceAll("Failed to load plugins", "Не удалось загрузить компоненты");
s = s.replaceAll("web boot: ", "загрузка: ");
const from =
  "t.append(Yn(Kn.failedItem,r));this.failure!==void 0&&t.append(Yn(Kn.failedItem,this.failure))";
const to =
  't.append(Yn(Kn.failedItem,String(r).replace(/@deepseek-ai\\//g,"").replace(/dsh-client-ui-/g,"").replace(/dsh-/g,"")));this.failure!==void 0&&t.append(Yn(Kn.failedItem,String(this.failure).replace(/@deepseek-ai\\//g,"").replace(/dsh-client-ui-/g,"").replace(/dsh-/g,"").replace(/DeepSeek/gi,"ASSISTIX")))';
if (!s.includes(from)) {
  console.warn("boot fail append pattern not found");
} else {
  s = s.replace(from, to);
  console.log("boot fail sanitize applied");
}
fs.writeFileSync(p, s);

// Mirror open-in-app fix into runtime copy if still broken
const runtimeOpen =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-open-in-app/lib/client.js";
if (fs.existsSync(runtimeOpen)) {
  let r = fs.readFileSync(runtimeOpen, "utf8");
  r = r.replace(
    /locale\.register\(NS,\s*\{\s*en\s*,\s*ru\s*\}\)/g,
    "locale.register(NS, { en, ru: en })"
  );
  fs.writeFileSync(runtimeOpen, r);
  console.log("runtime open-in-app", r.includes("ru: en"));
}
