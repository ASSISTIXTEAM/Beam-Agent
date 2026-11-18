/**
 * Point DesktopUpdateCoordinator at the Assistix public feed and make
 * quitAndInstall launch the Inno Setup package (not NSIS /S flags).
 * Also fills RU update copy with Beam branding.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const TARGETS = [
  path.join(ROOT, 'runtime', 'app', 'lib', 'main.js'),
  path.join(ROOT, 'dist', 'Beam Agent', 'resources', 'app', 'lib', 'main.js'),
]

const INNO_HOOK = `
		this.updater.autoDownload = false;
		this.updater.autoInstallOnAppQuit = false;
		this.updater.channel = channel;
		this.updater.allowPrerelease = channel === "nightly" || String(channel).includes("alpha") || String(channel).includes("early");
		this.updater.allowDowngrade = false;
		try {
			this.updater.disableDifferentialDownload = true;
			this.updater.disableWebInstaller = true;
		} catch {
			/* older electron-updater */
		}
		if (updater === autoUpdater && process.platform === "win32") {
			const owner = this.updater;
			owner.doInstall = (options) => {
				const installerPath = owner.installerPath;
				if (installerPath == null) {
					owner.dispatchError?.(new Error("No update filepath provided, can't quit and install"));
					return false;
				}
				const args = [
					"/VERYSILENT",
					"/NORESTART",
					"/CLOSEAPPLICATIONS",
					"/FORCECLOSEAPPLICATIONS",
					"/SUPPRESSMSGBOXES"
				];
				const run = owner.spawnLog?.(installerPath, args);
				if (run && typeof run.catch === "function") run.catch((error) => owner.dispatchError?.(error));
				return true;
			};
		}
		this.updater.on("download-progress", this.onProgress);
		this.updater.on("update-downloaded", this.onDownloaded);
		this.updater.on("error", this.onError);
`

const RU_UPDATE_PATCH = {
  checkUpdatesMenu: 'Проверить обновления…',
  updateCheckFailedTitle: 'Не удалось проверить обновления',
  updateCheckFailed: 'Не удалось проверить обновления. Попробуйте позже.',
  updateDownloadFailed: 'Не удалось скачать обновление. Попробуйте ещё раз.',
  updateInstallFailed: 'Не удалось установить обновление. Попробуйте позже.',
  updateCheckNetworkFailed: 'Не удалось проверить обновления. Проверьте соединение и попробуйте снова.',
  updateDownloadNetworkFailed: 'Не удалось скачать обновление. Проверьте соединение и попробуйте снова.',
  updateInstallNetworkFailed: 'Не удалось установить обновление. Проверьте соединение и попробуйте снова.',
  unknownError: 'Неизвестная ошибка',
  updateCheckTitle: 'Проверка обновлений',
  updateCurrentDetail: 'Текущая версия: {version}',
  updateCurrent: 'У вас актуальная версия Beam Agent',
  updateChecking: 'Проверяем обновления…',
  updateDownload: 'Скачать обновление',
  updateDownloadedTitle: 'Версия {version} готова к установке',
  updateDownloadedDetail: 'Приложение закроется на время обновления и откроется снова после установки.',
  updateDownloadedDetailWindows:
    'Приложение временно закроется на время обновления и откроется снова после установки.\n\nУстановка может занять несколько минут. Не запускайте Beam Agent повторно, пока она не завершится.',
  updateClose: 'Закрыть',
  updateAcknowledge: 'OK',
  updateLater: 'Обновить позже',
  updateDownloading: 'Скачивание {percent}%…',
  updateVerifying: 'Проверка файлов обновления…',
  updateInstalling: 'Подготовка к перезапуску…',
  updateRetry: 'Повторить обновление',
  updateActiveTasks: 'Есть незавершённые задачи',
  updateActiveTasksDetail: 'Обновление остановит текущие задачи и перезапустит приложение. Продолжить?',
  updateStopTasks: 'Остановить задачи и обновить',
  updateTasksChanged: 'Появились новые задачи. Подтвердите ещё раз, чтобы остановить их и обновить.',
  updateTasksUnavailable: 'Статус задач недоступен. Попробуйте обновить, когда рабочая область будет готова.',
  updateStopFailed: 'Не удалось безопасно остановить задачи. Обновление не установлено. Попробуйте позже.',
  updateTechnicalDetails: 'Технические детали',
  updateTitle: 'Обновление Beam Agent',
  updateAvailable: 'Доступна новая версия: {version}',
  updateDetail: 'После скачивания можно установить обновление и перезапустить приложение.',
  installAndRestart: 'Установить и перезапустить',
  later: 'Позже',
  updateFailedTitle: 'Ошибка обновления',
  mandatoryTitle: 'Нужно обновление',
  mandatoryDetail:
    'Эта версия больше не поддерживается. Обновите Beam Agent, чтобы продолжить. Текущие задачи будут работать до подтверждения установки.',
  mandatoryUnavailable: 'Не удалось проверить требования к обновлению. Попробуйте позже.',
  policyLoginTitle: 'Вход в тестовую среду',
  policyLoginRequired:
    'Войдите через ASSISTIX ID, чтобы проверить требования к обновлению для этой тестовой сборки. Вход сам по себе не скачивает и не устанавливает обновление.',
  policyLogin: 'Войти через ASSISTIX ID',
  policyLoginFailed: 'Вход через ASSISTIX ID не завершён. Попробуйте ещё раз.',
  policyLoginLoading: 'Открываем страницу входа…',
  mandatoryNoRelease: 'Подходящее обновление не найдено. Проверьте снова или обратитесь в поддержку.',
  mandatoryRefresh: 'Проверить снова',
  mandatoryPage: 'Скачать с официального сайта',
  mandatoryCopy: 'Скопировать ссылку',
  mandatoryPageFailed: 'Не удалось открыть страницу скачивания. Скопируйте ссылку и откройте её в браузере.',
  mandatoryActionFailed: 'Действие не выполнено. Попробуйте ещё раз. После обновления приложение снова будет доступно.',
  mandatoryReady: 'Обновление готово',
  mandatoryVersion: 'Новая версия: {version}',
  mandatoryReadyDetail: 'Приложение закроется на время обновления и откроется снова после установки.',
  mandatoryDeferred: 'Текущие задачи продолжат работу. Завершите обновление, прежде чем снова пользоваться приложением.',
  mandatoryContinue: 'Продолжить обновление',
  mandatoryInspecting: 'Проверяем задачи…',
  mandatoryStopping: 'Останавливаем задачи…',
  mandatoryRestarting: 'Приложение скоро перезапустится. Подождите.',
  mandatoryDownloadFailed: 'Не удалось скачать или подготовить файлы обновления. Попробуйте ещё раз.',
  mandatoryInstallFailed: 'Обновление не установлено. Проверьте задачи и повторите попытку.',
  mandatoryOpenHelp: 'Страница не открылась?',
  mandatoryReopen: 'Открыть страницу скачивания снова',
  mandatoryCopied: 'Ссылка скопирована',
  mandatoryCopyFailed: 'Не удалось скопировать ссылку. Выделите и скопируйте её ниже.',
  mandatoryAddress: 'Ссылка на скачивание',
  mandatoryNotification: 'Вернитесь в приложение, чтобы подтвердить установку и перезапуск.',
}

function patchInnoHook(src) {
  const start = src.indexOf('this.updater.autoDownload = false;')
  if (start < 0) return { src, changed: false, reason: 'autoDownload block missing' }
  const end = src.indexOf('this.updater.on("error", this.onError);', start)
  if (end < 0) return { src, changed: false, reason: 'onError marker missing' }
  const endLine = end + 'this.updater.on("error", this.onError);'.length
  const next = src.slice(0, start) + INNO_HOOK.trimStart() + src.slice(endLine)
  if (next.includes('disableDifferentialDownload') && next.includes('/VERYSILENT')) {
    return { src: next, changed: next !== src, reason: 'inno hook' }
  }
  return { src: next, changed: next !== src, reason: 'inno hook applied' }
}

function patchRuUpdates(src) {
  const marker = 'const ru = {'
  const start = src.indexOf(marker)
  if (start < 0) return { src, changed: false }
  // Find the closing `};` of the ru object — next top-level comment/function after it.
  const after = src.indexOf('};\n/** Resolve Electron', start)
  const end = after >= 0 ? after + 2 : -1
  if (end < 0) return { src, changed: false }
  let block = src.slice(start, end)
  let changed = false
  for (const [key, value] of Object.entries(RU_UPDATE_PATCH)) {
    const re = new RegExp(`("${key}"\\s*:\\s*)([\`"])([\\s\\S]*?)\\2`)
    const lit = JSON.stringify(value)
    if (re.test(block)) {
      const next = block.replace(re, `$1${lit}`)
      if (next !== block) {
        block = next
        changed = true
      }
    }
  }
  // Ensure enabled stays on packaged app-update.yml (undo kill-switch if present)
  return { src: src.slice(0, start) + block + src.slice(end), changed }
}

function ensureEnabled(src) {
  const killed = 'enabled = () => false'
  const good =
    'enabled = () => app.isPackaged && existsSync(join(process.resourcesPath, "app-update.yml"))'
  if (src.includes(killed) && !src.includes(good)) {
    return { src: src.replaceAll(killed, good), changed: true }
  }
  // Also fix constructor default if somehow still false-only in signature
  if (src.includes('enabled = () => false,')) {
    return {
      src: src.replace(
        'enabled = () => false,',
        'enabled = () => app.isPackaged && existsSync(join(process.resourcesPath, "app-update.yml")),',
      ),
      changed: true,
    }
  }
  return { src, changed: false }
}

function patchFile(file) {
  if (!fs.existsSync(file)) {
    console.warn('skip missing', file)
    return false
  }
  let src = fs.readFileSync(file, 'utf8')
  let changed = false
  {
    const r = ensureEnabled(src)
    src = r.src
    changed ||= r.changed
  }
  {
    const r = patchInnoHook(src)
    src = r.src
    changed ||= r.changed
    if (!r.changed) console.warn(' ', path.relative(ROOT, file), r.reason || 'inno unchanged')
  }
  {
    const r = patchRuUpdates(src)
    src = r.src
    changed ||= r.changed
  }
  // EN title already Beam; ensure product strings not DSH
  if (src.includes('updateTitle: "Update Available"')) {
    src = src.replace('updateTitle: "Update Available"', 'updateTitle: "Beam Agent Update"')
    changed = true
  }
  if (changed) {
    fs.writeFileSync(file, src)
    console.log('✓ patched', path.relative(ROOT, file))
  } else {
    console.log('· ok', path.relative(ROOT, file))
  }
  return changed
}

console.log('=== enable Beam auto-update ===')
for (const file of TARGETS) patchFile(file)

const ymlSrc = path.join(ROOT, 'desktop', 'installer', 'app-update.yml')
const ymlDests = [
  path.join(ROOT, 'dist', 'Beam Agent', 'resources', 'app-update.yml'),
]
for (const dest of ymlDests) {
  if (!fs.existsSync(path.dirname(dest))) continue
  fs.copyFileSync(ymlSrc, dest)
  const disabled = dest + '.disabled'
  if (fs.existsSync(disabled)) fs.unlinkSync(disabled)
  console.log('✓ app-update.yml →', path.relative(ROOT, dest))
}
console.log('done')
