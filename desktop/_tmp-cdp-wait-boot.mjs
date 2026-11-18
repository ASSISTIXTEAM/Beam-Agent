const PORT = Number(process.env.BEAM_CDP_PORT || 9222);
const MAX = Number(process.env.BEAM_BOOT_WAIT_SEC || 90);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function targets() {
  try {
    return await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  } catch {
    return [];
  }
}

async function probe(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r);
    ws.addEventListener("error", j);
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m);
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Runtime.enable");
  const ev = await send("Runtime.evaluate", {
    expression: `(() => {
      const text = (document.body?.innerText || "").slice(0, 200);
      const boot = !!document.querySelector("[data-beam-boot]:not([hidden]),[data-dsh-boot]:not([hidden])");
      const splash = !!document.querySelector("#beam-splash-watchdog, [data-beam-boot], [data-dsh-boot]");
      const bootHidden = [...document.querySelectorAll("[data-beam-boot],[data-dsh-boot]")].every((e) => e.hidden || e.getAttribute("hidden") !== null);
      const buttons = document.querySelectorAll("button").length;
      const gear = buttons > 20 && !/unavailable|could not start/i.test(text);
      const dialog = /unavailable|could not start|webServer/i.test(text);
      return { boot: boot || (splash && !bootHidden && buttons < 5), gear, buttons, text: text.replace(/\\s+/g, " ").trim().slice(0, 80), dialog, hasDshBoot: typeof window.__DSH_BOOT__ };
    })()`,
    returnByValue: true,
  });
  ws.close();
  return ev.result?.result?.value ?? { boot: true, gear: false, buttons: 0, text: "eval-failed", dialog: false };
}

let last = null;
for (let i = 0; i < MAX; i++) {
  const pages = (await targets()).filter((t) => t.type === "page");
  if (pages.length === 0) {
    console.log(i, { boot: true, gear: false, buttons: 0, text: "no-page" });
    await sleep(1000);
    continue;
  }
  last = await probe(pages[0]);
  console.log(i, JSON.stringify(last));
  if (last.dialog) {
    console.error("unavailable-dialog");
    process.exit(14);
  }
  if (!last.boot && last.gear && last.buttons >= 10 && last.hasDshBoot === "object") {
    console.log("BOOT_OK");
    process.exit(0);
  }
  await sleep(1000);
}
console.error("BOOT_TIMEOUT", last);
process.exit(13);
