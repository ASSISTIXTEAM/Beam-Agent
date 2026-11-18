/**
 * Settings UX fixes:
 * 1) Profile/Account section uses ASSISTIX ID session (dense Settings rows)
 * 2) Modal nav title follows left-nav selection (General→Settings, Profile, Limits, Voice)
 *
 * Applies to runtime + dist @assistix trees + web frontend injectors.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const TREES = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix"),
];
const WEBS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
];

const ACCOUNT_MARKER = "/* beam-assistix-account-panel */";
const RICH_MARKER = "data-beam-assistix-profile-rich";
const TITLE_MARKER = "/* beam-settings-dynamic-title */";
const HTML_STATUS_MARKER = "/* beam-assistix-status-publish */";
const HTML_LOGIN_MARKER = "/* beam-assistix-login-event */";
const PROFILE_CSS_MARKER = "/* ===== BEAM settings profile dense ===== */";

function buildAssistixHook() {
  return `const signedIn = state?.status === "credential-stored";
			${ACCOUNT_MARKER}
			const [assistixSnap, setAssistixSnap] = (0, react.useState)(() => {
				try {
					return typeof window !== "undefined" ? window.__beamAssistixStatus || null : null;
				} catch {
					return null;
				}
			});
			(0, react.useEffect)(() => {
				const sync = () => {
					try {
						setAssistixSnap(window.__beamAssistixStatus || null);
					} catch {}
				};
				sync();
				window.addEventListener("beam:assistix-updated", sync);
				window.addEventListener("beam:limits-updated", sync);
				return () => {
					window.removeEventListener("beam:assistix-updated", sync);
					window.removeEventListener("beam:limits-updated", sync);
				};
			}, []);
			const assistixUser = assistixSnap?.signedIn && assistixSnap?.user ? assistixSnap.user : null;
			const assistixSigned = !!assistixUser;
			const openAssistixLogin = () => {
				try {
					window.dispatchEvent(new CustomEvent("beam:assistix-login"));
				} catch {}
			};
			const refreshAssistix = async () => {
				setBusy(true);
				try {
					if (typeof window.__beamRefreshAssistix === "function") {
						await window.__beamRefreshAssistix({ force: true });
					} else {
						const r = await fetch("http://127.0.0.1:17865/assistix/status");
						const data = await r.json();
						window.__beamAssistixStatus = data;
						window.dispatchEvent(new CustomEvent("beam:assistix-updated"));
					}
					try { window.dispatchEvent(new CustomEvent("beam:refresh-limits")); } catch {}
				} catch {}
				setBusy(false);
			};
			const logoutAssistix = async () => {
				setBusy(true);
				try {
					await fetch("http://127.0.0.1:17865/assistix/logout", { method: "POST" });
				} catch {}
				try {
					window.__beamAssistixStatus = { signedIn: false, user: null, quotas: (assistixSnap && assistixSnap.quotas) || {} };
					window.dispatchEvent(new CustomEvent("beam:assistix-updated"));
					window.dispatchEvent(new CustomEvent("beam:refresh-limits"));
					if (typeof window.__beamRefreshAssistix === "function") window.__beamRefreshAssistix({ force: true });
				} catch {}
				setBusy(false);
			};
			const openLimitsSection = () => {
				try {
					if (window.__beamSettingsNav?.openSection) {
						window.__beamSettingsNav.openSection("limits");
						return;
					}
				} catch {}
				try {
					window.dispatchEvent(new CustomEvent("beam:open-settings", { detail: { section: "limits" } }));
				} catch {}
			};
			/* beam-assistix-account-panel-end */
			(0, react.useEffect)(() => () => {
				releasePage.current?.();
				releasePage.current = void 0;
			}, []);`;
}

function buildAssistixPanel() {
  return `if (!signedIn && !active) {
				if (assistixSigned) {
					const axName = assistixUser.display_name || assistixUser.name || "ASSISTIX";
					const axEmail = assistixUser.email || "";
					const axAvatar = assistixUser.avatar_url ? {
						status: "ready",
						url: String(assistixUser.avatar_url)
					} : void 0;
					const ru = ((typeof document !== "undefined") && (((document.documentElement.lang || "").toLowerCase().startsWith("ru")) || document.documentElement.dataset.beamLang === "ru"));
					const fmtTokens = (n) => {
						const v = Number(n) || 0;
						if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\\.0$/, "") + "M";
						if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\\.0$/, "") + "K";
						return String(Math.round(v));
					};
					const quotaSource = (assistixSnap && Array.isArray(assistixSnap.models) && assistixSnap.models.length)
						? assistixSnap.models
						: ((typeof window !== "undefined" && window.__beamLimitsSnapshot && Array.isArray(window.__beamLimitsSnapshot.models))
							? window.__beamLimitsSnapshot.models
							: []);
					const quotaMap = (assistixSnap && assistixSnap.quotas) || {};
					const quotaIds = ["tide", "flare", "pine"];
					const quotaParts = quotaIds.map((id) => {
						const fromModels = quotaSource.find((m) => String(m.id || "").toLowerCase() === id);
						const used = fromModels ? (Number(fromModels.used) || 0) : (Number(quotaMap[id]?.used) || 0);
						const limit = fromModels ? (Number(fromModels.limit) || 0) : (Number(quotaMap[id]?.limit) || 0);
						const label = fromModels?.name || ({ tide: "Tide", flare: "Flare", pine: "Pine" }[id]);
						return label + " " + fmtTokens(used) + "/" + fmtTokens(limit || 1);
					});
					const quotasTeaser = quotaParts.join(" · ");
					const signedAtRaw = assistixUser.at || null;
					let signedAtLabel = ru ? "—" : "—";
					if (signedAtRaw) {
						try {
							const d = new Date(signedAtRaw);
							if (!Number.isNaN(d.getTime())) {
								signedAtLabel = d.toLocaleString(ru ? "ru-RU" : "en-US", { dateStyle: "medium", timeStyle: "short" });
							}
						} catch {}
					}
					let deviceLabel = ru ? "Это устройство · Beam Agent" : "This device · Beam Agent";
					try {
						const ua = String(navigator.userAgent || "");
						if (/Windows/i.test(ua)) deviceLabel = ru ? "Windows · Beam Agent" : "Windows · Beam Agent";
						else if (/Mac OS|Macintosh/i.test(ua)) deviceLabel = ru ? "macOS · Beam Agent" : "macOS · Beam Agent";
						else if (/Linux/i.test(ua)) deviceLabel = ru ? "Linux · Beam Agent" : "Linux · Beam Agent";
					} catch {}
					const verified = !!assistixUser.email_verified;
					const verifiedLabel = verified ? (ru ? "Подтверждён" : "Verified") : (ru ? "Не подтверждён" : "Unverified");
					const providerLabel = "ASSISTIX ID";
					const productLabel = "Beam Agent";
					const sessionNote = ru ? "Сохраняется на этом устройстве" : "Persists on this device";
					const denseRow = (label, value, valueClass) => (0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.row + " beam-profile-row",
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: "beam-profile-label",
								children: label
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: (valueClass || "beam-profile-value"),
								children: value
							})
						]
					});
					return (0, react_jsx_runtime.jsxs)("section", {
						className: AccountSection_module_css_default.section + " beam-profile-section",
						"aria-label": t("nav"),
						"data-beam-assistix-profile": "1",
						"${RICH_MARKER}": "1",
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.card,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: AccountSection_module_css_default.identity,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: AccountSection_module_css_default.avatar,
										"data-avatar-status": axAvatar?.status,
										children: (0, react_jsx_runtime.jsx)(AccountAvatar, {
											avatar: axAvatar,
											avatarFailed
										})
									}), (0, react_jsx_runtime.jsxs)("div", {
										className: AccountSection_module_css_default.identityCopy,
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: AccountSection_module_css_default.name,
											children: axName
										}), (0, react_jsx_runtime.jsx)("span", {
											className: AccountSection_module_css_default.status,
											role: "status",
											children: axEmail || providerLabel
										})]
									})]
								}), (0, react_jsx_runtime.jsxs)("a", {
									className: AccountSection_module_css_default.accountInfo,
									href: "https://id.assistix.org/profile/",
									target: "_blank",
									rel: "noopener noreferrer",
									children: [ru ? "Профиль ASSISTIX ID" : "ASSISTIX ID profile", (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 12 })]
								})]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.balanceCard + " beam-profile-card",
								children: [
									denseRow(ru ? "Продукт" : "Product", productLabel),
									(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }),
									denseRow(ru ? "Аккаунт" : "Account", providerLabel),
									(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }),
									denseRow(ru ? "Имя" : "Display name", axName),
									(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }),
									denseRow("Email", axEmail || "—"),
									(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }),
									denseRow(ru ? "Статус email" : "Email status", verifiedLabel, verified ? "beam-profile-value beam-profile-ok" : "beam-profile-value beam-profile-warn"),
									(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }),
									denseRow(ru ? "Устройство" : "Session device", deviceLabel),
									(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }),
									denseRow(ru ? "Последний вход" : "Last sign-in", signedAtLabel),
									(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }),
									denseRow(ru ? "Сессия" : "Session", sessionNote)
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.balanceCard + " beam-profile-card",
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: AccountSection_module_css_default.row + " beam-profile-row",
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												className: "beam-profile-copy",
												children: [
													(0, react_jsx_runtime.jsx)("span", {
														className: "beam-profile-label",
														children: ru ? "Лимиты недели" : "Weekly quotas"
													}),
													(0, react_jsx_runtime.jsx)("span", {
														className: "beam-profile-hint",
														children: quotasTeaser
													})
												]
											}),
											(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												variant: "outline",
												className: AccountSection_module_css_default.linkButton,
												onClick: () => {
													openLimitsSection();
												},
												children: ru ? "Лимиты" : "Limits"
											})
										]
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.balanceCard + " beam-profile-card",
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: AccountSection_module_css_default.row,
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												className: AccountSection_module_css_default.secondary,
												children: ru ? "Действия" : "Actions"
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												className: AccountSection_module_css_default.links,
												children: [
													(0, react_jsx_runtime.jsx)("a", {
														className: AccountSection_module_css_default.linkButton,
														href: "https://id.assistix.org/profile/",
														target: "_blank",
														rel: "noreferrer",
														children: ru ? "Открыть ID" : "Open ID"
													}),
													(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														variant: "outline",
														className: AccountSection_module_css_default.linkButton,
														disabled: busy,
														onClick: () => {
															refreshAssistix();
														},
														children: ru ? "Обновить" : "Refresh"
													}),
													(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														variant: "outline",
														className: AccountSection_module_css_default.linkButton,
														disabled: busy,
														onClick: () => {
															logoutAssistix();
														},
														children: ru ? "Выйти" : "Sign out"
													})
												]
											})
										]
									})
								]
							})
						]
					});
				}
				return (0, react_jsx_runtime.jsx)("section", {
				className: AccountSection_module_css_default.signedOut,
				"aria-label": t("nav"),
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: AccountSection_module_css_default.signedOutContent,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.signedOutCopy,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: AccountSection_module_css_default.signedOutTitle,
							children: t("settingsSignedOutTitle")
						}), (0, react_jsx_runtime.jsx)("span", {
							className: AccountSection_module_css_default.signedOutDescription,
							role: "status",
							children: failed || streamFailed ? t("failed") : t("settingsSignedOutDescription")
						})]
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: AccountSection_module_css_default.signInButton,
						disabled: busy,
						onClick: () => {
							openAssistixLogin();
						},
						children: t("signIn")
					})]
				})
			});
			}`;
}

/** Replace sparse assistixSigned return with dense panel; keep signed-out fallback. */
function upgradeAssistixPanelInPlace(s) {
  const start = s.indexOf("if (assistixSigned) {");
  if (start < 0) return null;
  // Find the matching closing brace for assistixSigned, then keep following signed-out return.
  let i = start + "if (assistixSigned) {".length;
  let depth = 1;
  let inStr = null;
  let escape = false;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++; // include closing }
        break;
      }
    }
  }
  if (depth !== 0) return null;

  // buildAssistixPanel() returns full `if (!signedIn && !active) { if (assistixSigned) {...} return signedOut; }`
  // Extract only the inner `if (assistixSigned) { ... }` portion.
  const full = buildAssistixPanel();
  const innerStart = full.indexOf("if (assistixSigned) {");
  const afterInner = full.indexOf("\n\t\t\t\treturn (0, react_jsx_runtime.jsx)(\"section\", {");
  if (innerStart < 0 || afterInner < 0) return null;
  const richInner = full.slice(innerStart, afterInner).trimEnd();
  return s.slice(0, start) + richInner + s.slice(i);
}

function upgradeAssistixHookInPlace(s) {
  const start = s.indexOf(ACCOUNT_MARKER);
  if (start < 0) return null;
  const endMark = "/* beam-assistix-account-panel-end */";
  const end = s.indexOf(endMark, start);
  if (end < 0) return null;
  const hook = buildAssistixHook();
  // buildAssistixHook includes signedIn line + marker + end + release effect.
  // Replace only the marker..end block contents, keep surrounding signedIn / release effect.
  const hookStart = hook.indexOf(ACCOUNT_MARKER);
  const hookEnd = hook.indexOf(endMark) + endMark.length;
  const hookMid = hook.slice(hookStart, hookEnd);
  return s.slice(0, start) + hookMid + s.slice(end + endMark.length);
}

function patchAccountSection(clientPath) {
  if (!fs.existsSync(clientPath)) return false;
  let s = fs.readFileSync(clientPath, "utf8");
  if (!s.includes("function AccountSection({")) {
    console.log("  no AccountSection", path.relative(ROOT, clientPath));
    return false;
  }

  if (
    s.includes(ACCOUNT_MARKER) &&
    s.includes(RICH_MARKER) &&
    s.includes("refreshAssistix") &&
    s.includes("openLimitsSection")
  ) {
    console.log("  account assistix rich already", path.relative(ROOT, clientPath));
    return true;
  }

  // Path A: sparse Assistix panel already present → upgrade in place
  if (s.includes(ACCOUNT_MARKER) && s.includes("if (assistixSigned)") && s.includes("data-beam-assistix-profile")) {
    const hooked = upgradeAssistixHookInPlace(s);
    if (!hooked) {
      console.log("  failed to upgrade assistix hook", path.relative(ROOT, clientPath));
      return false;
    }
    s = hooked;
    const paneled = upgradeAssistixPanelInPlace(s);
    if (!paneled) {
      console.log("  failed to upgrade assistix panel", path.relative(ROOT, clientPath));
      return false;
    }
    s = paneled;
    if (!s.includes(RICH_MARKER) || !s.includes("refreshAssistix")) {
      console.log("  rich markers missing after in-place upgrade", path.relative(ROOT, clientPath));
      return false;
    }
    fs.writeFileSync(clientPath, s);
    console.log("  account assistix rich (upgrade)", path.relative(ROOT, clientPath));
    return true;
  }

  // Path B: virgin AccountSection — inject hook + wrap signed-out
  const hookNeedle = `const signedIn = state?.status === "credential-stored";
			(0, react.useEffect)(() => () => {
				releasePage.current?.();
				releasePage.current = void 0;
			}, []);`;

  if (!s.includes(hookNeedle)) {
    console.log("  signedIn hook missing", path.relative(ROOT, clientPath));
    return false;
  }
  s = s.replace(hookNeedle, buildAssistixHook());

  const signedOutStart = `if (!signedIn && !active) return (0, react_jsx_runtime.jsx)("section", {
				className: AccountSection_module_css_default.signedOut,
				"aria-label": t("nav"),
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: AccountSection_module_css_default.signedOutContent,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.signedOutCopy,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: AccountSection_module_css_default.signedOutTitle,
							children: t("settingsSignedOutTitle")
						}), (0, react_jsx_runtime.jsx)("span", {
							className: AccountSection_module_css_default.signedOutDescription,
							role: "status",
							children: failed || streamFailed ? t("failed") : t("settingsSignedOutDescription")
						})]
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: AccountSection_module_css_default.signInButton,
						disabled: busy || state === void 0,
						onClick: () => {
							run(start);
						},
						children: t("signIn")
					})]
				})
			});`;

  const assistixPanel = buildAssistixPanel();
  if (s.includes(signedOutStart)) {
    s = s.replace(signedOutStart, assistixPanel);
  } else {
    const loose =
      /if \(!signedIn && !active\) return \(0, react_jsx_runtime\.jsx\)\("section", \{\s*className: AccountSection_module_css_default\.signedOut,[\s\S]*?children: t\("signIn"\)\s*\}\)\s*\]\s*\}\)\s*\}\);/;
    if (loose.test(s)) s = s.replace(loose, assistixPanel);
    else {
      console.log("  failed to replace signed-out block", path.relative(ROOT, clientPath));
      return false;
    }
  }

  if (!s.includes(RICH_MARKER) || !s.includes("refreshAssistix")) {
    console.log("  rich panel markers missing after patch", path.relative(ROOT, clientPath));
    return false;
  }

  fs.writeFileSync(clientPath, s);
  console.log("  account assistix rich panel", path.relative(ROOT, clientPath));
  return true;
}

function patchDynamicTitle(generalPath) {
  if (!fs.existsSync(generalPath)) return false;
  let s = fs.readFileSync(generalPath, "utf8");

  if (s.includes(TITLE_MARKER)) {
    console.log("  dynamic title already", path.relative(ROOT, generalPath));
    return true;
  }

  const re =
    /children: renderSlot\("settings\.header", \{\}\)\r?\n(\t+)\}\),/;
  if (!re.test(s)) {
    console.log("  navTitle children missing", path.relative(ROOT, generalPath));
    return false;
  }

  s = s.replace(
    re,
    `children: (() => {\r\n$1\t${TITLE_MARKER}\r\n$1\tconst activeRow = rows.find((r) => r.id === active);\r\n$1\tif (active && active !== "general" && activeRow?.label) return activeRow.label;\r\n$1\treturn renderSlot("settings.header", {});\r\n$1})()\r\n$1}),`
  );

  if (!s.includes("data-beam-settings-title")) {
    s = s.replace(
      /("data-modal-autofocus": active === void 0 \? "" : void 0,\r?\n)(\t+)(children: \(\(\) => \{)/,
      `$1$2"data-beam-settings-title": active || "general",\r\n$2$3`
    );
  }

  fs.writeFileSync(generalPath, s);
  console.log("  dynamic title", path.relative(ROOT, generalPath));
  return true;
}

function patchHtml(htmlPath) {
  if (!fs.existsSync(htmlPath)) return false;
  let html = fs.readFileSync(htmlPath, "utf8");
  let changed = false;

  if (!html.includes(HTML_STATUS_MARKER)) {
    const needle = "    try {\n      const r = await fetch(BRIDGE + \"/assistix/status\");\n      lastData = await r.json();\n    } catch {\n      lastData = { signedIn: false, user: null, quotas: {} };\n    }";
    if (html.includes(needle)) {
      html = html.replace(
        needle,
        needle +
          `\n    ${HTML_STATUS_MARKER}\n    try {\n      window.__beamAssistixStatus = lastData;\n      window.dispatchEvent(new CustomEvent("beam:assistix-updated"));\n    } catch {}\n    try {\n      window.__beamRefreshAssistix = (opts) => refresh(opts || { force: true });\n    } catch {}`
      );
      changed = true;
    } else {
      const alt = "lastData = await r.json();\n    } catch {\n      lastData = { signedIn: false, user: null, quotas: {} };\n    }";
      if (html.includes(alt) && !html.includes("__beamAssistixStatus")) {
        html = html.replace(
          alt,
          alt +
            `\n    ${HTML_STATUS_MARKER}\n    try {\n      window.__beamAssistixStatus = lastData;\n      window.dispatchEvent(new CustomEvent("beam:assistix-updated"));\n    } catch {}\n    try {\n      window.__beamRefreshAssistix = (opts) => refresh(opts || { force: true });\n    } catch {}`
        );
        changed = true;
      } else {
        console.log("  status publish hook missing", path.relative(ROOT, htmlPath));
      }
    }
  }

  if (!html.includes(HTML_LOGIN_MARKER)) {
    const bindHook = `  if (!window.__beamOpenSettingsBound) {
    window.__beamOpenSettingsBound = true;
    window.addEventListener("beam:open-settings", (ev) => {
      try { openAppSettings(ev?.detail?.section || "general"); } catch {}
    });
  }`;
    if (html.includes(bindHook)) {
      html = html.replace(
        bindHook,
        bindHook +
          `\n\n  ${HTML_LOGIN_MARKER}\n  if (!window.__beamAssistixLoginBound) {\n    window.__beamAssistixLoginBound = true;\n    window.addEventListener("beam:assistix-login", () => {\n      try {\n        const closeBtn = document.querySelector('[data-shortcut-modal="settings"] button[class*="close"], [data-shortcut-modal="settings"] [class*="Close"]');\n        closeBtn?.click();\n      } catch {}\n      passwordErr = "";\n      ensureAuthGate(lastData || { signedIn: false }, { force: false });\n      try { document.getElementById("beam-auth-gate")?.querySelector('[name="email"]')?.focus(); } catch {}\n    });\n  }`
      );
      changed = true;
    } else if (!html.includes("__beamAssistixLoginBound")) {
      const marker = "  refresh({ force: true });";
      const idx = html.lastIndexOf(marker);
      if (idx > 0) {
        html =
          html.slice(0, idx) +
          `  ${HTML_LOGIN_MARKER}\n  if (!window.__beamAssistixLoginBound) {\n    window.__beamAssistixLoginBound = true;\n    window.addEventListener("beam:assistix-login", () => {\n      try {\n        const closeBtn = document.querySelector('[data-shortcut-modal="settings"] button[class*="close"]');\n        closeBtn?.click();\n      } catch {}\n      passwordErr = "";\n      ensureAuthGate(lastData || { signedIn: false }, { force: false });\n      try { document.getElementById("beam-auth-gate")?.querySelector('[name="email"]')?.focus(); } catch {}\n    });\n  }\n\n` +
          html.slice(idx);
        changed = true;
      }
    }
  }

  if (changed) fs.writeFileSync(htmlPath, html);
  console.log("  html", path.relative(ROOT, htmlPath), changed);
  return true;
}

function upsertProfileCss(overridePath) {
  if (!fs.existsSync(overridePath)) return false;
  const block = `${PROFILE_CSS_MARKER}
[data-beam-assistix-profile] .beam-profile-section {
  gap: 12px;
}
[data-beam-assistix-profile] .beam-profile-card {
  gap: 0;
  padding: 4px 16px;
}
[data-beam-assistix-profile] .beam-profile-row {
  min-height: 40px;
  padding: 8px 0;
  align-items: center;
}
[data-beam-assistix-profile] .beam-profile-label {
  color: var(--dsw-alias-label-secondary, var(--beam-muted));
  font-size: 13px;
  line-height: 20px;
  flex: none;
}
[data-beam-assistix-profile] .beam-profile-value {
  color: var(--dsw-alias-label-primary, var(--beam-ink));
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-align: right;
  max-width: 62%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-beam-assistix-profile] .beam-profile-ok {
  color: #5eead4;
}
[data-beam-assistix-profile] .beam-profile-warn {
  color: #fbbf24;
}
[data-beam-assistix-profile] .beam-profile-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
[data-beam-assistix-profile] .beam-profile-hint {
  color: var(--dsw-alias-label-tertiary, var(--beam-soft));
  font-size: 12px;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-beam-assistix-profile] ._6qcDqa_amount {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
`;

  let css = fs.readFileSync(overridePath, "utf8");
  if (css.includes(PROFILE_CSS_MARKER)) {
    const start = css.indexOf(PROFILE_CSS_MARKER);
    const next = css.indexOf("\n/* =====", start + PROFILE_CSS_MARKER.length);
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
  const a = patchAccountSection(path.join(tree, "beam-client-ui-settings-account/lib/client.js"));
  const g = patchDynamicTitle(path.join(tree, "beam-client-ui-settings-general/lib/client.js"));
  if (a && g) ok++;
}

for (const web of WEBS) {
  console.log("→ web", path.relative(ROOT, web));
  patchHtml(path.join(web, "index.html"));
  upsertProfileCss(path.join(web, "assets/beam-override.css"));
  console.log("  profile css", path.relative(ROOT, path.join(web, "assets/beam-override.css")));
}

if (ok < 1) {
  console.error("Failed to patch settings auth/title");
  process.exit(1);
}
console.log("Done. trees=", ok);
