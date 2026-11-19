import fs from "node:fs";

const files = [
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js",
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js",
];

const pairs = [
  [
    '"modelsEmpty": "Нет models will be shown in the selector. Unlisted IDs can still be sent directly."',
    '"modelsEmpty": "В селекторе модели не будут показаны. Не указанные ID всё ещё можно отправить напрямую."',
  ],
  ['"fetchSearch": "Поиск models"', '"fetchSearch": "Поиск моделей"'],
  ['"modelReasoningRemove": "Удалить level"', '"modelReasoningRemove": "Удалить уровень"'],
  ['"modelReasoningHelp": "О программе reasoning levels"', '"modelReasoningHelp": "Об уровнях рассуждения"'],
  ['"customApiUnset": "Нетt selected"', '"customApiUnset": "Не выбрано"'],
  ['"modelsInherited": "Using the adapter defaults"', '"modelsInherited": "Используются настройки адаптера по умолчанию"'],
  ['"modelsCustomized": "Customized model catalog"', '"modelsCustomized": "Свой каталог моделей"'],
  ['"modelId": "Model ID"', '"modelId": "ID модели"'],
  ['"modelNamePlaceholder": "Uses the model ID when empty"', '"modelNamePlaceholder": "Если пусто — используется ID модели"'],
  ['"contextWindowPlaceholder": "Uses the provider default"', '"contextWindowPlaceholder": "Как у провайдера по умолчанию"'],
  ['"maxTokensPlaceholder": "Uses the provider default"', '"maxTokensPlaceholder": "Как у провайдера по умолчанию"'],
  ['"modelAdvanced": "Model options"', '"modelAdvanced": "Параметры модели"'],
  ['"modelInputTypes": "Input types"', '"modelInputTypes": "Типы ввода"'],
  ['"modelInputText": "Text"', '"modelInputText": "Текст"'],
  ['"modelInputImage": "Image"', '"modelInputImage": "Изображение"'],
  ['"modelReasoningLevel": "Level"', '"modelReasoningLevel": "Уровень"'],
  ['"modelReasoningValue": "API value"', '"modelReasoningValue": "Значение API"'],
  ['"modelReasoningAdd": "Add level"', '"modelReasoningAdd": "Добавить уровень"'],
  ['"modelReasoningOffValuePlaceholder": "Turns reasoning off"', '"modelReasoningOffValuePlaceholder": "Отключает рассуждение"'],
  ['"modelIdRequired": "Model ID is required."', '"modelIdRequired": "Нужен ID модели."'],
  ['"modelIdDuplicate": "Model ID must be unique."', '"modelIdDuplicate": "ID модели должен быть уникальным."'],
  ['"fetchModels": "Fetch available models"', '"fetchModels": "Загрузить доступные модели"'],
  ['"fetching": "Asking the provider…"', '"fetching": "Запрос к провайдеру…"'],
  ['"fetchNeedsBaseUrl": "Enter the base URL first, then fetch."', '"fetchNeedsBaseUrl": "Сначала укажите base URL, затем загрузите."'],
  ['"fetchEmpty": "The provider listed no models. Add them by hand."', '"fetchEmpty": "Провайдер не вернул модели. Добавьте вручную."'],
  ['"fetchTitle": "Choose models to add"', '"fetchTitle": "Выберите модели для добавления"'],
  [
    '"fetchDescription": "These are the models this provider has available. Choose the ones to add."',
    '"fetchDescription": "Модели этого провайдера. Выберите, какие добавить."',
  ],
  ['"fetchSelectAll": "Select all"', '"fetchSelectAll": "Выбрать все"'],
  ['"fetchDeselectAll": "Deselect all"', '"fetchDeselectAll": "Снять выбор"'],
  ['"fetchAdopt": "Add selected"', '"fetchAdopt": "Добавить выбранные"'],
  ['"customTag": "Custom"', '"customTag": "Свой"'],
  ['"customApi": "API protocol"', '"customApi": "Протокол API"'],
  [
    '"error.sessionInUse": "This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again."',
    '"error.sessionInUse": "Эта сессия уже используется другим экземпляром Beam Agent. Закройте другие окна и попробуйте снова."',
  ],
  [
    '"keyBlank": "Enter the Ключ API, or leave the field empty to keep the stored one."',
    '"keyBlank": "Введите ключ API или оставьте поле пустым, чтобы сохранить текущий."',
  ],
  [
    '"keyBlankNew": "Enter the Ключ API, or leave the field empty if this provider authenticates another way."',
    '"keyBlankNew": "Введите ключ API или оставьте пустым, если провайдер авторизуется иначе."',
  ],
  [
    '"keyIllegalCharacters": "This Ключ API is not in a valid format. Please check it."',
    '"keyIllegalCharacters": "Ключ API в неверном формате. Проверьте его."',
  ],
  [
    '"modelNameInvalid": "Отображаемое имя cannot be empty."',
    '"modelNameInvalid": "Отображаемое имя не может быть пустым."',
  ],
  [
    '"modelContextInvalid": "Контекст must be a positive count, like 131072, 256K, or 1M."',
    '"modelContextInvalid": "Контекст — положительное число, например 131072, 256K или 1M."',
  ],
  [
    '"modelMaxTokensInvalid": "Макс. токенов ответа must be a positive count, like 8192, 64K, or 1M."',
    '"modelMaxTokensInvalid": "Макс. токенов ответа — положительное число, например 8192, 64K или 1M."',
  ],
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  const mark = s.indexOf("// #region beam-ru");
  if (mark < 0) continue;
  let head = s.slice(0, mark);
  let tail = s.slice(mark);
  let n = 0;
  for (const [a, b] of pairs) {
    if (tail.includes(a)) {
      tail = tail.split(a).join(b);
      n++;
    }
  }
  fs.writeFileSync(file, head + tail);
  console.log(file, n);
}
