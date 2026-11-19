/**
 * Clarify permission + mode menus (RU/EN), hide advanced modes behind Auto,
 * and let the agent request elevated access via the existing approval UI.
 * Patches runtime + dist @assistix trees. No BEAM_BASE_URL / .env changes.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TREES = [
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "beam", "node_modules", "@assistix"),
].filter((p) => fs.existsSync(p));

const MARK = "/* beam-clarify-menus-access */";

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function write(p, s) {
  fs.writeFileSync(p, s);
}

function replaceOnce(src, from, to, label) {
  if (!src.includes(from)) {
    if (src.includes(to) || (typeof to === "string" && to.length > 40 && src.includes(to.slice(0, 40)))) {
      return { src, ok: true, skipped: true, label };
    }
    return { src, ok: false, skipped: false, label };
  }
  return { src: src.replace(from, to), ok: true, skipped: false, label };
}

function replaceAll(src, from, to) {
  if (!src.includes(from)) return { src, n: 0 };
  const parts = src.split(from);
  return { src: parts.join(to), n: parts.length - 1 };
}

function syntaxCheck(file) {
  if (!file.endsWith(".js")) return true;
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error("SYNTAX FAIL", file, (r.stderr || "").slice(0, 300));
    return false;
  }
  return true;
}

function patchPermissionUi(file) {
  let s = read(file);
  if (s.includes("beam-clarify-menus-access:permission-ui")) return { file, changed: false, note: "already" };

  // EN settings dict
  s = s.replace(
    `const en = {
			"title": "Permission",
			"description": "Choose the default permission mode for new sessions",
			"loading": "Loading",
			"unavailable": "Unavailable",
			"preset.readOnly": "Read Only",
			"preset.workspaceWrite": "Project write",
			"preset.fullAccess": "Full access",
			"confirm.title": "Enable Full access?",
			"confirm.description": "Full access lets new sessions reduce confirmation steps and perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust subsequent tasks.",
			"confirm.acknowledge": "I understand the risks and want to continue",
			"confirm.cancel": "Cancel",
			"confirm.enable": "Enable Full access"
		};`,
    `const en = {
			"title": "Access",
			"description": "What Beam Agent may do in new chats by default",
			"loading": "Loading",
			"unavailable": "Unavailable",
			"preset.readOnly": "View only",
			"preset.workspaceWrite": "Edit project",
			"preset.fullAccess": "Full access",
			"preset.readOnly.desc": "Read files and answer questions. Cannot change files or run commands that write.",
			"preset.workspaceWrite.desc": "Edit files inside this project. Asks before broader system access.",
			"preset.fullAccess.desc": "Fewer prompts. Can change files and run commands more freely — use only when you trust the task.",
			"confirm.title": "Enable Full access?",
			"confirm.description": "Full access lets Beam Agent change files and run commands with fewer confirmation steps. Only enable when you trust the upcoming tasks.",
			"confirm.acknowledge": "I understand the risks and want to continue",
			"confirm.cancel": "Cancel",
			"confirm.enable": "Enable Full access"
		}; ${MARK} /* beam-clarify-menus-access:permission-ui */`
  );

  // access EN (composer picker)
  s = s.replace(
    `const accessEn = {
			"mode": "Access mode, current: {name}",
			"close": "Close",
			"preset.readOnly": "Read Only",
			"preset.workspaceWrite": "Project write",
			"preset.fullAccess": "Full access",
			"confirm.title": "Enable Full access?",
			"confirm.description": "Full access reduces confirmation steps and lets the agent perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust the current task.",
			"confirm.acknowledge": "I understand the risks and want to continue",
			"confirm.cancel": "Cancel",
			"confirm.enable": "Enable Full access",
			"auto.label": "Auto review",
			"auto.badge": "EXP",
			"auto.description": "Run without a sandbox after an experimental same-model review of every native tool call and PTC inner call.",
			"auto.confirm.title": "Enable Auto review (experimental)?",
			"auto.confirm.description": "Auto review runs without a sandbox. Before every native tool call and PTC inner call, the same model as the current agent reviews whether to allow it; you approve or reject each call it denies. This feature is experimental, can falsely allow or deny actions, and uses additional tokens.",
			"auto.confirm.acknowledge": "I understand these risks and want to continue",
			"auto.confirm.enable": "Enable Auto review"
		};`,
    `const accessEn = {
			"mode": "Access, current: {name}",
			"close": "Close",
			"preset.readOnly": "View only",
			"preset.workspaceWrite": "Edit project",
			"preset.fullAccess": "Full access",
			"preset.readOnly.desc": "Read files and answer questions. Cannot change files or run write commands.",
			"preset.workspaceWrite.desc": "Edit files inside this project. Asks before broader system access.",
			"preset.fullAccess.desc": "Fewer prompts. Can change files and run commands more freely — only when you trust this task.",
			"confirm.title": "Enable Full access?",
			"confirm.description": "Full access reduces confirmation steps and lets Beam Agent change files and run commands more freely. Only enable when you trust this task.",
			"confirm.acknowledge": "I understand the risks and want to continue",
			"confirm.cancel": "Cancel",
			"confirm.enable": "Enable Full access",
			"auto.label": "Smart review",
			"auto.badge": "EXP",
			"auto.description": "Runs with fewer limits; Beam Agent reviews each sensitive action before it runs. Experimental.",
			"auto.confirm.title": "Enable Smart review (experimental)?",
			"auto.confirm.description": "Smart review runs with fewer sandbox limits. Before each sensitive action, Beam Agent reviews it; you approve or reject anything it blocks. Experimental — may misjudge actions and uses extra tokens.",
			"auto.confirm.acknowledge": "I understand these risks and want to continue",
			"auto.confirm.enable": "Enable Smart review"
		};`
  );

  // accessZh leftover RU mix → keep zh, inject proper RU dict after accessEn
  if (!s.includes("const accessRu = {")) {
    s = s.replace(
      `const accessEn = {`,
      `const accessRu = {
			"mode": "Доступ, сейчас: {name}",
			"close": "Закрыть",
			"preset.readOnly": "Только просмотр",
			"preset.workspaceWrite": "Правки в проекте",
			"preset.fullAccess": "Полный доступ",
			"preset.readOnly.desc": "Читает файлы и отвечает на вопросы. Не меняет файлы и не выполняет команды записи.",
			"preset.workspaceWrite.desc": "Может править файлы в этом проекте. Перед более широким доступом спросит разрешение.",
			"preset.fullAccess.desc": "Меньше запросов. Может менять файлы и запускать команды свободнее — только если вы доверяете задаче.",
			"confirm.title": "Включить полный доступ?",
			"confirm.description": "Полный доступ уменьшает число подтверждений и позволяет Beam Agent свободнее менять файлы и запускать команды. Включайте, только если доверяете текущей задаче.",
			"confirm.acknowledge": "Я понимаю риски и хочу продолжить",
			"confirm.cancel": "Отмена",
			"confirm.enable": "Включить полный доступ",
			"auto.label": "Умная проверка",
			"auto.badge": "EXP",
			"auto.description": "Меньше ограничений; Beam Agent проверяет каждое чувствительное действие перед запуском. Экспериментально.",
			"auto.confirm.title": "Включить умную проверку (эксперимент)?",
			"auto.confirm.description": "Умная проверка работает с меньшими ограничениями. Перед каждым чувствительным действием Beam Agent проверяет его; вы подтверждаете или отклоняете заблокированные. Экспериментально — возможны ошибки и дополнительный расход токенов.",
			"auto.confirm.acknowledge": "Я понимаю эти риски и хочу продолжить",
			"auto.confirm.enable": "Включить умную проверку"
		};
		const accessEn = {`
    );
  }

  if (!s.includes("const settingsRu = {")) {
    s = s.replace(
      `const en = {`,
      `const settingsRu = {
			"title": "Доступ",
			"description": "Что Beam Agent может делать в новых чатах по умолчанию",
			"loading": "Загрузка",
			"unavailable": "Недоступно",
			"preset.readOnly": "Только просмотр",
			"preset.workspaceWrite": "Правки в проекте",
			"preset.fullAccess": "Полный доступ",
			"preset.readOnly.desc": "Читает файлы и отвечает на вопросы. Не меняет файлы и не выполняет команды записи.",
			"preset.workspaceWrite.desc": "Может править файлы в этом проекте. Перед более широким доступом спросит разрешение.",
			"preset.fullAccess.desc": "Меньше запросов. Может менять файлы и запускать команды свободнее — только если вы доверяете задаче.",
			"confirm.title": "Включить полный доступ?",
			"confirm.description": "Полный доступ позволяет Beam Agent менять файлы и запускать команды с меньшим числом подтверждений. Включайте, только если доверяете следующим задачам.",
			"confirm.acknowledge": "Я понимаю риски и хочу продолжить",
			"confirm.cancel": "Отмена",
			"confirm.enable": "Включить полный доступ"
		};
		const en = {`
    );
  }

  // Localize descriptions for built-in presets
  s = s.replace(
    `function optionDescription(option, t) {
			return option.value === "auto" ? t("auto.description") : option.description;
		}`,
    `function optionDescription(option, t) {
			if (option.value === "auto") return t("auto.description");
			const key = PRESET_LABEL_KEYS.get(option.value);
			if (key !== void 0) {
				const descKey = key + ".desc";
				const localized = t(descKey);
				if (localized && localized !== descKey) return localized;
			}
			return option.description;
		}`
  );

  // Show plain descriptions in the composer permission menu
  const itemsOld = `const items = catalog.options.map((option) => {
				const icon = permissionGlyph(option.value);
				const label = permissionLabel(option.value, option.name, t);
				const badge = optionBadge(option.value, t);
				return {
					id: option.value,
					label: badge === void 0 ? label : (0, react_jsx_runtime.jsxs)("span", {
						className: PermissionSelect_module_css_default.optionLabel,
						"aria-label": \`\${label} \${badge}\`,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: PermissionSelect_module_css_default.optionLabelText,
							children: label
						}), (0, react_jsx_runtime.jsx)("span", {
							className: PermissionSelect_module_css_default.badge,
							children: badge
						})]
					}),
					...icon === void 0 ? {} : { icon }
				};
			});`;

  const itemsNew = `const items = catalog.options.map((option) => {
				const icon = permissionGlyph(option.value);
				const label = permissionLabel(option.value, option.name, t);
				const badge = optionBadge(option.value, t);
				const detail = optionDescription(option, t);
				const titleRow = badge === void 0 ? label : (0, react_jsx_runtime.jsxs)("span", {
						className: PermissionSelect_module_css_default.optionLabel,
						"aria-label": \`\${label} \${badge}\`,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: PermissionSelect_module_css_default.optionLabelText,
							children: label
						}), (0, react_jsx_runtime.jsx)("span", {
							className: PermissionSelect_module_css_default.badge,
							children: badge
						})]
					});
				return {
					id: option.value,
					label: detail ? (0, react_jsx_runtime.jsxs)("span", {
						style: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, maxWidth: 280, whiteSpace: "normal" },
						children: [titleRow, (0, react_jsx_runtime.jsx)("span", {
							style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12, lineHeight: "18px", fontWeight: 400 },
							children: detail
						})]
					}) : titleRow,
					...icon === void 0 ? {} : { icon }
				};
			});`;

  if (s.includes(itemsOld)) s = s.replace(itemsOld, itemsNew);

  // Wire RU dictionaries (were incorrectly aliased to EN)
  s = s.replace(
    `ctx.effect(() => ctx.locale.register(PERMISSION_ACCESS_NS, {
				en: accessEn,
				ru: accessEn
			}), "ui-permission: current-session dictionaries");`,
    `ctx.effect(() => ctx.locale.register(PERMISSION_ACCESS_NS, {
				en: accessEn,
				ru: typeof accessRu !== "undefined" ? accessRu : accessEn
			}), "ui-permission: current-session dictionaries");`
  );
  s = s.replace(
    `ctx.effect(() => ctx.locale.register("settings.permission", {
				en,
				ru: en
			}), "ui-permission: settings row dictionaries");`,
    `ctx.effect(() => ctx.locale.register("settings.permission", {
				en,
				ru: typeof settingsRu !== "undefined" ? settingsRu : en
			}), "ui-permission: settings row dictionaries");`
  );

  // Slash popup details use localized desc
  s = s.replace(
    `...option.value === "auto" ? { detail: t("auto.description") } : option.description !== void 0 ? { detail: option.description } : {},`,
    `...(() => { const d = optionDescription(option, t); return d ? { detail: d } : {}; })(),`
  );

  write(file, s);
  return { file, changed: true, ok: syntaxCheck(file) };
}

function patchPermissionHost(file) {
  let s = read(file);
  if (s.includes("beam-clarify-menus-access:permission-host")) return { file, changed: false, note: "already" };

  // Default preset copy in Config
  s = s.replace(
    `"workspace-write": {
					sandbox: "workspace-write",
					approval: "ask",
					name: "workspace-write",
					description: "Write inside the workspace and permitted temporary directories; wider retries require approval."
				},
				"danger-full-access": {
					sandbox: "danger-full-access",
					approval: "never",
					name: "danger-full-access",
					description: "Full file access without approval prompts."
				}`,
    `"workspace-write": {
					sandbox: "workspace-write",
					approval: "ask",
					name: "Edit project",
					description: "Edit files inside this project. Asks before broader system access."
				},
				"danger-full-access": {
					sandbox: "danger-full-access",
					approval: "never",
					name: "Full access",
					description: "Fewer prompts. Can change files and run commands more freely."
				}`
  );

  // Register request_elevated_access tool via existing approval + permissionPresets.set
  const hookNeedle = `ctx.inject(["commands"], (commandCtx) => {`;
  if (!s.includes("request_elevated_access") && s.includes(hookNeedle)) {
    const toolBlock = `ctx.inject(["tools"], (toolCtx) => {
				const LEVELS = {
					"workspace-write": { preset: "workspace-write", en: "Edit project", ru: "Правки в проекте" },
					"danger-full-access": { preset: "danger-full-access", en: "Full access", ru: "Полный доступ" }
				};
				const register = (definition) => toolCtx.tools.register(definition);
				const definition = {
					name: "request_elevated_access",
					description: "Ask the user in-app to raise this chat's access level (edit project or full access). Use when the current access is too narrow for the task. Do not use for a one-shot retry after a sandbox denial — use sandbox_permissions on that tool call instead. The approval panel appears in the chat; wait for the user's decision.",
					parameters: {
						type: "object",
						additionalProperties: false,
						properties: {
							level: {
								type: "string",
								enum: ["workspace-write", "danger-full-access"],
								description: "Target access: workspace-write = edit files in this project; danger-full-access = full access with fewer prompts."
							},
							reason: {
								type: "string",
								description: "One clear sentence for the user explaining why higher access is needed, in the user's language."
							}
						},
						required: ["level", "reason"]
					},
					output: {
						schema: {
							type: "object",
							additionalProperties: false,
							properties: {
								text: { type: "string" },
								granted: { type: "boolean" },
								level: { type: "string" }
							},
							required: ["text", "granted"]
						},
						render(_args, value) {
							return value.text;
						}
					},
					async execute(args, exec) {
						const level = typeof args.level === "string" ? args.level : "";
						const reason = typeof args.reason === "string" ? args.reason.trim() : "";
						const meta = LEVELS[level];
						if (!meta) throw new Error(\`unknown access level "\${level}"\`);
						if (!reason) throw new Error("reason must be a non-empty sentence for the user");
						const agent = exec.agent;
						if (agent === void 0) throw new Error("request_elevated_access requires a live agent");
						const current = this.current(agent.session);
						if (current === meta.preset || current === "danger-full-access" && meta.preset === "workspace-write") {
							return {
								text: \`Access is already "\${current}"; no elevation needed.\`,
								granted: true,
								level: current
							};
						}
						const outcome = await this.ctx.approval.request({
							agent,
							toolName: "request_elevated_access",
							...exec.callId !== void 0 ? { callId: exec.callId } : {},
							reason: \`elevate session access to \${level}: \${reason}\`,
							displayReason: {
								en: \`Beam Agent asks for "\${meta.en}" for this chat: \${reason}\`,
								ru: \`Beam Agent просит «\${meta.ru}» для этого чата: \${reason}\`
							},
							...exec.signal ? { signal: exec.signal } : {}
						});
						if (outcome !== "allowed-once") {
							return {
								text: \`The user did not grant elevated access (outcome: \${outcome}). Continue with current access or explain what you cannot do.\`,
								granted: false,
								level: current
							};
						}
						this.set(agent.session, meta.preset);
						return {
							text: \`User granted "\${meta.en}" for this chat. Continue the task with the new access.\`,
							granted: true,
							level: meta.preset
						};
					}
				};
				definition.execute = definition.execute.bind(this);
				try { register(definition); } catch (error) { try { toolCtx.logger?.warn?.("permission: request_elevated_access tool not registered: " + (error instanceof Error ? error.message : String(error))); } catch {} }
			});
			${MARK} /* beam-clarify-menus-access:permission-host */
			ctx.inject(["commands"], (commandCtx) => {`;
    s = s.replace(hookNeedle, toolBlock);
  }

  write(file, s);
  return { file, changed: true, ok: syntaxCheck(file) };
}

function patchSandboxEscalation(file) {
  let s = read(file);
  if (s.includes("beam-clarify-menus-access:escalation")) return { file, changed: false, note: "already" };

  s = s.replace(
    `displayReason: {
			en: \`Allow this operation with \${mode} permissions: \${justification}\`,
			zh: \`允许本次操作使用 \${mode} 权限：\${justification}\`
		},`,
    `displayReason: (() => {
			const labels = {
				"workspace-write": { en: "Edit project", ru: "Правки в проекте", zh: "编辑项目" },
				"danger-full-access": { en: "Full access", ru: "Полный доступ", zh: "完全权限" }
			};
			const label = labels[mode] ?? { en: mode, ru: mode, zh: mode };
			return {
				en: \`Allow this one action with "\${label.en}" access: \${justification}\`,
				ru: \`Разрешить это действие с доступом «\${label.ru}»: \${justification}\`,
				zh: \`允许本次操作使用「\${label.zh}」权限：\${justification}\`
			};
		})(), ${MARK} /* beam-clarify-menus-access:escalation */`
  );

  s = s.replace(
    `return \`[sandbox: escalation available — retry this exact \${subject} once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]\`;`,
    `return \`[sandbox: escalation available — retry this exact \${subject} once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the in-app approval prompt asks the user. For standing higher access for the rest of this chat, call request_elevated_access instead]\`;`
  );

  write(file, s);
  return { file, changed: true, ok: syntaxCheck(file) };
}

function patchApprovalUi(file) {
  let s = read(file);
  if (s.includes("beam-clarify-menus-access:approval-ui")) return { file, changed: false, note: "already" };

  s = s.replace(
    `const en = {
			waiting: "Waiting for approval",
			"detail.aria": "Approval details",
			escalation: "Tool {toolName} requests privileged execution",
			reject: "Reject",
			allowOnce: "Allow once"
		};`,
    `const en = {
			waiting: "Waiting for your approval",
			"detail.aria": "Approval details",
			escalation: "Beam Agent asks for higher access ({toolName})",
			reject: "Reject",
			allowOnce: "Allow"
		}; ${MARK} /* beam-clarify-menus-access:approval-ui */`
  );

  s = s.replace(
    `const ru = {
			"waiting": "Waiting for approval",
			"detail.aria": "Approval details",
			"escalation": "Tool {toolName} requests privileged execution",
			"reject": "Отклонить",
			"allowOnce": "Разрешить один раз"
};`,
    `const ru = {
			"waiting": "Ожидание вашего разрешения",
			"detail.aria": "Сведения о запросе",
			"escalation": "Beam Agent просит расширить доступ ({toolName})",
			"reject": "Отклонить",
			"allowOnce": "Разрешить"
		};`
  );

  write(file, s);
  return { file, changed: true, ok: syntaxCheck(file) };
}

function patchAgentPresetUi(file) {
  let s = read(file);
  if (s.includes("beam-clarify-menus-access:modes")) return { file, changed: false, note: "already" };

  // Hide Creator with PTC/Minimal for normal users
  s = s.replace(
    `function requiresCodingTools(preset) {
			return preset !== void 0 && isBuiltInPreset(preset) && (preset.id === "ptc" || preset.id === "minimal");
		}`,
    `function requiresCodingTools(preset) {
			return preset !== void 0 && isBuiltInPreset(preset) && (preset.id === "ptc" || preset.id === "minimal" || preset.id === "cordis");
		} ${MARK} /* beam-clarify-menus-access:modes */`
  );

  // EN mode copy → Auto-first, no DSH
  s = s.replace(
    `const en = {
			...guideEn,
			builtInGroup: "Built-in",
			customGroup: "Custom",
			sectionIntro: "Choose the agent’s tools and how it works. Use Standard mode for everyday tasks, or Creator mode to add capabilities to DSH.",
			seatHint: "Choose the agent preset for your new task",
			headerHint: "The agent preset chosen when this task started",
			nav: "Agent presets",
			setDefault: "Set as new task default",
			view: "View configuration",
			presetStandardName: "Standard mode",
			presetStandardDescription: "Work with code, files, and information. Suitable for most tasks, with search, editing, terminal commands, and other tools available as needed.",
			presetPtcName: "PTC mode",
			presetPtcDescription: "Includes all Standard mode capabilities. Better suited to tasks that call tools in batches and then filter, organize, deduplicate, count, or summarize the results.",
			presetMinimalName: "Minimal mode",
			presetMinimalDescription: "The agent uses a terminal and image reading, with context compaction. Useful for testing and comparing its basic performance.",
			presetCordisName: "Creator mode",
			presetCordisDescription: "Customize DSH through conversation. Let the agent write plugins that add features or UI, or combine tools and prompts to create your own mode.",
			inUse: "New task default",
			noDescription: "No description.",
			brokenBadge: "Failed to load",
			switchRefused: "Could not switch to {name}: {reason}",
			standardUnavailable: "Standard mode is unavailable. Restore it or choose another available mode.",
			close: "Close",
			creatorDraft: "Let the agent help me create a preset",
			createPlugin: "Let the agent create a plugin",
			createPluginDescription: "Enter Creator mode and make your own DSH plugin",
			createPluginChecking: "Checking whether Creator mode is available",
			createPluginUnavailable: "Temporarily unavailable. Reopen this menu to retry",
			createPluginMissing: "Creator mode is not included in this configuration"
		};`,
    `const en = {
			...guideEn,
			builtInGroup: "Built-in",
			customGroup: "Custom",
			sectionIntro: "Auto is the default: Beam Agent picks the tools it needs. Advanced modes stay available when developer tools are on.",
			seatHint: "Choose how Beam Agent works for your new task",
			headerHint: "Mode chosen when this task started",
			nav: "Modes",
			setDefault: "Set as new task default",
			view: "View configuration",
			presetStandardName: "Auto",
			presetStandardDescription: "Beam Agent uses search, editing, terminal, and other tools as needed. Best default for most tasks.",
			presetPtcName: "Batch tools",
			presetPtcDescription: "Advanced: organizes many tool calls in code, then filters or summarizes results. Usually unnecessary — Auto handles batch work too.",
			presetMinimalName: "Minimal",
			presetMinimalDescription: "Advanced: terminal and image reading only. For testing basic performance.",
			presetCordisName: "Extend Beam",
			presetCordisDescription: "Advanced: let the agent build plugins or custom modes for Beam Agent / Assistix. Not needed for everyday work.",
			inUse: "New task default",
			noDescription: "No description.",
			brokenBadge: "Failed to load",
			switchRefused: "Could not switch to {name}: {reason}",
			standardUnavailable: "Auto mode is unavailable. Restore it or choose another available mode.",
			close: "Close",
			creatorDraft: "Let the agent help me create a mode",
			createPlugin: "Let the agent create a plugin",
			createPluginDescription: "Open advanced mode to build a Beam Agent plugin",
			createPluginChecking: "Checking whether advanced mode is available",
			createPluginUnavailable: "Temporarily unavailable. Reopen this menu to retry",
			createPluginMissing: "Advanced plugin mode is not included in this configuration"
		};`
  );

  // Replace empty / partial RU with full RU
  const ruBlock = `// #region beam-ru
		const ru = {
			builtInGroup: "Встроенные",
			customGroup: "Свои",
			sectionIntro: "Авто — режим по умолчанию: Beam Agent сам выбирает нужные инструменты. Расширенные режимы доступны при включённых инструментах разработчика.",
			seatHint: "Выберите, как Beam Agent будет работать в новой задаче",
			headerHint: "Режим, выбранный при старте этой задачи",
			nav: "Режимы",
			setDefault: "Сделать режимом по умолчанию",
			view: "Показать конфигурацию",
			presetStandardName: "Авто",
			presetStandardDescription: "Beam Agent сам подключает поиск, правки, терминал и другие инструменты по необходимости. Лучший выбор для большинства задач.",
			presetPtcName: "Пакетные инструменты",
			presetPtcDescription: "Расширенный: организует много вызовов инструментов в коде, затем фильтрует или суммирует результаты. Обычно не нужен — Авто тоже справляется с пакетной работой.",
			presetMinimalName: "Минимальный",
			presetMinimalDescription: "Расширенный: только терминал и чтение изображений. Для проверки базовой производительности.",
			presetCordisName: "Расширение Beam",
			presetCordisDescription: "Расширенный: агент может создавать плагины или свои режимы для Beam Agent / Assistix. Не нужен для повседневной работы.",
			inUse: "По умолчанию для новых задач",
			noDescription: "Нет описания.",
			brokenBadge: "Не загрузился",
			switchRefused: "Не удалось переключить на {name}: {reason}",
			standardUnavailable: "Режим Авто недоступен. Восстановите его или выберите другой.",
			close: "Закрыть",
			creatorDraft: "Пусть агент поможет создать режим",
			createPlugin: "Пусть агент создаст плагин",
			createPluginDescription: "Открыть расширенный режим и собрать плагин Beam Agent",
			createPluginChecking: "Проверяем, доступен ли расширенный режим",
			createPluginUnavailable: "Временно недоступно. Откройте меню снова",
			createPluginMissing: "Расширенный режим плагинов не включён в эту сборку",
			guideStandardIntro: "Выберите Авто для новой задачи. Опишите цель, укажите файлы и как проверить результат.",
			guidePtcIntro: "Пакетные инструменты — расширенный режим. Обычно достаточно Авто.",
			guideMinimalIntro: "Минимальный режим — для тестов. Обычно достаточно Авто.",
			guideCordisIntro: "Расширение Beam — для плагинов и своих режимов Assistix, не для повседневных задач."
		};
		// #endregion beam-ru;`;

  if (s.includes("// #region beam-ru")) {
    s = s.replace(/\/\/ #region beam-ru[\s\S]*?\/\/ #endregion beam-ru;?/, ruBlock);
  } else {
    s = s.replace(
      `// #endregion
		//#region \\0dsh-css:D:\\ci\\runners\\github\\_work\\beam-agent\\beam-agent\\packages\\client\\ui-agent-preset\\src\\client\\AgentPresetLabel.module.css.mjs`,
      `${ruBlock}
		//#endregion
		//#region \\0dsh-css:D:\\ci\\runners\\github\\_work\\beam-agent\\beam-agent\\packages\\client\\ui-agent-preset\\src\\client\\AgentPresetLabel.module.css.mjs`
    );
  }

  // Ensure locale.register includes ru
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*zh\s*,\s*en\s*\}\)/g, "locale.register($1, { en, ru, zh })");
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*zh\s*\}\)/g, "locale.register($1, { en, ru, zh })");
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*ru\s*\}\)/g, "locale.register($1, { en, ru, zh })");

  // Scrub leftover DSH in this file's user-facing EN/ZH strings we care about
  s = replaceAll(s, "Customize DSH through conversation", "Customize Beam Agent through conversation").src;
  s = replaceAll(s, "add capabilities to DSH", "add capabilities to Beam Agent").src;
  s = replaceAll(s, "扩展 DSH 的能力", "扩展 Beam Agent 的能力").src;
  s = replaceAll(s, "用对话定制 DSH", "用对话定制 Beam Agent").src;
  s = replaceAll(s, "你的 DSH 插件", "你的 Beam Agent 插件").src;
  s = replaceAll(s, "own DSH plugin", "own Beam Agent plugin").src;

  // Fix mixed zh/standard name leftovers
  s = replaceAll(s, 'presetStandardName: "Стандартный режим"', 'presetStandardName: "标准模式"').src;

  write(file, s);
  return { file, changed: true, ok: syntaxCheck(file) };
}

function patchCordisYml(file) {
  let s = read(file);
  if (s.includes("beam-clarify-menus-access:yml")) return { file, changed: false, note: "already" };

  const old = `        presets:
          read-only:
            sandbox: read-only
            approval: ask
          workspace-write:
            sandbox: workspace-write
            approval: ask
          danger-full-access:
            sandbox: danger-full-access
            approval: never`;

  const neu = `        presets:
          read-only:
            sandbox: read-only
            approval: ask
            name: View only
            description: Read files and answer questions. Cannot change files or run write commands.
          workspace-write:
            sandbox: workspace-write
            approval: ask
            name: Edit project
            description: Edit files inside this project. Asks before broader system access.
          danger-full-access:
            sandbox: danger-full-access
            approval: never
            name: Full access
            description: Fewer prompts. Can change files and run commands more freely.
        # beam-clarify-menus-access:yml`;

  if (!s.includes(old)) {
    // already named?
    if (s.includes("name: Edit project") || s.includes("name: View only")) {
      return { file, changed: false, note: "already-named" };
    }
    return { file, changed: false, note: "pattern-miss", ok: false };
  }
  s = s.replace(old, neu);
  write(file, s);
  return { file, changed: true, ok: true };
}

function patchChromeInjector(file) {
  if (!fs.existsSync(file)) return { file, changed: false, note: "missing" };
  let s = read(file);
  if (s.includes("beam-clarify-menus-access:chrome")) return { file, changed: false, note: "already" };

  const insert = `
      [/^View only$/g, "Только просмотр"],
      [/^Edit project$/g, "Правки в проекте"],
      [/^Full access$/g, "Полный доступ"],
      [/^Read Only$/g, "Только просмотр"],
      [/^Project write$/g, "Правки в проекте"],
      [/^Auto$/g, "Авто"],
      [/^Standard mode$/g, "Авто"],
      /* beam-clarify-menus-access:chrome */
`;

  if (s.includes("[/^Standard mode$/g,")) {
    s = s.replace("[/^Standard mode$/g, \"Стандартный режим\"],", `[/^Standard mode$/g, "Авто"],${insert}`);
  } else if (s.includes("const chromePairs")) {
    s = s.replace("const chromePairs", `${insert}\n  const chromePairs`);
  } else {
    return { file, changed: false, note: "no-hook" };
  }
  write(file, s);
  return { file, changed: true, ok: true };
}

const results = [];
for (const tree of TREES) {
  console.log("\\n==", tree);
  const targets = [
    ["beam-client-ui-permission-presets/lib/client.js", patchPermissionUi],
    ["beam-permission-presets/lib/index.js", patchPermissionHost],
    ["beam-sandbox/lib/index.js", patchSandboxEscalation],
    ["beam-client-ui-approval/lib/client.js", patchApprovalUi],
    ["beam-client-ui-agent-preset/lib/client.js", patchAgentPresetUi],
    ["beam-base/cordis.patch.yml", patchCordisYml],
  ];
  for (const [rel, fn] of targets) {
    const file = path.join(tree, rel);
    if (!fs.existsSync(file)) {
      results.push({ file, changed: false, note: "missing" });
      console.log("  miss", rel);
      continue;
    }
    const r = fn(file);
    results.push(r);
    console.log(" ", r.changed ? "patched" : "skip", rel, r.note || (r.ok === false ? "FAIL" : "ok"));
  }
}

const injector = path.join(ROOT, "desktop", "_tmp_index_inject.js");
results.push(patchChromeInjector(injector));

const failed = results.filter((r) => r.ok === false);
const changed = results.filter((r) => r.changed);
console.log("\\nChanged:", changed.length, "Failed:", failed.length);
if (failed.length) process.exitCode = 1;
