/**
 * Settings nav: exactly 4 items —
 *   Настройки (general) · Профиль (account) · Лимиты · О приложении
 *
 * Updates / Network / Notifications UI live inside О приложении.
 * Coolicons duocolor PNG masks for nav (incl. about = circle-info).
 * Idempotent. Syncs runtime + dist + C:/Users/Alexa/BeamAgent.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUST = "settings-about-update-v3";
const MARKER = "/* beam-settings-nav-extras */";

const TREES = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix"),
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix",
];

const WEBS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist",
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist",
];

const NAV_ICON_ABOUT_ONLY = `if (id === "limits") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutlineMedium, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});
			if (id === "about") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInfoOutlineMedium, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});
			if (id === "voice") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconMicrophoneOutlineMedium, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});`;

const SECTIONS_CODE = `
		${MARKER}
		function beamIsRu() {
			try {
				return ((document.documentElement.lang || "").toLowerCase().startsWith("ru")) || ((document.documentElement.dataset.beamLang || "") === "ru");
			} catch {
				return false;
			}
		}
		function beamBridgeBase() {
			try {
				if (typeof window !== "undefined" && window.__beamBridgeUrl) return String(window.__beamBridgeUrl).replace(/\\/$/, "");
			} catch {}
			return "http://127.0.0.1:17865";
		}
		function beamOpenExt(url) {
			try {
				if (window.dshDesktop?.shell?.openExternal) {
					window.dshDesktop.shell.openExternal(url);
					return;
				}
			} catch {}
			try { window.open(url, "_blank", "noopener,noreferrer"); } catch {}
		}
		function BeamSettingsCard({ children }) {
			return (0, react_jsx_runtime.jsx)("div", { className: "beam-settings-card", children });
		}
		function BeamSettingsRow({ label, value, hint, tone }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "beam-settings-kv" + (tone ? (" is-" + tone) : ""),
				children: [
					(0, react_jsx_runtime.jsx)("div", { className: "beam-settings-kv-label", children: label }),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "beam-settings-kv-body",
						children: [
							(0, react_jsx_runtime.jsx)("div", { className: "beam-settings-kv-value", children: value }),
							hint ? (0, react_jsx_runtime.jsx)("div", { className: "beam-settings-kv-hint", children: hint }) : null
						]
					})
				]
			});
		}
		function BeamSettingsSubhead({ children }) {
			return (0, react_jsx_runtime.jsx)("h3", { className: "beam-settings-subhead", children });
		}
		function BeamAboutUpdatesBlock() {
			const ru = beamIsRu();
			const [busy, setBusy] = react.useState(false);
			const [applying, setApplying] = react.useState(false);
			const [info, setInfo] = react.useState(null);
			const [progress, setProgress] = react.useState(null);
			const [err, setErr] = react.useState("");
			const [checkedAt, setCheckedAt] = react.useState(() => {
				try { return Number(localStorage.getItem("beam.update.lastCheck") || 0) || 0; } catch { return 0; }
			});
			const publishUpdate = (data) => {
				try {
					window.__beamUpdateInfo = data?.updateAvailable ? data : null;
					window.__beamUpdateCritical = !!(data?.critical || data?.mandatory) && !!data?.updateAvailable;
					window.dispatchEvent(new CustomEvent("beam:update-checked", { detail: data }));
				} catch {}
			};
			const refreshProgress = react.useCallback(async () => {
				try {
					const st = await fetch(beamBridgeBase() + "/assistix/update/status", { cache: "no-store" }).then((x) => x.json());
					const p = st?.state?.progress || null;
					setProgress(p);
					return p;
				} catch {
					return null;
				}
			}, []);
			const check = react.useCallback(async () => {
				setBusy(true);
				setErr("");
				try {
					let data = null;
					try {
						const r = await fetch(beamBridgeBase() + "/assistix/update/check", { cache: "no-store" });
						data = await r.json();
						if (!r.ok || data?.ok === false) throw new Error(data?.error || ("HTTP " + r.status));
					} catch (bridgeErr) {
						let local = "";
						try {
							const st = await fetch(beamBridgeBase() + "/assistix/update/status", { cache: "no-store" }).then((x) => x.json());
							local = st?.localVersion || "";
						} catch {}
						try {
							const st2 = await window.dshDesktop?.updates?.status?.();
							if (st2?.version) local = String(st2.version);
						} catch {}
						const q = "?current=" + encodeURIComponent(local || "0.0.0");
						const r = await fetch("https://agent.assistix.org/api/check-update.php" + q, { cache: "no-store" });
						data = await r.json();
						if (!data?.ok && data?.ok !== undefined && data?.updateAvailable === undefined && !data?.version) {
							throw bridgeErr;
						}
						if (local) data.localVersion = local;
						data.ok = true;
					}
					if (data?.progress) setProgress(data.progress);
					else await refreshProgress();
					setInfo(data);
					const now = Date.now();
					setCheckedAt(now);
					try { localStorage.setItem("beam.update.lastCheck", String(now)); } catch {}
					publishUpdate(data);
				} catch (e) {
					setErr(String(e?.message || e));
				} finally {
					setBusy(false);
				}
			}, [refreshProgress]);
			react.useEffect(() => { check(); }, [check]);
			react.useEffect(() => {
				if (!applying) return undefined;
				const id = setInterval(() => { refreshProgress(); }, 900);
				return () => clearInterval(id);
			}, [applying, refreshProgress]);
			const apply = async () => {
				if (applying) return;
				setApplying(true);
				setErr("");
				setProgress({ phase: "downloading", percent: 0 });
				try {
					let applied = false;
					try {
						const r = await fetch(beamBridgeBase() + "/assistix/update/apply", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ source: "settings-about" })
						});
						const j = await r.json().catch(() => ({}));
						if (!r.ok || j?.ok === false) throw new Error(j?.error || "update_failed");
						applied = true;
						if (j?.skipped) setProgress({ phase: "idle", percent: 0 });
						else setProgress({ phase: j?.applying ? "installing" : "restarting", percent: 100, version: j?.version });
					} catch (bridgeApplyErr) {
						if (window.dshDesktop?.updates?.open) {
							await window.dshDesktop.updates.open();
							applied = true;
						} else {
							throw bridgeApplyErr;
						}
					}
					if (!applied) throw new Error("update_failed");
				} catch (e) {
					setErr(String(e?.message || e));
					setProgress({ phase: "error", percent: 0, message: String(e?.message || e) });
				} finally {
					setApplying(false);
					try { await check(); } catch {}
				}
			};
			const local = info?.localVersion || "—";
			const remote = info?.version || null;
			const channel = String(info?.channel || "nightly");
			const available = !!info?.updateAvailable;
			const critical = !!(available && (info?.critical || info?.mandatory));
			const notes = String(info?.notes || info?.changelog || "").trim();
			const phase = String(progress?.phase || "").toLowerCase();
			const pct = Number(progress?.percent || 0);
			let tone = "ok";
			let status = ru ? "Актуальная версия" : "Up to date";
			if (err || phase === "error") {
				tone = "error";
				status = ru ? "Ошибка обновления" : "Update failed";
			} else if (busy && !info) {
				tone = "busy";
				status = ru ? "Проверка…" : "Checking…";
			} else if (phase === "downloading" || applying && phase !== "installing" && phase !== "restarting") {
				tone = "busy";
				status = ru ? ("Загрузка…" + (pct ? (" " + pct + "%") : "")) : ("Downloading…" + (pct ? (" " + pct + "%") : ""));
			} else if (phase === "verifying") {
				tone = "busy";
				status = ru ? "Проверка пакета…" : "Verifying package…";
			} else if (phase === "installing" || phase === "restarting") {
				tone = "busy";
				status = ru ? "Установка и перезапуск…" : "Installing & restarting…";
			} else if (critical) {
				tone = "critical";
				status = ru ? ("Критическое обновление " + (remote || "")) : ("Critical update " + (remote || ""));
			} else if (available) {
				tone = "available";
				status = ru ? ("Доступно " + (remote || "")) : ("Available: " + (remote || ""));
			}
			const checkedLabel = checkedAt
				? new Date(checkedAt).toLocaleString(ru ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
				: (ru ? "ещё не проверяли" : "not yet");
			return (0, react_jsx_runtime.jsxs)("div", {
				"data-beam-settings-updates": "1",
				children: [
					(0, react_jsx_runtime.jsx)(BeamSettingsSubhead, { children: ru ? "Обновления" : "Updates" }),
					critical ? (0, react_jsx_runtime.jsx)("div", {
						className: "beam-settings-critical-banner",
						children: ru
							? "Обязательное обновление безопасности. Установите его, чтобы продолжить безопасную работу."
							: "Mandatory security update. Install it to keep using Beam Agent safely."
					}) : null,
					(0, react_jsx_runtime.jsxs)(BeamSettingsCard, {
						children: [
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, { label: ru ? "Текущая версия" : "Current version", value: local }),
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, { label: ru ? "Канал" : "Channel", value: channel }),
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, {
								label: ru ? "Статус" : "Status",
								value: (0, react_jsx_runtime.jsx)("span", { className: "beam-settings-status-pill is-" + tone, children: status }),
								hint: available && remote ? ((ru ? "На сервере: " : "Server: ") + remote) : null,
								tone
							}),
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, { label: ru ? "Последняя проверка" : "Last checked", value: checkedLabel })
						]
					}),
					notes ? (0, react_jsx_runtime.jsxs)("div", {
						className: "beam-settings-notes",
						children: [
							(0, react_jsx_runtime.jsx)("div", { className: "beam-settings-notes-title", children: ru ? "Что нового" : "Release notes" }),
							(0, react_jsx_runtime.jsx)("pre", { className: "beam-settings-notes-body", children: notes })
						]
					}) : null,
					err ? (0, react_jsx_runtime.jsx)("p", { className: "beam-settings-error", children: err }) : null,
					(0, react_jsx_runtime.jsxs)("div", {
						className: "beam-settings-actions",
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "beam-settings-btn",
								disabled: busy || applying,
								onClick: () => { check(); },
								children: busy ? (ru ? "Проверка…" : "Checking…") : (ru ? "Проверить обновления" : "Check for updates")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "beam-settings-btn beam-settings-btn-primary" + (critical ? " is-critical" : ""),
								disabled: !available || applying || busy,
								onClick: () => { apply(); },
								children: applying
									? (ru ? "Обновление…" : "Updating…")
									: (available ? (ru ? ("Обновить до " + (remote || "")) : ("Update to " + (remote || ""))) : (ru ? "Обновить" : "Update"))
							})
						]
					})
				]
			});
		}
		function BeamAboutNetworkBlock() {
			const ru = beamIsRu();
			const [, bump] = react.useState(0);
			react.useEffect(() => {
				const on = () => bump((n) => n + 1);
				window.addEventListener("beam:net-degraded", on);
				window.addEventListener("beam:net-recovered", on);
				window.addEventListener("beam:net-state", on);
				const id = setInterval(on, 4000);
				return () => {
					window.removeEventListener("beam:net-degraded", on);
					window.removeEventListener("beam:net-recovered", on);
					window.removeEventListener("beam:net-state", on);
					clearInterval(id);
				};
			}, []);
			const net = (typeof window !== "undefined" && window.__beamNetState) || {};
			const browser = typeof navigator !== "undefined" ? navigator.onLine !== false : true;
			const bridgeOk = net.bridgeOk !== false && !window.__beamBridgeDown;
			const online = net.online != null ? !!net.online : (browser && bridgeOk);
			const yn = (ok) => ok ? (ru ? "В сети" : "Online") : (ru ? "Нет связи" : "Offline");
			return (0, react_jsx_runtime.jsxs)("div", {
				"data-beam-settings-network": "1",
				children: [
					(0, react_jsx_runtime.jsx)(BeamSettingsSubhead, { children: ru ? "Сеть" : "Network" }),
					(0, react_jsx_runtime.jsxs)(BeamSettingsCard, {
						children: [
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, { label: ru ? "Интернет" : "Internet", value: yn(browser) }),
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, {
								label: "Bridge",
								value: yn(bridgeOk),
								hint: "127.0.0.1:17865"
							}),
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, {
								label: "Host / Kumo",
								value: net.hostOk == null && net.kumoOk == null
									? (ru ? "Нет данных" : "Unknown")
									: yn(net.hostOk !== false && net.kumoOk !== false)
							}),
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, {
								label: ru ? "Итог" : "Overall",
								value: online ? (ru ? "Готово к работе" : "Ready") : (ru ? "Восстановление…" : "Recovering…")
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "beam-settings-actions",
						children: (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "beam-settings-btn",
							onClick: () => {
								try { window.dispatchEvent(new CustomEvent("beam:net-probe")); } catch {}
								bump((n) => n + 1);
							},
							children: ru ? "Проверить сейчас" : "Probe now"
						})
					})
				]
			});
		}
		function BeamAboutNotificationsBlock() {
			const ru = beamIsRu();
			const key = "beam.notifications.prefs";
			const read = () => {
				try {
					return Object.assign({ desktop: true, updates: true, limits: true }, JSON.parse(localStorage.getItem(key) || "{}"));
				} catch {
					return { desktop: true, updates: true, limits: true };
				}
			};
			const [prefs, setPrefs] = react.useState(read);
			const set = (field, value) => {
				const next = { ...prefs, [field]: !!value };
				setPrefs(next);
				try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
				try { window.__beamNotifPrefs = next; window.dispatchEvent(new CustomEvent("beam:notif-prefs", { detail: next })); } catch {}
			};
			const Toggle = ({ field, label, hint }) => (0, react_jsx_runtime.jsxs)("label", {
				className: "beam-settings-toggle",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "beam-settings-toggle-text",
						children: [
							(0, react_jsx_runtime.jsx)("div", { className: "beam-settings-toggle-label", children: label }),
							hint ? (0, react_jsx_runtime.jsx)("div", { className: "beam-settings-toggle-hint", children: hint }) : null
						]
					}),
					(0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: !!prefs[field],
						onChange: (e) => set(field, e.target.checked)
					})
				]
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				"data-beam-settings-notifications": "1",
				children: [
					(0, react_jsx_runtime.jsx)(BeamSettingsSubhead, { children: ru ? "Уведомления" : "Notifications" }),
					(0, react_jsx_runtime.jsxs)(BeamSettingsCard, {
						children: [
							(0, react_jsx_runtime.jsx)(Toggle, {
								field: "desktop",
								label: ru ? "Системные уведомления" : "Desktop notifications",
								hint: ru ? "Показывать тосты Windows, когда это доступно" : "Show OS toasts when available"
							}),
							(0, react_jsx_runtime.jsx)(Toggle, {
								field: "updates",
								label: ru ? "Обновления" : "Updates",
								hint: ru ? "Сообщать, когда доступна новая версия" : "Notify when a new version is available"
							}),
							(0, react_jsx_runtime.jsx)(Toggle, {
								field: "limits",
								label: ru ? "Лимиты моделей" : "Model limits",
								hint: ru ? "Предупреждать при исчерпании Tide / Flare / Pine" : "Warn when Tide / Flare / Pine are exhausted"
							})
						]
					})
				]
			});
		}
		function BeamAboutSettingsSection() {
			const ru = beamIsRu();
			const [version, setVersion] = react.useState("");
			react.useEffect(() => {
				(async () => {
					try {
						const st = await window.dshDesktop?.updates?.status?.();
						if (st?.version) { setVersion(String(st.version)); return; }
					} catch {}
					try {
						const r = await fetch(beamBridgeBase() + "/assistix/update/status", { cache: "no-store" });
						const j = await r.json();
						if (j?.localVersion) setVersion(String(j.localVersion));
					} catch {}
				})();
			}, []);
			const openDl = () => beamOpenExt("https://agent.assistix.org/download");
			const openSite = () => beamOpenExt("https://agent.assistix.org/");
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "beam-settings-panel",
				"data-beam-settings-about": "1",
				children: [
					(0, react_jsx_runtime.jsx)("p", {
						className: "beam-settings-panel-intro",
						children: ru
							? "Beam Agent — десктопный агент ASSISTIX. Версия, обновления, сеть и уведомления."
							: "Beam Agent — the ASSISTIX desktop agent. Version, updates, network, and notifications."
					}),
					(0, react_jsx_runtime.jsxs)(BeamSettingsCard, {
						children: [
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, { label: ru ? "Приложение" : "App", value: "Beam Agent" }),
							(0, react_jsx_runtime.jsx)(BeamSettingsRow, {
								label: ru ? "Сборка" : "Build",
								value: version || "—",
								hint: "agent.assistix.org"
							})
						]
					}),
					(0, react_jsx_runtime.jsx)(BeamAboutUpdatesBlock, {}),
					(0, react_jsx_runtime.jsx)(BeamAboutNetworkBlock, {}),
					(0, react_jsx_runtime.jsx)(BeamAboutNotificationsBlock, {}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "beam-settings-actions",
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "beam-settings-btn beam-settings-btn-primary",
								onClick: openDl,
								children: ru ? "Скачать на сайте" : "Download page"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "beam-settings-btn",
								onClick: openSite,
								children: "agent.assistix.org"
							})
						]
					})
				]
			});
		}
`;

const REGISTER_BLOCK = `
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "about",
				order: 90,
				label: () => beamIsRu() ? "О приложении" : "About",
				locale: NS
			}, BeamAboutSettingsSection));
`;

const CSS_BLOCK = `/* ===== BEAM settings nav extras ===== */
.beam-settings-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 6px 0 12px;
  color: var(--dsw-alias-label-primary, #eaf5f3);
}
.beam-settings-panel-intro {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary, rgba(186, 214, 210, 0.78));
}
.beam-settings-subhead {
  margin: 4px 0 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 20px;
  color: var(--dsw-alias-label-primary, #eaf5f3);
}
.beam-settings-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: .5px solid var(--dsw-alias-settings-card-stroke, rgba(140, 190, 186, 0.28));
  border-radius: var(--dsw-radius-xl, 14px);
  background: var(--dsw-alias-settings-card-fill, rgba(12, 28, 27, 0.55));
  overflow: hidden;
}
.beam-settings-kv {
  display: grid;
  grid-template-columns: minmax(118px, 34%) minmax(0, 1fr);
  column-gap: 16px;
  row-gap: 4px;
  align-items: start;
  padding: 14px 18px;
  border-bottom: .5px solid var(--dsw-alias-border-l2, rgba(140, 190, 186, 0.18));
}
.beam-settings-kv:last-child { border-bottom: 0; }
.beam-settings-kv-label {
  padding-top: 2px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  color: rgba(170, 205, 200, 0.72);
}
.beam-settings-kv-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.beam-settings-kv-value {
  font-size: 14px;
  font-weight: 560;
  line-height: 22px;
  color: var(--dsw-alias-label-primary, #eaf5f3);
  word-break: break-word;
}
.beam-settings-kv-hint {
  font-size: 12px;
  line-height: 18px;
  color: rgba(170, 205, 200, 0.68);
}
.beam-settings-status-pill {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 2px 10px;
  border-radius: 999px;
  border: .5px solid rgba(0, 179, 188, 0.28);
  background: rgba(0, 179, 188, 0.1);
  color: #b7f3ef;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.beam-settings-status-pill.is-available {
  border-color: rgba(0, 179, 188, 0.55);
  background: rgba(0, 179, 188, 0.18);
}
.beam-settings-status-pill.is-critical {
  border-color: rgba(230, 96, 96, 0.55);
  background: rgba(230, 96, 96, 0.16);
  color: #ffd0d0;
}
.beam-settings-status-pill.is-busy {
  border-color: rgba(210, 180, 90, 0.45);
  background: rgba(210, 180, 90, 0.12);
  color: #ffe9b0;
}
.beam-settings-status-pill.is-error {
  border-color: rgba(230, 96, 96, 0.55);
  background: rgba(230, 96, 96, 0.14);
  color: #ffd0d0;
}
.beam-settings-critical-banner {
  margin: -4px 0 2px;
  padding: 12px 14px;
  border-radius: 12px;
  border: .5px solid rgba(230, 96, 96, 0.45);
  background: rgba(230, 96, 96, 0.12);
  color: #ffd8d8;
  font-size: 13px;
  line-height: 20px;
}
.beam-settings-notes {
  border: .5px solid var(--dsw-alias-settings-card-stroke, rgba(140, 190, 186, 0.28));
  border-radius: var(--dsw-radius-xl, 14px);
  background: var(--dsw-alias-settings-card-fill, rgba(12, 28, 27, 0.55));
  padding: 14px 18px;
}
.beam-settings-notes-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--dsw-alias-label-primary, #eaf5f3);
}
.beam-settings-notes-body {
  margin: 0;
  white-space: pre-wrap;
  font: 12px/18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: rgba(186, 214, 210, 0.82);
}
.beam-settings-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: #e57373;
}
.beam-settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 2px;
}
.beam-settings-btn {
  box-sizing: border-box;
  border: .5px solid var(--dsw-alias-border-l3, rgba(140, 190, 186, 0.32));
  border-radius: var(--dsw-radius-md, 10px);
  min-width: 58px;
  height: 36px;
  padding: 0 14px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #eaf5f3);
  font: inherit;
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;
}
.beam-settings-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.04));
}
.beam-settings-btn:disabled {
  opacity: .55;
  cursor: default;
}
.beam-settings-btn-primary {
  border-color: rgba(0, 179, 188, 0.45);
  background: rgba(0, 179, 188, 0.14);
  color: #b7f3ef;
}
.beam-settings-btn-primary.is-critical {
  border-color: rgba(230, 96, 96, 0.55);
  background: rgba(230, 96, 96, 0.18);
  color: #ffd8d8;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) .beam-settings-btn-primary {
  color: #0b6f73;
  background: rgba(0, 179, 188, 0.12);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) .beam-settings-kv-label {
  color: rgba(40, 70, 68, 0.72);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) .beam-settings-kv-value {
  color: #123330;
}
.beam-settings-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: .5px solid var(--dsw-alias-border-l2, rgba(140, 190, 186, 0.18));
  cursor: pointer;
}
.beam-settings-toggle:last-child { border-bottom: 0; }
.beam-settings-toggle-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.beam-settings-toggle-hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: rgba(170, 205, 200, 0.68);
}
.beam-settings-toggle input {
  width: 16px;
  height: 16px;
  accent-color: #00b3bc;
  flex: none;
}
[data-beam-settings-updates],
[data-beam-settings-network],
[data-beam-settings-notifications] {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 4-item settings nav coolicons masks (positional + tagged) */
[role="dialog"] [class*="navList"] button:nth-child(1) svg,
[class*="navList"] button[data-beam-icon="general"] svg,
[class*="navList"] button[data-beam-icon="settings"] svg,
[role="dialog"] [class*="navList"] button:nth-child(2) svg,
[class*="navList"] button[data-beam-icon="user"] svg,
[class*="navList"] button[data-beam-icon="profile"] svg,
[role="dialog"] [class*="navList"] button:nth-child(3) svg,
[class*="navList"] button[data-beam-icon="limits"]:not(.bsl-rings) svg,
[role="dialog"] [class*="navList"] button:nth-child(4) svg,
[class*="navList"] button[data-beam-icon="about"] svg,
[class*="navList"] button[data-beam-icon="info"] svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  color: inherit !important;
  background-color: currentColor !important;
  opacity: 1 !important;
  overflow: hidden !important;
}
[role="dialog"] [class*="navList"] button:nth-child(1) svg,
[class*="navList"] button[data-beam-icon="general"] svg,
[class*="navList"] button[data-beam-icon="settings"] svg {
  -webkit-mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
}
[role="dialog"] [class*="navList"] button:nth-child(2) svg,
[class*="navList"] button[data-beam-icon="user"] svg,
[class*="navList"] button[data-beam-icon="profile"] svg {
  -webkit-mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important;
}
[role="dialog"] [class*="navList"] button:nth-child(3) svg,
[class*="navList"] button[data-beam-icon="limits"]:not(.bsl-rings) svg {
  -webkit-mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important;
}
[role="dialog"] [class*="navList"] button:nth-child(4) svg,
[class*="navList"] button[data-beam-icon="about"] svg,
[class*="navList"] button[data-beam-icon="info"] svg {
  -webkit-mask: url("./beam-icons/bold/circle-info.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/circle-info.png") center / contain no-repeat !important;
}
[role="dialog"] [class*="navList"] button:nth-child(1) svg *,
[role="dialog"] [class*="navList"] button:nth-child(2) svg *,
[role="dialog"] [class*="navList"] button:nth-child(3) svg *,
[role="dialog"] [class*="navList"] button:nth-child(4) svg *,
[class*="navList"] button[data-beam-icon="general"] svg *,
[class*="navList"] button[data-beam-icon="settings"] svg *,
[class*="navList"] button[data-beam-icon="user"] svg *,
[class*="navList"] button[data-beam-icon="profile"] svg *,
[class*="navList"] button[data-beam-icon="limits"]:not(.bsl-rings) svg *,
[class*="navList"] button[data-beam-icon="about"] svg *,
[class*="navList"] button[data-beam-icon="info"] svg * {
  opacity: 0 !important;
  visibility: hidden !important;
  fill: transparent !important;
  stroke: transparent !important;
}

/* Keep quota rings exempt */
#beam-side-limits .bsl-rings svg,
#beam-side-limits .bsl-rings .bsl-chart svg,
#beam-limits-modal .blm-ring-wrap svg {
  -webkit-mask: none !important;
  mask: none !important;
  background: none !important;
  background-color: transparent !important;
}
#beam-side-limits .bsl-rings svg *,
#beam-side-limits .bsl-rings .bsl-chart svg *,
#beam-limits-modal .blm-ring-wrap svg * {
  opacity: 1 !important;
  visibility: visible !important;
  fill: revert-layer !important;
  stroke: revert-layer !important;
}

/* Update availability badges (gear + About nav) */
.beam-update-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00b3bc;
  box-shadow: 0 0 0 2px rgba(8, 20, 19, 0.9);
  pointer-events: none;
  z-index: 2;
}
.beam-update-badge.is-critical {
  background: #e85b5b;
  box-shadow: 0 0 0 2px rgba(8, 20, 19, 0.9), 0 0 10px rgba(232, 91, 91, 0.55);
}
#beam-side-limits .bsl-gear,
[class*="navList"] button[data-beam-icon="about"],
[role="dialog"] [class*="navList"] button:nth-child(4) {
  position: relative;
}
`;

const TAGGER_EXTRA = `
/* beam-settings-extras-tagger */
try {
  const mapX = [
    [/^(settings|настройки|general|общие)$/i, "general"],
    [/^(profile|профиль|account|аккаунт)$/i, "user"],
    [/^(limits|лимиты|лимит)$/i, "limits"],
    [/^(about|о приложении)$/i, "about"],
  ];
  for (const el of document.querySelectorAll('[class*="navList"] button, button[class*="navCell"], button[class*="NavCell"]')) {
    if (el.closest("#beam-side-limits,.bsl-rings")) continue;
    const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
    for (const [re, role] of mapX) {
      if (re.test(label)) { el.setAttribute("data-beam-icon", role); break; }
    }
  }
} catch {}
`;

function uniqExisting(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    const n = path.normalize(p);
    if (seen.has(n) || !fs.existsSync(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function stripFunctionBlock(s, fnName) {
  const needle = "function " + fnName;
  const start = s.indexOf(needle);
  if (start < 0) return s;
  let i = start;
  let depth = 0;
  let started = false;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") { depth++; started = true; }
    else if (ch === "}") {
      depth--;
      if (started && depth === 0) {
        let from = start;
        const prevNl = s.lastIndexOf("\n", start - 1);
        if (prevNl >= 0) from = prevNl + 1;
        return s.slice(0, from) + s.slice(i + 1).replace(/^\s*\n/, "\n");
      }
    }
  }
  return s;
}

function stripExtras(s) {
  // Remove old multi-nav registrations
  s = s.replace(
    /\n\t\t\tctx\.slots\.inject\("settings\.section", \(\) => ctx\.slots\.register\(\{\s*name: "settings\.section",\s*id: "(?:updates|network|notifications|about)"[\s\S]*?\}, Beam(?:Updates|Network|Notifications|About)SettingsSection\)\);/g,
    ""
  );
  // Remove old icon branches for updates/network/notifications (keep about if present)
  s = s.replace(
    /\n\t\t\tif \(id === "(?:updates|network|notifications)"\) return \(0, react_jsx_runtime\.jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.Icon[A-Za-z]+, \{\r?\n\t\t\t\tclassName: SettingsRoot_module_css_default\.navIcon,\r?\n\t\t\t\tsize: 16\r?\n\t\t\t\}\);/g,
    ""
  );

  const names = [
    "BeamUpdatesSettingsSection",
    "BeamNetworkSettingsSection",
    "BeamNotificationsSettingsSection",
    "BeamAboutSettingsSection",
    "BeamAboutUpdatesBlock",
    "BeamAboutNetworkBlock",
    "BeamAboutNotificationsBlock",
    "BeamSettingsSubhead",
    "BeamSettingsRow",
    "BeamSettingsCard",
    "beamOpenExt",
    "beamBridgeBase",
    "beamIsRu",
  ];
  // Strip from MARKER through last related helper if marker present
  if (s.includes(MARKER)) {
    const mStart = s.indexOf(MARKER);
    const blockStart = s.lastIndexOf("\n", mStart - 1);
    // Prefer ending at BeamAboutSettingsSection close
    let cursor = mStart;
    const aboutFn = s.indexOf("function BeamAboutSettingsSection", mStart);
    if (aboutFn > 0) {
      let i = aboutFn;
      let depth = 0;
      let started = false;
      for (; i < s.length; i++) {
        if (s[i] === "{") { depth++; started = true; }
        else if (s[i] === "}") {
          depth--;
          if (started && depth === 0) {
            cursor = i + 1;
            break;
          }
        }
      }
      s = s.slice(0, blockStart >= 0 ? blockStart + 1 : mStart) + s.slice(cursor).replace(/^\s*\n/, "\n");
    }
  }
  // Safety: strip leftover named functions
  for (const n of names) {
    while (s.includes("function " + n)) s = stripFunctionBlock(s, n);
  }
  return s;
}

function ensureGeneralExtras(clientPath) {
  if (!fs.existsSync(clientPath)) return false;
  let s = fs.readFileSync(clientPath, "utf8");
  let changed = false;

  // Rename General → Настройки / Settings
  if (s.includes('"general.nav": "Общие"')) {
    s = s.replace('"general.nav": "Общие"', '"general.nav": "Настройки"');
    changed = true;
  }
  if (s.includes('"general.nav": "General"')) {
    s = s.replace('"general.nav": "General"', '"general.nav": "Settings"');
    changed = true;
  }

  // Ensure about nav icon only (after limits, before voice)
  if (s.includes('id === "updates"') || s.includes('id === "network"') || s.includes('id === "notifications"')) {
    // Will be cleaned by strip of icon branches below via stripExtras
  }
  if (!s.includes('id === "about"')) {
    const iconRe =
      /if \(id === "limits"\) return \(0, react_jsx_runtime\.jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.IconDataOutlineMedium, \{\r?\n\t\t\t\tclassName: SettingsRoot_module_css_default\.navIcon,\r?\n\t\t\t\tsize: 16\r?\n\t\t\t\}\);\r?\n\t\t\tif \(id === "voice"\) return \(0, react_jsx_runtime\.jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.IconMicrophoneOutlineMedium, \{\r?\n\t\t\t\tclassName: SettingsRoot_module_css_default\.navIcon,\r?\n\t\t\t\tsize: 16\r?\n\t\t\t\}\);/;
    if (iconRe.test(s)) {
      const nl = s.includes("\r\n") ? "\r\n" : "\n";
      s = s.replace(iconRe, NAV_ICON_ABOUT_ONLY.replace(/\n/g, nl));
      changed = true;
    }
  } else if (s.includes('id === "updates"')) {
    // Replace bloated icon block with about-only
    const bloated =
      /if \(id === "limits"\) return \(0, react_jsx_runtime\.jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.IconDataOutlineMedium, \{\r?\n\t\t\t\tclassName: SettingsRoot_module_css_default\.navIcon,\r?\n\t\t\t\tsize: 16\r?\n\t\t\t\}\);\r?\n(?:\t\t\tif \(id === "(?:updates|network|notifications|about)"\) return \(0, react_jsx_runtime\.jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.Icon[A-Za-z]+, \{\r?\n\t\t\t\tclassName: SettingsRoot_module_css_default\.navIcon,\r?\n\t\t\t\tsize: 16\r?\n\t\t\t\}\);\r?\n)+?\t\t\tif \(id === "voice"\) return \(0, react_jsx_runtime\.jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.IconMicrophoneOutlineMedium, \{\r?\n\t\t\t\tclassName: SettingsRoot_module_css_default\.navIcon,\r?\n\t\t\t\tsize: 16\r?\n\t\t\t\}\);/;
    if (bloated.test(s)) {
      const nl = s.includes("\r\n") ? "\r\n" : "\n";
      s = s.replace(bloated, NAV_ICON_ABOUT_ONLY.replace(/\n/g, nl));
      changed = true;
    }
  }

  const needsRefresh =
    s.includes('id: "updates"') ||
    s.includes("function BeamUpdatesSettingsSection") ||
    s.includes(MARKER) ||
    !s.includes("function BeamAboutUpdatesBlock") ||
    !s.includes("beam-settings-status-pill") ||
    !s.includes('id: "about"');

  if (needsRefresh) {
    const before = s;
    s = stripExtras(s);
    if (s !== before) changed = true;

    // Insert fresh about-only block after limits registration
    if (!s.includes("function BeamAboutUpdatesBlock")) {
      if (s.includes("}, BeamLimitsSettingsSection));")) {
        const at = s.indexOf("}, BeamLimitsSettingsSection));") + "}, BeamLimitsSettingsSection));".length;
        s = s.slice(0, at) + "\n" + SECTIONS_CODE + REGISTER_BLOCK + s.slice(at);
        changed = true;
      } else {
        const genEnd = s.indexOf("}, GeneralSection));");
        if (genEnd >= 0) {
          const at = genEnd + "}, GeneralSection));".length;
          s = s.slice(0, at) + "\n" + SECTIONS_CODE + REGISTER_BLOCK + s.slice(at);
          changed = true;
        } else {
          console.warn("  no insert point", path.relative(ROOT, clientPath));
          return false;
        }
      }
    } else if (!s.includes('id: "about"')) {
      const after = s.indexOf("function BeamAboutSettingsSection");
      // find end of about function then insert register
      let i = after;
      let depth = 0;
      let started = false;
      let end = -1;
      for (; i < s.length; i++) {
        if (s[i] === "{") { depth++; started = true; }
        else if (s[i] === "}") {
          depth--;
          if (started && depth === 0) { end = i + 1; break; }
        }
      }
      if (end > 0) {
        s = s.slice(0, end) + REGISTER_BLOCK + s.slice(end);
        changed = true;
      }
    }
  }

  if (changed) fs.writeFileSync(clientPath, s);
  console.log("  general", path.relative(ROOT, clientPath) || clientPath, changed ? "patched" : "ok");
  return true;
}

function upsertCss(cssPath) {
  if (!fs.existsSync(cssPath)) return false;
  let css = fs.readFileSync(cssPath, "utf8");
  const marker = "/* ===== BEAM settings nav extras ===== */";
  if (css.includes(marker)) {
    const start = css.indexOf(marker);
    const next = css.indexOf("\n/* =====", start + marker.length);
    css = css.slice(0, start) + CSS_BLOCK + (next > start ? "\n" + css.slice(next).replace(/^\n+/, "") : "\n");
  } else {
    css = css.trimEnd() + "\n\n" + CSS_BLOCK + "\n";
  }
  fs.writeFileSync(cssPath, css);
  return true;
}

function patchHtml(htmlPath) {
  if (!fs.existsSync(htmlPath)) return false;
  let html = fs.readFileSync(htmlPath, "utf8");
  let changed = false;

  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${BUST}"`
  );
  changed = true;

  // pickSettingsSection: keep about; drop separate updates/network/notifications maps if we want clean about-only deep links
  if (html.includes("limits: /^(Лимиты|Limits)/i,") && !html.includes("about: /^(О приложении|About)/i,")) {
    html = html.replace(
      "limits: /^(Лимиты|Limits)/i,",
      `limits: /^(Лимиты|Limits)/i,
      about: /^(О приложении|About)/i,`
    );
    changed = true;
  }
  // Also map Настройки → general
  if (html.includes("general: /^(Общие|General|通用)/i,") && !html.includes("Настройки")) {
    html = html.replace(
      "general: /^(Общие|General|通用)/i,",
      "general: /^(Настройки|Общие|Settings|General|通用)/i,"
    );
    changed = true;
  }

  // Inject / refresh extras tagger
  if (html.includes("/* beam-settings-extras-tagger */")) {
    html = html.replace(
      /\/\* beam-settings-extras-tagger \*\/[\s\S]*?\} catch \{\}\n/,
      TAGGER_EXTRA.trimStart() + "\n"
    );
    changed = true;
  } else if (html.includes("/* beam-navcell-tagger-v4b */")) {
    html = html.replace(
      "/* beam-navcell-tagger-v4b */",
      "/* beam-navcell-tagger-v4b */\n" + TAGGER_EXTRA
    );
    changed = true;
  } else if (html.includes("beamStripNewSessionIconHosts();")) {
    html = html.replace(
      "beamStripNewSessionIconHosts();",
      "beamStripNewSessionIconHosts();\n" + TAGGER_EXTRA
    );
    changed = true;
  }

  // Extend v4b inline tagger for Настройки + about; drop updates/network/notifications tags if present
  if (html.includes('if (/^(general|общие)$/i.test(label)) el.setAttribute("data-beam-icon", "general");')) {
    html = html.replace(
      'if (/^(general|общие)$/i.test(label)) el.setAttribute("data-beam-icon", "general");',
      'if (/^(general|общие|settings|настройки)$/i.test(label)) el.setAttribute("data-beam-icon", "general");'
    );
    changed = true;
  }
  if (html.includes('else if (/^(limits|лимиты|лимит)$/i.test(label)) el.setAttribute("data-beam-icon", "limits");')
    && !html.includes('else if (/^(about|о приложении)$/i.test(label)) el.setAttribute("data-beam-icon", "about");')) {
    html = html.replace(
      'else if (/^(limits|лимиты|лимит)$/i.test(label)) el.setAttribute("data-beam-icon", "limits");',
      `else if (/^(limits|лимиты|лимит)$/i.test(label)) el.setAttribute("data-beam-icon", "limits");
    else if (/^(about|о приложении)$/i.test(label)) el.setAttribute("data-beam-icon", "about");`
    );
    changed = true;
  }
  // Remove obsolete update/network/notif tagger lines (nav items gone)
  html = html.replace(/\n\s*else if \(\/\^\(updates\|обновления\)\$\/i\.test\(label\)\) el\.setAttribute\("data-beam-icon", "updates"\);/g, "");
  html = html.replace(/\n\s*else if \(\/\^\(network\|сеть\|соединение\)\$\/i\.test\(label\)\) el\.setAttribute\("data-beam-icon", "network"\);/g, "");
  html = html.replace(/\n\s*else if \(\/\^\(notifications\|уведомления\)\$\/i\.test\(label\)\) el\.setAttribute\("data-beam-icon", "notifications"\);/g, "");

  // Extend dialog tagger maps for about only
  if (html.includes('[/^\\\\s*(limits|лимиты|лимит)\\\\s*$/i, "limits"],') && !html.includes('"about"]')) {
    html = html.replace(
      '[/^\\\\s*(limits|лимиты|лимит)\\\\s*$/i, "limits"],',
      `[/^\\\\s*(limits|лимиты|лимит)\\\\s*$/i, "limits"],
    [/^\\\\s*(about|о приложении)\\\\s*$/i, "about"],
    [/^\\\\s*(settings|настройки|general|общие)\\\\s*$/i, "general"],`
    );
    changed = true;
  }

  // Hide any leftover update/network/notification nav labels if a stale section still registers
  if (!html.includes("/* beam-settings-nav-only4 */")) {
    const hide = `
/* beam-settings-nav-only4 */
try {
  const killExtra = /^(Обновления|Updates|Сеть|Network|Соединение|Уведомления|Notifications)$/i;
  for (const el of document.querySelectorAll('[class*="navList"] button, button[class*="navCell"]')) {
    const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
    if (killExtra.test(label)) el.style.display = "none";
  }
} catch {}
`;
    if (html.includes("/* beam-settings-extras-tagger */")) {
      html = html.replace(
        "/* beam-settings-extras-tagger */",
        "/* beam-settings-extras-tagger */\n" + hide
      );
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(htmlPath, html);
  console.log("  html", path.relative(ROOT, htmlPath) || htmlPath, "bust=" + BUST);
  return true;
}

function ensureCircleInfoPng(webDist) {
  const bold = path.join(webDist, "assets/beam-icons/bold");
  const dest = path.join(bold, "circle-info.png");
  if (fs.existsSync(dest)) return;
  const alts = ["info.png", "circle-help.png", "help.png"];
  for (const a of alts) {
    const src = path.join(bold, a);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log("  alias circle-info <-", a);
      return;
    }
  }
}

let ok = 0;
for (const tree of uniqExisting(TREES)) {
  console.log("→", path.relative(ROOT, tree) || tree);
  if (ensureGeneralExtras(path.join(tree, "beam-client-ui-settings-general/lib/client.js"))) ok++;
}

for (const web of uniqExisting(WEBS)) {
  console.log("→ web", path.relative(ROOT, web) || web);
  ensureCircleInfoPng(web);
  upsertCss(path.join(web, "assets/beam-override.css"));
  patchHtml(path.join(web, "index.html"));
}

if (ok < 1) {
  console.error("Failed to patch settings-general trees");
  process.exit(1);
}

// Structural verify
for (const tree of uniqExisting(TREES)) {
  const p = path.join(tree, "beam-client-ui-settings-general/lib/client.js");
  const s = fs.readFileSync(p, "utf8");
  if (!s.includes('id: "about"')) {
    console.error("missing about section", p);
    process.exit(1);
  }
  for (const bad of ['id: "updates"', 'id: "network"', 'id: "notifications"']) {
    if (s.includes(bad)) {
      console.error("stale nav section still registered:", bad, p);
      process.exit(1);
    }
  }
  if (!s.includes("/assistix/update/check")) {
    console.error("about panel missing update check", p);
    process.exit(1);
  }
  if (!s.includes('"general.nav": "Настройки"') && !s.includes('"general.nav": "Settings"')) {
    console.warn("warn: general.nav may still be Общие/General", p);
  }
  if (!s.includes("function BeamAboutUpdatesBlock")) {
    console.error("merged about blocks missing", p);
    process.exit(1);
  }
}

console.log("Done. settings about-only trees=", ok, "bust=", BUST);
