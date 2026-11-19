#!/usr/bin/env python3
"""Repair half-translated ru dictionary values by restoring from en keys."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOTS = [
    Path(r"C:\Beam-Agent\dist\Beam-Agent\resources\app\beam\node_modules\@assistix"),
    Path(r"C:\Beam-Agent\runtime\app\beam\node_modules\@assistix"),
]

KEEP = re.compile(
    r"ASSISTIX|Beam Agent|Tide|Flare|Pine|\bAPI\b|\bURL\b|\bID\b|\bHTTP\b|\bJSON\b|\bOK\b|Email|macOS|Windows|Linux|GitHub|Ctrl|Cmd|Shift|Alt|PNG|JPG|GIF|WebP"
)

# Full phrase EN→RU for common chrome (extend as needed)
PHRASES = {
    "Searching code": "Поиск по коду",
    "Editing files": "Изменение файлов",
    "Searching the web": "Поиск в интернете",
    "Searched code": "Поиск по коду выполнен",
    "Edited files": "Файлы изменены",
    "Searched the web": "Поиск в интернете выполнен",
    "Updated the plan": "План обновлён",
    "Background task updated": "Фоновая задача обновлена",
    "Close image preview": "Закрыть просмотр изображения",
    "Failed to load history: {message} ({code})": "Не удалось загрузить историю: {message} ({code})",
    "Back to bottom": "Вниз",
    "Default Browser": "Браузер по умолчанию",
    "When to Collapse Work Details": "Когда сворачивать детали работы",
    "On completion": "По завершении",
    "On next message": "При следующем сообщении",
    "System prompt": "Системный промпт",
    "System prompt update": "Обновление системного промпта",
    "Unknown surface event: {type}": "Неизвестное событие интерфейса: {type}",
    "Unknown content block": "Неизвестный блок содержимого",
    "Stopped": "Остановлено",
    "Retrying model request": "Повтор запроса к модели",
    "Retry delay: ": "Задержка повтора: ",
    "Provider / model": "Провайдер / модель",
    "Applying…": "Применение…",
    "Applying...": "Применение…",
    "No options": "Нет вариантов",
    "Files and images cannot be added right now": "Сейчас нельзя добавить файлы и изображения",
    "Image failed to load; click to retry": "Не удалось загрузить изображение; нажмите, чтобы повторить",
    "Only PNG, JPG, WebP, and GIF images are supported": "Поддерживаются только PNG, JPG, WebP и GIF",
    "Images exceed {size} in total; remove some and try again": "Суммарный размер изображений больше {size}; удалите часть и попробуйте снова",
    "Image resolution is too high; compress it and try again": "Слишком высокое разрешение; сожмите изображение и попробуйте снова",
    "Image sides must be at most {size}px; downscale it and try again": "Стороны изображения не больше {size}px; уменьшите и попробуйте снова",
    "Sending images failed ({reason}); re-add them and try again": "Не удалось отправить изображения ({reason}); добавьте снова",
    "Uploading…": "Загрузка…",
    "Uploading...": "Загрузка…",
    "Upload failed; click to retry": "Ошибка загрузки; нажмите, чтобы повторить",
    "Retry uploading {name}": "Повторить загрузку {name}",
    "Files are still uploading; send after they finish": "Файлы ещё загружаются; отправьте после завершения",
    "No models available.": "Нет доступных моделей.",
    "No matching models.": "Нет подходящих моделей.",
    "Search models…": "Поиск моделей…",
    "Clear search": "Очистить поиск",
    "Loading models…": "Загрузка моделей…",
    "Select model": "Выбрать модель",
    "Reload": "Обновить",
    "Language": "Язык",
    "Settings": "Настройки",
    "General": "Общие",
    "Plugins": "Плагины",
    "More": "Ещё",
    "Workspace": "Рабочая область",
    "Chat": "Чат",
    "Trajectory": "Траектория",
    "New session": "Новая сессия",
    "Thinking": "Думаю",
}

# Reverse broken stems accidentally applied on English words
STEM_REVERSE = [
    (r"Поискing\b", "Searching"),
    (r"Поискed\b", "Searched"),
    (r"Изменитьing\b", "Editing"),
    (r"Изменитьed\b", "Edited"),
    (r"Обновлениеd\b", "Updated"),
    (r"Назадground\b", "Background"),
    (r"Назад to\b", "Back to"),
    (r"Закрыть image\b", "Close image"),
    (r"не удалось загрузить history", "Failed to load history"),
    (r"Default Браузер", "Default Browser"),
    (r"Свернуть Work Details", "Collapse Work Details"),
    (r"Вкл completion", "On completion"),
    (r"Вкл next message", "On next message"),
    (r"Системная prompt", "System prompt"),
    (r"Неизвестно surface", "Unknown surface"),
    (r"Неизвестно content", "Unknown content"),
    (r"Стопped\b", "Stopped"),
    (r"Повторитьing\b", "Retrying"),
    (r"Повторить delay", "Retry delay"),
    (r"Провайдер / model", "Provider / model"),
    (r"Применитьing", "Applying"),
    (r"Нет options", "No options"),
    (r"Файлы and images", "Files and images"),
    (r"Изображение failed", "Image failed"),
    (r"Вклly\b", "Only"),
    (r"Изображениеs\b", "Images"),
    (r"Изображение resolution", "Image resolution"),
    (r"Изображение sides", "Image sides"),
    (r"Отправитьing\b", "Sending"),
    (r"Загрузитьing\b", "Uploading"),
    (r"Загрузить failed", "Upload failed"),
    (r"Повторить uploading", "Retry uploading"),
    (r"Файлы are still", "Files are still"),
    (r"Нет models available\.", "No models available."),
    (r"Нет matching models\.", "No matching models."),
    (r"Поиск models", "Search models"),
    (r"Очистить search", "Clear search"),
]


def is_mixed(s: str) -> bool:
    if not isinstance(s, str):
        return False
    if not re.search(r"[А-Яа-яЁё]", s):
        return False
    if not re.search(r"[A-Za-z]{3,}", s):
        return False
    if KEEP.search(s) and not re.search(
        r"(ing|ed|failed|history|options|images|prompt|model|search|Browser|Work|completion|delay|uploading|surface|content)\b",
        s,
        re.I,
    ):
        # brand-only mix ok-ish
        return False
    return True


def unbreak(s: str) -> str:
    out = s
    for pat, repl in STEM_REVERSE:
        out = re.sub(pat, repl, out)
    return out


def to_ru(en: str) -> str:
    if en in PHRASES:
        return PHRASES[en]
    # keep placeholders
    return PHRASES.get(en.strip(), en)


def parse_object_after(src: str, marker: str) -> tuple[dict[str, str], int, int] | None:
    idx = src.find(marker)
    if idx < 0:
        return None
    start = src.find("{", idx)
    if start < 0:
        return None
    depth = 0
    i = start
    while i < len(src):
        ch = src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                i += 1
                break
        i += 1
    block = src[start:i]
    # Extract "key": "value" pairs only (flat string dicts)
    d: dict[str, str] = {}
    for m in re.finditer(
        r'"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"',
        block,
    ):
        k = json.loads(f'"{m.group(1)}"')
        v = json.loads(f'"{m.group(2)}"')
        d[k] = v
    return d, start, i


def rebuild_object(d: dict[str, str], indent: str = "\t\t\t") -> str:
    lines = ["{"]
    items = list(d.items())
    for n, (k, v) in enumerate(items):
        comma = "," if n < len(items) - 1 else ""
        lines.append(f'{indent}{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}{comma}')
    # closing brace indent guess
    close = indent[:-1] if indent.endswith("\t") else indent
    lines.append(close + "}")
    return "\n".join(lines)


def repair_file(path: Path) -> int:
    src = path.read_text(encoding="utf-8")
    en = parse_object_after(src, "const en = {")
    ru = parse_object_after(src, "const ru = {")
    if not en or not ru:
        # also try ruDict
        if not ru:
            ru = parse_object_after(src, "const ruDict = {")
        if not en or not ru:
            return 0
    en_d, _, _ = en
    ru_d, ru_start, ru_end = ru
    changed = 0
    for k, v in list(ru_d.items()):
        if not is_mixed(v) and not re.search(
            r"Поискing|Изменитьing|Вклly|Стопped|Применитьing|Изображениеs|Загрузитьing|Отправитьing|Обновлениеd|Назадground",
            v,
        ):
            continue
        en_v = en_d.get(k)
        if not en_v:
            # try unbreak then phrase
            restored = unbreak(v)
            new_v = to_ru(restored) if restored in PHRASES else restored
            # if still mixed after unbreak+phrase, keep unbreak (hopefully pure EN)
            if is_mixed(new_v):
                new_v = restored if not is_mixed(restored) else v
        else:
            new_v = to_ru(en_v)
            # if no phrase, prefer pure EN over mixed RU
            if new_v == en_v and is_mixed(v):
                new_v = en_v
        if new_v != v:
            ru_d[k] = new_v
            changed += 1
    if not changed:
        return 0
    # replace ru object literal
    # detect indent from original
    indent = "\t\t\t"
    new_block = rebuild_object(ru_d, indent)
    # Find which marker
    marker = "const ru = {" if "const ru = {" in src[max(0, ru_start - 40) : ru_start + 5] or src[ru_start - 20 : ru_start].endswith("ru = ") else "const ru = {"
    # We have absolute start of `{` for ru
    # Need to include `const ru = ` prefix
    prefix_start = src.rfind("const ru", 0, ru_start)
    if prefix_start < 0:
        prefix_start = src.rfind("const ruDict", 0, ru_start)
    prefix = src[prefix_start:ru_start]
    src2 = src[:prefix_start] + prefix + new_block + src[ru_end:]
    path.write_text(src2, encoding="utf-8")
    return changed


def main():
    total_files = 0
    total_keys = 0
    for root in ROOTS:
        if not root.exists():
            continue
        for f in root.rglob("client.js"):
            if "beam-client" not in str(f):
                continue
            n = repair_file(f)
            if n:
                total_files += 1
                total_keys += n
                print(f"fixed {n} keys in {f}")
    print(json.dumps({"files": total_files, "keys": total_keys}))


if __name__ == "__main__":
    main()
