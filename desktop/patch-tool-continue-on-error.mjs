/**
 * Tool-layer continue-on-error (Windows bash + Write escalation).
 *
 * Root causes:
 * - On win32, tool-bash is disabled; models still call `bash` → UNKNOWN_TOOL.
 * - Write/escalation rejects orphan `justification` without sandbox_permissions.
 * - Errors already become tool_result isError (loop continues), but messages were
 *   too bare — models often stop instead of recovering.
 *
 * Fixes (surgical, no network-resume changes):
 * 1) Remap bash/shell → pwsh when pwsh is registered and bash is not.
 * 2) Strip orphan/empty justification before escalation validation.
 * 3) Actionable UNKNOWN_TOOL / escalation recovery hints on tool_result.
 * 4) System-prompt nudge: after tool errors, continue with alternate tools.
 *
 * Targets: workspace runtime/dist + live %USERPROFILE%\BeamAgent (@assistix + @deepseek-ai).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARK = "BEAM_TOOL_CONTINUE";
const HOME_BEAM = path.join(os.homedir(), "BeamAgent");

const TREES = [
  path.join(ROOT, "runtime", "app", "beam", "node_modules"),
  path.join(ROOT, "dist", "Beam Agent", "resources", "app", "beam", "node_modules"),
  path.join(HOME_BEAM, "resources", "app", "beam", "node_modules"),
].filter((p) => fs.existsSync(p));

const PKG_PAIRS = [
  ["@assistix/beam-sandbox", "@deepseek-ai/dsh-sandbox"],
  ["@assistix/beam-tools", "@deepseek-ai/dsh-tools"],
  ["@assistix/beam-tool-pwsh", "@deepseek-ai/dsh-tool-pwsh"],
  ["@assistix/beam-tool-fs", "@deepseek-ai/dsh-tool-fs"],
  ["@assistix/beam-tool-bash", "@deepseek-ai/dsh-tool-bash"],
];

function uniqReal(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    let key;
    try {
      key = fs.realpathSync(p);
    } catch {
      key = p;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function syntaxCheck(file) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error("SYNTAX FAIL", file, (r.stderr || "").slice(0, 400));
    return false;
  }
  return true;
}

function replaceOnce(src, from, to, label) {
  if (src.includes(`/* ${MARK}:${label} */`) || src.includes(`// /* ${MARK}:${label} */`)) {
    return { src, ok: true, skipped: true, label };
  }
  if (!src.includes(from)) {
    return { src, ok: false, skipped: false, label };
  }
  return { src: src.replace(from, to), ok: true, skipped: false, label };
}

function libIndex(tree, pkg) {
  return path.join(tree, pkg, "lib", "index.js");
}

function patchSandbox(file) {
  let s = fs.readFileSync(file, "utf8");
  const from = `function validateEscalationArgs(sandboxPermissions, justification) {
	if (sandboxPermissions !== void 0 && justification === void 0) throw new Error("invalid escalation: sandbox_permissions requires a justification");
	if (justification !== void 0 && sandboxPermissions === void 0) throw new Error("invalid escalation: justification is only valid together with sandbox_permissions");
	if (justification !== void 0 && justification.trim().length === 0) throw new Error("invalid justification: expected a non-empty sentence");
}`;
  const to = `function validateEscalationArgs(sandboxPermissions, justification) {
	/* ${MARK}:escalation */
	// Models often send justification alone or empty; treat orphan/empty as absent so Write/bash continue.
	if (justification !== void 0 && (sandboxPermissions === void 0 || justification.trim().length === 0)) justification = void 0;
	if (sandboxPermissions !== void 0 && justification === void 0) throw new Error("invalid escalation: sandbox_permissions requires a non-empty justification — retry with both sandbox_permissions and justification, or omit both and continue");
	if (justification !== void 0 && justification.trim().length === 0) throw new Error("invalid justification: expected a non-empty sentence");
}`;
  const r = replaceOnce(s, from, to, "escalation");
  if (!r.ok && !r.skipped) {
    // Already softened in a prior edit shape?
    if (s.includes(`${MARK}:escalation`)) return { file, changed: false, note: "already" };
    console.error("MISS sandbox validateEscalationArgs", file);
    return { file, changed: false, note: "miss" };
  }
  if (r.skipped) return { file, changed: false, note: "already" };
  fs.writeFileSync(file, r.src);
  return { file, changed: true, note: "escalation" };
}

function patchTools(file) {
  let s = fs.readFileSync(file, "utf8");
  let changed = false;

  // 1) Remap bash/shell → pwsh when only pwsh is registered
  {
    const from = `		const callId = exec.callId;
		const rootCallId = exec.rootCallId ?? callId;
		const name = exec.name;
		const agent = exec.agent;`;
    const to = `		const callId = exec.callId;
		const rootCallId = exec.rootCallId ?? callId;
		let name = exec.name;
		const agent = exec.agent;
		/* ${MARK}:bash-remap */
		// Windows compositions disable tool-bash; models still call bash/shell — remap to pwsh when available.
		if ((name === "bash" || name === "shell" || name === "Shell") && this.get(name, agent) === void 0) {
			if (this.get("pwsh", agent) !== void 0) name = "pwsh";
			else if (this.get("bash", agent) !== void 0) name = "bash";
		}`;
    const r = replaceOnce(s, from, to, "bash-remap");
    if (!r.ok && !r.skipped) {
      console.error("MISS tools bash-remap", file);
      return { file, changed: false, note: "miss-remap" };
    }
    if (!r.skipped) {
      s = r.src;
      changed = true;
    }
  }

  // 2) Richer unknown-tool message listing alternatives
  {
    const from = `			const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
			if (!tool) throw new ToolNotFoundError(exec.name);
			state.bodyInvoked = true;`;
    const to = `			const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
			if (!tool) {
				/* ${MARK}:unknown-hint */
				const visible = [...this.view(exec.agent).visible.keys()].filter((n) => typeof n === "string" && n.length > 0).slice(0, 32);
				let hint;
				if (exec.name === "bash" && this.get("pwsh", exec.agent) !== void 0) hint = "use \`pwsh\` instead of \`bash\` on this Windows host; then continue the turn";
				else if (visible.length > 0) hint = \`try an available tool instead (e.g. \${visible.slice(0, 12).join(", ")}); read the error and continue — do not stop\`;
				else hint = "tool is not registered; pick another approach and continue this turn";
				throw new ToolNotFoundError(exec.name, hint);
			}
			state.bodyInvoked = true;`;
    const r = replaceOnce(s, from, to, "unknown-hint");
    if (!r.ok && !r.skipped) {
      console.error("MISS tools unknown-hint", file);
      return { file, changed: false, note: "miss-unknown" };
    }
    if (!r.skipped) {
      s = r.src;
      changed = true;
    }
  }

  // 3) Recovery footer on tool errors (esp. unknown / escalation / invalid args)
  {
    const from = `function toolErrorResult(error) {
	const info = errorInfo(error);
	const message = errorMessage(error);
	return {
		content: [{
			type: "text",
			text: \`Error: \${message}\`
		}],
		isError: true,
		error: {
			message,
			...info ? { info } : {}
		}
	};
}`;
    const to = `function toolErrorResult(error) {
	const info = errorInfo(error);
	let message = errorMessage(error);
	/* ${MARK}:recover-hint */
	// Keep the turn alive: surface a fixable hint so the model continues instead of aborting.
	const code = info?.code;
	if (code === "UNKNOWN_TOOL" || code === "INVALID_ARGS" || /invalid escalation|unknown tool|sandbox_permissions|justification/i.test(message)) {
		message = \`\${message}\\n[recoverable] Tool failed — analyze this error, switch to an alternate available tool or fix the args (on Windows use pwsh not bash; for Write omit lone justification, or send sandbox_permissions+justification together), then continue this same turn. Do not stop after one tool error.\`;
	}
	return {
		content: [{
			type: "text",
			text: \`Error: \${message}\`
		}],
		isError: true,
		error: {
			message,
			...info ? { info } : {}
		}
	};
}`;
    const r = replaceOnce(s, from, to, "recover-hint");
    if (!r.ok && !r.skipped) {
      console.error("MISS tools recover-hint", file);
      return { file, changed: false, note: "miss-recover" };
    }
    if (!r.skipped) {
      s = r.src;
      changed = true;
    }
  }

  if (!changed) return { file, changed: false, note: "already" };
  fs.writeFileSync(file, s);
  return { file, changed: true, note: "tools" };
}

function patchPwshPrompt(file) {
  let s = fs.readFileSync(file, "utf8");
  const from = `	ctx.systemPrompt.section({
		name: "tool:pwsh",
		order: ctx.systemPrompt.getSectionOrder("TOOL_PWSH"),
		text: "Non-zero exits are reported as \`[exit code: N]\` markers; investigate failures before moving on. On Windows a killed process settles as \`[exit code: 1]\` without a signal marker; treat a bare exit 1 after an interruption as a termination, not a command failure."
	});`;
  const to = `	ctx.systemPrompt.section({
		name: "tool:pwsh",
		order: ctx.systemPrompt.getSectionOrder("TOOL_PWSH"),
		text: "Non-zero exits are reported as \`[exit code: N]\` markers; investigate failures before moving on. On Windows a killed process settles as \`[exit code: 1]\` without a signal marker; treat a bare exit 1 after an interruption as a termination, not a command failure. /* ${MARK}:pwsh-prompt */ On this host the shell tool is \`pwsh\` (not \`bash\`/\`shell\`). After any tool error (unknown tool, invalid args, sandbox/escalation, network), read the tool_result, pick a workaround (pwsh, Write without orphan justification, Edit/Read), and continue the same turn — never abort the whole turn after a single recoverable tool failure."
	});`;
  const r = replaceOnce(s, from, to, "pwsh-prompt");
  if (!r.ok && !r.skipped) {
    if (s.includes(`${MARK}:pwsh-prompt`)) return { file, changed: false, note: "already" };
    console.error("MISS pwsh prompt", file);
    return { file, changed: false, note: "miss" };
  }
  if (r.skipped) return { file, changed: false, note: "already" };

  // Soften validatePwshArgs like bash (orphan justification)
  const fromV = `function validatePwshArgs(args) {
	if (args.command.trim().length === 0) throw new Error("invalid command: expected a non-empty string");
	if (args.description.trim().length === 0) throw new Error("invalid description: expected a non-empty string");
	if (args.timeoutMs !== void 0 && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) throw new Error(\`invalid timeoutMs: expected a positive number, got \${JSON.stringify(args.timeoutMs)}\`);
	validateEscalationArgs(args.sandbox_permissions, args.justification);
}`;
  const toV = `function validatePwshArgs(args) {
	if (args.command.trim().length === 0) throw new Error("invalid command: expected a non-empty string");
	if (args.description.trim().length === 0) throw new Error("invalid description: expected a non-empty string");
	if (args.timeoutMs !== void 0 && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) throw new Error(\`invalid timeoutMs: expected a positive number, got \${JSON.stringify(args.timeoutMs)}\`);
	/* ${MARK}:pwsh-escalation */
	const justification = args.sandbox_permissions === void 0 && (args.justification === void 0 || args.justification.trim() === "") ? void 0 : args.sandbox_permissions === void 0 ? void 0 : args.justification;
	validateEscalationArgs(args.sandbox_permissions, justification);
}`;
  let next = r.src;
  const rv = replaceOnce(next, fromV, toV, "pwsh-escalation");
  if (rv.ok && !rv.skipped) next = rv.src;

  fs.writeFileSync(file, next);
  return { file, changed: true, note: "pwsh" };
}

function patchToolFs(file) {
  let s = fs.readFileSync(file, "utf8");
  const from = `	async resolvePolicy(toolName, args, exec) {
		validateEscalationArgs(args.sandbox_permissions, args.justification);
		const standingPolicy = this.policy?.resolve({ ...exec.agent ? { session: exec.agent.session } : {} });
		if (args.sandbox_permissions === void 0 || args.justification === void 0) return standingPolicy;`;
  const to = `	async resolvePolicy(toolName, args, exec) {
		/* ${MARK}:fs-escalation */
		// Strip orphan justification so Write continues under standing policy instead of hard-failing.
		const justification = args.sandbox_permissions === void 0 ? void 0 : args.justification;
		validateEscalationArgs(args.sandbox_permissions, justification);
		const standingPolicy = this.policy?.resolve({ ...exec.agent ? { session: exec.agent.session } : {} });
		if (args.sandbox_permissions === void 0 || justification === void 0) return standingPolicy;`;
  const r = replaceOnce(s, from, to, "fs-escalation");
  if (!r.ok && !r.skipped) {
    if (s.includes(`${MARK}:fs-escalation`)) return { file, changed: false, note: "already" };
    console.error("MISS tool-fs resolvePolicy", file);
    return { file, changed: false, note: "miss" };
  }
  if (r.skipped) return { file, changed: false, note: "already" };
  // Keep approveEscalation using original args when both present — when sandbox set, justification unchanged.
  fs.writeFileSync(file, r.src);
  return { file, changed: true, note: "fs" };
}

function patchToolBash(file) {
  let s = fs.readFileSync(file, "utf8");
  // Broaden existing empty-only strip to also drop non-empty orphan justification
  const from = `	const justification = args.sandbox_permissions === void 0 && args.justification?.trim() === "" ? void 0 : args.justification;
	validateEscalationArgs(args.sandbox_permissions, justification);`;
  const to = `	/* ${MARK}:bash-escalation */
	const justification = args.sandbox_permissions === void 0 ? void 0 : args.justification;
	validateEscalationArgs(args.sandbox_permissions, justification);`;
  const r = replaceOnce(s, from, to, "bash-escalation");
  if (!r.ok && !r.skipped) {
    if (s.includes(`${MARK}:bash-escalation`)) return { file, changed: false, note: "already" };
    // optional — bash disabled on win32
    return { file, changed: false, note: "skip-miss" };
  }
  if (r.skipped) return { file, changed: false, note: "already" };
  fs.writeFileSync(file, r.src);
  return { file, changed: true, note: "bash" };
}

const results = [];
for (const tree of TREES) {
  console.log("\nTREE", tree);
  const files = [];
  for (const [assistix, deepseek] of PKG_PAIRS) {
    for (const pkg of [assistix, deepseek]) files.push(libIndex(tree, pkg));
  }
  for (const file of uniqReal(files)) {
    const pkg = file.replace(/\\/g, "/");
    let res;
    if (/\/(?:beam|dsh)-sandbox\//.test(pkg)) res = patchSandbox(file);
    else if (/\/(?:beam|dsh)-tools\//.test(pkg)) res = patchTools(file);
    else if (/\/(?:beam|dsh)-tool-pwsh\//.test(pkg)) res = patchPwshPrompt(file);
    else if (/\/(?:beam|dsh)-tool-fs\//.test(pkg) && !pkg.includes("tool-fs-search")) res = patchToolFs(file);
    else if (/\/(?:beam|dsh)-tool-bash\//.test(pkg) && !pkg.includes("persistent")) res = patchToolBash(file);
    else continue;

    if (res.changed && !syntaxCheck(file)) {
      console.error("  SYNTAX FAIL", file);
      process.exitCode = 1;
    }
    results.push(res);
    console.log(res.changed ? "  PATCHED" : "  ok", path.relative(tree, file), res.note);
  }
}

const patched = results.filter((r) => r.changed).length;
const missed = results.filter((r) => r.note?.startsWith("miss")).length;
console.log(`\nDone: ${patched} patched, ${missed} misses, ${results.length} total checks`);
if (missed > 0) process.exitCode = 1;
