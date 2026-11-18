/**
 * Restore LibreOffice kit RDB files + harden document preview.
 * Fixes Office body slot registration (conflicting unpreviewable child),
 * RU/EN i18n, open fallbacks, and docx text soft-fail content.
 * Safe to re-run. Does not touch Projects/i18n patch scripts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RDB_REL = [
  "types.rdb",
  path.join("types", "offapi.rdb"),
  path.join("types", "oovbaapi.rdb"),
];

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function findKitProgramDirs() {
  const roots = [
    path.join(ROOT, "dist", "Beam Agent", "resources", "app", "beam", "node_modules"),
    path.join(ROOT, "runtime", "app", "beam", "node_modules"),
    path.join(ROOT, "_tmp_app", "dsh", "node_modules"),
    path.join(ROOT, "_tmp_app", "node_modules"),
  ];
  const scopes = ["@assistix", "@deepseek-ai"];
  const out = [];
  for (const root of roots) {
    for (const scope of scopes) {
      const prog = path.join(root, scope, "libreoffice-kit-win32-x64", "program", "program");
      if (exists(prog)) out.push(prog);
    }
  }
  return out;
}

function findRdbSource() {
  const candidates = [
    path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "libreoffice-kit-win32-x64", "program", "program"),
    path.join(ROOT, "dist", "Beam Agent", "resources", "app.asar.unpacked", "dsh", "node_modules", "@deepseek-ai", "libreoffice-kit-win32-x64", "program", "program"),
    path.join(ROOT, "_tmp_app", "dsh", "node_modules", "@deepseek-ai", "libreoffice-kit-win32-x64", "program", "program"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "DeepSeek Harness", "resources", "app.asar.unpacked", "dsh", "node_modules", "@deepseek-ai", "libreoffice-kit-win32-x64", "program", "program"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Beam Code", "resources", "app.asar.unpacked", "dsh", "node_modules", "@deepseek-ai", "libreoffice-kit-win32-x64", "program", "program"),
  ];
  for (const c of candidates) {
    if (RDB_REL.every((rel) => exists(path.join(c, rel)))) return c;
  }
  return null;
}

function restoreRdbFiles() {
  const src = findRdbSource();
  if (!src) throw new Error("No complete LibreOffice kit RDB source found");
  const targets = findKitProgramDirs();
  let restored = 0;
  for (const dest of targets) {
    fs.mkdirSync(path.join(dest, "types"), { recursive: true });
    for (const rel of RDB_REL) {
      const from = path.join(src, rel);
      const to = path.join(dest, rel);
      const need = !exists(to) || fs.statSync(to).size !== fs.statSync(from).size;
      if (need) {
        fs.copyFileSync(from, to);
        restored++;
        console.log("restored", to);
      }
    }
  }
  console.log(`RDB restore done; wrote ${restored} file(s) into ${targets.length} kit(s); source=${src}`);
}

function documentPreviewClients() {
  return [
    path.join(ROOT, "dist", "Beam Agent", "resources", "app", "beam", "node_modules", "@assistix", "beam-client-ui-sidebar-documentpreview", "lib", "client.js"),
    path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-client-ui-sidebar-documentpreview", "lib", "client.js"),
  ].filter(exists);
}

function officeToPdfLibs() {
  return [
    path.join(ROOT, "dist", "Beam Agent", "resources", "app", "beam", "node_modules", "@assistix", "beam-office-to-pdf", "lib", "index.js"),
    path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-office-to-pdf", "lib", "index.js"),
  ].filter(exists);
}

function patchOnce(file, label, find, replace) {
  if (!exists(file)) {
    console.log("skip missing", file);
    return false;
  }
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(label)) {
    console.log("already patched", path.basename(path.dirname(file)), label);
    return false;
  }
  if (!s.includes(find)) {
    console.warn("pattern not found", file, label);
    return false;
  }
  s = s.replace(find, replace);
  fs.writeFileSync(file, s);
  console.log("patched", file, label);
  return true;
}

function replaceAllInClients(label, transform) {
  for (const file of documentPreviewClients()) {
    let s = fs.readFileSync(file, "utf8");
    const next = transform(s);
    if (next === s) {
      console.log("no-op", path.basename(path.dirname(file)), label);
      continue;
    }
    fs.writeFileSync(file, next);
    console.log("updated", file, label);
  }
}

/** Conflicting child declaration throws at load and leaves Office previewer without a body. */
function stripBrokenUnpreviewableChild() {
  const bad = `, /* beam-lo-unpreviewable-child */ "sidebar.right.tab.document.unpreviewable": {
					kind: "list",
					scope: "session"
				}`;
  replaceAllInClients("strip-unpreviewable-child", (s) => s.split(bad).join(""));
}

function softFailDocumentPreview() {
  const find = `			apply$9(ctx);
			apply$8(ctx);
			apply$6(ctx);
			apply$5(ctx);
			apply$4(ctx);
			apply$2(ctx, config.office);
			apply$1(ctx, config.excel);
			apply$3(ctx);
		}`;
  const replace = `			apply$9(ctx);
			apply$8(ctx);
			apply$6(ctx);
			apply$5(ctx);
			apply$4(ctx);
			/* beam-lo-softfail */ try { apply$2(ctx, config.office); } catch (error) { console.warn("[beam] office preview disabled:", error); }
			try { apply$1(ctx, config.excel); } catch (error) { console.warn("[beam] excel preview disabled:", error); }
			apply$3(ctx);
		}`;
  for (const file of documentPreviewClients()) patchOnce(file, "beam-lo-softfail", find, replace);
}

/**
 * Office failure UI: retry + optional extracted text (docx) + hint to use toolbar Open.
 * Does NOT declare unpreviewable as a child of the office slot (that breaks registration).
 */
function officeFailureContentFallback() {
  // Replace prior open-fallback block if present, or original failure block.
  replaceAllInClients("beam-lo-failure-content", (s) => {
    if (s.includes("beam-lo-failure-content")) return s;

    const variants = [
      // Prior beam-lo-open-fallback version
      `			if (view?.failure !== void 0) {
				const { name } = pathPartsOf(resourceAddress);
				/* beam-lo-open-fallback */
				const absolutePath = typeof props.useResource === "function" ? props.useResource(resourceAddress)?.value?.absolutePath : void 0;
				const fileOwner = absolutePath === void 0 ? void 0 : { absolutePath };
				return (0, react_jsx_runtime.jsxs)("div", {
					className: TextPreview_module_css_default.empty,
					"data-textpreview-failed": view.failure.code,
					children: [
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
							kind: (0, _deepseek_ai_dsh_client_ui_primitives.classifyFileType)(name),
							size: 36
						}),
						(0, react_jsx_runtime.jsx)("p", {
							className: TextPreview_module_css_default.emptyLine,
							children: view.failure.message
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							onClick: request.reload,
							children: t("retry")
						}),
						fileOwner !== void 0 && props.renderSlot("sidebar.right.tab.document.unpreviewable", fileOwner)
					]
				});
			}`,
      // Stock upstream failure UI
      `			if (view?.failure !== void 0) {
				const { name } = pathPartsOf(resourceAddress);
				return (0, react_jsx_runtime.jsxs)("div", {
					className: TextPreview_module_css_default.empty,
					"data-textpreview-failed": view.failure.code,
					children: [
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
							kind: (0, _deepseek_ai_dsh_client_ui_primitives.classifyFileType)(name),
							size: 36
						}),
						(0, react_jsx_runtime.jsx)("p", {
							className: TextPreview_module_css_default.emptyLine,
							children: view.failure.message
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							onClick: request.reload,
							children: t("retry")
						})
					]
				});
			}`,
    ];

    const replacement = `			if (view?.failure !== void 0) {
				const { name } = pathPartsOf(resourceAddress);
				/* beam-lo-failure-content */
				const textFallback = view.textFallback;
				if (typeof textFallback === "string" && textFallback.length > 0) {
					return (0, react_jsx_runtime.jsxs)("div", {
						className: OfficeBody_module_css_default.body,
						"data-textpreview-failed": view.failure.code,
						"data-office-text-fallback": "",
						style: { overflow: "auto", padding: "16px" },
						children: [
							(0, react_jsx_runtime.jsx)("p", {
								className: TextPreview_module_css_default.emptyLine,
								style: { marginBottom: 12 },
								children: view.failure.message
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								onClick: request.reload,
								children: t("retry")
							}),
							(0, react_jsx_runtime.jsx)("pre", {
								style: { whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 16, fontSize: 13, lineHeight: 1.5 },
								children: textFallback
							})
						]
					});
				}
				return (0, react_jsx_runtime.jsxs)("div", {
					className: TextPreview_module_css_default.empty,
					"data-textpreview-failed": view.failure.code,
					children: [
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
							kind: (0, _deepseek_ai_dsh_client_ui_primitives.classifyFileType)(name),
							size: 36
						}),
						(0, react_jsx_runtime.jsx)("p", {
							className: TextPreview_module_css_default.emptyLine,
							children: view.failure.message
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							onClick: request.reload,
							children: t("retry")
						})
					]
				});
			}`;

    for (const find of variants) {
      if (s.includes(find)) return s.replace(find, replacement);
    }
    console.warn("office failure UI pattern not found");
    return s;
  });
}

/** Store action keeps optional extracted text beside conversion failure. */
function officeStoreTextFallback() {
  replaceAllInClients("beam-lo-store-text", (s) => {
    if (s.includes("beam-lo-store-text")) return s;
    const find = `					failed(state, tab, revision, failure) {
						state.byTab[tab] = {
							revision,
							failure
						};
					},`;
    const replace = `					/* beam-lo-store-text */ failed(state, tab, revision, failure, textFallback) {
						state.byTab[tab] = {
							revision,
							failure,
							textFallback
						};
					},`;
    if (!s.includes(find)) {
      console.warn("office store failed() pattern not found");
      return s;
    }
    return s.replace(find, replace);
  });
}

/** On conversion failure for docx/doc, extract ZIP text and surface it in the body. */
function officeFaceDocxFallback() {
  replaceAllInClients("beam-lo-face-docx", (s) => {
    if (s.includes("beam-lo-face-docx")) return s;

    const helper = `
		/* beam-lo-face-docx */
		async function beamInflateRaw(data) {
			if (typeof DecompressionStream === "undefined") return null;
			const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
			return new Uint8Array(await new Response(stream).arrayBuffer());
		}
		async function beamExtractDocxText(buf) {
			try {
				const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
				const entries = [];
				let i = 0;
				while (i + 30 < u8.length) {
					if (u8[i] !== 0x50 || u8[i + 1] !== 0x4b || u8[i + 2] !== 0x03 || u8[i + 3] !== 0x04) break;
					const method = u8[i + 8] | (u8[i + 9] << 8);
					const compSize = (u8[i + 18] | (u8[i + 19] << 8) | (u8[i + 20] << 16) | (u8[i + 21] << 24)) >>> 0;
					const nameLen = u8[i + 26] | (u8[i + 27] << 8);
					const extraLen = u8[i + 28] | (u8[i + 29] << 8);
					const name = new TextDecoder().decode(u8.subarray(i + 30, i + 30 + nameLen));
					const dataStart = i + 30 + nameLen + extraLen;
					const data = u8.subarray(dataStart, dataStart + compSize);
					entries.push({ name, method, data });
					i = dataStart + compSize;
				}
				const doc = entries.find((e) => e.name === "word/document.xml");
				if (!doc) return "";
				let xmlBytes;
				if (doc.method === 0) xmlBytes = doc.data;
				else if (doc.method === 8) xmlBytes = await beamInflateRaw(doc.data);
				else return "";
				if (!xmlBytes) return "";
				const xml = new TextDecoder("utf-8").decode(xmlBytes);
				return xml.replace(/<w:tab[^/]*\\/>/g, "\\t").replace(/<\\/w:p>/g, "\\n").replace(/<w:t[^>]*>/g, "").replace(/<\\/w:t>/g, "").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\\n{3,}/g, "\\n\\n").trim();
			} catch {
				return "";
			}
		}
`;

    // Insert helper before officeFace
    const faceMarker = `		function officeFace(read, describeFailure) {`;
    if (!s.includes(faceMarker)) {
      console.warn("officeFace marker missing");
      return s;
    }
    s = s.replace(faceMarker, helper + faceMarker);

    const find = `		function officeFace(read, describeFailure) {
			return (_sessionId, actions) => ({ load: (tabId, revision, file, signal, loaded, failed) => {
				if (signal.aborted) return;
				actions.loading(tabId, revision);
				read(file, signal).then((result) => {
					if (signal.aborted) return;
					if (result.ok) {
						actions.complete(tabId, revision, result.value);
						loaded(result.value.version);
					} else {
						actions.failed(tabId, revision, {
							code: result.error.code,
							message: describeFailure(result.error)
						});
						failed();
					}
				}, (error) => {
					if (!signal.aborted) {
						actions.failed(tabId, revision, {
							code: "gateway/internal",
							message: describeFailure({ message: error instanceof Error ? error.message : String(error) })
						});
						failed();
					}
				});
			} });
		}`;

    const replace = `		function officeFace(read, describeFailure, readSourceBytes) {
			return (_sessionId, actions) => ({ load: (tabId, revision, file, signal, loaded, failed) => {
				if (signal.aborted) return;
				actions.loading(tabId, revision);
				const settleFail = async (failure) => {
					let textFallback;
					const lower = String(file.path || "").toLowerCase();
					if (typeof readSourceBytes === "function" && lower.endsWith(".docx")) {
						try {
							const bytes = await readSourceBytes(file, signal);
							if (bytes) textFallback = (await beamExtractDocxText(bytes)) || void 0;
						} catch {}
					}
					if (signal.aborted) return;
					actions.failed(tabId, revision, failure, textFallback);
					failed();
				};
				read(file, signal).then((result) => {
					if (signal.aborted) return;
					if (result.ok) {
						actions.complete(tabId, revision, result.value);
						loaded(result.value.version);
					} else {
						settleFail({
							code: result.error.code,
							message: describeFailure(result.error)
						});
					}
				}, (error) => {
					if (!signal.aborted) {
						settleFail({
							code: "gateway/internal",
							message: describeFailure({ message: error instanceof Error ? error.message : String(error) })
						});
					}
				});
			} });
		}`;

    if (!s.includes(find)) {
      console.warn("officeFace body pattern not found");
      return s;
    }
    s = s.replace(find, replace);

    // Wire readSourceBytes from remote inject where face is created
    const faceCall = `			const face = officeFace((file, signal) => read(file, signal), (failure) => "code" in failure ? failureLine(documentT, failure) : documentT("error.unavailable", { message: failure.message }));`;
    const faceCallNew = `			const face = officeFace((file, signal) => read(file, signal), (failure) => "code" in failure ? failureLine(documentT, failure) : documentT("error.unavailable", { message: failure.message }), async (file, signal) => {
				/* beam-lo-face-docx-bytes */ try {
					const remote = ctx.remote?.workspaceFiles;
					if (!remote?.readBytes) return void 0;
					const result = await remote.readBytes(file.sessionId, file.path, {}, signal);
					if (!result?.ok) return void 0;
					return result.value?.data ?? result.value?.bytes ?? result.value;
				} catch { return void 0; }
			});`;
    if (s.includes(faceCall)) s = s.replace(faceCall, faceCallNew);
    else console.warn("officeFace call site not found for bytes wiring");

    return s;
  });
}

function officeRuFallbackCopy() {
  replaceAllInClients("beam-lo-ru-office", (s) => {
    // Upgrade existing ru office block title / messages if already patched
    if (s.includes("beam-lo-ru-office")) {
      s = s.replace(
        /title: "Документ Office"/,
        'title: "Office"',
      );
      return s;
    }
    const find = `			ctx.effect(() => ctx.locale.register("sidebarOffice", {
				zh: zh$1,
				en: en$1
			}));`;
    const replace = `			/* beam-lo-ru-office */ const ruOffice = {
				...en$1,
				title: "Office",
				loading: "Рендеринг документа...",
				retry: "Повторить",
				unavailable: "Предпросмотр Office недоступен. Можно открыть файл кнопкой «Открыть» выше.",
				invalid: "Этот файл Office нельзя показать. Возможно, он повреждён, защищён паролем или имеет неверное расширение.",
				tooLarge: "Файл Office или PDF после конвертации превышает лимит предпросмотра.",
				failed: "Конвертация Office не создала пригодный PDF. Ниже может быть текстовый фрагмент; или откройте файл кнопкой «Открыть».",
				timeout: "Конвертация Office превысила время ожидания. Повторите попытку или откройте файл снаружи.",
				busy: "Предпросмотр Office занят. Повторите чуть позже.",
				changed: "Файл изменился во время чтения. Откройте предпросмотр снова."
			};
			ctx.effect(() => ctx.locale.register("sidebarOffice", {
				zh: zh$1,
				en: en$1,
				ru: ruOffice
			}));`;
    if (!s.includes(find)) {
      console.warn("sidebarOffice register pattern not found");
      return s;
    }
    return s.replace(find, replace);
  });
}

/** Russian copy for shared document preview chrome (fixes mixed The {Документ} preview…). */
function documentPreviewRuLocale() {
  replaceAllInClients("beam-lo-ru-docpreview", (s) => {
    if (s.includes("beam-lo-ru-docpreview")) return s;
    const find = `		const en$7 = {
			loading: "Rendering document...",
			loadMore: "Load more",
			changed: "The file has changed, showing the previous content.",
			reloadNow: "Reload",
			reload: "Read the file again",
			autoRefresh: "Auto refresh",
			"autoRefresh.enable": "Enable auto refresh",
			"autoRefresh.disable": "Disable auto refresh",
			"wrap.enable": "Turn on line wrap",
			"wrap.disable": "Turn off line wrap",
			"wrap.aria": "Line wrap",
			openWith: "Open with",
			"viewer.text": "Plain text",
			resourceUnavailable: "The file resource service is unavailable.",
			rendererUnavailable: "The {name} preview is unavailable.",
			unsupportedFile: "Preview is not available for this file type yet.",
			"error.notFound": "File not found. It may have been moved or deleted.",
			"error.tooLarge": "This page exceeds the {limit} limit and cannot be read.",
			"error.notText": "Preview is not available for this file type yet.",
			"error.notRegularFile": "Not a regular file, nothing to display.",
			"error.unavailable": "Read failed: {message}",
			retry: "Retry"
		};`;
    const replace = `		const en$7 = {
			loading: "Rendering document...",
			loadMore: "Load more",
			changed: "The file has changed, showing the previous content.",
			reloadNow: "Reload",
			reload: "Read the file again",
			autoRefresh: "Auto refresh",
			"autoRefresh.enable": "Enable auto refresh",
			"autoRefresh.disable": "Disable auto refresh",
			"wrap.enable": "Turn on line wrap",
			"wrap.disable": "Turn off line wrap",
			"wrap.aria": "Line wrap",
			openWith: "Open with",
			"viewer.text": "Plain text",
			resourceUnavailable: "The file resource service is unavailable.",
			rendererUnavailable: "The {name} preview is unavailable.",
			unsupportedFile: "Preview is not available for this file type yet.",
			"error.notFound": "File not found. It may have been moved or deleted.",
			"error.tooLarge": "This page exceeds the {limit} limit and cannot be read.",
			"error.notText": "Preview is not available for this file type yet.",
			"error.notRegularFile": "Not a regular file, nothing to display.",
			"error.unavailable": "Read failed: {message}",
			retry: "Retry"
		};
		/* beam-lo-ru-docpreview */ const ru$7 = {
			...en$7,
			loading: "Рендеринг документа...",
			loadMore: "Загрузить ещё",
			changed: "Файл изменился, показана предыдущая версия.",
			reloadNow: "Перезагрузить",
			reload: "Прочитать файл снова",
			autoRefresh: "Автообновление",
			"autoRefresh.enable": "Включить автообновление",
			"autoRefresh.disable": "Выключить автообновление",
			"wrap.enable": "Включить перенос строк",
			"wrap.disable": "Выключить перенос строк",
			"wrap.aria": "Перенос строк",
			openWith: "Открыть с помощью",
			"viewer.text": "Текст",
			resourceUnavailable: "Служба файловых ресурсов недоступна.",
			rendererUnavailable: "Предпросмотр «{name}» недоступен. Используйте кнопку «Открыть» выше.",
			unsupportedFile: "Предпросмотр для этого типа файла пока недоступен.",
			"error.notFound": "Файл не найден. Возможно, он перемещён или удалён.",
			"error.tooLarge": "Страница превышает лимит {limit} и не может быть прочитана.",
			"error.notText": "Предпросмотр для этого типа файла пока недоступен.",
			"error.notRegularFile": "Путь не является обычным файлом — нечего показать.",
			"error.unavailable": "Ошибка чтения: {message}",
			retry: "Повторить"
		};`;
    if (!s.includes(find)) {
      console.warn("en$7 document preview locale not found");
      return s;
    }
    s = s.replace(find, replace);

    // Register ru on sidebarDocumentPreview (label arg may be present)
    const regFind = `			ctx.effect(() => ctx.locale.register(NS, {
				zh: zh$7,
				en: en$7
			}), "ui-sidebar-documentpreview: dictionaries");`;
    const regReplace = `			ctx.effect(() => ctx.locale.register(NS, {
				zh: zh$7,
				en: en$7,
				ru: ru$7
			}), "ui-sidebar-documentpreview: dictionaries");`;
    if (s.includes(regFind)) s = s.replace(regFind, regReplace);
    else if (s.includes(`en: en$7\n			}), "ui-sidebar-documentpreview: dictionaries")`) && !s.includes("ru: ru$7")) {
      s = s.replace(
        `en: en$7\n			}), "ui-sidebar-documentpreview: dictionaries")`,
        `en: en$7,\n				ru: ru$7\n			}), "ui-sidebar-documentpreview: dictionaries")`,
      );
    } else if (!s.includes("ru: ru$7")) {
      console.warn("sidebarDocumentPreview locale.register pattern not found");
    }
    return s;
  });
}

/** When the keyed body slot is missing, still offer Open via the parent unpreviewable slot. */
function enhanceRendererUnavailableFallback() {
  replaceAllInClients("beam-lo-unavailable-open", (s) => {
    if (s.includes("beam-lo-unavailable-open")) return s;
    const find = `							content !== void 0 && renderSlot("sidebar.right.tab.document", {
								resourceAddress: tab.contentId,
								content,
								wrap: state.wrap,
								scrollportRef: bindScrollport,
								addResource: add,
								setResources: set
							}, {
								entryKey: selected.id,
								hookContext: useTabInfo,
								fallback: (0, react_jsx_runtime.jsx)("p", {
									className: TextPreview_module_css_default.statusLine,
									children: t("rendererUnavailable", { name: selected.title() })
								})
							}),`;
    const replace = `							content !== void 0 && renderSlot("sidebar.right.tab.document", {
								resourceAddress: tab.contentId,
								content,
								wrap: state.wrap,
								scrollportRef: bindScrollport,
								addResource: add,
								setResources: set
							}, {
								entryKey: selected.id,
								hookContext: useTabInfo,
								/* beam-lo-unavailable-open */
								fallback: (0, react_jsx_runtime.jsxs)("div", {
									className: TextPreview_module_css_default.empty,
									children: [
										(0, react_jsx_runtime.jsx)("p", {
											className: TextPreview_module_css_default.emptyLine,
											children: t("rendererUnavailable", { name: selected.title() })
										}),
										fileOwner !== void 0 && renderSlot("sidebar.right.tab.document.unpreviewable", fileOwner)
									]
								})
							}),`;
    if (!s.includes(find)) {
      console.warn("rendererUnavailable fallback pattern not found");
      return s;
    }
    return s.replace(find, replace);
  });
}

function softFailOfficeToPdfConverter() {
  const find = `				if (slot.converter === void 0) slot.converter = createConverter(this.options).catch((error) => {
					delete slot.converter;
					throw error;
				});`;
  const replace = `				/* beam-lo-converter-softfail */ if (slot.converter === void 0) slot.converter = createConverter(this.options).catch((error) => {
					delete slot.converter;
					const message = error instanceof Error ? error.message : String(error);
					throw new OfficeToPdfError("unavailable", message.includes("types.rdb") || /LibreOffice|sidecar|rdb/i.test(message) ? "LibreOffice kit is unavailable on this host." : "LibreOffice converter failed to start.", { cause: error });
				});`;
  for (const file of officeToPdfLibs()) patchOnce(file, "beam-lo-converter-softfail", find, replace);
}

function ensureBuildHook() {
  const build = path.join(ROOT, "desktop", "build-beam.mjs");
  if (!exists(build)) return;
  let s = fs.readFileSync(build, "utf8");
  if (s.includes("fix-libreoffice-preview.mjs")) {
    console.log("build-beam already hooks LO restore");
    return;
  }
  const after = "copyRecursive(APP, path.join(resourcesDest, 'app'))";
  if (!s.includes(after)) {
    console.warn("build-beam app copy marker missing");
    return;
  }
  const hook = `
// Ensure LibreOffice kit RDB files survive packaging (preview otherwise hard-fails).
try {
  const { spawnSync } = await import('node:child_process')
  const fix = path.join(ROOT, 'desktop', 'fix-libreoffice-preview.mjs')
  if (fs.existsSync(fix)) {
    const r = spawnSync(process.execPath, [fix], { stdio: 'inherit' })
    if (r.status) console.warn('→ libreoffice preview fix exited', r.status)
  }
} catch (err) {
  console.warn('→ libreoffice preview fix skipped:', err?.message || err)
}
`;
  s = s.replace(after, `${after}\n${hook}`);
  fs.writeFileSync(build, s);
  console.log("hooked build-beam.mjs to run fix-libreoffice-preview.mjs");
}

restoreRdbFiles();
stripBrokenUnpreviewableChild();
softFailDocumentPreview();
officeStoreTextFallback();
officeFaceDocxFallback();
officeFailureContentFallback();
officeRuFallbackCopy();
documentPreviewRuLocale();
enhanceRendererUnavailableFallback();
softFailOfficeToPdfConverter();
ensureBuildHook();

// Sanity: ensure no conflicting child remains
for (const file of documentPreviewClients()) {
  const s = fs.readFileSync(file, "utf8");
  if (s.includes("beam-lo-unpreviewable-child")) {
    throw new Error(`unpreviewable child still present in ${file}`);
  }
  if (!s.includes("beam-lo-softfail")) console.warn("missing softfail", file);
  console.log("ok", file.includes("dist") ? "dist" : "runtime", {
    softfail: s.includes("beam-lo-softfail"),
    ruOffice: s.includes("beam-lo-ru-office"),
    ruDoc: s.includes("beam-lo-ru-docpreview"),
    failureContent: s.includes("beam-lo-failure-content"),
    faceDocx: s.includes("beam-lo-face-docx"),
    unavailableOpen: s.includes("beam-lo-unavailable-open"),
    officeTitle: (s.match(/title: "Office"/g) || []).length,
  });
}

console.log("fix-libreoffice-preview complete");
