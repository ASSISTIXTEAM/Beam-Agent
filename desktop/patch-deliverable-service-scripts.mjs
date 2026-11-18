/**
 * Chat deliverable strip: hide service/helper scripts (.py/.ps1/.sh/…) when the
 * user goal is not coding (essay/docx/pptx/research). Keep real artifacts.
 * Coding-focused goals still show .py normally. Trajectory/process UI untouched.
 *
 * Applies runtime + dist (@assistix + @deepseek-ai deliverables clients).
 * Does NOT write BEAM_BASE_URL into .env.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MARK = 'BEAM_DELIVERABLE_SERVICE_FILTER'

const TARGETS = [
  path.join(ROOT, 'runtime/app/beam/node_modules/@assistix/beam-client-ui-deliverables/lib/client.js'),
  path.join(ROOT, 'runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-deliverables/lib/client.js'),
  path.join(ROOT, 'dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-deliverables/lib/client.js'),
  path.join(ROOT, 'dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-deliverables/lib/client.js'),
]

const HELPER_REGION = `
		// #region ${MARK}
		/** User-facing Chat chips only — Trajectory/tool rows stay unfiltered. */
		const BEAM_SERVICE_SCRIPT_EXTS = new Set([".py", ".pyw", ".ps1", ".psm1", ".sh", ".bash", ".zsh", ".cmd", ".bat"]);
		const BEAM_GOAL_ARTIFACT_EXTS = new Set([
			".docx", ".doc", ".pdf", ".pptx", ".ppt", ".xlsx", ".xls", ".odt", ".odp", ".ods",
			".rtf", ".html", ".htm", ".md", ".txt", ".csv", ".epub", ".tex",
			".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg",
		]);
		const BEAM_CODE_GOAL_EXTS = new Set([
			".py", ".pyw", ".ps1", ".sh", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
			".go", ".rs", ".java", ".kt", ".cs", ".cpp", ".c", ".h", ".rb", ".php",
			".swift", ".vue", ".svelte", ".css", ".scss", ".json", ".yml", ".yaml", ".toml",
		]);
		const BEAM_HELPER_NAME_RE = /^(make_|build_|gen_|generate_|render_|create_|export_|compile_|run_|helper_|util_|scaffold_)/i;
		const BEAM_CODING_HINT_RE = /\\b(python|\\.py\\b|typescript|\\.tsx?\\b|javascript|\\.jsx?\\b|scripts?|coding|codebase|refactor|pytest|unittest|lint|debug|программ|скрипт|питон|(?:^|\\s)код(?:\\s|$))/i;
		const BEAM_DOC_HINT_RE = /\\b(реферат|доклад|эссе|курсов|диплом|презентац|исследован|отч[её]т|essay|report|docx|pptx|pdf|presentation|slides?|thesis|paper|write[- ]?up|research)\\b/i;
		function beamPathExt(filePath) {
			const base = String(filePath || "").replace(/\\\\/g, "/").split("/").pop() || "";
			const i = base.lastIndexOf(".");
			return i >= 0 ? base.slice(i).toLowerCase() : "";
		}
		function beamPathBase(filePath) {
			return String(filePath || "").replace(/\\\\/g, "/").split("/").pop() || "";
		}
		function beamIsServiceScriptPath(filePath) {
			return BEAM_SERVICE_SCRIPT_EXTS.has(beamPathExt(filePath));
		}
		function beamIsGoalArtifactPath(filePath) {
			return BEAM_GOAL_ARTIFACT_EXTS.has(beamPathExt(filePath));
		}
		function beamIsCodingPath(filePath) {
			return BEAM_CODE_GOAL_EXTS.has(beamPathExt(filePath));
		}
		function beamLooksLikeHelperScript(filePath) {
			if (!beamIsServiceScriptPath(filePath)) return false;
			const name = beamPathBase(filePath);
			return BEAM_HELPER_NAME_RE.test(name) || /^(make|build|gen|generate|render)-/i.test(name);
		}
		/**
		 * Coding-focused → show scripts. Document/other goals with helper scripts → suppress.
		 * @param {string} title
		 * @param {readonly string[]} paths
		 */
		function beamIsCodingFocusedGoal(title, paths) {
			const text = String(title || "");
			const list = Array.isArray(paths) ? paths.filter(Boolean) : [];
			const hasArtifact = list.some(beamIsGoalArtifactPath);
			const serviceScripts = list.filter(beamIsServiceScriptPath);
			const helpers = list.filter(beamLooksLikeHelperScript);
			const codingHint = BEAM_CODING_HINT_RE.test(text);
			const docHint = BEAM_DOC_HINT_RE.test(text);
			if (docHint && !codingHint) return false;
			if (hasArtifact && (helpers.length > 0 || serviceScripts.length > 0) && !codingHint) return false;
			if (hasArtifact && helpers.length > 0 && !docHint && codingHint) {
				// Explicit coding title wins only when no doc hint; still prefer artifacts over helpers.
			}
			if (codingHint && !docHint) return true;
			if (!hasArtifact && list.length > 0 && list.every((p) => beamIsServiceScriptPath(p) || beamIsCodingPath(p))) return true;
			if (!hasArtifact && serviceScripts.length > 0 && list.every(beamIsServiceScriptPath)) return true;
			return false;
		}
		function beamShouldSuppressServiceScripts(title, paths) {
			return !beamIsCodingFocusedGoal(title, paths);
		}
		function beamFilterPresentedFiles(presented, suppress) {
			if (!suppress || !Array.isArray(presented)) return presented;
			const kept = presented.filter((file) => !beamIsServiceScriptPath(file.path));
			return kept.length === 0 ? presented : kept;
		}
		function beamFilterChangesSummary(changes, suppress) {
			if (!changes || !suppress || !Array.isArray(changes.files)) return changes;
			const kept = [];
			for (let i = 0; i < changes.files.length; i += 1) {
				const file = changes.files[i];
				if (!beamIsServiceScriptPath(file.path)) kept.push({
					...file,
					beamIndex: i
				});
			}
			if (kept.length === changes.files.length) return changes;
			if (kept.length === 0) return null;
			let added = 0;
			let deleted = 0;
			for (const file of kept) {
				if (file.binary === true || file.oversized === true) continue;
				added += Number(file.added) || 0;
				deleted += Number(file.deleted) || 0;
			}
			return {
				...changes,
				files: kept,
				total: kept.length,
				added,
				deleted
			};
		}
		function beamReviewIndex(file, fallback) {
			return typeof file?.beamIndex === "number" ? file.beamIndex : fallback;
		}
		// #endregion ${MARK}
`

function normalizeEol(src) {
  return { text: src.replace(/\r\n/g, '\n'), crlf: src.includes('\r\n') }
}

function restoreEol(text, crlf) {
  return crlf ? text.replace(/\n/g, '\r\n') : text
}

function stripPrevious(src) {
  return src
    .replace(new RegExp(`\\n\\t\\t// #region ${MARK}[\\s\\S]*?// #endregion ${MARK}\\n`, 'g'), '\n')
    .replace(/\n{3,}/g, '\n\n')
}

function injectHelper(src) {
  const anchor = '\t\t//#region lib/types/client/Deliverables.js'
  if (!src.includes(anchor)) throw new Error('Deliverables region anchor missing')
  if (src.includes(`// #region ${MARK}`)) return src
  return src.replace(anchor, `${HELPER_REGION.trimEnd()}\n\n${anchor}`)
}

function patchDeliverablesBody(src) {
  if (src.includes('beamShouldSuppressServiceScripts') && src.includes('visiblePresented') && src.includes('sessionTitle = useSessions')) {
    return src
  }

  const start = src.indexOf('function Deliverables({ matched, openFile, t, sessionId, useSessions, openPresented, openChangesReview, usePresentedOpen, usePresentedHost, useChangesDiff, loadChangesDiff, useChangesSummary, reloadPresentedHost, loadChangesSummary, useShowCodeDiff, renderSlot }) {')
  if (start < 0) throw new Error('Deliverables function start not found')
  const end = src.indexOf('\n\t\t}\n\t\t//#endregion', start)
  if (end < 0) throw new Error('Deliverables function end not found')
  const close = end + '\n\t\t}'.length

  const newFn = `function Deliverables({ matched, openFile, t, sessionId, useSessions, openPresented, openChangesReview, usePresentedOpen, usePresentedHost, useChangesDiff, loadChangesDiff, useChangesSummary, reloadPresentedHost, loadChangesSummary, useShowCodeDiff, renderSlot }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const showCodeDiff = useShowCodeDiff((value) => value);
			const cwd = useSessions((state) => state.byId[sessionId]?.cwd);
			const sessionTitle = useSessions((state) => {
				const row = state.byId[sessionId];
				return row?.displayTitle ?? row?.title ?? "";
			});
			const states = usePresentedOpen((value) => value);
			const host = usePresentedHost((value) => value);
			const announced = showCodeDiff ? matched.changes : null;
			const summary = useChangesSummary((value) => announced === null ? void 0 : value[changesSummaryUrl(sessionId, announced.seq)]);
			(0, react.useEffect)(() => {
				if (announced !== null && summary === void 0) loadChangesSummary(sessionId, announced.seq);
			}, [
				announced,
				summary,
				sessionId,
				loadChangesSummary
			]);
			const changesRaw = announced !== null && typeof summary === "object" && summary.files.length > 0 ? {
				seq: announced.seq,
				...summary
			} : null;
			const contextPaths = [
				...matched.presented.map((file) => file.path),
				...(changesRaw?.files ?? []).map((file) => file.path)
			];
			const suppressScripts = beamShouldSuppressServiceScripts(sessionTitle, contextPaths);
			const visiblePresented = beamFilterPresentedFiles(matched.presented, suppressScripts);
			const changes = beamFilterChangesSummary(changesRaw, suppressScripts);
			const collapsible = visiblePresented.length > COLLAPSED_PRESENTED_COUNT;
			const presented = collapsible && !expanded ? visiblePresented.slice(0, COLLAPSED_PRESENTED_COUNT) : visiblePresented;
			(0, react.useEffect)(() => {
				if (host === null) reloadPresentedHost();
			}, [host, reloadPresentedHost]);
			if (changes === null && visiblePresented.length === 0) return null;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [changes !== null && (0, react_jsx_runtime.jsx)(ChangedFiles, {
				changes,
				cwd,
				t,
				sessionId,
				useChangesDiff,
				loadChangesDiff,
				openReview: (index) => {
					openChangesReview({
						sessionId,
						seq: changes.seq,
						turn: changes.turn
					}, index);
				}
			}), visiblePresented.length > 0 && (0, react_jsx_runtime.jsxs)("div", {
				className: Deliverables_module_css_default.root,
				"data-after-changes": changes !== null || void 0,
				"data-beam-service-filtered": suppressScripts || void 0,
				children: [
					host === "error" && (0, react_jsx_runtime.jsxs)("div", {
						className: Deliverables_module_css_default.hostStatus,
						children: [(0, react_jsx_runtime.jsx)("span", { children: t("presented.hostError") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							onClick: () => {
								reloadPresentedHost();
							},
							children: t("presented.retry")
						})]
					}),
					host !== null && host !== "error" && !host.available && (0, react_jsx_runtime.jsx)("span", {
						className: Deliverables_module_css_default.hostStatus,
						children: t("presented.unavailable")
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: Deliverables_module_css_default.presented,
						"data-presented-files-row": true,
						"data-single": visiblePresented.length === 1 ? true : void 0,
						children: presented.map((file) => (0, react_jsx_runtime.jsx)(PresentedFileCard, {
							file,
							cwd,
							phase: states[presentedFileUrl(sessionId, file.seq, file.index)],
							host: host === "error" ? null : host,
							t,
							onPreview: () => {
								openFile(file.path);
							},
							actions: renderSlot("deliverables.file.actions", {
								actionUrl: presentedFileUrl(sessionId, file.seq, file.index),
								available: host !== null && host !== "error" && host.available,
								pending: states[presentedFileUrl(sessionId, file.seq, file.index)] === "opening" || states[presentedFileUrl(sessionId, file.seq, file.index)] === "revealing",
								onAction: (action, application) => openPresented(sessionId, file.seq, file.index, action, application)
							})
						}, \`\${file.seq}:\${file.index}\`))
					}),
					collapsible && (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: Deliverables_module_css_default.toggle,
						"aria-expanded": expanded,
						"aria-label": t(expanded ? "presented.collapseAria" : "presented.expandAria", { count: visiblePresented.length }),
						onClick: () => {
							setExpanded((value) => !value);
						},
						children: [(0, react_jsx_runtime.jsx)("span", { children: t(expanded ? "presented.collapse" : "presented.all", { count: visiblePresented.length }) }), expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})]
					})
				]
			})] });
		}`

  return src.slice(0, start) + newFn + src.slice(close)
}

function patchChangedFilesIndices(src) {
  // Preserve Host summary indices when service scripts were filtered out.
  const headerClick = `onClick: () => {
					openReview(0);
				},`
  const headerClickNew = `onClick: () => {
					openReview(beamReviewIndex(singleFile, 0));
				},`
  if (src.includes('openReview(beamReviewIndex(singleFile, 0))') === false) {
    if (!src.includes(headerClick)) throw new Error('ChangedFiles header openReview(0) not found')
    src = src.replace(headerClick, headerClickNew)
  }

  const rowClick = `onClick: () => {
									openReview(index);
								},`
  const rowClickNew = `onClick: () => {
									openReview(beamReviewIndex(file, index));
								},`
  if (src.includes('openReview(beamReviewIndex(file, index))') === false) {
    if (!src.includes(rowClick)) throw new Error('ChangedFiles row openReview(index) not found')
    src = src.replace(rowClick, rowClickNew)
  }

  // Hover preview / diff fetch must use the same Host index.
  const singlePreview = `content: (0, react_jsx_runtime.jsx)(ChangedFilePreview, {
							sessionId,
							seq: changes.seq,
							index: 0,
							display: resolveWorkspacePath(cwd, singleFile.path),`
  const singlePreviewNew = `content: (0, react_jsx_runtime.jsx)(ChangedFilePreview, {
							sessionId,
							seq: changes.seq,
							index: beamReviewIndex(singleFile, 0),
							display: resolveWorkspacePath(cwd, singleFile.path),`
  if (src.includes('index: beamReviewIndex(singleFile, 0),') === false) {
    if (!src.includes(singlePreview)) throw new Error('ChangedFiles single preview index not found')
    src = src.replace(singlePreview, singlePreviewNew)
  }

  const rowPreview = `content: (0, react_jsx_runtime.jsx)(ChangedFilePreview, {
								sessionId,
								seq: changes.seq,
								index,
								display: resolveWorkspacePath(cwd, file.path),`
  const rowPreviewNew = `content: (0, react_jsx_runtime.jsx)(ChangedFilePreview, {
								sessionId,
								seq: changes.seq,
								index: beamReviewIndex(file, index),
								display: resolveWorkspacePath(cwd, file.path),`
  if (src.includes('index: beamReviewIndex(file, index),') === false) {
    if (!src.includes(rowPreview)) throw new Error('ChangedFiles row preview index not found')
    src = src.replace(rowPreview, rowPreviewNew)
  }
  return src
}

function patchFile(file) {
  if (!fs.existsSync(file)) {
    console.warn('skip missing', path.relative(ROOT, file))
    return false
  }
  const raw = fs.readFileSync(file, 'utf8')
  const { text: normalized, crlf } = normalizeEol(raw)
  let src = stripPrevious(normalized)
  src = injectHelper(src)
  src = patchDeliverablesBody(src)
  src = patchChangedFilesIndices(src)
  if (!src.includes(`// #region ${MARK}`)) throw new Error(`marker missing after patch: ${file}`)
  if (!src.includes('beamShouldSuppressServiceScripts')) throw new Error(`filter missing after patch: ${file}`)
  if (!src.includes('visiblePresented')) throw new Error(`visiblePresented missing after patch: ${file}`)
  if (!src.includes('beamReviewIndex(singleFile, 0)')) throw new Error(`review index patch missing: ${file}`)
  fs.writeFileSync(file, restoreEol(src, crlf))
  console.log('patched', path.relative(ROOT, file))
  return true
}

/** Lightweight self-check of the heuristic (no DOM). */
function selfCheck() {
  // Evaluate helper by extracting from HELPER_REGION is awkward; duplicate minimal asserts here.
  const cases = [
    {
      name: 'essay + make_referat.py + docx',
      title: 'Реферат о варёных огурцах',
      paths: ['make_referat.py', 'Почему варёные грурцы это имба.docx'],
      expectSuppress: true,
    },
    {
      name: 'python coding request',
      title: 'Напиши python скрипт для парсинга CSV',
      paths: ['parse_csv.py'],
      expectSuppress: false,
    },
    {
      name: 'only py helper without artifact still shows (coding default)',
      title: 'fix_runner',
      paths: ['make_referat.py'],
      expectSuppress: false,
    },
    {
      name: 'pptx + build script',
      title: 'Presentation for Q3',
      paths: ['build_deck.py', 'Q3.pptx'],
      expectSuppress: true,
    },
  ]

  // Inline copy of decision fn for verify (keeps patch script honest if region drifts)
  const SERVICE = new Set(['.py', '.pyw', '.ps1', '.psm1', '.sh', '.bash', '.zsh', '.cmd', '.bat'])
  const ARTIFACT = new Set(['.docx', '.doc', '.pdf', '.pptx', '.ppt', '.xlsx', '.xls', '.odt', '.odp', '.ods', '.rtf', '.html', '.htm', '.md', '.txt', '.csv', '.epub', '.tex', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])
  const CODE = new Set(['.py', '.pyw', '.ps1', '.sh', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.go', '.rs', '.java', '.kt', '.cs', '.cpp', '.c', '.h', '.rb', '.php', '.swift', '.vue', '.svelte', '.css', '.scss', '.json', '.yml', '.yaml', '.toml'])
  const helperRe = /^(make_|build_|gen_|generate_|render_|create_|export_|compile_|run_|helper_|util_|scaffold_)/i
  const codingRe = /\b(python|\.py\b|typescript|\.tsx?\b|javascript|\.jsx?\b|scripts?|coding|codebase|refactor|pytest|unittest|lint|debug|программ|скрипт|питон|(?:^|\s)код(?:\s|$))/i
  const docRe = /\b(реферат|доклад|эссе|курсов|диплом|презентац|исследован|отч[её]т|essay|report|docx|pptx|pdf|presentation|slides?|thesis|paper|write[- ]?up|research)\b/i
  const ext = (p) => {
    const base = String(p || '').replace(/\\/g, '/').split('/').pop() || ''
    const i = base.lastIndexOf('.')
    return i >= 0 ? base.slice(i).toLowerCase() : ''
  }
  const base = (p) => String(p || '').replace(/\\/g, '/').split('/').pop() || ''
  const isService = (p) => SERVICE.has(ext(p))
  const isArtifact = (p) => ARTIFACT.has(ext(p))
  const isCode = (p) => CODE.has(ext(p))
  const isHelper = (p) => isService(p) && (helperRe.test(base(p)) || /^(make|build|gen|generate|render)-/i.test(base(p)))
  const isCoding = (title, paths) => {
    const text = String(title || '')
    const list = paths.filter(Boolean)
    const hasArtifact = list.some(isArtifact)
    const serviceScripts = list.filter(isService)
    const helpers = list.filter(isHelper)
    const codingHint = codingRe.test(text)
    const docHint = docRe.test(text)
    if (docHint && !codingHint) return false
    if (hasArtifact && (helpers.length > 0 || serviceScripts.length > 0) && !codingHint) return false
    if (codingHint && !docHint) return true
    if (!hasArtifact && list.length > 0 && list.every((p) => isService(p) || isCode(p))) return true
    if (!hasArtifact && serviceScripts.length > 0 && list.every(isService)) return true
    return false
  }

  for (const c of cases) {
    const suppress = !isCoding(c.title, c.paths)
    if (suppress !== c.expectSuppress) {
      throw new Error(`self-check failed: ${c.name} got suppress=${suppress}`)
    }
  }
  console.log('self-check ok', cases.length, 'cases')
}

selfCheck()

let n = 0
for (const file of TARGETS) {
  if (patchFile(file)) n += 1
}
if (n === 0) throw new Error('No deliverables clients patched')
console.log(`done: ${n} files`)
