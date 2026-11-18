/**
 * Fix blank chat: QuotaNoticeHost patch truncated cosmokit helpers.
 * Symptom: `@assistix/beam-client-ui-chat: import failed: isNullable is not defined`
 * → chat plugin never activates → empty black conversation pane.
 *
 * Restores QuotaNoticeHost return + cosmokit helpers before isVolatile.
 * Applies runtime + dist (@assistix + @deepseek-ai). No BEAM_BASE_URL / .env.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARK = "BEAM_CHAT_ISNULLABLE_FIX";

const FILES = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js",
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js",
  "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js",
];

const RESTORE = `
			const owner = {
				code: notice.code,
				message: weeklyMsg,
				dismiss: dismissNotice,
				keepOpen: keepNoticeOpen
			};
			return (0, react_jsx_runtime.jsx)(react.Fragment, { children: renderSlotChain("shell.quota-notice", owner, { fallback: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: owner.message,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 18 }),
				onDone: dismissNotice
			}) }) }, \`quota-notice-\${String(notice.seq)}\`);
		}
		//#endregion
		//#region ../../../vendor/cosmokit/lib/index.js
		/* ${MARK} */
		/** Return true when a value is \`null\` or \`undefined\`. */
		function isNullable(value) {
			return value === null || value === void 0;
		}
		/** Return true for non-array object values. */
		function isPlainObject(data) {
			return data && typeof data === "object" && !Array.isArray(data);
		}
		/** Filter object entries and return a new object. */
		function filterKeys(object, filter) {
			return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
		}
		/** Map object values while preserving the original key set. */
		function mapValues(object, transform) {
			return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
		}
		/** Pick selected keys from an object, optionally including \`undefined\` values. */
		function pick(source, keys, forced) {
			if (!keys) return { ...source };
			const result = {};
			for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
			return result;
		}
		/** Shared config references used by schema validators and plugin runtimes. */
		const write = Symbol.for("cosmokit.volatile.write");
		function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
			if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
			if (value === null || typeof value !== "object") return value;
			if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
			ancestors.add(value);
			try {
				if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
				if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
				return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
			} finally {
				ancestors.delete(value);
			}
		}
		/**
		* Create a detached reference containing an immutable copy of the supplied data.
		* @param value - validated config data; class instances and functions are unsupported.
		* @returns a reference whose value is updated only by its owning runtime.
		*/
		function createVolatile(value) {
			let current = snapshot(value);
			return Object.freeze({
				get: () => current,
				[write]: (value) => {
					current = value;
				}
			});
		}
		/**
		* Identify references across ESM/CJS copies of the shared library.
		* @param value - a parsed config value.
		* @returns whether the value implements the shared reference protocol.
		*/
		function isVolatile(value) {
`;

function fix(file) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) {
    console.log("skip missing", file);
    return false;
  }
  let s = fs.readFileSync(abs, "utf8");
  const hasIsNullable = /function isNullable\s*\(/.test(s);
  const broken =
    s.includes("Beam Agent: weekly quota notice + switch hint") &&
    /return base;\s*\}\)\(\);\s*\}\s*\/\*\*\s*\n\s*\* Identify references across ESM/.test(s);

  if (hasIsNullable && s.includes(MARK)) {
    console.log("already fixed", file);
    return false;
  }
  if (hasIsNullable && !broken) {
    console.log("ok (has isNullable)", file);
    return false;
  }
  if (!broken && !hasIsNullable) {
    // Try broader broken pattern: weeklyMsg closes then jumps to isVolatile
    const reLoose =
      /(return base;\s*\}\)\(\);)\s*\}\s*\/\*\*[\s\S]*?\*\/\s*function isVolatile\(value\) \{/;
    if (!reLoose.test(s)) {
      console.warn("pattern miss", file, { hasIsNullable, broken });
      return false;
    }
    s = s.replace(reLoose, `$1${RESTORE}`);
  } else {
    const re =
      /(return base;\s*\}\)\(\);)\s*\}\s*\/\*\*[\s\S]*?\*\/\s*function isVolatile\(value\) \{/;
    if (!re.test(s)) {
      console.warn("broken pattern miss", file);
      return false;
    }
    s = s.replace(re, `$1${RESTORE}`);
  }

  // Sanity
  if (!/function isNullable\s*\(/.test(s)) throw new Error("isNullable still missing: " + file);
  if (!s.includes("renderSlotChain(\"shell.quota-notice\"")) {
    throw new Error("QuotaNoticeHost return missing: " + file);
  }
  // Duplicate isVolatile should not happen — RESTORE includes isVolatile opening
  const count = (s.match(/function isVolatile\(value\) \{/g) || []).length;
  if (count !== 1) throw new Error("isVolatile count=" + count + " in " + file);

  fs.writeFileSync(abs, s);
  console.log("fixed", file);
  return true;
}

let n = 0;
for (const f of FILES) if (fix(f)) n++;
console.log("done, patched", n);
