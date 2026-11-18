/**
 * First-class Settings sections: Профиль (account) + Лимиты (Tide/Flare/Pine).
 * - Restore hidden account settings.section
 * - Register beam limits settings.section (Settings-dense rows, not DIY modal)
 * - Stop hideSettingsPlumbing from killing Profile/Limits nav
 * - Route sidebar profile/rings → Settings openSection
 * - Keep Beam brand + Recommended badge contrast
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const TREES = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix"),
];
const WEBS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
];

function restoreAccountSection(clientPath) {
  if (!fs.existsSync(clientPath)) return false;
  let s = fs.readFileSync(clientPath, "utf8");
  const marker = "/* beam-hide-settings account */";
  if (!s.includes(marker)) {
    if (s.includes('id: "account"') && s.includes('name: "settings.section"')) {
      console.log("  account already live", path.relative(ROOT, clientPath));
      return true;
    }
    console.log("  account marker missing", path.relative(ROOT, clientPath));
    return false;
  }

  const reg = `ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "account",
				order: 5,
				label: () => t("nav"),
				locale: "settings.account",
				inject: () => operations
			}, AccountSection));`;

  s = s.replace(
    /\/\* beam-hide-settings account \*\/ void 0; \/\* was: settings\.section account \*\//,
    reg
  );

  // Profile naming
  s = s.replace(/nav: "Account"/g, 'nav: "Profile"');
  s = s.replace(/"nav": "Аккаунт"/g, '"nav": "Профиль"');
  s = s.replace(/nav: "账号与余额"/g, 'nav: "账号"');

  fs.writeFileSync(clientPath, s);
  console.log("  restored account section", path.relative(ROOT, clientPath));
  return true;
}

const LIMITS_MARKER = "/* beam-settings-limits-section */";

function ensureLimitsSection(generalPath) {
  if (!fs.existsSync(generalPath)) return false;
  let s = fs.readFileSync(generalPath, "utf8");

  // Expose nav API on window for injector
  if (!s.includes("window.__beamSettingsNav")) {
    s = s.replace(
      `const disposeSettingsNav = ctx.reflect.provide("settingsNavigation", {
					open: () => {
						shellInstance.actions.open();
					},
					openSection: (id) => {
						shellInstance.actions.openSection(id);
					}
				});`,
      `const disposeSettingsNav = ctx.reflect.provide("settingsNavigation", {
					open: () => {
						shellInstance.actions.open();
					},
					openSection: (id) => {
						shellInstance.actions.openSection(id);
					}
				});
				try {
					window.__beamSettingsNav = {
						open: () => shellInstance.actions.open(),
						openSection: (id) => shellInstance.actions.openSection(id)
					};
				} catch {}`
    );
  }

  // Nav icon for limits
  if (!s.includes('id === "limits"')) {
    s = s.replace(
      `if (id === "voice") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconMicrophoneOutlineMedium, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});`,
      `if (id === "limits") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutlineMedium, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});
			if (id === "voice") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconMicrophoneOutlineMedium, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});`
    );
  }

  if (s.includes(LIMITS_MARKER)) {
    // refresh registration block only
    fs.writeFileSync(generalPath, s);
    console.log("  limits marker exists, nav api refreshed", path.relative(ROOT, generalPath));
    return true;
  }

  const limitsComponent = `
		${LIMITS_MARKER}
		function BeamLimitsSettingsSection() {
			const [, bump] = react.useState(0);
			react.useEffect(() => {
				const onRefresh = () => bump((n) => n + 1);
				window.addEventListener("beam:refresh-limits", onRefresh);
				window.addEventListener("beam:limits-updated", onRefresh);
				return () => {
					window.removeEventListener("beam:refresh-limits", onRefresh);
					window.removeEventListener("beam:limits-updated", onRefresh);
				};
			}, []);
			const snap = (typeof window !== "undefined" && window.__beamLimitsSnapshot) || { models: [] };
			const ru = ((document.documentElement.lang || "").toLowerCase().startsWith("ru")) || ((document.documentElement.dataset.beamLang || "") === "ru");
			const intro = ru ? "Недельные лимиты Tide, Flare и Pine. У каждой модели свой счётчик: использовано / лимит." : "Weekly limits for Tide, Flare, and Pine. Each model has its own used / limit counter."; /* beam-quotas-ux-clarity: re-run patch-quotas-ux-clarity.mjs after this */
			const refreshLabel = ru ? "Обновить" : "Refresh";
			const models = Array.isArray(snap.models) && snap.models.length ? snap.models : [
				{ id: "tide", name: "Tide", tag: ru ? "Быстрая" : "Fast", desc: ru ? "Повседневное мышление — быстрые задачи и код" : "Everyday thinking — fast tasks and code", used: 0, limit: 1, color: "#f59e0b" },
				{ id: "flare", name: "Flare", tag: ru ? "Стиль" : "Style", desc: ru ? "Стиль и креатив — тексты, полировка, идеи" : "Style and creative work", used: 0, limit: 1, color: "#a78bfa" },
				{ id: "pine", name: "Pine", tag: ru ? "Точная" : "Precise", desc: ru ? "Точность — сложные задачи и длинный контекст" : "Accuracy — hard tasks and long context", used: 0, limit: 1, color: "#34d399" }
			];
			const fmt = (n) => {
				const v = Number(n) || 0;
				if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\\.0$/, "") + "M";
				if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\\.0$/, "") + "K";
				return String(Math.round(v));
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "beam-settings-limits",
				"data-beam-settings-limits": "1",
				children: [
					(0, react_jsx_runtime.jsx)("p", { className: "beam-settings-limits-intro", children: intro }),
					(0, react_jsx_runtime.jsx)("div", {
						className: "beam-settings-limits-list",
						children: models.map((m) => {
							const pct = Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
							return (0, react_jsx_runtime.jsxs)("div", {
								className: "beam-settings-limits-row",
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: "beam-settings-limits-rowText",
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												className: "beam-settings-limits-title",
												children: [
													(0, react_jsx_runtime.jsx)("span", { className: "beam-settings-limits-dot", style: { background: m.color } }),
													m.name,
													(0, react_jsx_runtime.jsx)("span", { className: "beam-settings-limits-tag", children: m.tag || "" })
												]
											}),
											(0, react_jsx_runtime.jsx)("div", { className: "beam-settings-limits-desc", children: m.desc || "" }),
											(0, react_jsx_runtime.jsxs)("div", {
												className: "beam-settings-limits-meta",
												children: [
													(0, react_jsx_runtime.jsx)("span", { children: (ru ? "Лимиты недели " : "Weekly ") + fmt(m.used) + " / " + fmt(m.limit) }),
													(0, react_jsx_runtime.jsx)("span", { children: pct + "%" })
												]
											}),
											(0, react_jsx_runtime.jsx)("div", {
												className: "beam-settings-limits-bar",
												children: (0, react_jsx_runtime.jsx)("span", { style: { width: pct + "%", background: m.color } })
											})
										]
									})
								]
							}, m.id || m.name);
						})
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "beam-settings-limits-actions",
						children: (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "beam-settings-limits-btn",
							onClick: () => {
								try { window.dispatchEvent(new CustomEvent("beam:refresh-limits")); } catch {}
							},
							children: refreshLabel
						})
					})
				]
			});
		}
`;

  // Insert component before general settings.section register
  if (!s.includes("function BeamLimitsSettingsSection")) {
    const needle = 'id: "general"';
    const idIdx = s.indexOf(needle);
    if (idIdx < 0) throw new Error("general id not found");
    const injectStart = s.lastIndexOf('ctx.slots.inject("settings.section"', idIdx);
    if (injectStart < 0) throw new Error("general settings.section inject not found");
    s = s.slice(0, injectStart) + limitsComponent + "\n\t\t" + s.slice(injectStart);
  }

  // Register limits section after general (idempotent)
  if (!s.includes("BeamLimitsSettingsSection));") || !s.includes('id: "limits"')) {
    const genEnd = s.indexOf("}, GeneralSection));");
    if (genEnd < 0) throw new Error("GeneralSection register end not found");
    const insertAt = genEnd + "}, GeneralSection));".length;
    if (!s.slice(insertAt, insertAt + 200).includes('id: "limits"')) {
      s =
        s.slice(0, insertAt) +
        `
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "limits",
				order: 8,
				label: () => ((document.documentElement.lang || "").toLowerCase().startsWith("ru") || document.documentElement.dataset.beamLang === "ru") ? "Лимиты" : "Limits",
				locale: NS
			}, BeamLimitsSettingsSection));` +
        s.slice(insertAt);
    }
  }

  fs.writeFileSync(generalPath, s);
  console.log("  limits section registered", path.relative(ROOT, generalPath));
  return true;
}

function patchHidePlumbingInHtml(htmlPath) {
  if (!fs.existsSync(htmlPath)) return false;
  let html = fs.readFileSync(htmlPath, "utf8");
  let changed = false;

  // Allow Profile/Limits in Settings nav; still hide Models/Plugins/Presets
  const oldKill =
    /const killNav = \/\^\(Limits\|Лимиты\|Models\|Модели\|Agent presets\|Пресеты агента\|Account\|Аккаунт\|Built-in plugins\|Встроенные плагины\|Plugins\|Плагины\)\$\/i;/;
  const newKill = `const killNav = /^(Models|Модели|Agent presets|Пресеты агента|Built-in plugins|Встроенные плагины|Plugins|Плагины)$/i;`;
  if (oldKill.test(html)) {
    html = html.replace(oldKill, newKill);
    changed = true;
  } else if (html.includes("killNav") && html.includes("Account|Аккаунт")) {
    html = html.replace(
      /const killNav = \/\^[^;]+\$\/i;/,
      newKill
    );
    changed = true;
  }

  // pickSettingsSection implementation
  if (!html.includes("const pickSettingsSection = ")) {
    const hook = "  const openAppSettings = (section) => {";
    if (!html.includes(hook)) {
      console.log("  no openAppSettings hook", path.relative(ROOT, htmlPath));
    } else {
      html = html.replace(
        hook,
        `  const pickSettingsSection = (section) => {
    const key = String(section || "general").toLowerCase();
    const map = {
      general: /^(Общие|General|通用)/i,
      account: /^(Профиль|Profile|Account|Аккаунт|账号)/i,
      profile: /^(Профиль|Profile|Account|Аккаунт|账号)/i,
      limits: /^(Лимиты|Limits)/i,
      voice: /^(Голосовой|Voice|语音)/i,
    };
    const re = map[key] || map.general;
    const tryClick = () => {
      try {
        if (window.__beamSettingsNav?.openSection) {
          const id = key === "profile" ? "account" : key;
          window.__beamSettingsNav.openSection(id);
          return true;
        }
      } catch {}
      const panel = document.querySelector('[class*="AnXs9G_panel"], [class*="_panel_"][class*="Settings"], [role="dialog"]');
      const scope = panel || document;
      const btn = [...scope.querySelectorAll("button, [role='tab']")].find((el) => {
        const label = (el.innerText || el.textContent || "").trim().split("\\n")[0].trim();
        return re.test(label);
      });
      if (btn) { btn.click(); return true; }
      return false;
    };
    if (!tryClick()) setTimeout(tryClick, 120);
  };

` + hook
      );
      changed = true;
    }
  }

  // Prefer Settings nav API in openAppSettings
  if (html.includes("const openAppSettings = (section) => {") && !html.includes("__beamSettingsNav?.openSection")) {
    html = html.replace(
      "  const openAppSettings = (section) => {\n    /* beam-finish-open-settings-gear */",
      `  const openAppSettings = (section) => {
    try {
      if (window.__beamSettingsNav?.openSection) {
        const id = section === "profile" ? "account" : (section || "general");
        window.__beamSettingsNav.openSection(id);
        return;
      }
      if (window.__beamSettingsNav?.open) {
        window.__beamSettingsNav.open();
        if (section) setTimeout(() => pickSettingsSection(section), 80);
        return;
      }
    } catch {}
    /* beam-finish-open-settings-gear */`
    );
    changed = true;
  }

  // Route profile / limits clicks to Settings instead of DIY modals
  if (html.includes("const openProfileModal = () => {") && !html.includes("/* beam-profile-via-settings */")) {
    html = html.replace(
      /const openProfileModal = \(\) => \{[\s\S]*?\n  \};/,
      `const openProfileModal = () => {
    /* beam-profile-via-settings */
    closeBeamDialogs();
    openAppSettings("account");
  };`
    );
    changed = true;
  }
  if (html.includes("const openLimitsModal = () => {") && !html.includes("/* beam-limits-via-settings */")) {
    html = html.replace(
      /const openLimitsModal = \(\) => \{[\s\S]*?\n  \};/,
      `const openLimitsModal = () => {
    /* beam-limits-via-settings */
    closeBeamDialogs();
    openAppSettings("limits");
  };`
    );
    changed = true;
  }

  // Publish limits snapshot for Settings Limits section
  if (!html.includes("window.__beamLimitsSnapshot")) {
    html = html.replace(
      "const models = modelsFrom(data);\n    const rings = models.map((m) => {",
      `const models = modelsFrom(data);
    try {
      window.__beamLimitsSnapshot = {
        models: models.map((m) => ({
          id: m.id, name: m.name, color: m.color, used: m.used, limit: m.limit,
          tag: (t()[(m.id + "Tag")] || ""),
          desc: (t()[(m.id + "Desc")] || "")
        })),
        at: Date.now()
      };
    } catch {}
    const rings = models.map((m) => {`
    );
    changed = true;
  }

  // Hide DIY modals if somehow opened
  if (!html.includes("beam-hide-diy-modals")) {
    // handled in CSS override
  }

  if (changed) fs.writeFileSync(htmlPath, html);
  console.log("  html", path.relative(ROOT, htmlPath), changed);
  return changed;
}

function upsertLimitsCss(overridePath) {
  if (!fs.existsSync(overridePath)) return false;
  const marker = "/* ===== BEAM settings limits rows ===== */";
  const block = `${marker}
.beam-settings-limits {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 8px;
  color: var(--dsw-alias-label-primary, var(--beam-ink));
}
.beam-settings-limits-intro {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary, var(--beam-muted));
}
.beam-settings-limits-list {
  display: flex;
  flex-direction: column;
  border: .5px solid var(--dsw-alias-settings-card-stroke, var(--beam-line));
  border-radius: var(--dsw-radius-xl, 14px);
  background: var(--dsw-alias-settings-card-fill, var(--beam-elev));
  overflow: hidden;
}
.beam-settings-limits-row {
  padding: 12px 16px;
  border-bottom: .5px solid var(--dsw-alias-border-l2, var(--beam-line));
}
.beam-settings-limits-row:last-child { border-bottom: 0; }
.beam-settings-limits-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.beam-settings-limits-dot {
  width: 8px; height: 8px; border-radius: 50%; flex: none;
}
.beam-settings-limits-tag {
  margin-left: auto;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-tertiary, var(--beam-soft));
}
.beam-settings-limits-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary, var(--beam-soft));
}
.beam-settings-limits-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, var(--beam-muted));
}
.beam-settings-limits-bar {
  margin-top: 6px;
  height: 4px;
  border-radius: 99px;
  background: rgba(255,255,255,.08);
  overflow: hidden;
}
.beam-settings-limits-bar > span {
  display: block; height: 100%; border-radius: inherit;
}
.beam-settings-limits-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.beam-settings-limits-btn {
  box-sizing: border-box;
  border: .5px solid var(--dsw-alias-border-l3, var(--beam-line));
  border-radius: var(--dsw-radius-md, 10px);
  min-width: 58px;
  height: 36px;
  padding: 0 14px;
  background: transparent;
  color: var(--dsw-alias-label-primary, var(--beam-ink));
  font: inherit;
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;
}
.beam-settings-limits-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.04));
}
/* Kill standalone DIY profile/limits modals — Settings owns these screens */
#beam-profile-modal,
#beam-limits-modal {
  display: none !important;
}
/* Account / ASSISTIX badges: dark ink on Beam chip */
._6qcDqa_primary,
button._6qcDqa_primary,
a._6qcDqa_primary {
  color: #042f2e !important;
  -webkit-text-fill-color: #042f2e !important;
}
`;

  let css = fs.readFileSync(overridePath, "utf8");
  if (css.includes(marker)) {
    const start = css.indexOf(marker);
    const next = css.indexOf("\n/* =====", start + marker.length);
    css = css.slice(0, start) + block + (next > start ? "\n" + css.slice(next).replace(/^\n+/, "") : "\n");
  } else {
    css = css.trimEnd() + "\n\n" + block + "\n";
  }
  fs.writeFileSync(overridePath, css);
  return true;
}

let ok = 0;
for (const tree of TREES) {
  console.log("→", path.relative(ROOT, tree));
  const a = restoreAccountSection(path.join(tree, "beam-client-ui-settings-account/lib/client.js"));
  const g = ensureLimitsSection(path.join(tree, "beam-client-ui-settings-general/lib/client.js"));
  if (a && g) ok++;
}

for (const web of WEBS) {
  console.log("→ web", path.relative(ROOT, web));
  patchHidePlumbingInHtml(path.join(web, "index.html"));
  upsertLimitsCss(path.join(web, "assets/beam-override.css"));
}

// Also re-apply brand contrast + sidebar foot routing
spawnSync(process.execPath, [path.join(ROOT, "desktop/patch-beam-brand-contrast.mjs")], {
  stdio: "inherit",
});
spawnSync(process.execPath, [path.join(ROOT, "desktop/patch-sidebar-profile-foot.mjs")], {
  stdio: "inherit",
});

// Re-run html routing after sidebar foot (it rewrites openProfileModal)
for (const web of WEBS) {
  patchHidePlumbingInHtml(path.join(web, "index.html"));
}

// Assistix Profile session + dynamic Settings title (must stay after account restore)
spawnSync(process.execPath, [path.join(ROOT, "desktop/patch-settings-auth-title.mjs")], {
  stdio: "inherit",
});

if (ok < 1) {
  console.error("Failed to patch settings trees");
  process.exit(1);
}
console.log("Done. settings trees=", ok);
