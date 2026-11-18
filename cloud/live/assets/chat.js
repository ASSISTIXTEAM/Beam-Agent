/* BEAM AGENT — page logic */
(function () {
  'use strict';
  var A = window.ACX;
  var $ = function (id) { return document.getElementById(id); };

  function t(key, vars) {
    var I = window.ACX_I18N;
    return I ? I.t(key, vars) : key;
  }
  function uiLang() {
    return window.ACX_I18N ? window.ACX_I18N.lang : 'en';
  }
  function localizedPath(sub) {
    var I = window.ACX_I18N;
    return I ? I.pathWithLang(sub) : (sub || '/');
  }

  var SUG_PICK_COUNT = 4;
  var SUG_RECENT_KEY = 'acx_recent_sugs';
  var SUG_RECENT_MAX = 36;

  function shuffledSugs() {
    var pool = (window.ACX_I18N ? window.ACX_I18N.getSugs() : (window.ACX_CHAT_SUGS && window.ACX_CHAT_SUGS.ru) || []).slice();
    if (!pool.length) return [];
    var recent = [];
    try {
      recent = JSON.parse(sessionStorage.getItem(SUG_RECENT_KEY) || '[]');
    } catch (e) {
      recent = [];
    }
    if (!Array.isArray(recent)) recent = [];
    var candidates = pool.filter(function (s) {
      return s && s.q && recent.indexOf(s.q) === -1;
    });
    if (candidates.length < SUG_PICK_COUNT) candidates = pool.slice();
    for (var i = candidates.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
    var picked = [];
    var usedIcons = {};
    for (var k = 0; k < candidates.length && picked.length < SUG_PICK_COUNT; k++) {
      var item = candidates[k];
      if (!item || !item.q) continue;
      var ic = item.icon || 'spark';
      if (picked.length < SUG_PICK_COUNT - 1 && usedIcons[ic] && candidates.length > SUG_PICK_COUNT) continue;
      usedIcons[ic] = true;
      picked.push(item);
    }
    if (picked.length < SUG_PICK_COUNT) {
      for (var m = 0; m < candidates.length && picked.length < SUG_PICK_COUNT; m++) {
        if (picked.indexOf(candidates[m]) !== -1) continue;
        picked.push(candidates[m]);
      }
    }
    var nextRecent = picked.map(function (s) { return s.q; }).concat(
      recent.filter(function (q) {
        return picked.every(function (s) { return s.q !== q; });
      })
    ).slice(0, SUG_RECENT_MAX);
    try {
      sessionStorage.setItem(SUG_RECENT_KEY, JSON.stringify(nextRecent));
    } catch (e2) {}
    return picked;
  }

  var GREETINGS_NAMED = [
    { pre: 'Привет, ', post: '!' },
    { pre: 'Эй, ', post: '!' },
    { pre: 'Хэй, ', post: '' },
    { pre: 'Йо, ', post: '' },
    { pre: 'Салют, ', post: '' },
    { pre: 'Хай, ', post: '' },
    { pre: 'Здорово, ', post: '' },
    { pre: 'Приветик, ', post: '' },
    { pre: 'Ну привет, ', post: '' },
    { pre: 'Привет-привет, ', post: '' },
    { pre: 'Снова ты, ', post: '' },
    { pre: 'Снова ты, ', post: ' — огонь' },
    { pre: 'Снова ты, ', post: ' — класс' },
    { pre: 'Ну здравствуй, ', post: '' },
    { pre: 'С возвращением, ', post: '' },
    { pre: 'Рад видеть, ', post: '' },
    { pre: 'Рад, что ', post: ' здесь' },
    { pre: 'Класс, ', post: ' на месте' },
    { pre: 'Отлично, ', post: ' здесь' },
    { pre: 'Ты здесь, ', post: '' },
    { pre: 'Вот и ', post: '' },
    { pre: 'А вот и ', post: '' },
    { pre: 'Наконец-то, ', post: '' },
    { pre: 'Как раз ждал, ', post: '' },
    { pre: 'О, ', post: ' — вовремя' },
    { pre: 'А, ', post: ', привет' },
    { pre: 'Добро пожаловать, ', post: '' },
    { pre: 'Привет снова, ', post: '' },
    { pre: 'Давно не виделись, ', post: '' },
    { pre: 'Рад тебя видеть, ', post: '' },
    { pre: 'Хорошо, что ', post: ' здесь' },
    { pre: 'Приятно, ', post: '' },
    { pre: 'С тобой интереснее, ', post: '' },
    { pre: 'Готов помочь, ', post: '' },
    { pre: 'Я на связи, ', post: '' },
    { pre: 'На связи, ', post: '' },
    { pre: 'Я здесь, ', post: '' },
    { pre: 'День добрый, ', post: '' },
    { pre: 'Доброе утро, ', post: '' },
    { pre: 'Добрый вечер, ', post: '' },
    { pre: 'Ну что, ', post: ', поехали?' },
    { pre: 'Ладно, ', post: ', слушаю' },
    { pre: 'Окей, ', post: ', начинаем' },
    { pre: 'Так, ', post: ', что делаем?' },
    { pre: 'Итак, ', post: ', вперёд' },
    { pre: 'Супер, ', post: ', пиши' },
    { pre: 'Круто, ', post: ', ты здесь' },
    { pre: 'К делу, ', post: '' },
    { pre: 'Без лишних слов, ', post: '' },
    { pre: 'Погнали, ', post: '' },
    { pre: 'Вперёд, ', post: '' },
    { pre: 'Задавай, ', post: '' },
    { pre: 'Спрашивай, ', post: '' },
    { pre: 'Пиши смело, ', post: '' },
    { pre: 'Не стесняйся, ', post: '' },
    { pre: 'Можно начинать, ', post: '' },
    { pre: 'Начнём, ', post: '?' },
    { pre: 'Готов, ', post: '?' },
    { pre: 'Жду вопрос, ', post: '' },
    { pre: 'Жду идею, ', post: '' },
    { pre: 'Жду задачу, ', post: '' },
    { pre: 'Чистый лист — ', post: ', ваш ход' },
    { pre: 'Новый чат, ', post: ' — поехали' },
    { pre: 'С чистого листа, ', post: '' },
    { pre: '', post: ', чем помочь?' },
    { pre: '', post: ', что обсудим?' },
    { pre: '', post: ', что на уме?' },
    { pre: '', post: ', слушаю' },
    { pre: '', post: ', пиши' },
    { pre: '', post: ', рассказывай' },
    { pre: '', post: ', начинаем?' },
    { pre: '', post: ', поехали' },
    { pre: '', post: ', я готов' },
    { pre: '', post: ', задавай вопрос' },
    { pre: '', post: ', чем займёмся?' },
    { pre: '', post: ', с чего начнём?' },
    { pre: '', post: ', к твоим услугам' },
    { pre: '', post: ', давай разберёмся' },
    { pre: '', post: ', что нового?' },
    { pre: '', post: ', готов к диалогу' },
    { pre: '', post: ', ваш ход' },
    { pre: '', post: ', я на месте' },
    { pre: '', post: ', в эфире' },
    { pre: 'Привет, ', post: ', что нового?' },
    { pre: 'Чем займёмся, ', post: '?' },
    { pre: 'Что сегодня, ', post: '?' },
    { pre: 'Какие планы, ', post: '?' },
    { pre: 'Что ищем, ', post: '?' },
    { pre: 'Куда копнём, ', post: '?' },
    { pre: 'О чём поговорим, ', post: '?' },
    { pre: 'Что разберём, ', post: '?' },
    { pre: 'Чем помочь, ', post: '?' },
    { pre: 'Что подсказать, ', post: '?' },
    { pre: 'Что объяснить, ', post: '?' },
    { pre: 'Что найти, ', post: '?' },
    { pre: 'Что написать, ', post: '?' },
    { pre: 'Что придумать, ', post: '?' },
    { pre: 'Что улучшить, ', post: '?' },
    { pre: 'Что понять, ', post: '?' },
    { pre: 'Что решить, ', post: '?' },
    { pre: 'Что создать, ', post: '?' },
    { pre: 'Что спланировать, ', post: '?' },
    { pre: 'С чего начнёшь, ', post: '?' },
    { pre: 'Что придумал, ', post: '?' },
    { pre: 'Что задумал, ', post: '?' },
    { pre: 'Что нужно, ', post: '?' },
    { pre: 'Любой вопрос, ', post: '' },
    { pre: 'Любая тема, ', post: '' },
    { pre: 'Что угодно, ', post: '' },
    { pre: 'Снова вместе, ', post: '' },
    { pre: 'Снова в деле, ', post: '' },
    { pre: 'Снова в теме, ', post: '' },
    { pre: 'Снова в эфире, ', post: '' },
    { pre: 'Снова в ASSISTIX, ', post: '' },
    { pre: 'Ура, ', post: ' вернулся' },
    { pre: 'Ура, ', post: ' вернулась' },
    { pre: 'М-м, ', post: ', интересно' },
    { pre: 'Кстати, ', post: ', рад видеть' },
    { pre: 'Мысль есть? ', post: ', давай' },
    { pre: 'Задача есть? ', post: ', разберём' },
    { pre: 'Вопрос есть? ', post: ', отвечу' },
    { pre: 'Идея есть? ', post: ', докрутим' },
    { pre: 'Черновик есть? ', post: ', отшлифуем' },
    { pre: 'Тупик? ', post: ', обойдём' },
    { pre: 'Хаос? ', post: ', структурируем' },
    { pre: 'Срок горит? ', post: ', поможем' },
    { pre: 'Нет слов? ', post: ', найдём' },
    { pre: 'Сложно? ', post: ', упростим' },
    { pre: 'Длинно? ', post: ', сожмём' },
    { pre: 'Сырой текст? ', post: ', оформим' },
    { pre: 'Нужен план? ', post: ', составим' },
    { pre: 'Нужен текст? ', post: ', напишем' },
    { pre: 'Нужен разбор? ', post: ', сделаем' },
    { pre: 'По сути, ', post: '' },
    { pre: 'В точку, ', post: '' },
    { pre: 'Коротко и ясно, ', post: '' },
    { pre: 'Точно и понятно, ', post: '' },
    { pre: 'Без воды, ', post: '' },
    { pre: 'Сразу к делу, ', post: '' },
    { pre: 'Один вопрос — ', post: ', один ответ' },
    { pre: 'Текст, код, идея — ', post: ', вперёд' },
    { pre: 'Спроси смело, ', post: '' },
    { pre: 'Думай вслух, ', post: '' },
    { pre: 'Говори как есть, ', post: '' },
    { pre: 'Я не осуждаю, ', post: '' },
    { pre: 'Любой уровень, ', post: '' },
    { pre: 'С нуля или с опытом — ', post: ', помогу' },
    { pre: 'Быстро или глубоко — ', post: ', как скажешь' },
    { pre: 'Коротко или подробно — ', post: ', на выбор' },
    { pre: 'RU или EN — ', post: ', без разницы' },
    { pre: 'Утро или ночь — ', post: ', я тут' },
    { pre: 'Кофе или чай — ', post: ', я готов' },
    { pre: 'Просто или сложно — ', post: ', справимся' },
    { pre: 'Серьёзно или с юмором — ', post: ', как хочешь' },
    { pre: 'С файлом или без — ', post: ', прикрепляй' },
    { pre: 'С фото или без — ', post: ', загружай' },
    { pre: 'С вебом или без — ', post: ', включим' },
    { pre: 'Пустой экран — ', post: ', ваш ход' },
    { pre: 'Курсор мигает, ', post: '' },
    { pre: 'Экран чист, ', post: '' },
    { pre: 'Слово за тобой, ', post: '' },
    { pre: 'Ход за тобой, ', post: '' },
    { pre: 'Старт за тобой, ', post: '' },
    { pre: 'Микрофон твой, ', post: '' },
    { pre: 'Сцена твоя, ', post: '' },
    { pre: 'История начинается, ', post: '' },
    { pre: 'Разговор открыт, ', post: '' },
    { pre: 'Канал свободен, ', post: '' },
    { pre: 'Эфир открыт, ', post: '' },
    { pre: 'ASSISTIX ждёт, ', post: '' },
    { pre: 'ASSISTIX готов, ', post: '' },
    { pre: 'ASSISTIX слушает, ', post: '' },
    { pre: 'FLAIR или PINE — ', post: ', выбирай' },
    { pre: 'Чат, веб или docs — ', post: ', решай' },
    { pre: 'Одно сообщение — ', post: ', и поехали' },
    { pre: 'Первый шаг — ', post: ', твоё слово' },
    { pre: 'Zero drama, ', post: '' },
    { pre: 'Max useful, ', post: '' },
    { pre: 'Min filler, ', post: '' },
    { pre: 'Think aloud, ', post: '' },
    { pre: 'Just ask, ', post: '' },
    { pre: 'Simply write, ', post: '' },
    { pre: 'Go when ready, ', post: '' },
    { pre: 'Ready when you are, ', post: '' },
    { pre: 'Vibe check passed, ', post: '' },
    { pre: 'Focus on, ', post: '' },
    { pre: 'Flow ready, ', post: '' },
    { pre: 'Spark lit, ', post: '' },
    { pre: 'Magic pending, ', post: '' },
    { pre: 'Clarity incoming, ', post: '' },
    { pre: 'Answer closer, ', post: '' },
    { pre: 'Solution nearby, ', post: '' },
    { pre: 'Idea on approach, ', post: '' },
    { pre: 'Plan on approach, ', post: '' },
    { pre: 'Text on approach, ', post: '' }
  ];

  var GREETINGS_GUEST = [
    'Чем могу <span class="acx-grad-text">помочь?</span>',
    'С чего <span class="acx-grad-text">начнём?</span>',
    'Что вас <span class="acx-grad-text">интересует?</span>',
    'Спрашивайте — <span class="acx-grad-text">помогу</span>',
    'Готов к <span class="acx-grad-text">работе</span>',
    'Я <span class="acx-grad-text">на связи</span>',
    'Я <span class="acx-grad-text">здесь</span>',
    'Я <span class="acx-grad-text">слушаю</span>',
    'Я <span class="acx-grad-text">готов</span>',
    'Пишите — <span class="acx-grad-text">отвечу</span>',
    'Спрашивайте <span class="acx-grad-text">смело</span>',
    'Любой <span class="acx-grad-text">вопрос</span>',
    'Любая <span class="acx-grad-text">задача</span>',
    'Любая <span class="acx-grad-text">тема</span>',
    'Что <span class="acx-grad-text">подсказать?</span>',
    'Что <span class="acx-grad-text">объяснить?</span>',
    'Что <span class="acx-grad-text">найти?</span>',
    'Что <span class="acx-grad-text">написать?</span>',
    'Что <span class="acx-grad-text">разобрать?</span>',
    'Что <span class="acx-grad-text">придумать?</span>',
    'Что <span class="acx-grad-text">улучшить?</span>',
    'Что <span class="acx-grad-text">понять?</span>',
    'Что <span class="acx-grad-text">решить?</span>',
    'Что <span class="acx-grad-text">создать?</span>',
    'О чём <span class="acx-grad-text">поговорим?</span>',
    'Куда <span class="acx-grad-text">копнём?</span>',
    'С чего <span class="acx-grad-text">старт?</span>',
    'Какая <span class="acx-grad-text">задача?</span>',
    'Какой <span class="acx-grad-text">вопрос?</span>',
    'Какая <span class="acx-grad-text">идея?</span>',
    'Новый чат — <span class="acx-grad-text">ваш ход</span>',
    'Чистый лист. <span class="acx-grad-text">Пишите</span>',
    'Пустой экран — <span class="acx-grad-text">начинаем</span>',
    'Мысль в голове? <span class="acx-grad-text">Давайте</span>',
    'Сложное — <span class="acx-grad-text">упростим</span>',
    'Простое — <span class="acx-grad-text">ускорим</span>',
    'Текст, код, идея — <span class="acx-grad-text">вперёд</span>',
    'Один вопрос — <span class="acx-grad-text">один ответ</span>',
    'К <span class="acx-grad-text">делу</span>',
    'По <span class="acx-grad-text">сути</span>',
    'В <span class="acx-grad-text">точку</span>',
    'Без <span class="acx-grad-text">лишнего</span>',
    'Без <span class="acx-grad-text">воды</span>',
    'Коротко и <span class="acx-grad-text">ясно</span>',
    'Точно и <span class="acx-grad-text">понятно</span>',
    'Глубже? <span class="acx-grad-text">Легко</span>',
    'Проще? <span class="acx-grad-text">Сделаем</span>',
    'Загадка? <span class="acx-grad-text">Разгадаем</span>',
    'Тупик? <span class="acx-grad-text">Обойдём</span>',
    'Хаос? <span class="acx-grad-text">Структурируем</span>',
    'Срок горит? <span class="acx-grad-text">Поможем</span>',
    'Нет слов? <span class="acx-grad-text">Найдём</span>',
    'Черновик? <span class="acx-grad-text">Отшлифуем</span>',
    'Сырой текст? <span class="acx-grad-text">Оформим</span>',
    'Длинный текст? <span class="acx-grad-text">Сожмём</span>',
    'Сложная тема? <span class="acx-grad-text">Разложим</span>',
    'Непонятно? <span class="acx-grad-text">Объясним</span>',
    'Ошибка в коде? <span class="acx-grad-text">Найдём</span>',
    'Пустой документ? <span class="acx-grad-text">Заполним</span>',
    'Слишком общо? <span class="acx-grad-text">Конкретизируем</span>',
    'ASSISTIX <span class="acx-grad-text">ждёт</span>',
    'ASSISTIX <span class="acx-grad-text">готов</span>',
    'ASSISTIX <span class="acx-grad-text">слушает</span>',
    'ASSISTIX <span class="acx-grad-text">на связи</span>',
    'Добро пожаловать в <span class="acx-grad-text">ASSISTIX</span>',
    'Начните <span class="acx-grad-text">диалог</span>',
    'Задайте <span class="acx-grad-text">вопрос</span>',
    'Опишите <span class="acx-grad-text">задачу</span>',
    'Расскажите <span class="acx-grad-text">идею</span>',
    'Поделитесь <span class="acx-grad-text">мыслью</span>',
    'Загрузите <span class="acx-grad-text">файл</span>',
    'Прикрепите <span class="acx-grad-text">фото</span>',
    'Включите <span class="acx-grad-text">веб</span>',
    'Выберите <span class="acx-grad-text">модель</span>',
    'Попробуйте <span class="acx-grad-text">FLAIR</span>',
    'Попробуйте <span class="acx-grad-text">FLAIR</span>',
    'Попробуйте <span class="acx-grad-text">PINE</span>',
    'Сегодня <span class="acx-grad-text">создадим</span>',
    'Сегодня <span class="acx-grad-text">разберём</span>',
    'Сегодня <span class="acx-grad-text">напишем</span>',
    'Сегодня <span class="acx-grad-text">решим</span>',
    'Сейчас — <span class="acx-grad-text">лучшее время</span>',
    'Прямо сейчас — <span class="acx-grad-text">пишите</span>',
    'Первый шаг — <span class="acx-grad-text">ваше слово</span>',
    'Ваш ход, <span class="acx-grad-text">капитан</span>',
    'Клавиатура <span class="acx-grad-text">ждёт</span>',
    'Курсор <span class="acx-grad-text">мигает</span>',
    'Экран <span class="acx-grad-text">чист</span>',
    'История <span class="acx-grad-text">начинается</span>',
    'Разговор <span class="acx-grad-text">открыт</span>',
    'Канал <span class="acx-grad-text">свободен</span>',
    'Эфир <span class="acx-grad-text">открыт</span>',
    'Сцена <span class="acx-grad-text">ваша</span>',
    'Слово — <span class="acx-grad-text">за вами</span>',
    'Ход — <span class="acx-grad-text">ваш</span>',
    'Старт — <span class="acx-grad-text">за вами</span>',
    'Ответ — <span class="acx-grad-text">ближе</span>',
    'Решение — <span class="acx-grad-text">рядом</span>',
    'Идея — <span class="acx-grad-text">на подходе</span>',
    'План — <span class="acx-grad-text">на подходе</span>',
    'Clarity — <span class="acx-grad-text">incoming</span>',
    'Focus — <span class="acx-grad-text">on</span>',
    'Flow — <span class="acx-grad-text">ready</span>',
    'Just — <span class="acx-grad-text">ask</span>',
    'Simply — <span class="acx-grad-text">write</span>',
    'Think — <span class="acx-grad-text">aloud</span>',
    'Zero — <span class="acx-grad-text">drama</span>',
    'Max — <span class="acx-grad-text">useful</span>',
    'Min — <span class="acx-grad-text">filler</span>',
    'Turbo — <span class="acx-grad-text">mode</span>',
    'Zen — <span class="acx-grad-text">on</span>',
    'Chill — <span class="acx-grad-text">and ask</span>',
    'Vibe — <span class="acx-grad-text">check passed</span>',
    'Spark — <span class="acx-grad-text">lit</span>',
    'Magic — <span class="acx-grad-text">pending</span>',
    'Wow — <span class="acx-grad-text">loading</span>',
    'Boom — <span class="acx-grad-text">on enter</span>',
    'Snap — <span class="acx-grad-text">and done</span>',
    'Sharp — <span class="acx-grad-text">by default</span>',
    'Deep — <span class="acx-grad-text">if asked</span>',
    'Wide — <span class="acx-grad-text">if needed</span>',
    'RU или EN — <span class="acx-grad-text">без разницы</span>',
    'Утро или ночь — <span class="acx-grad-text">я тут</span>',
    'Кофе или чай — <span class="acx-grad-text">я готов</span>',
    'Школа или работа — <span class="acx-grad-text">подстроюсь</span>',
    'С нуля или с опытом — <span class="acx-grad-text">помогу</span>',
    'Быстро или глубоко — <span class="acx-grad-text">как скажете</span>',
    'Коротко или подробно — <span class="acx-grad-text">на выбор</span>',
    'Серьёзно или с юмором — <span class="acx-grad-text">как хотите</span>',
    'Факт или фантазия — <span class="acx-grad-text">разберём</span>',
    'Код или текст — <span class="acx-grad-text">оба</span>',
    'PDF или фото — <span class="acx-grad-text">прикрепляйте</span>',
    'Веб или офлайн — <span class="acx-grad-text">решайте</span>',
    'FLAIR и PINE — <span class="acx-grad-text">выбирайте</span>',
    'Чат, веб, docs — <span class="acx-grad-text">режимы</span>',
    'Один клик — <span class="acx-grad-text">и поехали</span>',
    'Одно сообщение — <span class="acx-grad-text">и старт</span>',
    'Два слова — <span class="acx-grad-text">хватит</span>',
    'Три слова — <span class="acx-grad-text">идеально</span>',
    'Пять слов — <span class="acx-grad-text">шедевр</span>',
    'Космос, код, кофе — <span class="acx-grad-text">любая тема</span>',
    'Мысли вслух — <span class="acx-grad-text">я рядом</span>',
    'Сомневаетесь? <span class="acx-grad-text">Спросите</span>',
    'Застряли? <span class="acx-grad-text">Вытащим</span>',
    'Спешите? <span class="acx-grad-text">Быстро</span>',
    'Не спешите? <span class="acx-grad-text">Глубже</span>',
    'Первый раз здесь? <span class="acx-grad-text">Добро пожаловать</span>',
    'Снова здесь? <span class="acx-grad-text">Как дома</span>',
    'Ночная смена? <span class="acx-grad-text">Я не сплю</span>',
    'Утро? <span class="acx-grad-text">Начнём</span>',
    'Вечер? <span class="acx-grad-text">Тоже ок</span>',
    'Дедлайн через час? <span class="acx-grad-text">Живём</span>',
    'Дедлайн завтра? <span class="acx-grad-text">Успеем</span>',
    'Дедлайн вчера? <span class="acx-grad-text">Быстрее</span>',
    'Идея на салфетке? <span class="acx-grad-text">Развернём</span>',
    'Скриншот ошибки? <span class="acx-grad-text">Кидайте</span>',
    'Stack trace? <span class="acx-grad-text">Разберём</span>',
    'Код не компилится? <span class="acx-grad-text">Починим</span>',
    'Тесты красные? <span class="acx-grad-text">Позеленеем</span>',
    'README пустой? <span class="acx-grad-text">Напишем</span>',
    'Commit message? <span class="acx-grad-text">Сформулируем</span>',
    'PR description? <span class="acx-grad-text">Оформим</span>',
    'Email начальнику? <span class="acx-grad-text">Отполируем</span>',
    'Пост в соцсети? <span class="acx-grad-text">Зацепим</span>',
    'Заголовок статьи? <span class="acx-grad-text">Выстрелим</span>',
    'Название проекта? <span class="acx-grad-text">Придумаем</span>',
    'Слоган? <span class="acx-grad-text">Сожмём</span>',
    'Pitch за 30 сек? <span class="acx-grad-text">Уложимся</span>',
    'Конспект лекции? <span class="acx-grad-text">Сделаем</span>',
    'Шпаргалка? <span class="acx-grad-text">Соберём</span>',
    'Задача из учебника? <span class="acx-grad-text">Решим</span>',
    'Домашка? <span class="acx-grad-text">Разберём</span>',
    'Курсовая? <span class="acx-grad-text">Структурируем</span>',
    'Резюме? <span class="acx-grad-text">Отточим</span>',
    'Mock interview? <span class="acx-grad-text">Потренируем</span>',
    'Regex from hell? <span class="acx-grad-text">Победим</span>',
    'CORS error? <span class="acx-grad-text">Объясним</span>',
    'Legacy code? <span class="acx-grad-text">Аккуратно</span>',
    'Spaghetti code? <span class="acx-grad-text">Распутаем</span>',
    'Writers block? <span class="acx-grad-text">Сдвинем</span>',
    'Blank page? <span class="acx-grad-text">Заполним</span>',
    'Too many tabs? <span class="acx-grad-text">Сожмём</span>',
    'Decision fatigue? <span class="acx-grad-text">Упростим</span>',
    'Monday mood? <span class="acx-grad-text">Поднимем</span>',
    'Friday mood? <span class="acx-grad-text">Дожмём</span>',
    'Side project? <span class="acx-grad-text">План</span>',
    'Startup idea? <span class="acx-grad-text">Валидируем</span>',
    'Landing copy? <span class="acx-grad-text">Hook</span>',
    'Empty state? <span class="acx-grad-text">Warm</span>',
    'Error message? <span class="acx-grad-text">Human</span>',
    'AI prompt? <span class="acx-grad-text">Sharpen</span>',
    'Tabs or spaces? <span class="acx-grad-text">Мир</span>',
    'Done or perfect? <span class="acx-grad-text">Done</span>',
    'Ship or polish? <span class="acx-grad-text">Ship</span>',
    'Now or later? <span class="acx-grad-text">Now</span>',
    'Вы + ASSISTIX — <span class="acx-grad-text">go</span>',
    'Человек + AI — <span class="acx-grad-text">сильнее</span>',
    'Вопрос в голове? <span class="acx-grad-text">В чат</span>',
    'Полстраницы текста? <span class="acx-grad-text">Сожмём</span>',
    'Три абзаца воды? <span class="acx-grad-text">Вычистим</span>',
    'Сложная формулировка? <span class="acx-grad-text">Упростим</span>',
    'Нужен другой угол? <span class="acx-grad-text">Покажем</span>',
    'Нужен контраргумент? <span class="acx-grad-text">Дадим</span>',
    'Нужен пример? <span class="acx-grad-text">Приведём</span>',
    'Нужна аналогия? <span class="acx-grad-text">Найдём</span>',
    'Нужен план B? <span class="acx-grad-text">Придумаем</span>',
    'Нужен чек-лист? <span class="acx-grad-text">5 пунктов</span>',
    'Нужен TL;DR? <span class="acx-grad-text">3 строки</span>',
    'Нужен brainstorm? <span class="acx-grad-text">10 идей</span>',
    'Нужен reality check? <span class="acx-grad-text">Честно</span>',
    'Нужен second opinion? <span class="acx-grad-text">Есть</span>',
    'Нужен sanity check? <span class="acx-grad-text">Сделаем</span>',
    'Нужен gut check? <span class="acx-grad-text">Обсудим</span>',
    'Нужен vibe check? <span class="acx-grad-text">Passed</span>',
    'Нужен fact check? <span class="acx-grad-text">Проверим</span>',
    'Нужен spell check? <span class="acx-grad-text">Исправим</span>',
    'Нужен tone check? <span class="acx-grad-text">Подстроим</span>',
    'Нужен peer review? <span class="acx-grad-text">Имитируем</span>',
    'Нужен code review? <span class="acx-grad-text">Пройдёмся</span>',
    'Нужен design review? <span class="acx-grad-text">Комментарии</span>',
    'Нужен retro? <span class="acx-grad-text">3 вопроса</span>',
    'Нужен standup? <span class="acx-grad-text">Yesterday/today/blockers</span>',
    'Нужен 1:1 agenda? <span class="acx-grad-text">Outline</span>',
    'Нужен OKR draft? <span class="acx-grad-text">Черновик</span>',
    'Нужен KPI tree? <span class="acx-grad-text">Разложим</span>',
    'Нужен user story? <span class="acx-grad-text">As a…</span>',
    'Нужен acceptance criteria? <span class="acx-grad-text">Given/when/then</span>',
    'Нужен bug report? <span class="acx-grad-text">Steps</span>',
    'Нужен incident report? <span class="acx-grad-text">Timeline</span>',
    'Нужен postmortem? <span class="acx-grad-text">5 whys</span>',
    'Нужен runbook? <span class="acx-grad-text">Steps</span>',
    'Нужен SOP? <span class="acx-grad-text">Procedure</span>',
    'Нужен FAQ? <span class="acx-grad-text">Q&A</span>',
    'Нужен glossary? <span class="acx-grad-text">Terms</span>',
    'Нужен style guide? <span class="acx-grad-text">Rules</span>',
    'Нужен brand voice? <span class="acx-grad-text">Tone</span>',
    'Нужен microcopy? <span class="acx-grad-text">≤5 слов</span>',
    'Нужен haiku? <span class="acx-grad-text">5-7-5</span>',
    'Нужен joke? <span class="acx-grad-text">Попробуем</span>',
    'Нужен rhyme? <span class="acx-grad-text">Сочиним</span>',
    'Нужен story hook? <span class="acx-grad-text">Первая строка</span>',
    'Нужен plot twist? <span class="acx-grad-text">Идея</span>',
    'Нужен character name? <span class="acx-grad-text">10 вариантов</span>',
    'Нужен world lore? <span class="acx-grad-text">Bullets</span>',
    'Нужен dialogue? <span class="acx-grad-text">Живой</span>',
    'Нужен script? <span class="acx-grad-text">Сцена</span>',
    'Нужен poem? <span class="acx-grad-text">Строки</span>',
    'Нужен song lyric? <span class="acx-grad-text">Куплет</span>',
    'Нужен metaphor? <span class="acx-grad-text">Образ</span>',
    'Нужен acronym? <span class="acx-grad-text">BACKronym</span>',
    'Нужен nickname? <span class="acx-grad-text">List</span>',
    'Нужен domain name? <span class="acx-grad-text">Ideas</span>',
    'Нужен emoji set? <span class="acx-grad-text">Pick</span>',
    'Нужен color palette? <span class="acx-grad-text">5 hex</span>',
    'Нужен font pair? <span class="acx-grad-text">2 names</span>',
    'Нужен wireframe? <span class="acx-grad-text">ASCII</span>',
    'Нужен user flow? <span class="acx-grad-text">Steps</span>',
    'Нужен edge case? <span class="acx-grad-text">List</span>',
    'Нужен happy path? <span class="acx-grad-text">Map</span>',
    'Нужен unhappy path? <span class="acx-grad-text">Plan</span>',
    'Нужен migration plan? <span class="acx-grad-text">Phases</span>',
    'Нужен rollback plan? <span class="acx-grad-text">Steps</span>',
    'Нужен backup plan? <span class="acx-grad-text">Checklist</span>',
    'Нужен launch plan? <span class="acx-grad-text">Timeline</span>',
    'Нужен growth loop? <span class="acx-grad-text">Sketch</span>',
    'Нужен funnel fix? <span class="acx-grad-text">Hypothesis</span>',
    'Нужен A/B idea? <span class="acx-grad-text">Variant</span>',
    'Нужен metric? <span class="acx-grad-text">Define</span>',
    'Нужен dashboard? <span class="acx-grad-text">Widgets</span>',
    'Нужен chart type? <span class="acx-grad-text">Pick</span>',
    'Нужен diagram? <span class="acx-grad-text">Mermaid</span>',
    'Нужен ERD? <span class="acx-grad-text">Entities</span>',
    'Нужен API spec? <span class="acx-grad-text">Endpoints</span>',
    'Нужен JSON schema? <span class="acx-grad-text">Fields</span>',
    'Нужен SQL query? <span class="acx-grad-text">SELECT</span>',
    'Нужен bash one-liner? <span class="acx-grad-text">Pipe</span>',
    'Нужен Python snippet? <span class="acx-grad-text">def</span>',
    'Нужен JS helper? <span class="acx-grad-text">fn</span>',
    'Нужен Rust impl? <span class="acx-grad-text">trait</span>',
    'Нужен Go func? <span class="acx-grad-text">err</span>',
    'Нужен regex? <span class="acx-grad-text">/.*/</span>',
    'Нужен cron? <span class="acx-grad-text">* * *</span>',
    'Нужен nginx? <span class="acx-grad-text">location</span>',
    'Нужен dockerfile? <span class="acx-grad-text">FROM</span>',
    'Нужен k8s yaml? <span class="acx-grad-text">kind:</span>',
    'Нужен terraform? <span class="acx-grad-text">resource</span>',
    'Нужен ci yaml? <span class="acx-grad-text">on: push</span>',
    'Нужен git command? <span class="acx-grad-text">--help</span>',
    'Нужен vim tip? <span class="acx-grad-text">:wq</span>',
    'Нужен shortcut? <span class="acx-grad-text">Ctrl+?</span>',
    'Нужен lifehack? <span class="acx-grad-text">1 trick</span>',
    'Нужен pro tip? <span class="acx-grad-text">Hidden</span>',
    'Нужен ELI5? <span class="acx-grad-text">Simple</span>',
    'Нужен ELI12? <span class="acx-grad-text">Clear</span>',
    'Нужен expert dive? <span class="acx-grad-text">Deep</span>',
    'Нужен beginner path? <span class="acx-grad-text">Steps</span>',
    'Нужен study plan? <span class="acx-grad-text">Weeks</span>',
    'Нужен habit stack? <span class="acx-grad-text">Routine</span>',
    'Нужен pomodoro? <span class="acx-grad-text">25 min</span>',
    'Нужен focus trick? <span class="acx-grad-text">One task</span>',
    'Нужен calm? <span class="acx-grad-text">Breathe</span>',
    'Нужен boost? <span class="acx-grad-text">Let\'s go</span>',
    'ASSISTIX — <span class="acx-grad-text">hi</span>'
  ];
  function userFirstName() {
    if (!state.boot || !state.boot.data || !state.boot.data.authenticated) return '';
    var u = state.boot.data.user || {};
    var name = (u.display_name || u.first_name || '').trim();
    if (!name && u.email) name = u.email.split('@')[0];
    return name ? name.split(/\s+/)[0] : '';
  }

  function welcomeHeadingHtml() {
    var fn = userFirstName();
    var I = window.ACX_I18N;
    if (!fn) {
      var guestAlt = I && I.getGreetingsGuest();
      if (guestAlt && guestAlt.length) return guestAlt[Math.floor(Math.random() * guestAlt.length)];
      if (!I || I.lang === 'ru') return GREETINGS_GUEST[Math.floor(Math.random() * GREETINGS_GUEST.length)];
      return 'How can I <span class="acx-grad-text">help?</span>';
    }
    var namedAlt = I && I.getGreetingsNamed();
    if (namedAlt && namedAlt.length) {
      var ga = namedAlt[Math.floor(Math.random() * namedAlt.length)];
      return A.esc(ga.pre) + '<span class="acx-grad-text">' + A.esc(fn) + '</span>' + A.esc(ga.post);
    }
    if (!I || I.lang === 'ru') {
      var g = GREETINGS_NAMED[Math.floor(Math.random() * GREETINGS_NAMED.length)];
      return A.esc(g.pre) + '<span class="acx-grad-text">' + A.esc(fn) + '</span>' + A.esc(g.post);
    }
    return 'Hi, <span class="acx-grad-text">' + A.esc(fn) + '</span>!';
  }

  var ID_ORIGIN = 'https://id.assistix.org';

  var state = {
    boot: null,
    guest: true,
    model: 'FLAIR',
    mode: 'agent',
    web: false,
    streaming: false,
    stream: null,
    messages: [],
    attachments: [],
    conversationId: null,
    localId: null,
    chatTitle: '',
    shareMode: false,
    titleGenPending: false,
    historyGroups: {},
    historyFilter: '',
    idEmbedProbeComplete: false,
    idProbeTimer: null,
    idModalEscBound: false,
    profilePopBound: false,
    profileMemDraft: [],
    profileMemDeleted: [],
    profileSaving: false,
    researchPanelOpen: false,
    researchPanelWide: localStorage.getItem('acx_rp_wide') === '1',
    researchPanelData: null,
    pdfExtractors: {},
    pdfPreviewBlob: null,
    ephemeral: false,
    ephemeralPending: false,
    historyHasMore: false,
    historyOffset: 0,
    historyLoading: false,
    compactMode: localStorage.getItem('acx_compact') === '1',
    lastStreamPayload: null,
    guestUserMsgCount: 0,
    voiceActive: false
  };

  function parseMessageMeta(m) {
    var meta = null;
    if (m.meta_json) {
      try {
        meta = typeof m.meta_json === 'string' ? JSON.parse(m.meta_json) : m.meta_json;
      } catch (e) { meta = null; }
    }
    return meta;
  }

  function messageFromApiRow(m) {
    var att = [];
    if (m.attachments_json) {
      try { att = typeof m.attachments_json === 'string' ? JSON.parse(m.attachments_json) : m.attachments_json; } catch (e) { att = []; }
    }
    var row = { role: m.role, content: m.content, attachments: att };
    var meta = parseMessageMeta(m);
    if (meta && meta.research) {
      row.research = meta.research;
      if (meta.research.sources) row.sources = meta.research.sources;
    }
    if (meta && meta.reasoning) row.reasoning = meta.reasoning;
    if (meta && meta.widgets && meta.widgets.length) row.widgets = meta.widgets;
    if (meta && meta.agent) row.agent = true;
    if (m.model) row.model = m.model;
    return row;
  }

  function chatPathId() {
    if (state.ephemeral) return null;
    if (state.guest && state.localId) return state.localId;
    if (state.conversationId) return String(state.conversationId);
    return null;
  }

  function parseRoute() {
    var path = window.ACX_I18N
      ? window.ACX_I18N.stripLangFromPath(location.pathname)
      : location.pathname;
    var m = path.match(/^\/c\/([^/]+)\/?$/i);
    if (m) return { type: 'chat', id: decodeURIComponent(m[1]) };
    m = path.match(/^\/s\/([^/]+)\/?$/i);
    if (m) return { type: 'share', token: decodeURIComponent(m[1]) };
    var sp = new URLSearchParams(location.search);
    var legacy = sp.get('c');
    if (legacy) return { type: 'chat', id: legacy };
    return null;
  }

  function syncChatUrl(replace) {
    if (state.shareMode || state.ephemeral) return;
    var id = chatPathId();
    var path = localizedPath(id ? '/c/' + encodeURIComponent(id) : '/');
    if (replace) history.replaceState({ chat: id, share: null, lang: uiLang() }, '', path);
    else history.pushState({ chat: id, share: null, lang: uiLang() }, '', path);
    updateChatTitleBar();
    document.title = state.chatTitle ? (state.chatTitle + ' · BEAM AGENT') : 'BEAM AGENT';
    applyPageSeo();
  }

  function setRootChatClasses() {
    var root = document.querySelector('.c-root');
    if (!root) return;
    root.classList.toggle('has-chat', !!chatPathId() && !state.shareMode);
    root.classList.toggle('is-share', !!state.shareMode);
    root.classList.toggle('research-open', !!state.researchPanelOpen);
    root.classList.toggle('research-wide', !!state.researchPanelWide && !!state.researchPanelOpen);
    root.classList.toggle('composer-compact', !!state.researchPanelOpen);
  }

  function updateChatTitleBar() {
    var head = $('chatHead');
    var titleEl = $('chatTitle');
    var shareBtn = $('chatShareBtn');
    setRootChatClasses();
    if (!head) return;
    var id = chatPathId();
    var title = state.chatTitle || '';
    if ((id || state.shareMode) && title) {
      head.hidden = false;
      if (titleEl) titleEl.textContent = title;
      if (shareBtn) shareBtn.hidden = !!state.shareMode || !id;
    } else {
      head.hidden = true;
    }
  }

  function setShareBanner(show) {
    var banner = $('shareBanner');
    if (banner) banner.hidden = !show;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (e) {
        reject(e);
      }
      ta.remove();
    });
  }

  function applyPageSeo() {
    if (!window.ACXSEO) return;
    var basePath = window.ACX_I18N ? window.ACX_I18N.pathWithLang('/') : '/';
    if (state.shareMode && state.chatTitle) {
      window.ACXSEO.apply({
        title: state.chatTitle + ' · BEAM AGENT',
        description: t('seo.shareChatDesc', { title: state.chatTitle }),
        url: location.href,
        image: window.ACXSEO.absUrl('/api/og.php?kind=chat&title=' + encodeURIComponent(state.chatTitle)),
        type: 'article',
        robots: 'noindex, follow'
      });
      return;
    }
    if (state.chatTitle && chatPathId() && !state.ephemeral) {
      window.ACXSEO.apply({
        title: state.chatTitle + ' · BEAM AGENT',
        description: t('seo.chatDesc', { title: state.chatTitle }),
        url: location.href,
        image: window.ACXSEO.absUrl('/api/og.php?kind=chat&title=' + encodeURIComponent(state.chatTitle)),
        type: 'website',
        robots: 'noindex, nofollow'
      });
      return;
    }
    window.ACXSEO.apply({
      title: t('seo.title'),
      description: t('seo.description'),
      url: window.ACXSEO.absUrl(basePath),
      image: window.ACXSEO.absUrl('/api/og.php'),
      type: 'website',
      robots: 'index, follow'
    });
  }

  function renderShareSocial(url, title) {
    var box = $('shareSocialBtns');
    if (!box || !window.ACXSEO) return;
    var links = window.ACXSEO.shareLinks(url, title);
    var items = [
      { key: 'telegram', label: t('share.telegram'), href: links.telegram },
      { key: 'whatsapp', label: t('share.whatsapp'), href: links.whatsapp },
      { key: 'vk', label: t('share.vk'), href: links.vk },
      { key: 'twitter', label: t('share.twitter'), href: links.twitter },
      { key: 'email', label: t('share.email'), href: links.email }
    ];
    box.innerHTML = items.map(function (it) {
      return '<a class="c-share-social-btn" href="' + A.esc(it.href) + '" target="_blank" rel="noreferrer noopener" data-share="' + it.key + '">' + A.esc(it.label) + '</a>';
    }).join('');
  }

  function closeShareModal() {
    var modal = $('shareModal');
    if (modal) modal.classList.add('hidden');
  }

  function openShareModal(opts) {
    opts = opts || {};
    var modal = $('shareModal');
    var input = $('shareUrlInput');
    var hint = $('shareModalHint');
    var nativeBtn = $('shareNativeBtn');
    if (!modal || !input) {
      if (opts.url) return copyText(opts.url).then(function () { toast(t('toast.linkCopied')); });
      return Promise.reject(new Error('no_modal'));
    }
    var url = opts.url || '';
    var title = opts.title || t('seo.title');
    input.value = url;
    if (hint) {
      hint.textContent = opts.hint || t(opts.hintKey || 'share.modalHint');
    }
    renderShareSocial(url, title);
    modal.classList.remove('hidden');
    if (nativeBtn) {
      nativeBtn.hidden = !(navigator.share && typeof navigator.share === 'function');
    }
    setTimeout(function () { input.focus(); input.select(); }, 30);
    return Promise.resolve(url);
  }

  function shareUrlFlow(getUrlPromise, opts) {
    opts = opts || {};
    return Promise.resolve(getUrlPromise).then(function (url) {
      if (!url) throw new Error('no_url');
      opts.url = url;
      if (window.ACXSEO && navigator.share && opts.tryNative !== false) {
        return window.ACXSEO.nativeShare({
          title: opts.title || t('seo.title'),
          text: opts.description || opts.title || '',
          url: url
        }).catch(function (err) {
          if (err && err.name === 'AbortError') return url;
          return openShareModal(opts);
        });
      }
      return openShareModal(opts);
    });
  }

  function shareChat() {
    var id = chatPathId();
    if (!id) return;
    if (state.guest) {
      shareUrlFlow(Promise.resolve(location.origin + localizedPath('/c/' + encodeURIComponent(id))), {
        title: state.chatTitle || t('hist.chat'),
        hintKey: 'share.modalHintGuest',
        tryNative: false
      }).then(function () {
        toast(t('toast.linkCopiedLocal'));
      }).catch(function () { toast(t('toast.copyFail'), true); });
      return;
    }
    shareUrlFlow(
      chatAction('share_link', { conversation_id: state.conversationId }).then(function (j) {
        if (!j.success) throw new Error(j.error || 'Ошибка');
        return j.share_url || j.owner_url;
      }),
      {
        title: state.chatTitle || t('hist.chat'),
        hintKey: 'share.modalHintChat',
        description: t('seo.shareChatDesc', { title: state.chatTitle || t('hist.chat') })
      }
    ).catch(function (e) { toast(e.message || t('toast.error'), true); });
  }

  // Новый чат в сайдбаре сразу, не дожидаясь перезагрузки.
  function noteLiveChat() {
    var id = state.guest ? state.localId : state.conversationId;
    if (!id) return;
    var groups = state.historyGroups || {};
    var keys = Object.keys(groups);
    var found = null;
    keys.forEach(function (g) {
      (groups[g] || []).forEach(function (c) {
        var cid = state.guest ? c.local_id : Number(c.id);
        if (String(cid) === String(id)) found = c;
      });
    });
    if (found) {
      if (state.chatTitle && found.title !== state.chatTitle) {
        found.title = state.chatTitle;
        renderHistory();
      }
      return;
    }
    var head = keys[0] || t('hist.today');
    if (!groups[head]) groups[head] = [];
    var row = state.guest
      ? { local_id: state.localId, title: state.chatTitle || t('chat.new') }
      : { id: state.conversationId, title: state.chatTitle || t('chat.new'), is_pinned: 0 };
    groups[head].unshift(row);
    state.historyGroups = groups;
    renderHistory();
  }

  function maybeGenerateTitle() {
    if (state.shareMode || state.titleGenPending) return;
    var userCount = state.messages.filter(function (m) { return m.role === 'user'; }).length;
    var asstCount = state.messages.filter(function (m) { return m.role === 'assistant'; }).length;
    if (userCount !== 1 || asstCount < 1) return;
    var id = chatPathId();
    if (!id) return;
    state.titleGenPending = true;
    var payload = state.guest
      ? { local_id: id }
      : { conversation_id: state.conversationId };
    var ask = function (left) {
      chatAction('generate_title', payload).then(function (j) {
        if (j && j.success && j.error === undefined && j.title) {
          state.titleGenPending = false;
          if (!j.skipped) {
            state.chatTitle = j.title;
            updateChatTitleBar();
            document.title = j.title + ' · BEAM AGENT';
            noteLiveChat();
          }
          return;
        }
        if (left > 0) setTimeout(function () { ask(left - 1); }, 700);
        else state.titleGenPending = false;
      }).catch(function () {
        if (left > 0) setTimeout(function () { ask(left - 1); }, 700);
        else state.titleGenPending = false;
      });
    };
    ask(4);
  }

  function pdfPipelineSteps() {
    return [
      { key: 'upload', label: t('pdf.step.upload') },
      { key: 'engine', label: t('pdf.step.engine') },
      { key: 'layout', label: t('pdf.step.layout') },
      { key: 'tables', label: t('pdf.step.tables') },
      { key: 'images', label: t('pdf.step.images') },
      { key: 'done', label: t('pdf.step.done') }
    ];
  }

  function revokePdfPreviewBlob() {
    if (state.pdfPreviewBlob) {
      try { URL.revokeObjectURL(state.pdfPreviewBlob); } catch (e) {}
      state.pdfPreviewBlob = null;
    }
  }

  function setPdfPreviewBlob(file) {
    revokePdfPreviewBlob();
    if (file && ((file.type || '').indexOf('pdf') >= 0 || /\.pdf$/i.test(file.name || ''))) {
      state.pdfPreviewBlob = URL.createObjectURL(file);
    }
  }

  function findPdfAttachment() {
    for (var i = 0; i < state.attachments.length; i++) {
      if (state.attachments[i].kind === 'pdf') return state.attachments[i];
    }
    return null;
  }

  function pdfPreviewSrc(att) {
    if (att && att.preview_url) return att.preview_url + '#view=FitH&toolbar=0&navpanes=0';
    if (state.pdfPreviewBlob) return state.pdfPreviewBlob + '#view=FitH&toolbar=0&navpanes=0';
    return '';
  }

  var PDF_MIN_TEXT = 80;
  var pdfJsReady = null;

  function ensurePdfJs() {
    if (pdfJsReady) return pdfJsReady;
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfJsReady = Promise.resolve(window.pdfjsLib);
      return pdfJsReady;
    }
    pdfJsReady = Promise.reject(new Error('pdfjs_missing'));
    return pdfJsReady;
  }

  function pdfNeedsVisionPages(att) {
    if (!att || att.kind !== 'pdf') return false;
    if (att.extract_status === 'pending' || att.extract_status === 'processing') return false;
    return ((att.text || '').trim().length < PDF_MIN_TEXT);
  }

  function renderPdfPageImage(pdf, pageNum) {
    return pdf.getPage(pageNum).then(function (page) {
      var viewport = page.getViewport({ scale: 1.45 });
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
        return canvas.toDataURL('image/jpeg', 0.82);
      });
    });
  }

  function exportPdfPagesForVision(att, maxPages) {
    maxPages = maxPages || 5;
    return ensurePdfJs().then(function (pdfjsLib) {
      var src = att.preview_url || state.pdfPreviewBlob;
      if (!src) return [];
      return pdfjsLib.getDocument({ url: src, withCredentials: !!att.preview_url }).promise.then(function (pdf) {
        var total = Math.min(maxPages, pdf.numPages || 1);
        var jobs = [];
        for (var p = 1; p <= total; p++) jobs.push(renderPdfPageImage(pdf, p));
        return Promise.all(jobs);
      });
    });
  }

  function prepareAttachmentsForSend(list) {
    var jobs = list.map(function (a) {
      if (!pdfNeedsVisionPages(a)) return Promise.resolve([a]);
      return exportPdfPagesForVision(a, 5).then(function (pages) {
        if (!pages || !pages.length) return [a];
        var out = [a];
        pages.forEach(function (dataUri, i) {
          out.push({
            name: (a.name || 'document.pdf') + ' \u00b7 p.' + (i + 1),
            kind: 'image',
            is_image: true,
            vision_inline: true,
            from_pdf: true,
            data_uri: dataUri
          });
        });
        return out;
      }).catch(function () { return [a]; });
    });
    return Promise.all(jobs).then(function (chunks) {
      var merged = [];
      chunks.forEach(function (chunk) { merged = merged.concat(chunk); });
      return merged;
    });
  }

  function resolveSendMode(prepared, fallback) {
    if (!prepared || !prepared.length) {
      if (fallback === 'documents' || fallback === 'image') return 'chat';
      return fallback || 'chat';
    }
    if (prepared.some(function (a) { return a.from_pdf && a.is_image; })) return 'image';
    if (prepared.some(function (a) {
      return a.kind === 'pdf' || a.kind === 'docx' || a.kind === 'html' ||
        (a.kind === 'text' && !a.is_image);
    })) {
      return fallback === 'chat' ? 'documents' : fallback;
    }
    if (prepared.some(function (a) { return a.is_image; })) return 'image';
    return fallback || 'chat';
  }

  function syncComposerModeFromAttachments() {
    if (!state.attachments.length) {
      if (state.mode === 'documents' || state.mode === 'image') {
        state.mode = 'chat';
        syncModeTags();
      }
      return;
    }
    var hasImage = state.attachments.some(function (a) { return a.is_image; });
    var hasDoc = state.attachments.some(function (a) { return !a.is_image; });
    if (hasDoc && !hasImage && state.mode === 'chat') {
      state.mode = 'documents';
      syncModeTags();
    } else if (hasImage && !hasDoc && state.mode === 'chat') {
      state.mode = 'image';
      syncModeTags();
    }
  }

  function pdfStageRank(stage) {
    var order = ['upload', 'prepare', 'start', 'engine', 'layout', 'structure', 'tables', 'ocr', 'images', 'fallback', 'done'];
    var i = order.indexOf(stage || '');
    return i >= 0 ? i : 0;
  }

  function attachmentsExtracting() {
    return state.attachments.some(function (a) {
      if (a._uploading || a._ocrPending) return true;
      return a.kind === 'pdf' && (a.extract_status === 'pending' || a.extract_status === 'processing');
    });
  }

  function pdfAttachmentSendBlocked() {
    for (var i = 0; i < state.attachments.length; i++) {
      var a = state.attachments[i];
      if (a.kind === 'pdf' && a.extract_status === 'failed') return 'toast.pdfExtractFailed';
    }
    return null;
  }

  function preparedHasDocContent(prepared, sendMode) {
    if (!prepared || !prepared.length) return true;
    if (sendMode === 'image') {
      return prepared.some(function (a) {
        if (a.is_image && (a.data_uri || a.vision_inline || a.id)) return true;
        return a.kind === 'pdf' && a.id;
      });
    }
    if (sendMode === 'documents') {
      return prepared.some(function (a) {
        if (a.is_image) return false;
        if (a.kind !== 'pdf') return true;
        return ((a.text || '').trim().length >= PDF_MIN_TEXT) || !!a.id;
      });
    }
    return true;
  }

  function renderPdfAnalysisPanel() {
    var panel = $('pdfAnalysis');
    if (!panel) return;
    var pdfAtt = findPdfAttachment();
    var previewSrc = pdfPreviewSrc(pdfAtt);
    if (!pdfAtt && !previewSrc) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    var name = (pdfAtt && pdfAtt.name) || 'document.pdf';
    var prog = (pdfAtt && pdfAtt.extract_progress) || { stage: 'upload', pct: 0, label: t('pdf.extracting') };
    var stage = prog.stage || 'engine';
    var status = pdfAtt ? pdfAtt.extract_status : 'pending';
    var isBusy = status === 'pending' || status === 'processing';
    var isFailed = status === 'failed';
    var isDone = status === 'done';
    var stepsHtml = pdfPipelineSteps().map(function (step) {
      var cls = '';
      if (step.key === 'done') cls = stage === 'done' || isDone ? 'is-done' : '';
      else if (step.key === 'upload') cls = 'is-done';
      else if (stage === 'done' || isDone) cls = 'is-done';
      else if (step.key === stage || (step.key === 'tables' && (stage === 'ocr' || stage === 'structure' || stage === 'fallback'))) cls = 'is-active';
      else if (pdfStageRank(stage) > pdfStageRank(step.key === 'tables' ? 'tables' : step.key)) cls = 'is-done';
      return '<li class="' + cls + '">' + A.esc(step.label) + '</li>';
    }).join('');
    var pct = isDone ? 100 : Math.max(0, Math.min(100, prog.pct || 0));
    var title = isDone ? t('pdf.ready') : (isFailed ? t('toast.pdfErr') : t('pdf.analyzing'));
    var meta;
    if (isDone && pdfAtt && pdfAtt.extract_meta && pdfAtt.extract_meta.pages) {
      meta = t('pdf.pages', { n: pdfAtt.extract_meta.pages });
    } else if (isDone) {
      meta = t('pdf.ready');
    } else {
      meta = A.esc(prog.label || t('pdf.extracting'));
    }
    var previewHtml = previewSrc
      ? '<div class="c-pdf-preview"><iframe src="' + A.esc(previewSrc) + '" title="' + A.esc(t('pdf.preview')) + '" loading="lazy"></iframe></div>'
      : '<div class="c-pdf-preview c-pdf-preview--empty"><span class="c-file-ic">' + A.icon('file', 36) + '</span></div>';
    var retryHtml = isFailed && pdfAtt
      ? '<button type="button" class="c-pdf-retry" id="pdfRetryBtn">' + A.esc(t('pdf.retry')) + '</button>'
      : '';
    panel.innerHTML =
      '<div class="c-pdf-analysis-layout">' +
      previewHtml +
      '<div class="c-pdf-analysis-info">' +
      '<div class="c-pdf-analysis-head"><b>' + A.esc(title) + ' · ' + A.esc(name) + '</b>' +
      '<span>' + pct + '%</span></div>' +
      '<ul class="c-pdf-analysis-steps">' + stepsHtml + '</ul>' +
      '<div class="c-pdf-analysis-meta">' + meta + '</div>' +
      retryHtml +
      '</div></div>';
    var retryBtn = $('pdfRetryBtn');
    if (retryBtn && pdfAtt) {
      retryBtn.addEventListener('click', function () {
        var idx = state.attachments.indexOf(pdfAtt);
        if (idx < 0) return;
        mergeAttachment(idx, { extract_status: 'pending', extract_progress: { stage: 'engine', pct: 4, label: t('pdf.startEngine') } });
        startPdfExtraction(state.attachments[idx], idx);
      });
    }
  }

  function mergeAttachment(idx, patch) {
    if (!state.attachments[idx]) return;
    state.attachments[idx] = Object.assign({}, state.attachments[idx], patch);
  }

  function startPdfExtraction(att, idx) {
    if (!att || !att.id || att.kind !== 'pdf') return;
    if (att.extract_status === 'done') return;
    if (state.pdfExtractors[att.id]) return;
    mergeAttachment(idx, { extract_status: 'processing', extract_progress: { stage: 'engine', pct: 8, label: t('pdf.startEngine') } });
    renderAttachRow();
    renderPdfAnalysisPanel();
    state.pdfExtractors[att.id] = A.API.extractPdf(att.id, {
      onProgress: function (p) {
        mergeAttachment(idx, {
          extract_status: 'processing',
          extract_progress: { stage: p.stage || 'engine', pct: p.pct || 0, label: p.label || t('pdf.extracting') }
        });
        renderAttachRow();
        renderPdfAnalysisPanel();
      },
      onDone: function (payload) {
        delete state.pdfExtractors[att.id];
        if (!payload.success || !payload.attachment) {
          mergeAttachment(idx, { extract_status: 'failed', extract_progress: { stage: 'done', pct: 100, label: 'Ошибка анализа' } });
          toast(t('toast.pdfFail'), true);
        } else {
          var a = payload.attachment;
          mergeAttachment(idx, {
            text: a.text || '',
            warning: a.warning || null,
            extract_status: 'done',
            extract_engine: a.extract_engine || null,
            extract_meta: a.extract_meta || {},
            extract_progress: { stage: 'done', pct: 100, label: t('pdf.ready') }
          });
          if (a.warning) toast(a.warning);
          else toast(t('toast.pdfDone'));
          maybeRunPdfOcr(idx);
        }
        renderAttachRow();
        renderPdfAnalysisPanel();
        updateSend();
      },
      onError: function () {
        delete state.pdfExtractors[att.id];
        mergeAttachment(idx, { extract_status: 'failed', extract_progress: { stage: 'done', pct: 100, label: 'Ошибка' } });
        renderAttachRow();
        renderPdfAnalysisPanel();
        updateSend();
        toast(t('toast.pdfErr'), true);
      }
    });
  }

  function maybeRunPdfOcr(idx) {
    var att = state.attachments[idx];
    if (!att || att.kind !== 'pdf' || !window.ACXPdfOcr) return;
    if (!window.ACXPdfOcr.isSparseText(att.text)) return;
    mergeAttachment(idx, {
      _ocrPending: true,
      extract_progress: { stage: 'ocr', pct: 6, label: t('pdf.ocrStart') }
    });
    renderPdfAnalysisPanel();
    window.ACXPdfOcr.extractFromAttachment(att, function (p) {
      mergeAttachment(idx, {
        extract_progress: {
          stage: p.stage || 'ocr',
          pct: p.pct || 0,
          label: p.label || t('pdf.ocrStart')
        }
      });
      renderPdfAnalysisPanel();
    }).then(function (res) {
      if (!res || !res.text) {
        mergeAttachment(idx, { _ocrPending: false });
        updateSend();
        return;
      }
      var cur = state.attachments[idx];
      mergeAttachment(idx, {
        _ocrPending: false,
        text: res.text,
        extract_engine: res.engine || 'tesseract',
        extract_meta: Object.assign({}, (cur && cur.extract_meta) || {}, { pages: res.pages || 0, ocr: true }),
        extract_progress: { stage: 'done', pct: 100, label: t('pdf.ocrDone') }
      });
      toast(t('pdf.ocrDone'));
      renderAttachRow();
      renderPdfAnalysisPanel();
      updateSend();
    }).catch(function () {
      mergeAttachment(idx, { _ocrPending: false });
      updateSend();
    });
  }

  function maxAttachments() {
    var lim = state.boot && state.boot.data && state.boot.data.attachment_limits;
    return (lim && lim.max_per_conversation) || 10;
  }

  function chatAction(action, payload) {
    return A.API.chatPost(Object.assign({ action: action }, payload || {}));
  }

  function toast(msg, err) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!err);
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  var deleteModalResolve = null;

  function openDeleteChatModal(title) {
    return new Promise(function (resolve) {
      var modal = $('deleteChatModal');
      var text = $('deleteChatText');
      if (!modal) {
        resolve(window.confirm(t('delete.title') + '\n\n' + t('delete.body')));
        return;
      }
      if (text) {
        text.textContent = title
          ? t('delete.body') + ' «' + title + '»'
          : t('delete.body');
      }
      deleteModalResolve = resolve;
      modal.classList.remove('hidden');
    });
  }

  function closeDeleteChatModal(result) {
    var modal = $('deleteChatModal');
    if (modal) modal.classList.add('hidden');
    if (deleteModalResolve) {
      deleteModalResolve(!!result);
      deleteModalResolve = null;
    }
  }

  var inputModalResolve = null;

  function openInputModal(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var modal = $('inputModal');
      var titleEl = $('inputModalTitle');
      var hintEl = $('inputModalHint');
      var field = $('inputModalField');
      var confirmBtn = $('inputModalConfirm');
      if (!modal || !field) {
        resolve(window.prompt(opts.title || '', opts.value || ''));
        return;
      }
      if (titleEl) titleEl.textContent = opts.title || '';
      if (hintEl) {
        if (opts.hint) {
          hintEl.textContent = opts.hint;
          hintEl.hidden = false;
        } else {
          hintEl.hidden = true;
        }
      }
      field.value = opts.value || '';
      field.rows = opts.multiline === false ? 1 : (opts.rows || 4);
      if (confirmBtn) confirmBtn.textContent = opts.confirmLabel || t('inputModal.save');
      inputModalResolve = resolve;
      modal.classList.remove('hidden');
      setTimeout(function () {
        field.focus();
        field.select();
      }, 30);
    });
  }

  function closeInputModal(result) {
    var modal = $('inputModal');
    if (modal) modal.classList.add('hidden');
    if (inputModalResolve) {
      inputModalResolve(result === undefined ? null : result);
      inputModalResolve = null;
    }
  }

  function bindInputModal() {
    var modal = $('inputModal');
    var field = $('inputModalField');
    var confirmBtn = $('inputModalConfirm');
    var cancelBtn = $('inputModalCancel');
    if (!modal || modal._bound) return;
    modal._bound = true;
    function submitInput() {
      if (!field) return;
      var val = field.value.trim();
      if (!val) return;
      closeInputModal(val);
    }
    if (confirmBtn) confirmBtn.addEventListener('click', submitInput);
    if (cancelBtn) cancelBtn.addEventListener('click', function () { closeInputModal(null); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeInputModal(null);
    });
    if (field) {
      field.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (field.rows === 1 || e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submitInput();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeInputModal(null);
        }
      });
    }
  }
  bindInputModal();

  function updateEphemeralUI() {
    var banner = $('ephemeralBanner');
    var tempBtn = $('newTempChat');
    var root = document.querySelector('.c-root');
    var show = !!(state.ephemeral || state.ephemeralPending);
    if (banner) {
      banner.hidden = !show;
      var ic = banner.querySelector('.ic');
      if (ic) ic.innerHTML = A.icon('incognito', 14);
      if (show && !banner.querySelector('.c-ephemeral-save')) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'c-ephemeral-save';
        btn.textContent = t('chat.saveEphemeral');
        btn.addEventListener('click', saveEphemeralChat);
        banner.appendChild(btn);
      }
      var saveBtn = banner.querySelector('.c-ephemeral-save');
      if (saveBtn) saveBtn.hidden = !state.ephemeral || state.guest || !state.conversationId;
    }
    if (tempBtn) tempBtn.classList.toggle('on', show);
    if (root) root.classList.toggle('is-ephemeral', show);
  }

  function saveEphemeralChat() {
    if (!state.conversationId || state.guest) return;
    A.API.chatAction({ action: 'save_ephemeral', conversation_id: state.conversationId, title: state.chatTitle || t('chat.new') })
      .then(function (j) {
        if (!j.success) { toast(j.error || t('toast.error'), true); return; }
        state.ephemeral = false;
        state.ephemeralPending = false;
        updateEphemeralUI();
        toast(t('toast.ephemeralSaved'));
        loadHistoryList(true);
        syncChatUrl(true);
      });
  }

  function purgeEphemeralChat() {
    if (!state.ephemeral) {
      state.ephemeralPending = false;
      updateEphemeralUI();
      return Promise.resolve();
    }
    var convId = state.conversationId;
    var localId = state.localId;
    var wasGuest = state.guest;
    state.ephemeral = false;
    state.ephemeralPending = false;
    updateEphemeralUI();
    if (!convId && !localId) return Promise.resolve();
    var act = wasGuest && localId
      ? chatAction('guest_delete', { local_id: localId })
      : convId
        ? chatAction('delete', { conversation_id: convId })
        : Promise.resolve({ success: true });
    return act.catch(function () { return { success: false }; });
  }

  /* chrome */
  $('newChat').innerHTML = A.icon('plus', 18);
  var tempChatBtn = $('newTempChat');
  if (tempChatBtn) tempChatBtn.innerHTML = A.icon('incognito', 18);
  $('newChatTop').innerHTML = A.icon('plus', 16) + ' <span class="tx">' + t('top.new') + '</span>';
  $('sideSearchBtn').innerHTML = A.icon('search', 18);
  $('sideSettingsBtn').innerHTML = A.icon('settings', 18);
  $('sideSearchClear').innerHTML = A.icon('x', 16);
  document.querySelectorAll('#sideSettingsMenu .c-side-menu-item .ic').forEach(function (el, i) {
    var icons = ['spark', 'globe', 'external', 'download', 'file', 'layers', 'layers'];
    el.innerHTML = A.icon(icons[i] || 'external', 15);
  });
  $('sideClose').innerHTML = A.icon('x', 18);
  $('sideCollapse').innerHTML = A.icon('sidebarClose', 18);
  $('sideExpand').innerHTML = A.icon('sidebarOpen', 20);
  $('burger').innerHTML = A.icon('menu', 22);
  $('send').innerHTML = A.icon('send', 19);
  $('attachBtn').innerHTML = A.icon('plus', 20);
  var exportBtn = $('exportChatBtn');
  if (exportBtn) {
    var exportIc = exportBtn.querySelector('.ic');
    if (exportIc) exportIc.innerHTML = A.icon('download', 15);
    exportBtn.addEventListener('click', function () {
      $('sideSettingsMenu').hidden = true;
      exportChatMarkdown();
    });
  }
  var exportPdfBtn = $('exportChatPdfBtn');
  if (exportPdfBtn) {
    var exportPdfIc = exportPdfBtn.querySelector('.ic');
    if (exportPdfIc) exportPdfIc.innerHTML = A.icon('file', 15);
    exportPdfBtn.addEventListener('click', function () {
      $('sideSettingsMenu').hidden = true;
      exportChatPdf();
    });
  }
  var exportZipBtn = $('exportArtifactsBtn');
  if (exportZipBtn) {
    var exportZipIc = exportZipBtn.querySelector('.ic');
    if (exportZipIc) exportZipIc.innerHTML = A.icon('layers', 15);
    exportZipBtn.addEventListener('click', function () {
      $('sideSettingsMenu').hidden = true;
      exportChatArtifactsZip();
    });
  }

  var rpClose = $('researchPanelClose');
  if (rpClose) {
    rpClose.innerHTML = A.icon('close', 20);
    rpClose.addEventListener('click', function () { closeResearchPanel(true); });
  }
  var rpWide = $('researchPanelWide');
  if (rpWide) rpWide.addEventListener('click', toggleResearchPanelWide);
  var rpShare = $('researchPanelShare');
  if (rpShare) {
    rpShare.addEventListener('click', function () {
      shareResearchReport().catch(function () { toast(t('toast.error'), true); });
    });
  }
  var rpContinue = $('researchContinueBtn');
  if (rpContinue) rpContinue.addEventListener('click', continueResearchReport);
  var rpToc = $('researchPanelToc');
  if (rpToc && !rpToc._bound) {
    rpToc._bound = true;
    rpToc.addEventListener('click', scrollResearchToc);
  }
  function researchExportBadge(type) {
    if (type === 'txt') {
      return '<span class="c-export-badge c-export-badge--txt" aria-hidden="true">TXT</span>';
    }
    if (type === 'md') {
      return '<span class="c-export-badge c-export-badge--md" aria-hidden="true">MD</span>';
    }
    if (type === 'pdf') {
      return '<span class="c-export-badge c-export-badge--pdf" aria-hidden="true">PDF</span>';
    }
    if (type === 'docx') {
      return '<span class="c-export-badge c-export-badge--word" aria-hidden="true">' +
        '<svg viewBox="0 0 20 20" width="20" height="20" role="img" aria-label="Word">' +
        '<rect x="0" y="0" width="20" height="20" rx="2.5" fill="#185ABD"/>' +
        '<text x="10" y="14.2" text-anchor="middle" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="700">W</text>' +
        '</svg></span>';
    }
    return A.icon('download', 18);
  }

  var rpExportMd = $('researchExportMd');
  var rpExportPdf = $('researchExportPdf');
  var rpExportTxt = $('researchExportTxt');
  var rpExportDocx = $('researchExportDocx');
  if (rpExportMd) rpExportMd.innerHTML = researchExportBadge('md');
  if (rpExportPdf) rpExportPdf.innerHTML = researchExportBadge('pdf');
  if (rpExportTxt) rpExportTxt.innerHTML = researchExportBadge('txt');
  if (rpExportDocx) rpExportDocx.innerHTML = researchExportBadge('docx');
  syncResearchPanelChrome();
  var rpScrim = $('researchPanelScrim');
  if (rpScrim) rpScrim.addEventListener('click', function () { closeResearchPanel(true); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.researchPanelOpen) closeResearchPanel(true);
  });

  function sourceDomain(s) {
    if (s.domain) return s.domain;
    try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function sourceFaviconUrl(domain) {
    if (!domain) return '';
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=32';
  }

  function researchEtaText(data) {
    if (!data || data.phase !== 'collecting' || !data.collectStarted) return '';
    var elapsed = Date.now() - data.collectStarted;
    var remain = Math.max(8000, 110000 - elapsed);
    var sec = Math.ceil(remain / 1000);
    if (sec > 75) return t('research.etaMin', { n: Math.max(1, Math.ceil(sec / 60)) });
    return t('research.etaSec', { n: sec });
  }

  function maybeNotifyResearchDone(title) {
    if (document.visibilityState === 'visible') return;
    if (!('Notification' in window)) return;
    var body = t('research.notifyBody');
    if (Notification.permission === 'granted') {
      try {
        new Notification(title || 'Beam Agent', { body: body, icon: '/agent-icon.png' });
      } catch (e) {}
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  function scrollResearchToc() {
    var nav = document.getElementById('researchPanelTocNav');
    var scrollEl = $('researchPanelScroll');
    if (!nav || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, nav.offsetTop - 16), behavior: 'smooth' });
  }

  function researchShortTitle(q) {
    q = String(q || '').trim();
    if (q.length > 72) q = q.slice(0, 69) + '…';
    return t('research.title', { q: q || t('mode.research') });
  }

  function formatResearchTime(d) {
    try {
      return (d || new Date()).toLocaleString(uiLang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function researchStepHtml(num, iconName, title, desc, withBody) {
    var body = withBody && desc
      ? '<div class="c-research-step-body">' +
          '<div class="c-research-bullets" data-collapsed="true">' + A.esc(desc) + '</div>' +
          '<button type="button" class="c-research-more">' + A.esc(t('research.more')) + '</button>' +
        '</div>'
      : '<div class="c-research-step-body c-research-step-body--empty"></div>';
    return '<div class="c-research-step" data-step="' + num + '">' +
      '<div class="c-research-step-head">' +
      '<span class="c-research-step-ic">' + A.icon(iconName, 20) + '</span>' +
      '<span class="c-research-step-name">' + A.esc(title) + '</span>' +
      '<span class="c-research-step-dot" aria-hidden="true"></span>' +
      '</div>' + body + '</div>';
  }

  function setResearchPhase(widget, phase) {
    if (!widget) return;
    phase = Math.max(1, Math.min(3, phase));
    widget.dataset.phase = String(phase);
    widget.querySelectorAll('.c-research-step').forEach(function (step) {
      var n = Number(step.dataset.step);
      step.classList.toggle('is-done', n < phase);
      step.classList.toggle('is-active', n === phase);
    });
  }

  function createResearchWidget(query) {
    var q = String(query || '').trim();
    var bullets = [1, 2, 3, 4, 5].map(function (n) {
      return t('research.bullet' + n, { q: q || '…' });
    }).join('\n');
    var el = document.createElement('div');
    el.className = 'c-research is-active';
    el.dataset.phase = '1';
    el.innerHTML =
      '<div class="c-research-panel">' +
      '<h3 class="c-research-title">' + A.esc(researchShortTitle(q)) + '</h3>' +
      '<div class="c-research-steps">' +
      researchStepHtml(1, 'search', t('research.stepSearch'), bullets, true) +
      researchStepHtml(2, 'layers', t('research.stepAnalyze'), '', false) +
      researchStepHtml(3, 'globe', t('research.stepReport'), '', false) +
      '</div>' +
      '<div class="c-research-eta">' +
      '<span class="c-research-eta-ic">' + A.icon('search', 18) + '</span>' +
      '<span class="c-research-eta-tx">' + A.esc(t('research.eta')) + '</span>' +
      '</div>' +
      '<div class="c-research-log" hidden></div>' +
      '<div class="c-research-skeleton" hidden></div>' +
      '<div class="c-research-open-hint">' + A.icon('external', 14) + ' ' + A.esc(t('research.openPanel')) + '</div>' +
      '</div>';
    var moreBtn = el.querySelector('.c-research-more');
    var bulletsEl = el.querySelector('.c-research-bullets');
    if (moreBtn && bulletsEl) {
      moreBtn.addEventListener('click', function () {
        var collapsed = bulletsEl.dataset.collapsed === 'true';
        bulletsEl.dataset.collapsed = collapsed ? 'false' : 'true';
        bulletsEl.classList.toggle('is-expanded', collapsed);
        moreBtn.textContent = collapsed ? t('research.less') : t('research.more');
      });
    }
    setResearchPhase(el, 1);
    return el;
  }

  function updateResearchProgress(widget, progress) {
    if (!widget || !progress) return;
    var etaTx = widget.querySelector('.c-research-eta-tx');
    if (etaTx && progress.message) etaTx.textContent = progress.message;
    if (progress.sources_total != null && etaTx && !progress.message) {
      etaTx.textContent = t('research.foundLive', { n: progress.sources_total });
    }
    var logEl = widget.querySelector('.c-research-log');
    if (logEl && progress.channel_log && progress.channel_log.length) {
      logEl.hidden = false;
      logEl.innerHTML = progress.channel_log.map(function (row) {
        return '<span class="c-research-log-item" data-ch="' + A.esc(row.channel || 'web') + '">' +
          A.esc(researchChannelLabel(row.channel || 'web')) +
          (row.domain ? ' · ' + A.esc(row.domain) : '') + '</span>';
      }).join('');
    }
    if (progress.type === 'step' && progress.step_id) {
      var phaseMap = { search: 1, analyze: 2, report: 3 };
      if (progress.status === 'active' && phaseMap[progress.step_id]) {
        setResearchPhase(widget, phaseMap[progress.step_id]);
      }
    }
  }

  function researchOutlineHtml(sections) {
    if (!sections || !sections.length) return '';
    return '<nav class="c-rp-artifact-outline"><h3>' + A.esc(t('research.panelOutline')) + '</h3><ol>' +
      sections.map(function (s) { return '<li>' + A.esc(s) + '</li>'; }).join('') +
      '</ol></nav>';
  }

  function applyResearchSkeleton(widget, sk) {
    if (!widget || !sk) return;
    var box = widget.querySelector('.c-research-skeleton');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<h4>' + A.esc(sk.title || '') + '</h4><p>' + A.esc(sk.intro || '') + '</p>' +
      researchOutlineHtml(sk.sections || []);
    var titleEl = widget.querySelector('.c-research-title');
    if (titleEl && sk.title) titleEl.textContent = sk.title;
    if (state.researchPanelData) {
      state.researchPanelData.skeleton = sk;
      if (state.researchPanelOpen) renderResearchPanelStreaming(state.researchPanelData);
    }
  }

  function updateResearchPanelChannels(bundle) {
    var bar = $('researchPanelChannels');
    if (!bar || !bundle) return;
    var channels = bundle.channels || [];
    if (!channels.length) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = channels.map(function (ch) {
      var n = ch.count || 0;
      var st = ch.status === 'empty' ? 'empty' : (n > 0 ? 'done' : 'wait');
      return '<div class="c-rp-ch-bar c-rp-ch-bar--' + A.esc(ch.id || 'web') + ' c-rp-ch-bar--' + st + '">' +
        '<span class="c-rp-ch-bar-label">' + A.esc(researchChannelLabel(ch.id || 'web')) + '</span>' +
        '<span class="c-rp-ch-bar-count">' + n + '</span></div>';
    }).join('');
  }

  function finishResearchWidget(widget, query) {
    if (!widget) return;
    widget.classList.remove('is-active');
    widget.classList.add('is-complete');
    widget.innerHTML =
      '<div class="c-research-card">' +
      '<span class="c-research-card-ic">' + A.icon('globe', 28) + '</span>' +
      '<div class="c-research-card-body">' +
      '<div class="c-research-card-title">' + A.esc(researchShortTitle(query)) + '</div>' +
      '<div class="c-research-card-time">' + A.esc(formatResearchTime(new Date())) + '</div>' +
      '<div class="c-research-open-hint">' + A.icon('external', 14) + ' ' + A.esc(t('research.openPanel')) + '</div>' +
      '</div></div>';
  }

  function researchChannelLabel(id) {
    return t('research.channel.' + id) || id;
  }

  function markdownToc(md) {
    var items = [];
    String(md || '').replace(/\r/g, '').split('\n').forEach(function (line) {
      var m = line.match(/^(#{1,6})\s+(.+)$/);
      if (m) items.push({ level: m[1].length, text: m[2].replace(/\*\*/g, '').replace(/\*/g, '').trim() });
    });
    return items;
  }

  function applyResearchBundleToWidget(widget, bundle) {
    if (!widget || !bundle || !bundle.steps) return;
    var stepsEl = widget.querySelector('.c-research-steps');
    if (!stepsEl) return;
    var icons = { search: 'search', analyze: 'layers', report: 'globe' };
    var stepTitles = {
      search: t('research.stepSearch'),
      analyze: t('research.stepAnalyze'),
      report: t('research.stepReport')
    };
    stepsEl.innerHTML = bundle.steps.map(function (step, i) {
      var bullets = (step.bullets || []).join('\n');
      var title = stepTitles[step.id] || step.title || '';
      return researchStepHtml(i + 1, icons[step.id] || 'search', title, bullets, bullets !== '');
    }).join('');
    var moreBtn = widget.querySelector('.c-research-more');
    var bulletsEl = widget.querySelector('.c-research-bullets');
    if (moreBtn && bulletsEl) {
      moreBtn.addEventListener('click', function () {
        var collapsed = bulletsEl.dataset.collapsed === 'true';
        bulletsEl.dataset.collapsed = collapsed ? 'false' : 'true';
        bulletsEl.classList.toggle('is-expanded', collapsed);
        moreBtn.textContent = collapsed ? t('research.less') : t('research.more');
      });
    }
    var phase = 1;
    bundle.steps.forEach(function (step, i) {
      if (step.status === 'active') phase = i + 1;
      if (step.status === 'done') phase = Math.max(phase, i + 2);
    });
    setResearchPhase(widget, Math.min(3, phase));
  }

  function researchArtifactSourcesHtml(sources, query, figureList) {
    if (!sources || !sources.length) return '';
    var figures = {};
    (figureList || []).forEach(function (fig) {
      if (fig && fig.source_url) figures[fig.source_url] = fig.url;
    });
    var cards = sources.map(function (s, i) {
      var dom = sourceDomain(s);
      var ch = s.channel || 'web';
      var thumb = figures[s.url || ''] || '';
      var thumbSrc = thumb && A.imgProxy ? A.imgProxy(thumb) : thumb;
      return '<a class="c-rp-artifact-source" href="' + A.esc(s.url || '#') + '" target="_blank" rel="noreferrer">' +
        (thumb
          ? '<span class="c-rp-artifact-source-thumb"><img src="' + A.esc(thumbSrc) + '" alt="" loading="lazy"></span>'
          : '<span class="c-rp-artifact-source-num">' + (i + 1) + '</span>') +
        '<span class="c-rp-artifact-source-body">' +
        '<span class="c-rp-artifact-source-meta">' + A.esc(dom) + ' · ' + A.esc(researchChannelLabel(ch)) + '</span>' +
        '<span class="c-rp-artifact-source-title">' + A.esc(s.title || dom) + '</span>' +
        (s.description ? '<span class="c-rp-artifact-source-desc">' + A.esc(s.description) + '</span>' : '') +
        '</span></a>';
    }).join('');
    return '<section class="c-rp-artifact-sources">' +
      '<h2>' + A.esc(t('research.artifactSources')) + '</h2>' +
      (query ? '<p class="c-rp-artifact-sources-lead">' + A.esc(t('research.artifactSourcesLead', { q: query })) + '</p>' : '') +
      '<div class="c-rp-artifact-sources-grid">' + cards + '</div></section>';
  }

  var RESEARCH_STREAM_OPTS = { slow: true };

  function scrollResearchPanelDown() {
    var scroll = $('researchPanelScroll');
    if (!scroll) return;
    scroll.scrollTop = scroll.scrollHeight;
  }

  function updateResearchPanelCover(data) {
    var artifact = $('researchArtifactDoc');
    if (!artifact || !data) return;
    var bundle = data.bundle || {};
    var docTitle = bundle.skeleton && bundle.skeleton.title ? bundle.skeleton.title : (bundle.title || researchShortTitle(data.query || ''));
    var h1 = artifact.querySelector('.c-rp-artifact-cover h1');
    if (h1) h1.textContent = docTitle;
    var liveBadge = artifact.querySelector('.c-rp-artifact-live');
    if (data.streaming && !liveBadge) {
      var meta = artifact.querySelector('.c-rp-artifact-meta');
      if (meta) {
        var span = document.createElement('span');
        span.className = 'c-rp-artifact-live';
        span.textContent = t('research.panelLive');
        meta.appendChild(document.createTextNode(' '));
        meta.appendChild(span);
      }
    } else if (!data.streaming && liveBadge) {
      liveBadge.remove();
    }
    var sk = artifact.querySelector('.c-rp-artifact-lead');
    if (sk && data.content) sk.remove();
  }

  function updateResearchPanelToc(content) {
    var toc = markdownToc(content);
    var artifact = $('researchArtifactDoc');
    if (!artifact) return;
    var existing = artifact.querySelector('#researchPanelTocNav');
    if (!toc.length) {
      if (existing) existing.remove();
      var tocBtn = $('researchPanelToc');
      if (tocBtn) tocBtn.hidden = true;
      return;
    }
    var tocHtml = '<nav class="c-rp-artifact-toc" id="researchPanelTocNav"><h2>' + A.esc(t('research.panelToc')) + '</h2><ul>' +
      toc.map(function (item, i) {
        return '<li class="lvl-' + item.level + '"><a href="#rp-h-' + i + '">' + A.esc(item.text) + '</a></li>';
      }).join('') + '</ul></nav>';
    if (existing) {
      existing.outerHTML = tocHtml;
    } else {
      var cover = artifact.querySelector('.c-rp-artifact-cover');
      if (cover) cover.insertAdjacentHTML('afterend', tocHtml);
    }
    var tocBtn = $('researchPanelToc');
    if (tocBtn) {
      tocBtn.hidden = false;
      tocBtn.textContent = t('research.panelToc');
    }
  }

  function ensureResearchReportContainer() {
    var artifact = $('researchArtifactDoc');
    if (!artifact) return null;
    var reportEl = $('researchPanelReport');
    if (reportEl) return reportEl;
    var waitEl = artifact.querySelector('.c-rp-report-empty');
    var sk = artifact.querySelector('.c-rp-artifact-lead');
    if (sk) sk.remove();
    reportEl = document.createElement('div');
    reportEl.id = 'researchPanelReport';
    reportEl.className = 'c-rp-artifact-body acx-md';
    if (waitEl) {
      waitEl.replaceWith(reportEl);
    } else {
      artifact.appendChild(reportEl);
    }
    return reportEl;
  }

  function renderResearchPanelStreaming(data) {
    var body = $('researchPanelBody');
    if (!body || !data) return;
    var artifact = $('researchArtifactDoc');
    if (!artifact) {
      renderResearchPanelBody(data, true);
      artifact = $('researchArtifactDoc');
    }
    if (!artifact) return;

    updateResearchPanelCover(data);
    updateResearchPanelToc(data.content || '');

    var content = data.content || '';
    var reportEl = ensureResearchReportContainer();

    if (data.error && reportEl) {
      reportEl.classList.remove('is-streaming', 'is-revealing');
      reportEl.innerHTML = '<div class="c-rp-artifact-error">' + data.error + '</div>';
      return;
    }

    if (reportEl) {
      A.syncStreamMarkdown(reportEl, content, RESEARCH_STREAM_OPTS);
      scrollResearchPanelDown();
    }

    var details = body.querySelector('.c-rp-details');
    if (!details && data.bundle) {
      renderResearchPanelDetails(data, body);
    } else if (details && data.bundle) {
      renderResearchPanelDetails(data, body);
    }
  }

  function renderResearchPanelDetails(data, body) {
    body = body || $('researchPanelBody');
    if (!body) return;
    var bundle = data.bundle || {};
    var stats = bundle.stats || {};
    var channels = bundle.channels || [];
    var steps = bundle.steps || [];
    var llms = bundle.llms || [];
    var sources = data.sources || bundle.sources || [];
    var channelLog = bundle.channel_log || [];

    var logHtml = channelLog.length
      ? '<div class="c-rp-log">' + channelLog.map(function (row) {
          return '<span class="c-research-log-item">' + A.esc(researchChannelLabel(row.channel || 'web')) +
            (row.domain ? ' · ' + A.esc(row.domain) : '') + '</span>';
        }).join('') + '</div>'
      : '';

    var statsHtml = '<div class="c-rp-stats">' +
      '<span>' + A.esc(t('research.queries', { n: stats.queries_run || 0 })) + '</span>' +
      '<span>' + A.esc(t('research.found', { n: stats.sources_total || sources.length || 0 })) + '</span>' +
      (stats.llms_found ? '<span>llms.txt × ' + stats.llms_found + '</span>' : '') +
      '</div>';

    var channelsHtml = channels.length
      ? '<section class="c-rp-section"><h3>' + A.esc(t('research.panelChannels')) + '</h3><div class="c-rp-channels">' +
        channels.map(function (ch) {
          return '<div class="c-rp-channel c-rp-channel--' + A.esc(ch.id || 'web') + '">' +
            '<span class="c-rp-channel-label">' + A.esc(researchChannelLabel(ch.id || 'web')) + '</span>' +
            '<span class="c-rp-channel-count">' + (ch.count || 0) + '</span></div>';
        }).join('') + '</div></section>'
      : '';

    var stepsHtml = steps.length
      ? '<section class="c-rp-section"><h3>' + A.esc(t('research.panelSteps')) + '</h3><div class="c-rp-steps">' +
        steps.map(function (step, i) {
          var stepTitles = { search: t('research.stepSearch'), analyze: t('research.stepAnalyze'), report: t('research.stepReport') };
          var title = stepTitles[step.id] || step.title || '';
          var bullets = (step.bullets || []).map(function (b) { return '<li>' + A.esc(b) + '</li>'; }).join('');
          return '<div class="c-rp-step">' +
            '<div class="c-rp-step-head"><span class="c-rp-step-num">' + (i + 1) + '</span><b>' + A.esc(title) + '</b></div>' +
            (bullets ? '<ul class="c-rp-step-list">' + bullets + '</ul>' : '') +
            '</div>';
        }).join('') + '</div></section>'
      : '';

    var llmsHtml = llms.length
      ? '<section class="c-rp-section"><h3>' + A.esc(t('research.panelLlms')) + '</h3>' +
        llms.map(function (doc) {
          return '<article class="c-rp-llms">' +
            '<a class="c-rp-llms-head" href="' + A.esc(doc.url || '#') + '" target="_blank" rel="noreferrer">' +
            '<img class="c-source-fav" src="' + A.esc(sourceFaviconUrl(doc.domain)) + '" alt="" width="18" height="18">' +
            '<span>' + A.esc(doc.domain) + '</span></a>' +
            '<pre class="c-rp-llms-body">' + A.esc(doc.excerpt || '') + '</pre></article>';
        }).join('') + '</section>'
      : '';

    var sourcesHtml = sources.length
      ? '<section class="c-rp-section"><h3>' + A.esc(t('research.panelSources')) + '</h3><div class="c-rp-sources">' +
        sources.map(function (s) {
          var dom = sourceDomain(s);
          var ch = s.channel || 'web';
          return '<a class="c-rp-source" href="' + A.esc(s.url || '#') + '" target="_blank" rel="noreferrer">' +
            '<img class="c-source-fav" src="' + A.esc(sourceFaviconUrl(dom)) + '" alt="" width="18" height="18">' +
            '<span class="c-rp-source-main">' +
            '<span class="c-rp-source-dom">' + A.esc(dom) + ' · ' + A.esc(researchChannelLabel(ch)) + '</span>' +
            '<span class="c-rp-source-title">' + A.esc(s.title || dom) + '</span>' +
            (s.description ? '<span class="c-rp-source-desc">' + A.esc(s.description) + '</span>' : '') +
            '</span></a>';
        }).join('') + '</div></section>'
      : '';

    var detailsInner = statsHtml + logHtml + channelsHtml + stepsHtml + llmsHtml + sourcesHtml;
    var detailsHtml = detailsInner
      ? '<details class="c-rp-details"><summary>' + A.esc(t('research.panelDetails')) + '</summary><div class="c-rp-details-body">' +
        detailsInner + '</div></details>'
      : '';

    var existing = body.querySelector('.c-rp-details');
    if (detailsHtml) {
      if (existing) existing.outerHTML = detailsHtml;
      else body.insertAdjacentHTML('beforeend', detailsHtml);
    } else if (existing) {
      existing.remove();
    }
  }

  function renderResearchPanelBody(data, forceFull) {
    var body = $('researchPanelBody');
    if (!body) return;
    data = data || {};
    if (data.streaming && !forceFull) {
      renderResearchPanelStreaming(data);
      return;
    }
    var bundle = data.bundle || {};
    var stats = bundle.stats || {};
    var channels = bundle.channels || [];
    var steps = bundle.steps || [];
    var llms = bundle.llms || [];
    var sources = data.sources || bundle.sources || [];
    var content = data.content || '';
    var toc = markdownToc(content);
    var docTitle = bundle.skeleton && bundle.skeleton.title ? bundle.skeleton.title : (bundle.title || researchShortTitle(data.query || ''));
    var generatedAt = data.generatedAt || formatResearchTime(new Date());

    var channelLog = bundle.channel_log || [];
    var logHtml = channelLog.length
      ? '<div class="c-rp-log">' + channelLog.map(function (row) {
          return '<span class="c-research-log-item">' + A.esc(researchChannelLabel(row.channel || 'web')) +
            (row.domain ? ' · ' + A.esc(row.domain) : '') + '</span>';
        }).join('') + '</div>'
      : '';

    var statsHtml = '<div class="c-rp-stats">' +
      '<span>' + A.esc(t('research.queries', { n: stats.queries_run || 0 })) + '</span>' +
      '<span>' + A.esc(t('research.found', { n: stats.sources_total || sources.length || 0 })) + '</span>' +
      (stats.llms_found ? '<span>llms.txt × ' + stats.llms_found + '</span>' : '') +
      '</div>';

    var channelsHtml = channels.length
      ? '<section class="c-rp-section"><h3>' + A.esc(t('research.panelChannels')) + '</h3><div class="c-rp-channels">' +
        channels.map(function (ch) {
          return '<div class="c-rp-channel c-rp-channel--' + A.esc(ch.id || 'web') + '">' +
            '<span class="c-rp-channel-label">' + A.esc(researchChannelLabel(ch.id || 'web')) + '</span>' +
            '<span class="c-rp-channel-count">' + (ch.count || 0) + '</span></div>';
        }).join('') + '</div></section>'
      : '';

    var stepsHtml = steps.length
      ? '<section class="c-rp-section"><h3>' + A.esc(t('research.panelSteps')) + '</h3><div class="c-rp-steps">' +
        steps.map(function (step, i) {
          var stepTitles = { search: t('research.stepSearch'), analyze: t('research.stepAnalyze'), report: t('research.stepReport') };
          var title = stepTitles[step.id] || step.title || '';
          var bullets = (step.bullets || []).map(function (b) { return '<li>' + A.esc(b) + '</li>'; }).join('');
          return '<div class="c-rp-step">' +
            '<div class="c-rp-step-head"><span class="c-rp-step-num">' + (i + 1) + '</span><b>' + A.esc(title) + '</b></div>' +
            (bullets ? '<ul class="c-rp-step-list">' + bullets + '</ul>' : '') +
            '</div>';
        }).join('') + '</div></section>'
      : '';

    var llmsHtml = llms.length
      ? '<section class="c-rp-section"><h3>' + A.esc(t('research.panelLlms')) + '</h3>' +
        llms.map(function (doc) {
          return '<article class="c-rp-llms">' +
            '<a class="c-rp-llms-head" href="' + A.esc(doc.url || '#') + '" target="_blank" rel="noreferrer">' +
            '<img class="c-source-fav" src="' + A.esc(sourceFaviconUrl(doc.domain)) + '" alt="" width="18" height="18">' +
            '<span>' + A.esc(doc.domain) + '</span></a>' +
            '<pre class="c-rp-llms-body">' + A.esc(doc.excerpt || '') + '</pre></article>';
        }).join('') + '</section>'
      : '';

    var sourcesHtml = sources.length
      ? '<section class="c-rp-section"><h3>' + A.esc(t('research.panelSources')) + '</h3><div class="c-rp-sources">' +
        sources.map(function (s) {
          var dom = sourceDomain(s);
          var ch = s.channel || 'web';
          return '<a class="c-rp-source" href="' + A.esc(s.url || '#') + '" target="_blank" rel="noreferrer">' +
            '<img class="c-source-fav" src="' + A.esc(sourceFaviconUrl(dom)) + '" alt="" width="18" height="18">' +
            '<span class="c-rp-source-main">' +
            '<span class="c-rp-source-dom">' + A.esc(dom) + ' · ' + A.esc(researchChannelLabel(ch)) + '</span>' +
            '<span class="c-rp-source-title">' + A.esc(s.title || dom) + '</span>' +
            (s.description ? '<span class="c-rp-source-desc">' + A.esc(s.description) + '</span>' : '') +
            '</span></a>';
        }).join('') + '</div></section>'
      : '';

    var tocInDoc = toc.length
      ? '<nav class="c-rp-artifact-toc" id="researchPanelTocNav"><h2>' + A.esc(t('research.panelToc')) + '</h2><ul>' +
        toc.map(function (item, i) {
          return '<li class="lvl-' + item.level + '"><a href="#rp-h-' + i + '">' + A.esc(item.text) + '</a></li>';
        }).join('') + '</ul></nav>'
      : '';

    var liveBadge = data.streaming
      ? '<span class="c-rp-artifact-live">' + A.esc(data.phase === 'collecting' ? t('research.panelCollecting') : t('research.panelLive')) + '</span>'
      : '';

    var outlineSections = (data.skeleton && data.skeleton.sections) || (bundle.outline || []);
    var skeletonBlock = data.streaming && !content && (data.skeleton || outlineSections.length)
      ? '<div class="c-research-skeleton c-rp-artifact-lead">' +
        (data.skeleton && data.skeleton.intro ? '<p>' + A.esc(data.skeleton.intro) + '</p>' : '') +
        researchOutlineHtml(outlineSections) +
        '</div>'
      : '';

    var waitBlock = !content && !data.error
      ? (data.phase === 'collecting'
        ? '<div class="c-rp-report-empty c-rp-collecting"><p class="c-rp-collecting-text">' + A.esc(t('research.panelCollecting')) +
          (researchEtaText(data) ? '<span class="c-rp-collecting-eta">' + A.esc(researchEtaText(data)) + '</span>' : '') +
          '</p><span class="acx-stream-dot" aria-hidden="true"></span></div>'
        : '<div class="c-rp-report-empty acx-stream-wait"><span class="acx-stream-dot" aria-hidden="true"></span></div>')
      : '';

    var artifactHtml = '<article class="c-rp-artifact" id="researchArtifactDoc">' +
      '<header class="c-rp-artifact-cover">' +
      '<h1>' + A.esc(docTitle) + '</h1>' +
      '<p class="c-rp-artifact-meta">' +
      A.esc(t('research.generatedAt')) + ': ' + A.esc(generatedAt) +
      (data.query ? ' · ' + A.esc(data.query) : '') +
      liveBadge +
      '</p></header>' +
      tocInDoc +
      skeletonBlock +
      (data.error
        ? '<div class="c-rp-report-empty c-rp-artifact-error">' + data.error + '</div>'
        : content
        ? '<div class="c-rp-artifact-body acx-md" id="researchPanelReport">' + A.renderMarkdown(content, { headingIds: 'rp-h' }) + '</div>' +
          (!data.streaming && sources.length ? researchArtifactSourcesHtml(sources, data.query || '', bundle.figures) : '')
        : waitBlock) +
      '</article>';

    var detailsInner = statsHtml + logHtml + channelsHtml + stepsHtml + llmsHtml + sourcesHtml;
    var detailsHtml = detailsInner
      ? '<details class="c-rp-details"><summary>' + A.esc(t('research.panelDetails')) + '</summary><div class="c-rp-details-body">' +
        detailsInner + '</div></details>'
      : '';

    body.innerHTML = artifactHtml + detailsHtml;
    var reportBody = body.querySelector('.c-rp-artifact-body');
    if (reportBody) A.enhanceMarkdown(reportBody, { static: true });

    var tocBtn = $('researchPanelToc');
    if (tocBtn) {
      tocBtn.hidden = !toc.length;
      tocBtn.textContent = t('research.panelToc');
    }
  }

  function finishResearchPanelStream(content, cb) {
    var reportEl = $('researchPanelReport');
    if (!reportEl) {
      if (cb) cb();
      return;
    }
    A.finishStreamMarkdown(reportEl, content || '', RESEARCH_STREAM_OPTS);
    setTimeout(function () {
      scrollResearchPanelDown();
      if (cb) cb();
    }, 480);
  }

  function toggleResearchPanelWide() {
    state.researchPanelWide = !state.researchPanelWide;
    localStorage.setItem('acx_rp_wide', state.researchPanelWide ? '1' : '0');
    var panel = $('researchPanel');
    if (panel) panel.classList.toggle('c-rpanel--wide', state.researchPanelWide);
    var btn = $('researchPanelWide');
    if (btn) btn.classList.toggle('is-active', state.researchPanelWide);
    setRootChatClasses();
  }

  function shareResearchReport(data) {
    data = data || state.researchPanelData;
    if (!data || !data.content) return Promise.reject();
    var bundle = data.bundle || {};
    var title = (bundle.skeleton && bundle.skeleton.title) || bundle.title || researchShortTitle(data.query || '');
    return shareUrlFlow(
      fetch('/api/research_public.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          query: data.query || '',
          content: data.content,
          sources: data.sources || bundle.sources || [],
          generated_at: data.generatedAt || new Date().toISOString()
        })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.success || !j.url) throw new Error('share_failed');
        return j.url;
      }),
      {
        title: title,
        hintKey: 'share.modalHintResearch',
        description: t('seo.researchShareDesc', { title: title })
      }
    ).then(function () {
      toast(t('research.shareOk'));
    });
  }

  function continueResearchReport() {
    var data = state.researchPanelData;
    if (!data || !data.content || state.streaming) return;
    var base = data.content;
    state.mode = 'research';
    syncModeTags();
    send(t('research.continueUser'), [], {
      researchContinue: true,
      researchBase: base,
      researchQuery: data.query || '',
      appendResearchBase: base
    });
  }

  function openResearchPanel(data) {
    data = data || state.researchPanelData;
    if (!data) return;
    state.researchPanelData = data;
    state.researchPanelOpen = true;
    var root = document.querySelector('.c-root');
    var panel = $('researchPanel');
    var scrim = $('researchPanelScrim');
    setRootChatClasses();
    if (panel) {
      panel.hidden = false;
      panel.setAttribute('aria-hidden', 'false');
      panel.classList.add('c-rpanel--doc');
      panel.classList.toggle('c-rpanel--wide', state.researchPanelWide);
      panel.classList.toggle('c-rpanel--streaming', !!data.streaming);
    }
    if (scrim) {
      scrim.hidden = false;
      scrim.setAttribute('aria-hidden', 'false');
    }
    var titleEl = $('researchPanelTitle');
    var iconEl = $('researchPanelIcon');
    if (titleEl) titleEl.textContent = (data.bundle && data.bundle.title) || researchShortTitle(data.query || '');
    if (iconEl) iconEl.innerHTML = A.icon('globe', 22);
    updateResearchPanelChannels(data.bundle);
    renderResearchPanelBody(data);
    syncResearchContinueBtn(data);
    var scroll = $('researchPanelScroll');
    if (scroll) scroll.scrollTop = 0;
    var wideBtn = $('researchPanelWide');
    if (wideBtn) {
      wideBtn.innerHTML = A.icon('external', 18);
      wideBtn.classList.toggle('is-active', state.researchPanelWide);
    }
    var shareBtn = $('researchPanelShare');
    if (shareBtn) shareBtn.innerHTML = A.icon('share', 18);
  }

  function closeResearchPanel(abortStream) {
    if (abortStream) stopGeneration();
    state.researchPanelOpen = false;
    var panel = $('researchPanel');
    var scrim = $('researchPanelScrim');
    var chBar = $('researchPanelChannels');
    var foot = $('researchPanelFoot');
    setRootChatClasses();
    if (panel) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.classList.remove('c-rpanel--doc', 'c-rpanel--streaming', 'c-rpanel--wide');
    }
    if (scrim) {
      scrim.hidden = true;
      scrim.setAttribute('aria-hidden', 'true');
    }
    if (chBar) chBar.hidden = true;
    if (foot) foot.hidden = true;
  }

  function bindResearchPanelOpen(el, getData) {
    if (!el) return;
    el.classList.add('c-research-clickable');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('title', t('research.openPanel'));
    function open() {
      var data = typeof getData === 'function' ? getData() : getData;
      if (data) openResearchPanel(data);
    }
    el.addEventListener('click', open);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  }

  function renderSourcesEl(sources) {
    if (!sources || !sources.length) return null;
    var el = document.createElement('div');
    el.className = 'c-sources';
    el.innerHTML = '<div class="c-sources-head">' + A.esc(t('sources.title')) + '</div><div class="c-sources-track">' +
      sources.map(function (s) {
        var dom = sourceDomain(s);
        var fav = sourceFaviconUrl(dom);
        var title = s.title || dom || s.url || '';
        var sub = (s.description || title || '').trim();
        if (sub.length > 52) sub = sub.slice(0, 49) + '…';
        return '<a class="c-source-chip" href="' + A.esc(s.url || '#') + '" target="_blank" rel="noreferrer" title="' + A.esc(title) + '">' +
          (fav
            ? '<img class="c-source-fav" src="' + A.esc(fav) + '" alt="" width="20" height="20" loading="lazy">'
            : '<span class="c-source-fav c-source-fav--ph">' + A.icon('globe', 16) + '</span>') +
          '<span class="c-source-chip-text">' +
          '<span class="c-source-chip-dom">' + A.esc(dom || 'web') + '</span>' +
          '<span class="c-source-chip-sub">' + A.esc(sub) + '</span>' +
          '</span></a>';
      }).join('') + '</div>';
    return el;
  }

  function attachSources(aiEl, sources) {
    if (!sources || !sources.length) return;
    var wrap = aiEl.querySelector('.c-ai-wrap');
    if (!wrap || wrap.querySelector('.c-sources')) return;
    var node = renderSourcesEl(sources);
    if (!node) return;
    var meta = wrap.querySelector('.c-ai-meta');
    if (meta) wrap.insertBefore(node, meta);
    else wrap.appendChild(node);
  }

  function revealMessageChrome(aiEl, opts) {
    if (!aiEl) return;
    opts = opts || {};
    var hideModel = !!opts.hideModel || aiEl.classList.contains('is-agent');
    var meta = aiEl.querySelector('.c-ai-meta');
    if (hideModel && meta) {
      meta.classList.add('is-hidden');
      meta.classList.remove('is-visible');
    }
    function show() {
      if (!aiEl.isConnected) return;
      aiEl.classList.add('is-msg-ready');
      aiEl.querySelectorAll('.c-actions, .c-sources').forEach(function (el) {
        el.classList.add('is-visible');
      });
      if (!hideModel && meta) {
        meta.classList.remove('is-hidden');
        meta.classList.add('is-visible');
      }
    }
    if (opts.instant) {
      show();
      return;
    }
    var delay = opts.delay != null ? opts.delay : 280;
    window.setTimeout(show, delay);
  }

  function truncateMessages(keepCount) {
    state.messages = state.messages.slice(0, keepCount);
    if (state.guest || !state.conversationId) return Promise.resolve({ success: true });
    return chatAction('truncate_messages', { conversation_id: state.conversationId, keep_count: keepCount });
  }

  function branchFromMessage(msgIndex) {
    if (state.streaming || state.shareMode) return;
    var keep = msgIndex + 1;
    if (keep <= 0 || keep > state.messages.length) return;
    if (state.guest) {
      state.messages = state.messages.slice(0, keep);
      state.localId = null;
      state.conversationId = null;
      renderThreadFromMessages();
      syncChatUrl(true);
      toast(t('toast.branchReady'));
      input.focus();
      return;
    }
    if (!state.conversationId) {
      state.messages = state.messages.slice(0, keep);
      renderThreadFromMessages();
      toast(t('toast.branchReady'));
      return;
    }
    chatAction('branch', { conversation_id: state.conversationId, keep_count: keep }).then(function (j) {
      if (!j.success) throw new Error(j.error || t('toast.error'));
      return loadThread(String(j.new_conversation_id), false, false);
    }).then(function () {
      toast(t('toast.branchOk'));
    }).catch(function (e) { toast(e.message || t('toast.error'), true); });
  }

  function editUserMessage(msgIndex) {
    if (state.streaming || state.shareMode) return;
    var m = state.messages[msgIndex];
    if (!m || m.role !== 'user') return;
    openInputModal({
      title: t('action.editPrompt'),
      value: m.content,
      rows: 5,
      confirmLabel: t('inputModal.resend')
    }).then(function (newText) {
      if (newText === null) return;
      newText = newText.trim();
      if (!newText || newText === m.content) return;
      truncateMessages(msgIndex).then(function (j) {
        if (j && j.success === false) throw new Error(j.error || t('toast.error'));
        state.messages = state.messages.slice(0, msgIndex);
        renderThreadFromMessages();
        send(newText, m.attachments || []);
      }).catch(function (e) { toast(e.message || t('toast.error'), true); });
    });
  }

  function exportChatMarkdown() {
    if (!state.messages.length) {
      toast(t('toast.exportEmpty'), true);
      return;
    }
    var title = (state.chatTitle || 'BEAM AGENT').replace(/[<>:"/\\|?*]+/g, '-').slice(0, 64);
    var lines = ['# ' + (state.chatTitle || 'BEAM AGENT'), '', '*' + t('export.from') + '*', ''];
    state.messages.forEach(function (m) {
      if (m.role === 'user') lines.push('## ' + t('export.roleUser'), '', m.content, '');
      else {
        lines.push('## ' + t('export.roleAssistant'), '', m.content, '');
        if (m.sources && m.sources.length) {
          lines.push('### ' + t('sources.title'), '');
          m.sources.forEach(function (s, i) {
            lines.push((i + 1) + '. [' + (s.title || s.url) + '](' + s.url + ')');
          });
          lines.push('');
        }
      }
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = title + '.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
    toast(t('toast.exportOk'));
  }

  function exportChatPdf() {
    if (!state.messages.length) {
      toast(t('toast.exportEmpty'), true);
      return;
    }
    if (!window.ACXExportPlus) {
      toast(t('toast.error'), true);
      return;
    }
    var title = state.chatTitle || 'BEAM AGENT';
    var parts = [];
    state.messages.forEach(function (m) {
      var body = document.createElement('div');
      if (m.role === 'assistant') A.revealMarkdown(body, m.content, { static: true });
      else body.textContent = m.content;
      parts.push('<section><h2>' + (m.role === 'user' ? t('export.roleUser') : t('export.roleAssistant')) + '</h2>' + body.innerHTML + '</section>');
    });
    window.ACXExportPlus.exportChatPdf(title, parts.join('')).then(function () {
      toast(t('toast.exportPdfOk'));
    }).catch(function () {
      toast(t('toast.exportFail'), true);
    });
  }

  function exportChatArtifactsZip() {
    if (!state.messages.length) {
      toast(t('toast.exportEmpty'), true);
      return;
    }
    if (!window.ACXExportPlus) return;
    var title = (state.chatTitle || 'assistix-chat').replace(/[<>:"/\\|?*]+/g, '-').slice(0, 48);
    window.ACXExportPlus.exportArtifactsZip(state.messages, title + '-files.zip').then(function (r) {
      if (!r || !r.ok) toast(t('toast.exportArtifactsEmpty'), true);
      else toast(t('toast.exportArtifactsOk', { n: r.count }));
    }).catch(function () { toast(t('toast.exportFail'), true); });
  }

  function stopGeneration() {
    if (!state.streaming) return;
    if (state.stream) state.stream.abort();
    state.stream = null;
    state.streaming = false;
    updateSend();
  }

  function copyMessageText(btn, aiEl, fallback) {
    var body = aiEl.querySelector('.c-ai-body');
    var text = body ? A.getMarkdownPlainText(body) : (fallback || '');
    if (!text) return;
    copyText(text).then(function () {
      btn.innerHTML = A.icon('check', 17);
      toast(t('toast.copied'));
      setTimeout(function () { btn.innerHTML = A.icon('copy', 17); }, 1200);
    }).catch(function () { toast(t('toast.copyFail'), true); });
  }

  function getModeChips() {
    return window.ACX_I18N ? window.ACX_I18N.getModeChips() : MODE_CHIPS;
  }

  var MODE_CHIPS = [
    { key: 'web', label: 'Веб', icon: 'globe', title: 'Поиск в интернете' },
    { key: 'canvas', label: 'Холст', icon: 'image', title: 'Генерация картинок · до 5/день' },
    { key: 'agent', label: 'Агент', icon: 'agent', title: 'План → действие → результат' },
    { key: 'research', label: 'Исследование', icon: 'research', title: 'Развёрнутый отчёт' },
    { key: 'reasoning', label: 'Рассуждение', icon: 'lightbulb', title: 'Мысли модели и финальный ответ' }
  ];

  function modeChipActiveKey() {
    if (state.mode === 'web' || state.mode === 'research' || state.mode === 'reasoning' || state.mode === 'agent' || state.mode === 'canvas') return state.mode;
    return '';
  }

  function setComposerMode(key) {
    if (!getModeChips().some(function (m) { return m.key === key; })) return;
    var prev = modeChipActiveKey();
    if (prev === key) {
      state.mode = 'chat';
      state.web = false;
      if (prev === 'research') closeResearchPanel(true);
    } else {
      if (prev === 'research' && key !== 'research') closeResearchPanel(true);
      state.mode = key;
      state.web = key === 'web' || key === 'agent';
    }
    syncModeTags();
    syncResearchTemplates();
  }

  var RESEARCH_TEMPLATES = [
    { key: 'bio', labelKey: 'research.tplBio', qKey: 'research.tplBioQ' },
    { key: 'market', labelKey: 'research.tplMarket', qKey: 'research.tplMarketQ' },
    { key: 'chrono', labelKey: 'research.tplChrono', qKey: 'research.tplChronoQ' },
    { key: 'long', labelKey: 'research.tplLong', qKey: 'research.tplLongQ' }
  ];

  function syncResearchTemplates() {
    var host = $('researchTemplates');
    if (!host) return;
    var show = modeChipActiveKey() === 'research' && !state.streaming;
    host.hidden = !show;
    if (!show) return;
    host.innerHTML = RESEARCH_TEMPLATES.map(function (tpl) {
      return '<button type="button" class="c-research-tpl" data-q="' + A.esc(t(tpl.qKey)) + '">' + A.esc(t(tpl.labelKey)) + '</button>';
    }).join('');
    host.querySelectorAll('.c-research-tpl').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var q = btn.getAttribute('data-q') || '';
        if (!q) return;
        input.value = q;
        autosize();
        updateSend();
        input.focus();
      });
    });
  }

  function researchLooksTruncated(content) {
    content = String(content || '').trim();
    if (content.length < 2800) return true;
    var tail = content.slice(-500).trim();
    if (/^##\s/m.test(tail)) return true;
    return !/[.!?…»"')\]]\s*$/.test(tail);
  }

  function syncResearchContinueBtn(data) {
    var foot = $('researchPanelFoot');
    var btn = $('researchContinueBtn');
    if (!foot || !btn) return;
    data = data || state.researchPanelData;
    var show = data && !data.streaming && data.content && researchLooksTruncated(data.content);
    foot.hidden = !show;
    if (show) btn.textContent = t('research.continue');
  }

  function renderModeTags() {
    var host = $('modeTags');
    if (!host) return;
    var tagsHtml = getModeChips().map(function (m) {
      var locked = isModeLocked(m.key);
      return '<button type="button" class="c-mode-tag' + (locked ? ' is-locked' : '') + '" data-mode="' + m.key + '" title="' + A.esc(locked ? t('sub.lockedMode', { plan: 'ASSISTIX PREMIER' }) : m.title) + '" aria-pressed="false">' +
        (locked ? '<span class="c-mode-lock">' + A.icon('lock', 12) + '</span>' : '') +
        '<span class="c-mode-tag-ic">' + A.icon(m.icon, 16) + '</span>' +
        '<span class="c-mode-tag-tx">' + A.esc(m.label) + '</span></button>';
    }).join('');
    host.innerHTML = '<div class="c-tool-wrap c-modes-wrap"><button type="button" class="c-tool c-modes-btn" id="modesBtn" aria-haspopup="menu" aria-expanded="false"><span class="c-modes-cur"></span><span class="c-modes-chev">' + A.icon('chevron', 14) + '</span></button><div class="c-attach-menu c-modes-menu" id="modesMenu" hidden role="menu">' + tagsHtml + '</div></div>';
    var modesBtn = $('modesBtn');
    var modesMenu = $('modesMenu');
    modesBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      modesMenu.hidden = !modesMenu.hidden;
      modesBtn.setAttribute('aria-expanded', modesMenu.hidden ? 'false' : 'true');
    });
    if (!window._acxModesDoc) {
      window._acxModesDoc = true;
      document.addEventListener('click', function () {
        var mm = $('modesMenu');
        if (mm && !mm.hidden) { mm.hidden = true; var mb = $('modesBtn'); if (mb) mb.setAttribute('aria-expanded', 'false'); }
      });
    }
    host.querySelectorAll('.c-mode-tag').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('is-locked')) {
          openSubscriptionModal(btn.getAttribute('data-mode'));
          return;
        }
        setComposerMode(btn.getAttribute('data-mode'));
      });
    });
    syncModeTags();
  }

  function syncModeTags() {
    var host = $('modeTags');
    if (!host) return;
    var active = modeChipActiveKey();
    host.querySelectorAll('.c-mode-tag').forEach(function (btn) {
      var on = btn.getAttribute('data-mode') === active;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var cur = host.querySelector('.c-modes-cur');
    if (cur) {
      var act = host.querySelector('.c-mode-tag.active');
      cur.innerHTML = act ? act.querySelector('.c-mode-tag-ic').innerHTML + '<span>' + act.querySelector('.c-mode-tag-tx').innerHTML + '</span>' : A.icon('spark', 16);
    }
    syncResearchTemplates();
  }

  function modelDotClass(key) { return A.modelClass(key); }

  function modelDotBall(key, size) {
    return '<span class="dot">' + A.modelBall(key, size || 10) + '</span>';
  }

  function modelOptionIcon(key) {
    return A.modelBall(key, 24);
  }

  function isDesktopLayout() {
    return window.matchMedia('(min-width: 881px)').matches;
  }

  function setSidebarCollapsed(collapsed) {
    var root = document.querySelector('.c-root');
    var expand = $('sideExpand');
    if (!root) return;
    if (!isDesktopLayout()) {
      root.classList.remove('sidebar-collapsed');
      if (expand) expand.hidden = true;
      return;
    }
    root.classList.toggle('sidebar-collapsed', collapsed);
    if (expand) expand.hidden = !collapsed;
    try { localStorage.setItem('acx-sidebar-collapsed', collapsed ? '1' : '0'); } catch (e) {}
  }

  function initSidebarCollapsed() {
    var collapsed = false;
    try { collapsed = localStorage.getItem('acx-sidebar-collapsed') === '1'; } catch (e) {}
    setSidebarCollapsed(collapsed);
  }

  function openSide(o) {
    if (isDesktopLayout()) return;
    if (!o) closeProfileModal();
    $('sidebar').classList.toggle('open', o);
    $('scrim').classList.toggle('open', o);
  }
  $('burger').addEventListener('click', function () { if (A.haptics) A.haptics.tap(); openSide(true); });
  $('sideClose').addEventListener('click', function () { openSide(false); });
  $('scrim').addEventListener('click', function () { openSide(false); });

  /* Свайп влево по меню закрывает его на телефоне */
  (function initSideSwipe() {
    var side = $('sidebar');
    if (!side) return;
    var startX = 0, startY = 0, dx = 0, active = false, decided = false, vertical = false;
    side.addEventListener('touchstart', function (e) {
      if (isDesktopLayout() || !side.classList.contains('open')) return;
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; active = true; decided = false; vertical = false;
      side.style.transition = 'none';
    }, { passive: true });
    side.addEventListener('touchmove', function (e) {
      if (!active || e.touches.length !== 1) return;
      dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      if (!decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        decided = true;
        vertical = Math.abs(dy) > Math.abs(dx);
      }
      if (vertical) return;
      if (dx < 0) {
        side.style.transform = 'translateX(' + Math.max(dx, -320) + 'px)';
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });
    var end = function () {
      if (!active) return;
      active = false;
      side.style.transition = '';
      side.style.transform = '';
      if (!vertical && dx < -70) {
        if (A.haptics) A.haptics.tap();
        openSide(false);
      }
      dx = 0; decided = false; vertical = false;
    };
    side.addEventListener('touchend', end, { passive: true });
    side.addEventListener('touchcancel', end, { passive: true });
  })();
  $('sideCollapse').addEventListener('click', function () { setSidebarCollapsed(true); });
  $('sideExpand').addEventListener('click', function () { setSidebarCollapsed(false); });
  initSidebarCollapsed();
  window.addEventListener('resize', function () {
    if (isDesktopLayout()) initSidebarCollapsed();
    else {
      document.querySelector('.c-root').classList.remove('sidebar-collapsed');
      $('sideExpand').hidden = true;
      openSide(false);
    }
  });

  function themeIcon() {
    var t = A.Theme.get();
    var name = t === 'dark' ? 'moon' : (t === 'light' ? 'sun' : (A.Theme.effective() === 'dark' ? 'moon' : 'sun'));
    var ic = A.icon(name, 19);
    $('themeBtn').innerHTML = ic;
    var sideTheme = $('sideThemeBtn');
    if (sideTheme) sideTheme.innerHTML = A.icon(name, 18);
  }
  function cycleTheme(ev) { if (A.haptics) A.haptics.press(); A.Theme.cycle(ev); themeIcon(); }
  $('themeBtn').addEventListener('click', cycleTheme);
  var sideThemeBtn = $('sideThemeBtn');
  if (sideThemeBtn) sideThemeBtn.addEventListener('click', cycleTheme);
  themeIcon();

  function toggleSideSearch(force) {
    var wrap = $('sideSearchWrap');
    var btn = $('sideSearchBtn');
    if (!wrap || !btn) return;
    var open = typeof force === 'boolean' ? force : wrap.hidden;
    wrap.hidden = !open;
    btn.classList.toggle('on', open);
    if (open) {
      var menu = $('sideSettingsMenu');
      var settingsBtn = $('sideSettingsBtn');
      if (menu && !menu.hidden) {
        menu.hidden = true;
        if (settingsBtn) settingsBtn.classList.remove('on');
      }
      setTimeout(function () { $('historySearch').focus(); }, 30);
    } else {
      var inp = $('historySearch');
      if (inp) inp.value = '';
      state.historyFilter = '';
      renderHistory();
    }
  }

  $('sideSearchBtn').addEventListener('click', function () { toggleSideSearch(); });
  $('sideSearchClear').addEventListener('click', function () { toggleSideSearch(false); });

  var sideSettingsBtn = $('sideSettingsBtn');
  var sideSettingsMenu = $('sideSettingsMenu');
  if (sideSettingsBtn && sideSettingsMenu) {
    sideSettingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      sideSettingsMenu.hidden = !sideSettingsMenu.hidden;
      sideSettingsBtn.classList.toggle('on', !sideSettingsMenu.hidden);
    });
    document.addEventListener('click', function (e) {
      if (!sideSettingsMenu.hidden && !sideSettingsBtn.contains(e.target) && !sideSettingsMenu.contains(e.target)) {
        sideSettingsMenu.hidden = true;
        sideSettingsBtn.classList.remove('on');
      }
    });
  }

  function modelsFromBoot() {
    if (!state.boot || !state.boot.data) return [];
    return (state.boot.data.models || []).map(function (m) {
      var key = m.key;
      return {
        key: key,
        name: key === 'GUEST' ? t('model.GUEST.name') : (m.name || key),
        tag: t('model.' + key + '.tag'),
        desc: t('model.' + key + '.desc'),
        active: true
      };
    });
  }

  function modelByKey(k) {
    var list = modelsFromBoot();
    for (var i = 0; i < list.length; i++) if (list[i].key === k) return list[i];
    return list[0] || { key: 'FLAIR', name: 'FLAIR' };
  }

  function resolveModelForSend() {
    if (state.guest) return modelByKey('GUEST');
    var requested = state.model;
    if (state.mode === 'reasoning') {
      if (isModelAvailable('PINE')) return modelByKey('PINE');
      return pickResearchFallback('PINE');
    }
    if (state.mode === 'agent') {
      if (!requested || requested === 'TIDE') return modelByKey('FLAIR');
      if (isModelAvailable(requested)) return modelByKey(requested);
      return pickResearchFallback(requested);
    }
    if (state.mode === 'research') {
      if (isModelAvailable(requested)) return modelByKey(requested);
      return pickResearchFallback(requested);
    }
    return modelByKey(requested);
  }

  function usageSnapshot() {
    return state.boot && state.boot.data && state.boot.data.usage;
  }

  function isModelAvailable(key) {
    var u = usageSnapshot();
    if (!u) return true;
    if (key === 'PINE' && u.pine) {
      var pineCap = u.pine.tokens_cap;
      if (pineCap == null) return true;
      return (u.pine.tokens_used || 0) < pineCap;
    }
    if (key === 'FLAIR' && u.flair) {
      var flairCap = u.flair.tokens_cap;
      if (flairCap == null) return true;
      return (u.flair.tokens_used || 0) < flairCap;
    }
    return true;
  }

  function pickResearchFallback(fromKey) {
    if (fromKey !== 'FLAIR' && isModelAvailable('FLAIR')) return modelByKey('FLAIR');
    return modelByKey('FLAIR');
  }

  function displayModelForSend() {
    return resolveModelForSend();
  }

  function positionComposerModelPop(btn, pop) {
    var r = btn.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.zIndex = '500';
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 308)) + 'px';
    pop.style.bottom = (window.innerHeight - r.top + 10) + 'px';
    pop.style.top = 'auto';
    pop.style.width = '300px';
  }

  function resetComposerModelPop(pop) {
    pop.style.position = '';
    pop.style.zIndex = '';
    pop.style.left = '';
    pop.style.bottom = '';
    pop.style.top = '';
    pop.style.width = '';
  }

  function buildSelector(slot) {
    var list = modelsFromBoot();
    var cur = modelByKey(state.model);
    var isComposer = slot && slot.id === 'modelSlot';
    var wrap = document.createElement('div');
    wrap.className = 'c-modelsel';
    wrap.innerHTML = '<button class="c-modelsel-btn ' + modelDotClass(cur.key) + '" type="button"><span class="dot ' + modelDotClass(cur.key) + '">' + A.modelBall(cur.key, 13) + '</span><span class="nm">' + A.esc(cur.name) + '</span><span class="chev">' + A.icon('chevron', 15) + '</span></button><div class="c-modelsel-pop acx-scroll" hidden><div class="h">' + t('model.title') + '</div>' +
      list.map(function (m) {
        var avail = isModelAvailable(m.key);
        return '<button class="c-mopt' + (m.key === state.model ? ' active' : '') + (avail ? '' : ' is-disabled') + ' ' + modelDotClass(m.key) + '" data-k="' + A.esc(m.key) + '"' +
          (avail ? '' : ' data-limit-note="' + A.esc(t('model.limitHit')) + '"') + '><span class="mic2 ' + modelDotClass(m.key) + '">' + modelOptionIcon(m.key) + '</span><span style="flex:1"><span class="nm"><b>' + A.esc(m.name) + '</b><span class="tg">' + A.esc(m.tag) + '</span></span><span class="ds">' + A.esc(m.desc) + '</span></span>' + (m.key === state.model ? '<span class="ck">' + A.icon('check', 16) + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    var btn = wrap.querySelector('.c-modelsel-btn');
    var pop = wrap.querySelector('.c-modelsel-pop');
    function closePop() {
      pop.hidden = true;
      wrap.classList.remove('open');
      if (isComposer) resetComposerModelPop(pop);
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!pop.hidden) {
        closePop();
        return;
      }
      pop.hidden = false;
      wrap.classList.add('open');
      if (isComposer) positionComposerModelPop(btn, pop);
      if (A.Scrollbars) A.Scrollbars.bind(pop);
    });
    wrap.querySelectorAll('.c-mopt').forEach(function (opt) {
      opt.addEventListener('click', function () {
        var key = opt.getAttribute('data-k');
        if (!isModelAvailable(key)) {
          toast(t('toast.modelLimit'), true);
          return;
        }
        state.model = key;
        if (!state.guest) localStorage.setItem('acx_model', state.model);
        renderSelectors();
        if (window.ACXEnhance && window.ACXEnhance.renderComposerChips) window.ACXEnhance.renderComposerChips();
      });
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) closePop(); });
    slot.innerHTML = '';
    slot.appendChild(wrap);
  }

  function renderSelectors() {
    buildSelector($('modelSlot'));
    buildSelector($('topModelSlot'));
  }

  window.addEventListener('resize', function () {
    var slot = $('modelSlot');
    if (!slot) return;
    var wrap = slot.querySelector('.c-modelsel.open');
    if (!wrap) return;
    var pop = wrap.querySelector('.c-modelsel-pop');
    var btn = wrap.querySelector('.c-modelsel-btn');
    if (pop && btn && !pop.hidden) positionComposerModelPop(btn, pop);
  });

  function userFootChevron() {
    return '<span class="c-user-foot-chevron" aria-hidden="true">' + A.icon('chevron', 16) + '</span>';
  }

  function bindUserFootButton() {
    var btn = $('userFootBtn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleProfileModal();
    });
  }

  function buildUsageRingsHtml(d) {
    if (!d) return '';
    var html = '';
    if (d.guest && d.guest_usage) {
      var g = d.guest_usage;
      html += usageRingHtml({
        label: t('usage.guestMessages'),
        valText: g.daily_user_messages + ' / ' + g.max_daily_user_messages,
        used: g.daily_user_messages,
        cap: g.max_daily_user_messages,
        color: '#6f9490',
        warn: g.daily_user_messages / g.max_daily_user_messages >= 0.75,
        hot: g.daily_user_messages >= g.max_daily_user_messages
      });
      html += usageRingHtml({
        label: t('usage.guestChats'),
        valText: g.conversation_count + ' / ' + g.max_conversations,
        used: g.conversation_count,
        cap: g.max_conversations,
        color: '#0d9488',
        warn: g.conversation_count / g.max_conversations >= 0.75,
        hot: g.conversation_count >= g.max_conversations
      });
      return html;
    }
    if (d.usage) {
      var u = d.usage;
      if (u.unlimited) {
        html += usageRingHtml({
          label: 'ASSISTIX MAX',
          valText: t('usage.unlimited'),
          used: 0,
          cap: 1,
          color: '#22c55e',
          warn: false,
          hot: false
        });
        return html;
      }
      var flairCap = u.flair.tokens_cap;
      var pineCap = u.pine.tokens_cap;
      var flairUsed = u.flair.tokens_used || 0;
      var pineUsed = u.pine.tokens_used || 0;
      html += usageRingHtml({
        label: 'FLAIR',
        valText: flairCap == null ? t('usage.unlimited') : (formatUsageNum(flairUsed) + ' / ' + formatUsageNum(flairCap) + ' ' + t('usage.tokens')),
        used: flairCap == null ? 0 : flairUsed,
        cap: flairCap == null ? 1 : flairCap,
        color: A.modelMeta('FLAIR').color,
        warn: flairCap != null && flairUsed / flairCap >= 0.75,
        hot: flairCap != null && flairUsed >= flairCap
      });
      html += usageRingHtml({
        label: 'PINE',
        valText: pineCap == null ? t('usage.unlimited') : (formatUsageNum(pineUsed) + ' / ' + formatUsageNum(pineCap) + ' ' + t('usage.requests')),
        used: pineCap == null ? 0 : pineUsed,
        cap: pineCap == null ? 1 : pineCap,
        color: A.modelMeta('PINE').color,
        warn: pineCap != null && pineUsed / pineCap >= 0.75,
        hot: pineCap != null && pineUsed >= pineCap
      });
    }
    return html;
  }

  function stripMemoryMarkers(text) {
    return (text || '').replace(/\[\[MEMORY:\s*.+?\]\]\s*/gu, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function applyMemoryEvent(payload) {
    if (!payload || !payload.ops || !payload.ops.length) return;
    if (Array.isArray(payload.memories) && state.boot && state.boot.data) {
      state.boot.data.memories = payload.memories.slice();
    }
    var added = 0, updated = 0, deleted = 0;
    payload.ops.forEach(function (op) {
      if (!op) return;
      if (op.action === 'add') added++;
      else if (op.action === 'update') updated++;
      else if (op.action === 'delete') deleted++;
    });
    var parts = [];
    if (added) parts.push(t('toast.memoryAdded', { n: added }));
    if (updated) parts.push(t('toast.memoryUpdated', { n: updated }));
    if (deleted) parts.push(t('toast.memoryDeleted', { n: deleted }));
    if (parts.length) toast(parts.join(' · '));
  }

  function stripResearchStreamContent(text) {
    var s = stripMemoryMarkers(text);
    s = s.replace(/[\s\S]*?<\/think>/gi, '');
    s = s.replace(/<\/?think>/gi, '');
    s = s.replace(/\[(?:BEGIN|END|\/think)\]/gi, '');
    s = s.replace(/^!\[[^\]]*\]\([^)\s]*$/gm, '');
    return s.replace(/\n{3,}/g, '\n\n').trim();
  }

  function researchContentTooShort(text) {
    var plain = stripResearchStreamContent(text).replace(/[#>*_\[\]()!\-\s\d|]+/g, '');
    return plain.length < 400;
  }

  function bootData() {
    return state.boot && state.boot.data ? state.boot.data : {};
  }

  function subscriptionInfo() {
    var d = bootData();
    return d.subscription || null;
  }

  function subscriptionFeatures() {
    var sub = subscriptionInfo();
    if (sub && sub.current && sub.current.features) return sub.current.features;
    return null;
  }

  function subscriptionTierId() {
    var sub = subscriptionInfo();
    return sub && sub.tier ? sub.tier : 'free';
  }

  function subscriptionPlanName() {
    var sub = subscriptionInfo();
    if (sub && sub.current && sub.current.name) return sub.current.name;
    return 'ASSISTIX Free';
  }

  function modeFeatureKey(mode) {
    if (mode === 'web' || mode === 'research' || mode === 'reasoning' || mode === 'agent') return mode;
    return null;
  }

  var AGENT_VIBES = {
    en: {
      plan: ['Figuring it out…', 'Mapping the plan…', 'Thinking it through…', 'Sketching steps…'],
      act: ['Cooking…', 'Brewing…', 'Crunching…', 'Wiring it up…', 'Noodling…', 'Digging in…', 'Putting it together…', 'Almost there…'],
      done: ['Done', 'All set', 'Wrapped up'],
      tool: {
        python: ['Running Python…', 'Coding…', 'Tweaking the script…'],
        shell: ['In the terminal…', 'Running a command…'],
        web_search: ['Searching the web…', 'Looking things up…'],
        web_fetch: ['Reading a page…', 'Fetching…'],
        http_request: ['Calling an API…'],
        fs_list: ['Listing files…'],
        fs_read: ['Reading a file…'],
        fs_write: ['Writing a file…', 'Saving changes…'],
        subagent: ['Spinning up a subagent…'],
        code_handoff: ['Handing off to CODE…'],
        finish: ['Wrapping up…']
      }
    },
    ru: {
      plan: ['Думаю…', 'Набрасываю план…', 'Разбираюсь…', 'Прикидываю шаги…'],
      act: ['Готовлю…', 'Варю…', 'Кручу…', 'Собираю…', 'Ковыряю…', 'Уже почти…', 'Доделываю…'],
      done: ['Готово', 'Сделано', 'Всё'],
      tool: {
        python: ['Пишу на Python…', 'Кручу скрипт…', 'Правлю код…'],
        shell: ['В терминале…', 'Запускаю команду…'],
        web_search: ['Ищу в сети…', 'Гугляю…'],
        web_fetch: ['Читаю страницу…'],
        http_request: ['Дергаю API…'],
        fs_list: ['Смотрю файлы…'],
        fs_read: ['Читаю файл…'],
        fs_write: ['Пишу файл…', 'Сохраняю…'],
        subagent: ['Запускаю субагента…'],
        code_handoff: ['Передаю в CODE…'],
        finish: ['Завершаю…']
      }
    },
    it: {
      plan: ['Sto pensando…', 'Traccio il piano…', 'Ci ragiono…'],
      act: ['Cooking…', 'Preparando…', 'Assemblando…', 'Quasi fatto…'],
      done: ['Fatto', 'Tutto ok'],
      tool: {
        python: ['Eseguo Python…', 'Scrivo codice…'],
        shell: ['Nel terminale…'],
        web_search: ['Cerco sul web…'],
        web_fetch: ['Leggo una pagina…'],
        http_request: ['Chiamo API…'],
        fs_list: ['Elenco i file…'],
        fs_read: ['Leggo un file…'],
        fs_write: ['Scrivo un file…'],
        subagent: ['Avvio un subagent…'],
        code_handoff: ['Passo a CODE…'],
        finish: ['Chiudo…']
      }
    }
  };

  function agentVibePack() {
    var lang = uiLang();
    return AGENT_VIBES[lang] || AGENT_VIBES.en;
  }

  function pickAgentVibe(list, avoid) {
    if (!list || !list.length) return '';
    if (list.length === 1) return list[0];
    var next = list[Math.floor(Math.random() * list.length)];
    if (avoid && next === avoid) {
      next = list[(list.indexOf(avoid) + 1) % list.length];
    }
    return next;
  }

  function stopAgentVibe(widget) {
    if (!widget) return;
    if (widget._vibeTimer) {
      clearInterval(widget._vibeTimer);
      widget._vibeTimer = null;
    }
  }

  function setAgentStatusText(widget, text, soft) {
    if (!widget) return;
    var label = widget.querySelector('[data-agent-phase]');
    if (!label || !text) return;
    if (label.textContent === text) return;
    widget._vibeLast = text;
    if (!soft) {
      label.textContent = text;
      return;
    }
    label.classList.add('is-swap');
    setTimeout(function () {
      label.textContent = text;
      label.classList.remove('is-swap');
    }, 120);
  }

  function refreshAgentVibe(widget, forceTool) {
    if (!widget || !widget.classList.contains('is-active')) return;
    var pack = agentVibePack();
    var phase = widget._agentPhase || 'plan';
    var tool = forceTool || widget._activeTool || '';
    var pool = pack[phase] || pack.act;
    if (tool && pack.tool && pack.tool[tool]) pool = pack.tool[tool];
    setAgentStatusText(widget, pickAgentVibe(pool, widget._vibeLast), true);
  }

  function startAgentVibe(widget) {
    stopAgentVibe(widget);
    if (!widget) return;
    refreshAgentVibe(widget);
    widget._vibeTimer = setInterval(function () {
      if (!widget.classList.contains('is-active')) {
        stopAgentVibe(widget);
        return;
      }
      refreshAgentVibe(widget);
    }, 2400);
  }

  function agentMarkIcon(kind) {
    if (kind === 'done') {
      return '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.8 7.2l2.8 2.8 5.6-5.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    return '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6" stroke-dasharray="18 10" stroke-linecap="round"/></svg>';
  }

  function createAgentWidget() {
    var el = document.createElement('div');
    el.className = 'c-agent is-active';
    el._agentPhase = 'plan';
    el._toolRows = [];
    el._stepCount = 0;
    el.innerHTML =
      '<div class="c-agent-bar">' +
        '<span class="c-agent-mark" data-agent-mark aria-hidden="true">' + agentMarkIcon('live') + '</span>' +
        '<div class="c-agent-status" data-agent-phase>' + A.esc(t('agent.plan')) + '</div>' +
        '<div class="c-agent-badge">' + A.esc(t('agent.badge')) + '</div>' +
      '</div>' +
      '<div class="c-agent-console acx-scroll" data-agent-console aria-live="polite"></div>' +
      '<div class="c-agent-foot" data-agent-foot></div>';
    startAgentVibe(el);
    return el;
  }

  function setAgentPhase(widget, phase) {
    if (!widget) return;
    var next = phase === 'act' || phase === 'done' ? phase : 'plan';
    widget._agentPhase = next;
    if (next === 'done') {
      stopAgentVibe(widget);
      widget.classList.remove('is-active');
      widget.classList.add('is-done');
      var mark = widget.querySelector('[data-agent-mark]');
      if (mark) mark.innerHTML = agentMarkIcon('done');
      var pack = agentVibePack();
      setAgentStatusText(widget, pickAgentVibe(pack.done) || t('agent.done'), false);
      return;
    }
    widget.classList.add('is-active');
    widget.classList.remove('is-done');
    var liveMark = widget.querySelector('[data-agent-mark]');
    if (liveMark) liveMark.innerHTML = agentMarkIcon('live');
    if (!widget._vibeTimer) startAgentVibe(widget);
    else refreshAgentVibe(widget);
  }

  function agentToolLabel(name, done) {
    var keys = {
      web_search: 'agent.tool.web_search',
      web_fetch: 'agent.tool.web_fetch',
      http_request: 'agent.tool.http',
      python: 'agent.tool.python',
      shell: 'agent.tool.shell',
      fs_list: 'agent.tool.fs_list',
      fs_read: 'agent.tool.fs_read',
      fs_write: 'agent.tool.fs_write',
      subagent: 'agent.tool.subagent',
      code_handoff: 'agent.tool.code',
      finish: 'agent.tool.finish'
    };
    var base = keys[name];
    if (!base) return name || '';
    if (done) {
      var doneKey = base + '.done';
      var doneLabel = t(doneKey);
      if (doneLabel && doneLabel !== doneKey) return doneLabel;
    }
    return t(base);
  }

  function agentDemoteActiveSteps(widget) {
    if (!widget) return;
    var box = widget.querySelector('[data-agent-console]');
    if (!box) return;
    box.querySelectorAll('.c-agent-step.is-active').forEach(function (row) {
      row.classList.remove('is-active', 'is-running', 'is-wait');
      if (!row.classList.contains('is-err')) row.classList.add('is-done');
      var mark = row.querySelector('.c-agent-step-mark');
      if (mark) mark.textContent = '';
      var tag = row.querySelector('.c-agent-step-tag');
      if (tag) tag.hidden = true;
    });
  }

  function agentOneLine(text, max) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    max = max || 96;
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function agentArgsSummary(tool, args) {
    if (!args) return '';
    var a = args;
    if (typeof a === 'string') {
      try { a = JSON.parse(a); } catch (e) { return agentOneLine(a, 88); }
    }
    if (!a || typeof a !== 'object') return '';
    if (tool === 'shell') return agentOneLine(a.command || a.cmd || a.code || '', 88);
    if (tool === 'python') {
      if (a.path) return agentOneLine(a.path, 88);
      if (a.file) return agentOneLine(a.file, 88);
      var code = String(a.code || a.source || '');
      if (!code) return 'run';
      var line = code.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean)[0] || '';
      return agentOneLine(line || 'run', 88);
    }
    if (tool === 'fs_write' || tool === 'fs_read') return agentOneLine(a.path || a.file || '', 88);
    if (tool === 'fs_list') return agentOneLine(a.path || a.dir || '.', 88);
    if (tool === 'web_search') return agentOneLine(a.query || a.q || '', 88);
    if (tool === 'web_fetch' || tool === 'http_request') return agentOneLine(a.url || a.uri || '', 88);
    if (tool === 'subagent') return agentOneLine(a.goal || a.task || a.prompt || '', 88);
    if (tool === 'code_handoff') return agentOneLine(a.summary || a.goal || 'CODE', 88);
    if (a.path) return agentOneLine(a.path, 88);
    if (a.query) return agentOneLine(a.query, 88);
    try { return agentOneLine(JSON.stringify(a), 72); } catch (e2) { return ''; }
  }

  function agentResultSummary(tool, result, ok) {
    var r = result || {};
    if (r.error) return agentOneLine(r.error, 120);
    if (r.patched != null) return 'patched: ' + String(r.patched);
    if (r.path) return agentOneLine(r.path, 96);
    if (r.stdout) return agentOneLine(r.stdout, 120);
    if (r.stderr && !ok) return agentOneLine(r.stderr, 120);
    if (r.text) return agentOneLine(r.text, 120);
    if (r.report) return agentOneLine(r.report, 120);
    if (r.summary) return agentOneLine(r.summary, 120);
    if (r.sources) return t('agent.sources', { n: (r.sources || []).length });
    if (r.files) {
      if (Array.isArray(r.files)) {
        var names = r.files.map(function (f) { return (f && f.path) || f; }).filter(Boolean).slice(0, 4);
        if (names.length) return names.join(', ');
      }
      return t('agent.files', { n: (r.files || []).length });
    }
    if (r.exit_code != null && r.exit_code !== 0) return 'exit ' + r.exit_code;
    return ok ? 'ok' : 'error';
  }

  function ensureAgentConsole(widget) {
    var box = widget && widget.querySelector('[data-agent-console]');
    if (box) box.classList.add('is-on');
    return box;
  }

  /**
   * Cursor-like feed row.
   * opts: { running, active, wait, tag, metaInline, previewMax, tool }
   */
  function appendAgentConsole(widget, kind, title, detail, opts) {
    if (!widget) return null;
    var box = ensureAgentConsole(widget);
    if (!box) return null;
    opts = opts || {};
    var full = detail ? String(detail) : '';
    var preview = agentOneLine(full, opts.previewMax || 120);
    var active = !!(opts.active || opts.running || kind === 'thought' || kind === 'wait');
    if (active) agentDemoteActiveSteps(widget);

    var row = document.createElement('div');
    row.className = 'c-agent-step';
    if (kind === 'err') row.classList.add('is-err');
    else if (kind === 'wait' || opts.wait) row.classList.add('is-wait');
    else if (opts.running) row.classList.add('is-running', 'is-active');
    else if (active) row.classList.add('is-active');
    else row.classList.add('is-done');
    if (opts.tool) row._tool = opts.tool;

    var main = document.createElement('div');
    main.className = 'c-agent-step-main';

    var mark = document.createElement('span');
    mark.className = 'c-agent-step-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = active && kind !== 'wait' && !opts.wait ? '::' : '';
    main.appendChild(mark);

    var titleEl = document.createElement('span');
    titleEl.className = 'c-agent-step-title';
    titleEl.textContent = title || '';
    main.appendChild(titleEl);

    if (opts.tag) {
      var tag = document.createElement('span');
      tag.className = 'c-agent-step-tag';
      tag.textContent = opts.tag;
      main.appendChild(tag);
    }

    var metaInline = opts.metaInline !== false && !active && preview && kind !== 'thought';
    var metaEl = null;
    var subEl = null;
    if (metaInline && preview) {
      metaEl = document.createElement('span');
      metaEl.className = 'c-agent-step-meta';
      metaEl.textContent = preview;
      metaEl.title = full || preview;
      main.appendChild(metaEl);
    }

    row.appendChild(main);

    if (!metaInline && preview) {
      subEl = document.createElement('div');
      subEl.className = 'c-agent-step-sub';
      subEl.textContent = preview;
      subEl.title = full || preview;
      row.appendChild(subEl);
    }

    row._fullDetail = full;
    row._preview = preview;
    row._titleEl = titleEl;
    row._metaEl = metaEl;
    row._subEl = subEl;

    if (full && full !== preview) {
      row.classList.add('has-more');
      row.addEventListener('click', function () {
        row.classList.toggle('is-open');
        var open = row.classList.contains('is-open');
        var target = row._subEl || row._metaEl;
        if (target) target.textContent = open ? (row._fullDetail || row._preview) : row._preview;
      });
    }

    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    return row;
  }

  function updateAgentLogRow(row, kind, detail, opts) {
    if (!row) return;
    opts = opts || {};
    row.classList.remove('is-running', 'is-active', 'is-wait', 'is-done', 'is-err', 'is-ok');
    if (kind === 'err') row.classList.add('is-err');
    else row.classList.add('is-done');

    var mark = row.querySelector('.c-agent-step-mark');
    if (mark) mark.textContent = '';
    var tag = row.querySelector('.c-agent-step-tag');
    if (tag) tag.hidden = true;

    if (opts.title && row._titleEl) row._titleEl.textContent = opts.title;

    var full = detail ? String(detail) : '';
    var preview = agentOneLine(full, 120);
    row._fullDetail = full;
    row._preview = preview;

    // Done rows: verb + meta on one line (Searched web · query)
    if (row._subEl) {
      row._subEl.remove();
      row._subEl = null;
    }
    if (preview) {
      if (!row._metaEl) {
        row._metaEl = document.createElement('span');
        row._metaEl.className = 'c-agent-step-meta';
        var main = row.querySelector('.c-agent-step-main');
        if (main) main.appendChild(row._metaEl);
      }
      row._metaEl.textContent = preview;
      row._metaEl.title = full || preview;
      row._metaEl.hidden = false;
    } else if (row._metaEl) {
      row._metaEl.hidden = true;
    }
    if (full && full !== preview) row.classList.add('has-more');
  }

  // ═══ Agent trace (OpenCode-style) ═══════════════════════════════════════
  function axEl(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }

  function axNow() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  }

  function axDur(ms) {
    if (ms == null || isNaN(ms) || ms < 0) return '';
    if (ms < 1000) return Math.round(ms) + ' ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + ' s';
    var m = Math.floor(ms / 60000);
    return m + 'm ' + Math.round((ms % 60000) / 1000) + 's';
  }

  function axMetaRow(key, val, tone) {
    var row = axEl('div', 'ax-meta-row');
    row.appendChild(axEl('span', 'ax-meta-k' + (tone ? ' is-' + tone : ''), key));
    if (val !== '' && val != null) row.appendChild(axEl('span', 'ax-meta-v', String(val)));
    return row;
  }

  function axPre(text, tone) {
    var body = String(text == null ? '' : text).replace(/\s+$/, '');
    var wrap = axEl('div', 'ax-block');
    if (tone) wrap.classList.add('is-' + tone);
    var pre = axEl('pre', 'ax-code');
    pre.textContent = body;
    var lines = body.split(/\r?\n/).length;
    if (lines > 14 || body.length > 1600) {
      wrap.classList.add('is-clipped');
      wrap.appendChild(pre);
      var more = axEl('button', 'ax-more', 'Show all · ' + lines + ' lines');
      more.type = 'button';
      more.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var open = wrap.classList.toggle('is-expanded');
        more.textContent = open ? 'Collapse' : ('Show all · ' + lines + ' lines');
      });
      wrap.appendChild(more);
    } else {
      wrap.appendChild(pre);
    }
    return wrap;
  }

  function axTick(widget) {
    if (!widget) return;
    var bar = widget.querySelector('.c-agent-bar');
    if (!bar) return;
    var live = bar.querySelector('.ax-live');
    if (!live) {
      live = axEl('span', 'ax-live');
      var badge = bar.querySelector('.c-agent-badge');
      if (badge) bar.insertBefore(live, badge);
      else bar.appendChild(live);
    }
    var bits = [];
    if (widget._axCur) bits.push('step ' + widget._axCur._num);
    if (widget._axT0) bits.push(axDur(axNow() - widget._axT0));
    live.textContent = bits.join(' · ');
  }

  function axReset(widget) {
    var box = ensureAgentConsole(widget);
    if (!box) return null;
    box.innerHTML = '';
    box.classList.add('is-on', 'ax-trace');
    widget._axSteps = [];
    widget._axCur = null;
    widget._axT0 = axNow();
    widget._stepCount = 0;
    if (widget._axTimer) { clearInterval(widget._axTimer); widget._axTimer = null; }
    return box;
  }

  function axStep(widget, num, phase) {
    var box = ensureAgentConsole(widget);
    if (!box) return null;
    var cur = widget._axCur;
    if (cur && cur._num === num) {
      if (phase) cur._phaseEl.textContent = phase;
      return cur;
    }
    if (cur && cur._thought) cur._thought.classList.remove('is-live');

    var step = axEl('section', 'ax-step is-running');
    step._num = num || 1;
    step._t0 = axNow();

    var head = axEl('div', 'ax-step-head');
    head.appendChild(axEl('span', 'ax-idx', String(step._num)));
    var ph = axEl('span', 'ax-phase', phase || 'act');
    head.appendChild(ph);
    head.appendChild(axEl('span', 'ax-live-dot'));
    head.appendChild(axEl('span', 'ax-time', ''));
    var caret = axEl('button', 'ax-caret', '▾');
    caret.type = 'button';
    caret.setAttribute('aria-label', 'Collapse step');
    head.appendChild(caret);
    step.appendChild(head);
    step._phaseEl = ph;
    step._timeEl = head.querySelector('.ax-time');

    var body = axEl('div', 'ax-body');
    step.appendChild(body);
    step._body = body;

    caret.addEventListener('click', function (ev) {
      ev.stopPropagation();
      step.classList.toggle('is-collapsed');
    });
    head.addEventListener('click', function () {
      step.classList.toggle('is-collapsed');
    });

    box.appendChild(step);
    box.scrollTop = box.scrollHeight;
    widget._axCur = step;
    widget._axSteps = widget._axSteps || [];
    widget._axSteps.push(step);
    return step;
  }

  function axThought(widget, text, num) {
    var step = widget._axCur || axStep(widget, num || 1, 'plan');
    if (!step) return;
    var body = String(text || '').trim();
    if (!body) return;
    var t = step._thought;
    if (!t) {
      t = axEl('div', 'ax-thought');
      t.appendChild(axEl('div', 'ax-thought-label', 'thinking'));
      t._body = axEl('div', 'ax-thought-body');
      t.appendChild(t._body);
      step._body.appendChild(t);
      step._thought = t;
    }
    t.classList.add('is-live');
    t._body.textContent = body;
    var box = ensureAgentConsole(widget);
    if (box) box.scrollTop = box.scrollHeight;
  }

  function axToolSummary(tool, args) {
    if (!args) return '';
    var a = args;
    if (typeof a === 'string') {
      try { a = JSON.parse(a); } catch (e) { return agentOneLine(a, 90); }
    }
    if (!a || typeof a !== 'object') return '';
    if (tool === 'shell') return agentOneLine(a.command || a.cmd || '', 90);
    if (tool === 'python') return 'python';
    if (tool === 'fs_write' || tool === 'fs_read') return agentOneLine(a.path || a.file || '', 90);
    if (tool === 'fs_list') return agentOneLine(a.path || a.dir || '.', 90);
    if (tool === 'web_search') return agentOneLine(a.query || a.q || '', 90);
    if (tool === 'web_fetch' || tool === 'http_request') return agentOneLine(a.url || a.uri || '', 90);
    if (tool === 'subagent') return agentOneLine(a.goal || a.task || a.prompt || '', 90);
    if (tool === 'finish') return agentOneLine(a.summary || '', 90);
    return '';
  }

  function axRenderArgs(body, tool, args) {
    var a = args;
    if (typeof a === 'string') {
      try { a = JSON.parse(a); } catch (e) { a = { input: a }; }
    }
    if (!a || typeof a !== 'object' || Array.isArray(a)) return;

    if (tool === 'shell' && (a.command || a.cmd)) {
      body.appendChild(axPre(a.command || a.cmd));
      return;
    }
    if (tool === 'python' && a.code) {
      body.appendChild(axPre(a.code));
      return;
    }
    if (tool === 'fs_write') {
      if (a.path) body.appendChild(axMetaRow('path', a.path));
      if (a.content != null) body.appendChild(axPre(a.content));
      return;
    }

    var keys = Object.keys(a).filter(function (k) { return k !== '_incomplete'; });
    if (!keys.length) return;
    var dl = axEl('div', 'ax-args');
    keys.forEach(function (k) {
      var v = a[k];
      var row = axEl('div', 'ax-arg-row');
      row.appendChild(axEl('span', 'ax-arg-key', k));
      var val;
      if (v != null && typeof v === 'object') val = JSON.stringify(v);
      else val = String(v == null ? '' : v);
      if (val.length > 200) val = val.slice(0, 199) + '…';
      row.appendChild(axEl('span', 'ax-arg-val', val));
      dl.appendChild(row);
    });
    body.appendChild(dl);
  }

  function axRenderResult(body, tool, r) {
    r = r || {};
    var out = axEl('div', 'ax-out');
    var has = false;

    if (r.error) {
      out.appendChild(axMetaRow('error', String(r.error), 'err'));
      has = true;
    }
    if (r.stdout != null && String(r.stdout).trim() !== '') {
      body.appendChild(axMetaRow('stdout', '', 'ok'));
      out.appendChild(axPre(r.stdout));
      has = true;
    }
    if (r.stderr != null && String(r.stderr).trim() !== '') {
      out.appendChild(axMetaRow('stderr', '', 'err'));
      out.appendChild(axPre(r.stderr, 'err'));
      has = true;
    }
    if (r.text && r.stdout == null) { out.appendChild(axPre(r.text)); has = true; }
    if (r.body && !r.text) { out.appendChild(axPre(r.body)); has = true; }
    if (r.summary) { out.appendChild(axPre(r.summary)); has = true; }
    if (r.path && r.stdout == null && !r.text) { out.appendChild(axMetaRow('path', r.path)); has = true; }
    if (r.content != null) { out.appendChild(axPre(r.content)); has = true; }

    if (Array.isArray(r.files) && r.files.length) {
      var fl = axEl('div', 'ax-files');
      r.files.forEach(function (f) {
        var nm = (f && f.path) || f;
        if (nm) fl.appendChild(axEl('span', 'ax-file', String(nm)));
      });
      out.appendChild(fl);
      has = true;
    }
    if (Array.isArray(r.sources) && r.sources.length) {
      var sl = axEl('div', 'ax-sources');
      r.sources.slice(0, 8).forEach(function (s) {
        var u = (s && (s.url || s.link)) || '';
        var ttl = (s && (s.title || s.name)) || u || 'source';
        var a2 = axEl('a', 'ax-source', ttl);
        if (u) { a2.href = u; a2.target = '_blank'; a2.rel = 'noopener noreferrer'; }
        sl.appendChild(a2);
      });
      out.appendChild(sl);
      has = true;
    }
    if (r.exit_code != null && r.exit_code !== 0) {
      out.appendChild(axMetaRow('exit', String(r.exit_code), 'err'));
      has = true;
    }
    if (r.timed_out) { out.appendChild(axMetaRow('status', 'timed out', 'err')); has = true; }
    if (!has) {
      var raw = '';
      try { raw = JSON.stringify(r); } catch (e) { raw = String(r); }
      if (raw && raw !== '{}' && raw !== '{"ok":true}') out.appendChild(axPre(raw));
    }
    if (out.childNodes.length) body.appendChild(out);
  }

  function axToolStart(widget, tool, args, num) {
    var step = widget._axCur || axStep(widget, num || 1, 'act');
    if (!step) return null;
    if (step._thought) step._thought.classList.remove('is-live');

    var blk = axEl('div', 'ax-tool is-running');
    blk._tool = tool;

    var head = axEl('div', 'ax-tool-head');
    head.appendChild(axEl('span', 'ax-tool-glyph', '›'));
    head.appendChild(axEl('span', 'ax-tool-name', tool || 'tool'));
    var sum = axToolSummary(tool, args);
    if (sum) head.appendChild(axEl('span', 'ax-tool-sum', sum));
    head.appendChild(axEl('span', 'ax-tool-time', ''));
    head.appendChild(axEl('span', 'ax-tool-state', 'running'));
    blk.appendChild(head);
    blk._timeEl = head.querySelector('.ax-tool-time');
    blk._stateEl = head.querySelector('.ax-tool-state');
    blk._t0 = axNow();

    var body = axEl('div', 'ax-tool-body');
    blk.appendChild(body);
    blk._bodyEl = body;
    axRenderArgs(body, tool, args);

    step._body.appendChild(blk);
    step._lastTool = blk;
    var box = ensureAgentConsole(widget);
    if (box) box.scrollTop = box.scrollHeight;
    return blk;
  }

  function axToolEnd(widget, tool, payload) {
    payload = payload || {};
    var step = widget._axCur || axStep(widget, payload.step || 1, 'act');
    var blk = step && step._lastTool;
    if (!blk || blk._tool !== tool) {
      blk = axToolStart(widget, tool, {}, step ? step._num : 1);
    }
    if (!blk) return;

    var ok = payload.ok !== false;
    var ms = payload.duration_ms != null ? Number(payload.duration_ms) : (axNow() - (blk._t0 || axNow()));
    blk.classList.remove('is-running');
    blk.classList.add(ok ? 'is-ok' : 'is-err');
    blk._stateEl.textContent = ok ? 'ok' : 'failed';
    blk._timeEl.textContent = axDur(ms);
    if (step && step._thought) step._thought.classList.remove('is-live');

    axRenderResult(blk._bodyEl, tool, payload.result || {});
    var box = ensureAgentConsole(widget);
    if (box) box.scrollTop = box.scrollHeight;
  }

  function handleAgentEvent(widget, eventName, payload) {
    if (!widget || !payload) return;

    if (eventName === 'agent_start') {
      var box0 = axReset(widget);
      if (payload.job_id) widget.title = payload.job_id;
      if (box0 && payload.goal) {
        var goal = axEl('div', 'ax-goal');
        goal.appendChild(axEl('span', 'ax-goal-k', 'goal'));
        goal.appendChild(axEl('span', 'ax-goal-v', payload.goal));
        box0.appendChild(goal);
      }
      widget._axT0 = axNow();
      widget._axTimer = setInterval(function () { axTick(widget); }, 500);
      axTick(widget);
      setAgentPhase(widget, 'plan');
      return;
    }

    if (eventName === 'agent_phase') {
      var phase = payload.phase || 'act';
      if (phase !== 'done') {
        var n = payload.step || (widget._axCur ? widget._axCur._num : 1);
        var st = axStep(widget, n, phase);
        if (st && payload.max) st._phaseEl.textContent = phase + ' ' + n + '/' + payload.max;
      }
      if (phase === 'plan' || phase === 'act' || phase === 'done') setAgentPhase(widget, phase);
      axTick(widget);
      return;
    }

    if (eventName === 'agent_thought') {
      axThought(widget, payload.text || '', payload.step);
      setAgentPhase(widget, 'act');
      axTick(widget);
      return;
    }

    if (eventName === 'agent_tool_start') {
      widget._stepCount = (widget._stepCount || 0) + 1;
      setAgentPhase(widget, 'act');
      refreshAgentVibe(widget, payload.tool);
      axToolStart(widget, payload.tool || '', payload.args || {}, payload.step);
      axTick(widget);
      return;
    }

    if (eventName === 'agent_tool_end') {
      axToolEnd(widget, payload.tool || '', payload);
      axTick(widget);
      return;
    }

    if (eventName === 'agent_model') {
      var sm = axStep(widget, payload.step || 1, (payload.step || 1) > 1 ? 'act' : 'plan');
      if (sm) {
        if (!sm._meta) { sm._meta = axEl('div', 'ax-meta-line'); sm._body.insertBefore(sm._meta, sm._body.firstChild); }
        var kb = function (n) { return Math.round((Number(n) || 0) / 1000) + 'k'; };
        sm._meta.textContent = [payload.model, (payload.messages || 0) + ' msgs', kb(payload.context_chars) + ' / ' + kb(payload.context_budget) + ' ctx', (payload.tools || 0) + ' tools'].join(' · ');
      }
      axTick(widget);
      return;
    }

    if (eventName === 'agent_usage' || eventName === 'agent_step_end') {
      var se = (widget._axSteps || []).filter(function (s) { return s._num === payload.step; })[0];
      if (se) {
        if (payload.total_tokens) se._tokens = payload.total_tokens;
        if (payload.duration_ms != null) se._ms = payload.duration_ms;
        var bits2 = [];
        if (se._ms != null) bits2.push(axDur(se._ms));
        if (se._tokens) bits2.push(se._tokens + ' tok');
        if (bits2.length) se._timeEl.textContent = bits2.join(' · ');
      }
      return;
    }

    if (eventName === 'agent_error') {
      var es = widget._axCur || axStep(widget, 1, 'act');
      if (es) {
        es._body.appendChild(axEl('div', 'ax-error', payload.message || t('agent.error')));
        var eb = ensureAgentConsole(widget);
        if (eb) eb.scrollTop = eb.scrollHeight;
      }
      return;
    }

    if (eventName === 'agent_done' || eventName === 'agent_paused') {
      if (widget._axCur) {
        widget._axCur.classList.remove('is-running');
        widget._axCur.classList.add('is-done');
        if (widget._axCur._ms == null && payload.duration_ms == null) widget._axCur._timeEl.textContent = axDur(axNow() - (widget._axCur._t0 || axNow()));
        if (widget._axCur._thought) widget._axCur._thought.classList.remove('is-live');
      }
      if (widget._axTimer) { clearInterval(widget._axTimer); widget._axTimer = null; }
      setAgentPhase(widget, 'done');

      var foot = widget.querySelector('[data-agent-foot]');
      if (foot) {
        var bits = [];
        var steps = payload.steps || (widget._axSteps || []).length || 0;
        if (steps) bits.push(steps + ' steps');
        if (payload.duration_ms != null) bits.push(axDur(Number(payload.duration_ms)) + ' total');
        else if (widget._axT0) bits.push(axDur(axNow() - widget._axT0) + ' total');
        var files = (payload.files || []).map(function (f) { return f && f.path; }).filter(Boolean);
        if (files.length) bits.push(files.slice(0, 4).join(', ') + (files.length > 4 ? '…' : ''));
        if (bits.length) {
          foot.textContent = bits.join(' · ');
          foot.classList.add('is-on');
        }
      }
      return;
    }
  }

  function featureAllowed(feature) {
    return true;
  }

  function isModeLocked(mode) {
    return false;
  }

  function formatPlanPrice(plan) {
    if (!plan) return '';
    if (!plan.price_rub) return t('sub.freePrice');
    return t('sub.perMonth', { price: String(plan.price_rub).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') });
  }

  function planTagline(plan) {
    if (!plan || !plan.id) return plan && plan.tagline ? plan.tagline : '';
    var key = 'sub.tier.' + plan.id + '.tag';
    var tr = t(key);
    return tr !== key ? tr : (plan.tagline || '');
  }

  function planFeatureLines(plan) {
    if (!plan) return [];
    var feats = plan.features || {};
    var lim = plan.limits || {};
    var lines = [];
    if (feats.web) lines.push(t('sub.feature.web'));
    if (feats.documents) lines.push(t('sub.feature.documents'));
    if (feats.image) lines.push(t('sub.feature.image'));
    if (feats.research) lines.push(t('sub.feature.research'));
    if (feats.reasoning) lines.push(t('sub.feature.reasoning'));
    if (feats.memory) lines.push(t('sub.feature.memory'));
    if (feats.widgets) lines.push(t('sub.feature.widgets'));
    if (lim.unlimited) {
      lines.push(t('sub.feature.limitsMax'));
    } else {
      lines.push(t('sub.feature.limits', {
        flair: lim.flair_weekly_tokens != null ? formatUsageNum(lim.flair_weekly_tokens) : '—',
        pine: lim.pine_weekly_tokens != null ? formatUsageNum(lim.pine_weekly_tokens) : '—'
      }));
    }
    return lines;
  }

  function memoryLimitsFromBoot() {
    var d = state.boot && state.boot.data;
    var lim = d && d.memory_limits;
    return {
      maxItems: (lim && lim.max_items) || 24,
      maxChars: (lim && lim.max_item_chars) || 400
    };
  }

  function profileLinkRow(href, icon, label, external) {
    var ext = external ? ' target="_blank" rel="noreferrer"' : '';
    return '<a class="c-profile-link" href="' + A.esc(href) + '"' + ext + '>' +
      '<span class="ic">' + A.icon(icon, 18) + '</span><span>' + A.esc(label) + '</span>' +
      (external ? '<span class="c-profile-link-ext">' + A.icon('external', 14) + '</span>' : '') +
      '</a>';
  }

  function renderProfileMemoryRows(memories) {
    var lim = memoryLimitsFromBoot();
    if (!memories || !memories.length) {
      return '<p class="c-profile-section-desc" style="margin:0">' + t('profile.memoryEmpty') + '</p>';
    }
    return memories.map(function (m) {
      var src = m.source === 'assistant' ? 'assistant' : 'user';
      var title = src === 'assistant' ? t('profile.memoryAi') : t('profile.memoryUser');
      return '<div class="c-profile-memory-row" data-mid="' + (m.id || '') + '">' +
        '<input type="text" maxlength="' + lim.maxChars + '" value="' + A.esc(m.content || '') + '" data-source="' + src + '" title="' + A.esc(title) + '" placeholder="' + A.esc(t('profile.memoryFactPh')) + '" />' +
        '<button type="button" class="c-profile-memory-del" title="' + A.esc(t('hist.delete')) + '">' + A.icon('x', 16) + '</button></div>';
    }).join('');
  }

  function renderProfileSubscriptionSection(d) {
    return '';
  }

  function renderProfileModalContent() {
    var inner = $('profileModalInner');
    if (!inner || !state.boot) return;
    var d = state.boot.data || {};
    var usageHtml = buildUsageRingsHtml(d);
    var subSection = renderProfileSubscriptionSection(d);
    var usageBlock = usageHtml
      ? '<div class="c-profile-section"><div class="c-profile-section-title">' +
        (d.guest ? t('usage.demo') : t('usage.limits')) +
        '</div><div class="c-usage-rings c-usage-rings--profile">' + usageHtml + '</div>' +
        (d.guest ? '<p class="c-profile-note">' + t('profile.noteGuest') + '</p>' : '<p class="c-profile-note">' + t('profile.noteWeek') + '</p>') +
        '</div>'
      : '';

    if (!d.authenticated) {
      inner.innerHTML =
        '<div class="c-profile-card c-profile-card--guest">' +
        '<button type="button" class="c-profile-close" id="profileModalClose" aria-label="' + A.esc(t('profile.close')) + '">' + A.icon('x', 18) + '</button>' +
        '<div class="c-profile-hero">' +
        '<div class="c-profile-av-ring is-guest"><div class="c-profile-av">' + A.icon('chat', 28) + '</div></div>' +
        '<h3 class="c-profile-name">' + t('profile.guest') + '</h3>' +
        '<p class="c-profile-email">' + t('profile.guestDesc') + '</p>' +
        '<span class="c-profile-badge">' + A.esc(t('hist.demo')) + '</span></div></div>' +
        '<div class="c-profile-modal-scroll acx-scroll">' + usageBlock + subSection +
        '<div class="c-profile-section"><div class="c-profile-section-title">' + t('profile.fullAccess') + '</div>' +
        '<p class="c-profile-lead">' + t('profile.fullLead') + '</p>' +
        '<a class="c-profile-login" href="' + A.esc(buildChatLoginUrl()) + '">' + t('profile.loginId') + '</a>' +
        '<div class="c-profile-links" style="margin-top:14px">' +
        profileLinkRow(d.about_models_url || 'https://assistix.org/about/', 'research', t('side.models'), true) +
        profileLinkRow('https://assistix.org/', 'globe', t('side.ecosystem'), true) +
        '</div></div></div>';
      bindProfileModalClose();
      if (A.Scrollbars) A.Scrollbars.init(inner);
      return;
    }

    var u = d.user || {};
    var memories = state.profileMemDraft.length ? state.profileMemDraft : (d.memories || []).slice();
    state.profileMemDraft = memories.slice();
    state.profileMemDeleted = state.profileMemDeleted || [];
    var lim = memoryLimitsFromBoot();
    var av = u.avatar_url
      ? '<img src="' + A.esc(u.avatar_url) + '" alt="">'
      : A.esc((u.display_name || '?').charAt(0).toUpperCase());
    var themeLabel = { auto: t('profile.themeAuto'), light: t('profile.themeLight'), dark: t('profile.themeDark') }[A.Theme.get()] || t('profile.themeAuto');

    inner.innerHTML =
      '<div class="c-profile-card">' +
      '<button type="button" class="c-profile-close" id="profileModalClose" aria-label="' + A.esc(t('profile.close')) + '">' + A.icon('x', 18) + '</button>' +
      '<div class="c-profile-head">' +
      '<button type="button" class="c-profile-av-btn" id="profileAvatarBtn" title="' + A.esc(t('profile.photo')) + '">' +
      '<div class="c-profile-av-ring"><div class="c-profile-av" id="profileAvatarPreview">' + av + '</div></div>' +
      '<span class="c-profile-av-hint">' + t('profile.photo') + '</span></button>' +
      '<div class="c-profile-fields">' +
      '<input class="c-profile-name-input" id="profileNameInput" type="text" maxlength="120" value="' + A.esc(u.display_name || '') + '" placeholder="' + A.esc(t('profile.namePh')) + '" autocomplete="name" />' +
      '<p class="c-profile-email">' + A.esc(u.email || '') + '</p>' +
      '<span class="c-profile-badge">ASSISTIX ID</span></div></div></div>' +
      '<div class="c-profile-modal-scroll acx-scroll">' +
      subSection +
      '<div class="c-profile-section">' +
      '<div class="c-profile-section-title">' + t('profile.memory') + '</div>' +
      '<p class="c-profile-section-desc">' + t('profile.memoryDesc') + '</p>' +
      '<div class="c-profile-memory-list" id="profileMemoryList">' + renderProfileMemoryRows(memories) + '</div>' +
      '<button type="button" class="c-profile-memory-add" id="profileMemoryAdd">' + A.icon('plus', 16) + ' ' + t('profile.memoryAdd') + '</button>' +
      '<p class="c-profile-memory-meta">' + t('profile.memoryMeta', { items: lim.maxItems, chars: lim.maxChars }) + '</p></div>' +
      usageBlock +
      '<div class="c-profile-section"><div class="c-profile-section-title">' + t('profile.links') + '</div>' +
      '<div class="c-profile-links">' +
      profileLinkRow(d.id_profile_url || 'https://id.assistix.org/profile/', 'settings', 'ASSISTIX ID', true) +
      profileLinkRow(d.about_models_url || 'https://assistix.org/about/', 'research', t('side.models'), true) +
      profileLinkRow('https://assistix.org/', 'globe', t('profile.ecosystem'), true) +
      '</div></div>' +
      '<div class="c-profile-section c-profile-section--signout">' +
      '<button type="button" class="c-profile-signout" id="profileSignOutBtn">' + A.icon('x', 16) + '<span>' + t('auth.logout') + '</span></button>' +
      '</div></div>' +
      '<div class="c-profile-foot">' +
      '<button type="button" class="c-profile-action" id="profileThemeBtn"><span class="ic">' + A.icon('sun', 18) + '</span><span>' + A.esc(t('theme.label', { mode: themeLabel })) + '</span></button>' +
      '<button type="button" class="c-profile-action c-profile-action--primary" id="profileSaveBtn">' + t('profile.save') + '</button></div>';

    bindProfileModalClose();
    bindProfileModalActions();
    var plansBtn = $('profilePlansBtn');
    if (plansBtn) plansBtn.addEventListener('click', function () { openSubscriptionModal(); });
    if (A.Scrollbars) A.Scrollbars.init(inner);
  }

  function collectProfileMemoriesFromDom() {
    var list = $('profileMemoryList');
    if (!list) return [];
    var out = [];
    list.querySelectorAll('.c-profile-memory-row').forEach(function (row) {
      var input = row.querySelector('input');
      if (!input) return;
      var val = (input.value || '').trim();
      if (!val) return;
      var id = parseInt(row.getAttribute('data-mid') || '0', 10);
      out.push({ id: id > 0 ? id : null, content: val });
    });
    return out;
  }

  function bindProfileMemoryList() {
    var list = $('profileMemoryList');
    var addBtn = $('profileMemoryAdd');
    if (!list || !addBtn) return;

    list.querySelectorAll('.c-profile-memory-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.c-profile-memory-row');
        if (!row) return;
        var mid = parseInt(row.getAttribute('data-mid') || '0', 10);
        if (mid > 0) state.profileMemDeleted.push(mid);
        row.remove();
        if (!list.querySelector('.c-profile-memory-row')) {
          list.innerHTML = '<p class="c-profile-section-desc" style="margin:0">' + t('profile.memoryEmpty') + '</p>';
        }
      });
    });

    addBtn.onclick = function () {
      var lim = memoryLimitsFromBoot();
      var current = list.querySelectorAll('.c-profile-memory-row').length;
      if (list.querySelector('p.c-profile-section-desc')) list.innerHTML = '';
      if (current >= lim.maxItems) {
        toast(t('toast.memMax', { n: lim.maxItems }), true);
        return;
      }
      var row = document.createElement('div');
      row.className = 'c-profile-memory-row';
      row.setAttribute('data-mid', '');
      row.innerHTML =
        '<input type="text" maxlength="' + lim.maxChars + '" value="" data-source="user" placeholder="' + A.esc(t('profile.memoryPh')) + '" />' +
        '<button type="button" class="c-profile-memory-del" title="' + A.esc(t('hist.delete')) + '">' + A.icon('x', 16) + '</button>';
      list.appendChild(row);
      row.querySelector('.c-profile-memory-del').addEventListener('click', function () {
        row.remove();
        if (!list.querySelector('.c-profile-memory-row')) {
          list.innerHTML = '<p class="c-profile-section-desc" style="margin:0">' + t('profile.memoryEmpty') + '</p>';
        }
      });
      row.querySelector('input').focus();
    };
  }

  function bindProfileModalActions() {
    var avBtn = $('profileAvatarBtn');
    var avInput = $('avatarInput');
    if (avBtn && avInput) {
      avBtn.addEventListener('click', function () { avInput.click(); });
      avInput.onchange = function () {
        var file = avInput.files && avInput.files[0];
        avInput.value = '';
        if (!file) return;
        avBtn.disabled = true;
        A.API.uploadAvatar(file).then(function (j) {
          avBtn.disabled = false;
          if (!j.success) {
            toast(j.error || t('toast.avatarFail'), true);
            return;
          }
          if (state.boot && state.boot.data && j.user) {
            state.boot.data.user = j.user;
          }
          var prev = $('profileAvatarPreview');
          if (prev && j.avatar_url) prev.innerHTML = '<img src="' + A.esc(j.avatar_url) + '" alt="">';
          renderAuth();
          toast(t('toast.avatarOk'));
        }).catch(function () {
          avBtn.disabled = false;
          toast(t('toast.avatarErr'), true);
        });
      };
    }

    bindProfileMemoryList();

    var themeBtn = $('profileThemeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', function (ev) {
        var next = A.Theme.cycle(ev);
        var lbl = { auto: t('profile.themeAuto'), light: t('profile.themeLight'), dark: t('profile.themeDark') }[next] || t('profile.themeAuto');
        themeBtn.querySelector('span:last-child').textContent = t('theme.label', { mode: lbl });
        themeIcon();
      });
    }

    var saveBtn = $('profileSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveProfileModal);
    }

    var signOutBtn = $('profileSignOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', function () {
        if (signOutBtn.getAttribute('data-armed') !== '1') {
          signOutBtn.setAttribute('data-armed', '1');
          signOutBtn.classList.add('is-armed');
          var lbl = signOutBtn.querySelector('span');
          if (lbl) lbl.textContent = t('profile.signOutConfirm');
          if (A.haptics) A.haptics.pattern([12, 40, 12]);
          setTimeout(function () {
            signOutBtn.removeAttribute('data-armed');
            signOutBtn.classList.remove('is-armed');
            var l2 = signOutBtn.querySelector('span');
            if (l2) l2.textContent = t('auth.logout');
          }, 4000);
          return;
        }
        window.location.href = '/api/logout.php';
      });
    }
  }

  function saveProfileModal() {
    if (state.profileSaving) return;
    var nameInput = $('profileNameInput');
    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      toast(t('toast.nameRequired'), true);
      return;
    }
    state.profileSaving = true;
    var saveBtn = $('profileSaveBtn');
    if (saveBtn) saveBtn.disabled = true;

    A.API.updateProfile({
      display_name: name,
      memories: collectProfileMemoriesFromDom(),
      delete_memory_ids: state.profileMemDeleted.slice()
    }).then(function (j) {
      state.profileSaving = false;
      if (saveBtn) saveBtn.disabled = false;
      if (!j.success) {
        toast(j.error || t('toast.saveFail'), true);
        return;
      }
      if (state.boot && state.boot.data) {
        state.boot.data.user = j.user;
        state.boot.data.memories = j.memories || [];
      }
      state.profileMemDraft = (j.memories || []).slice();
      state.profileMemDeleted = [];
      renderAuth();
      toast(t('toast.profileOk'));
    }).catch(function () {
      state.profileSaving = false;
      if (saveBtn) saveBtn.disabled = false;
      toast(t('toast.saveErr'), true);
    });
  }

  function renderSubscriptionModalContent(highlightMode) {
    var inner = $('subModalInner');
    if (!inner) return;
    var d = bootData();
    var plans = d.plans || [];
    var currentTier = subscriptionTierId();
    var cards = plans.map(function (plan) {
      var isCurrent = plan.id === currentTier;
      var lines = planFeatureLines(plan).map(function (line) {
        return '<li>' + A.esc(line) + '</li>';
      }).join('');
      return '<article class="c-sub-card c-sub-card--' + A.esc(plan.badge || plan.id) + (isCurrent ? ' is-current' : '') + '">' +
        '<div class="c-sub-card-head">' +
        '<span class="c-sub-badge c-sub-badge--' + A.esc(plan.badge || plan.id) + '">' + A.esc(plan.name) + '</span>' +
        (isCurrent ? '<span class="c-sub-current-pill">' + t('sub.selected') + '</span>' : '') +
        '</div>' +
        '<p class="c-sub-card-price">' + A.esc(formatPlanPrice(plan)) + '</p>' +
        '<p class="c-sub-card-tag">' + A.esc(planTagline(plan)) + '</p>' +
        '<ul class="c-sub-card-feats">' + lines + '</ul>' +
        '<button type="button" class="c-sub-card-btn' + (isCurrent ? ' is-current' : '') + '" data-tier="' + A.esc(plan.id) + '"' + (isCurrent ? ' disabled' : '') + '>' +
        (isCurrent ? t('sub.selected') : t('sub.select')) +
        '</button></article>';
    }).join('');
    var hint = highlightMode && isModeLocked(highlightMode)
      ? '<p class="c-sub-hint">' + A.esc(t('sub.lockedMode', { plan: 'ASSISTIX PREMIER' })) + '</p>'
      : '';
    inner.innerHTML =
      '<div class="c-sub-modal-card">' +
      '<button type="button" class="c-sub-close" id="subModalClose" aria-label="' + A.esc(t('profile.close')) + '">' + A.icon('x', 18) + '</button>' +
      '<h3 class="c-sub-title">' + t('sub.title') + '</h3>' +
      hint +
      '<p class="c-sub-note">' + t('sub.conceptNote') + '</p>' +
      '<div class="c-sub-grid">' + cards + '</div></div>';
    bindSubscriptionModalActions();
  }

  function bindSubscriptionModalActions() {
    var close = $('subModalClose');
    var backdrop = $('subModalBackdrop');
    if (close) close.onclick = function (e) { e.stopPropagation(); closeSubscriptionModal(); };
    if (backdrop) backdrop.onclick = function () { closeSubscriptionModal(); };
    var inner = $('subModalInner');
    if (!inner) return;
    inner.querySelectorAll('.c-sub-card-btn[data-tier]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tier = btn.getAttribute('data-tier');
        if (!tier || btn.disabled) return;
        selectSubscriptionTier(tier);
      });
    });
  }

  function onSubModalEsc(e) {
    if (e.key === 'Escape') closeSubscriptionModal();
  }

  function openSubscriptionModal(highlightMode) {
    return;
  }

  function closeSubscriptionModal() {
    var modal = $('subModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('sub-modal-open');
  }

  function selectSubscriptionTier(tier) {
    return;
  }

  function bindProfileModalClose() {
    var close = $('profileModalClose');
    var backdrop = $('profileModalBackdrop');
    if (close) close.onclick = function (e) { e.stopPropagation(); closeProfileModal(); };
    if (backdrop) backdrop.onclick = function () { closeProfileModal(); };
  }

  function onProfileModalEsc(e) {
    if (e.key === 'Escape') closeProfileModal();
  }

  function openProfileModal() {
    state.profileMemDeleted = [];
    renderProfileModalContent();
    var modal = $('profileModal');
    var btn = $('userFootBtn');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('profile-modal-open');
    if (btn) {
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
    if (!state.profilePopBound) {
      document.addEventListener('keydown', onProfileModalEsc);
      state.profilePopBound = true;
    }
  }

  function closeProfileModal() {
    var modal = $('profileModal');
    var btn = $('userFootBtn');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('profile-modal-open');
    if (btn) {
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    state.profileMemDraft = [];
    state.profileMemDeleted = [];
  }

  function toggleProfileModal() {
    var modal = $('profileModal');
    if (modal && !modal.classList.contains('hidden')) closeProfileModal();
    else openProfileModal();
  }

  function renderAuth() {
    var host = $('topAuth');
    var foot = $('userFoot');
    var root = document.querySelector('.c-root');
    if (!host || !state.boot) return;
    host.innerHTML = '';
    closeProfileModal();
    var d = state.boot.data || {};
    if (root) {
      root.classList.toggle('is-guest', !d.authenticated);
      root.classList.toggle('is-auth', !!d.authenticated);
    }
    if (!d.authenticated) {
      var a = document.createElement('a');
      a.href = d.login_url || buildChatLoginUrl();
      a.className = 'btn-login';
      a.textContent = t('auth.login');
      host.appendChild(a);
      if (foot) {
        foot.innerHTML =
          '<button type="button" class="c-user-foot-btn c-user-foot-guest" id="userFootBtn" aria-expanded="false" aria-controls="profileModal">' +
          '<div class="av is-guest">' + A.icon('chat', 18) + '</div>' +
          '<div class="c-user-foot-text"><div class="nm">' + t('auth.guest') + '</div><div class="sub">' + t('auth.guestSub') + '</div></div>' +
          userFootChevron() +
          '</button>' +
          '<a class="c-user-foot-login" href="' + A.esc(d.login_url || buildChatLoginUrl()) + '">' +
          A.icon('spark', 15) + '<span>' + t('auth.login') + '</span></a>';
        bindUserFootButton();
        var footLogin = foot.querySelector('.c-user-foot-login');
        if (footLogin) footLogin.addEventListener('click', function () { if (A.haptics) A.haptics.tap(); });
      }
      syncComposerPlaceholder();
      renderUsage();
      return;
    }
    var u = d.user || {};
    if (foot) {
      var av = u.avatar_url ? '<img src="' + A.esc(u.avatar_url) + '" alt="">' : A.esc((u.display_name || '?').charAt(0).toUpperCase());
      var subLine = A.esc(u.email || '');
      foot.innerHTML =
        '<button type="button" class="c-user-foot-btn" id="userFootBtn" aria-expanded="false" aria-controls="profileModal">' +
        '<div class="av">' + av + '</div>' +
        '<div class="c-user-foot-text"><div class="nm">' + A.esc(u.display_name || t('auth.user')) + '</div><div class="sub">' + subLine + '</div></div>' +
        userFootChevron() +
        '</button>';
      bindUserFootButton();
    }
    syncComposerPlaceholder();
    renderUsage();
    if (!state.messages.length) renderWelcome();
  }

  function syncComposerPlaceholder() {
    var inp = $('input');
    if (!inp) return;
    var fn = userFirstName();
    inp.placeholder = fn ? t('input.phNamed', { name: fn }) : t('input.ph');
  }

  function formatUsageNum(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function usageRingHtml(opts) {
    var used = Math.max(0, Number(opts.used) || 0);
    var cap = Math.max(1, Number(opts.cap) || 1);
    var pct = Math.min(100, (used / cap) * 100);
    if (used > 0 && pct < 1.5) pct = 1.5;
    var r = 17;
    var c = 2 * Math.PI * r;
    var dash = (pct / 100) * c;
    var pctLabel = pct >= 10 ? Math.round(pct) + '%' : (pct >= 1 ? pct.toFixed(1) + '%' : (used > 0 ? '<1%' : '0%'));
    return '<div class="c-usage-ring' + (opts.warn ? ' is-warn' : '') + (opts.hot ? ' is-hot' : '') + '" style="--ring-color:' + opts.color + '">' +
      '<div class="c-usage-ring-chart" aria-hidden="true">' +
      '<svg viewBox="0 0 44 44" width="44" height="44">' +
      '<circle class="c-usage-track" cx="22" cy="22" r="' + r + '" fill="none" stroke-width="3.5" />' +
      '<circle class="c-usage-fill" cx="22" cy="22" r="' + r + '" fill="none" stroke-width="3.5" stroke-linecap="round" ' +
      'stroke-dasharray="' + dash.toFixed(2) + ' ' + (c - dash).toFixed(2) + '" transform="rotate(-90 22 22)" />' +
      '</svg>' +
      '<span class="c-usage-pct">' + pctLabel + '</span>' +
      '</div>' +
      '<div class="c-usage-ring-meta">' +
      '<span class="c-usage-ring-label">' + A.esc(opts.label) + '</span>' +
      '<span class="c-usage-ring-val">' + A.esc(opts.valText) + '</span>' +
      '</div></div>';
  }

  function renderUsage() {
    var panel = $('usagePanel');
    var rings = $('usageRings');
    var title = $('usageTitle');
    var reset = $('usageReset');
    if (!panel || !rings || !state.boot) return;
    var d = state.boot.data || {};
    var html = buildUsageRingsHtml(d);
    var show = !!html;

    if (d.guest && d.guest_usage) {
      if (title) title.textContent = t('usage.demo');
      if (reset) reset.textContent = t('usage.resetToday');
    } else if (d.usage) {
      if (title) title.textContent = t('usage.limits');
      if (reset) reset.textContent = t('usage.resetWeek');
    }

    rings.innerHTML = html;
    panel.hidden = !show;
    if (window.ACXEnhance && window.ACXEnhance.renderComposerChips) window.ACXEnhance.renderComposerChips();
  }

  function renderHistory() {
    var box = $('history');
    if (!box) return;
    var html = '<div class="c-side-label">' + t('hist.label') + '</div>';
    var groups = state.historyGroups;
    var keys = Object.keys(groups);
    var filter = (state.historyFilter || '').toLowerCase();
    var any = false;
    var trGroup = window.ACX_I18N ? function (n) { return window.ACX_I18N.translateHistoryGroup(n); } : function (n) { return n; };
    if (!keys.length) {
      html += '<p class="c-hist-empty">' + t('hist.empty') + '</p>';
    } else {
      keys.forEach(function (gname) {
        var items = (groups[gname] || []).filter(function (c) {
          if (!filter) return true;
          return ((c.title || t('hist.chat')) + '').toLowerCase().indexOf(filter) >= 0;
        });
        if (!items.length) return;
        any = true;
        html += '<div class="c-side-label">' + A.esc(trGroup(gname)) + '</div>';
        items.forEach(function (c) {
          var active = state.guest ? (c.local_id === state.localId) : (Number(c.id) === Number(state.conversationId));
          var id = state.guest ? c.local_id : String(c.id);
          var pin = !state.guest && c.is_pinned ? '<span class="c-hist-pin" title="' + A.esc(t('hist.pinned')) + '">' + A.icon('pin', 12) + '</span>' : '';
          html += '<div class="c-hist-row' + (active ? ' active' : '') + '" data-id="' + A.esc(id) + '" data-guest="' + (state.guest ? '1' : '0') + '" data-pinned="' + (c.is_pinned ? '1' : '0') + '">' +
            '<button type="button" class="c-hist" data-id="' + A.esc(id) + '" data-guest="' + (state.guest ? '1' : '0') + '">' +
            '<span class="ic">' + A.icon('chat', 14) + '</span>' +
            '<span>' + pin + A.esc(c.title || t('hist.chat')) + '</span></button>' +
            '<button type="button" class="c-hist-del" data-del="' + A.esc(id) + '" data-guest="' + (state.guest ? '1' : '0') + '" title="' + A.esc(t('hist.delete')) + '">' + A.icon('x', 14) + '</button></div>';
        });
      });
      if (!any && filter) html += '<p class="c-hist-empty">' + t('hist.none') + '</p>';
    }
    if (state.historyHasMore && !filter) {
      html += '<div class="c-hist-load-more" id="histLoadMore">' +
        (state.historyLoading ? '<span class="c-hist-skeleton"></span><span class="c-hist-skeleton"></span>' : t('hist.loadMore')) +
        '</div>';
    }
    box.innerHTML = html;
    if (A.Scrollbars) A.Scrollbars.refresh(box);
    if (!box._acxHistScroll) {
      box._acxHistScroll = true;
      box.addEventListener('scroll', function () {
        if (!state.historyHasMore || state.historyLoading) return;
        if (box.scrollTop + box.clientHeight >= box.scrollHeight - 48) loadHistoryList(false);
      });
    }
    box.querySelectorAll('.c-hist').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('data-guest') === '1') loadThread(btn.getAttribute('data-id'), true, false);
        else loadThread(btn.getAttribute('data-id'), false, false);
        openSide(false);
      });
    });
    box.querySelectorAll('.c-hist-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteConversation(
          btn.getAttribute('data-del'),
          btn.getAttribute('data-guest') === '1',
          (btn.closest('.c-hist-row') && btn.closest('.c-hist-row').querySelector('.c-hist span'))
            ? btn.closest('.c-hist-row').querySelector('.c-hist span').textContent
            : ''
        );
      });
    });
    box.querySelectorAll('.c-hist-row').forEach(function (row) {
      if (state.guest) return;
      row.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        showHistoryMenu(e, row.getAttribute('data-id'), row.getAttribute('data-pinned') === '1');
      });
    });
  }

  function executeDeleteConversation(id, isGuest) {
    if (!id) return;
    var act = isGuest
      ? chatAction('guest_delete', { local_id: id })
      : chatAction('delete', { conversation_id: parseInt(id, 10) });
    act.then(function (j) {
      if (!j.success) throw new Error(j.error || t('toast.deleteFail'));
      if (isGuest ? state.localId === id : Number(state.conversationId) === Number(id)) newChat(true);
      else loadHistoryList();
    }).catch(function (e) { toast(e.message || t('toast.error'), true); });
  }

  function deleteConversation(id, isGuest, title) {
    if (!id) return;
    openDeleteChatModal(title || '').then(function (ok) {
      if (ok) executeDeleteConversation(id, isGuest);
    });
  }

  function showHistoryMenu(e, id, pinned) {
    var items = [
      { label: t('hist.share'), fn: function () {
        chatAction('share_link', { conversation_id: parseInt(id, 10) }).then(function (j) {
          if (!j.success) throw new Error(j.error || t('toast.error'));
          return shareUrlFlow(Promise.resolve(j.share_url || j.owner_url), {
            title: j.title || t('hist.chat'),
            hintKey: 'share.modalHintChat'
          });
        }).catch(function (e) { toast(e.message || t('toast.error'), true); });
      }},
      { label: pinned ? t('hist.unpin') : t('hist.pin'), fn: function () {
        chatAction(pinned ? 'unpin' : 'pin', { conversation_id: parseInt(id, 10) }).then(function (j) {
          if (j.success) loadHistoryList(); else toast(j.error || t('toast.error'), true);
        });
      }},
      { label: t('hist.rename'), fn: function () {
        var rowTitle = (function () {
          var el = document.querySelector('.c-hist-row[data-id="' + id + '"] .c-hist span:last-child');
          return el ? el.textContent : '';
        })();
        openInputModal({
          title: t('hist.renamePrompt'),
          value: rowTitle || t('hist.chat'),
          rows: 1,
          multiline: false,
          confirmLabel: t('inputModal.save')
        }).then(function (tit) {
          if (!tit || !tit.trim()) return;
          chatAction('rename', { conversation_id: parseInt(id, 10), title: tit.trim() }).then(function (j) {
            if (j.success) {
              if (Number(state.conversationId) === Number(id)) {
                state.chatTitle = tit.trim();
                updateChatTitleBar();
                document.title = state.chatTitle + ' · BEAM AGENT';
                applyPageSeo();
              }
              loadHistoryList();
            } else toast(j.error || t('toast.error'), true);
          });
        });
      }},
      { label: t('hist.duplicate'), fn: function () {
        chatAction('duplicate', { conversation_id: parseInt(id, 10) }).then(function (j) {
          if (j.success) {
            loadHistoryList().then(function () {
              if (j.new_conversation_id) loadThread(String(j.new_conversation_id), false);
            });
          } else toast(j.error || t('toast.error'), true);
        });
      }},
      { label: t('action.export'), fn: function () {
        var prevId = state.conversationId;
        loadThread(id, false, true).then(function () {
          exportChatMarkdown();
          if (Number(prevId) !== Number(id)) {
            if (prevId) loadThread(String(prevId), false, true);
            else newChat(true);
          }
        });
      }},
      { label: t('hist.delete'), fn: function () {
        var row = document.querySelector('.c-hist-row[data-id="' + id + '"]');
        var title = row && row.querySelector('.c-hist span') ? row.querySelector('.c-hist span').textContent : '';
        deleteConversation(id, false, title);
      }}
    ];
    var menu = document.createElement('div');
    menu.className = 'c-ctx-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.innerHTML = items.map(function (it, i) {
      return '<button type="button" data-i="' + i + '">' + A.esc(it.label) + '</button>';
    }).join('');
    document.body.appendChild(menu);
    function close() { menu.remove(); document.removeEventListener('click', close); }
    menu.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        items[parseInt(b.getAttribute('data-i'), 10)].fn();
        close();
      });
    });
    setTimeout(function () { document.addEventListener('click', close); }, 0);
  }

  async function loadHistoryList(reset) {
    if (reset !== false) {
      state.historyOffset = 0;
      state.historyGroups = {};
    }
    if (state.historyLoading) return;
    state.historyLoading = true;
    var params = { offset: state.historyOffset, limit: 20 };
    var j = await A.API.history(params);
    state.historyLoading = false;
    if (!j.success) return;
    var incoming = j.conversations || {};
    if (state.historyOffset === 0) {
      state.historyGroups = incoming;
    } else {
      Object.keys(incoming).forEach(function (gname) {
        if (!state.historyGroups[gname]) state.historyGroups[gname] = [];
        state.historyGroups[gname] = state.historyGroups[gname].concat(incoming[gname] || []);
      });
    }
    state.historyHasMore = !!j.has_more;
    state.historyOffset = j.next_offset != null ? j.next_offset : state.historyOffset;
    renderHistory();
  }

  async function loadThread(id, isGuest, replaceUrl) {
    if (state.stream) state.stream.abort();
    await purgeEphemeralChat();
    if (isGuest === undefined) isGuest = String(id).indexOf('g_') === 0;
    if (replaceUrl === undefined) replaceUrl = true;
    state.shareMode = false;
    setShareBanner(false);
    var params = isGuest ? { local_id: id } : { conversation_id: id };
    var j = await A.API.history(params);
    if (!j.success) {
      toast(t('toast.chatNotFound'), true);
      newChat(true);
      return;
    }
    state.messages = (j.messages || []).map(messageFromApiRow);
    if (isGuest) state.localId = id; else state.conversationId = parseInt(id, 10);
    state.ephemeral = false;
    state.ephemeralPending = false;
    updateEphemeralUI();
    state.chatTitle = (j.conversation && j.conversation.title) ? j.conversation.title : 'Чат';
    state.attachments = [];
    renderAttachRow();
    renderThreadFromMessages();
    var lastResearch = null;
    for (var ri = state.messages.length - 1; ri >= 0; ri--) {
      if (state.messages[ri].research) { lastResearch = state.messages[ri].research; break; }
    }
    closeResearchPanel(true);
    if (lastResearch) {
      state.researchPanelData = {
        query: lastResearch.query,
        bundle: lastResearch.bundle || null,
        content: lastResearch.report || (state.messages[state.messages.length - 1] && state.messages[state.messages.length - 1].content) || '',
        sources: lastResearch.sources || []
      };
    } else {
      state.researchPanelData = null;
    }
    renderHistory();
    syncChatUrl(replaceUrl);
    updateChatTitleBar();
  }

  async function loadShareView(token) {
    if (state.stream) state.stream.abort();
    state.shareMode = true;
    stopVoiceIfActive(true);
    syncVoiceBtn();
    state.conversationId = null;
    state.localId = null;
    state.attachments = [];
    setShareBanner(true);
    var j = await A.API.share(token);
    if (!j.success) {
      toast(t('toast.shareInvalid'), true);
      newChat(true);
      return;
    }
    state.chatTitle = (j.conversation && j.conversation.title) ? j.conversation.title : 'Чат';
    state.messages = (j.messages || []).map(function (m) {
      return { role: m.role, content: m.content, attachments: [] };
    });
    renderAttachRow();
    renderThreadFromMessages();
    updateChatTitleBar();
    document.title = state.chatTitle + ' · BEAM AGENT';
    applyPageSeo();
    openSide(false);
  }

  var thread = $('thread'), scroll = $('scroll');
  function scrollDown() {
    scroll.scrollTop = scroll.scrollHeight;
    if (A.Scrollbars) A.Scrollbars.refresh(scroll);
  }

  function scrollToMessageStart(msgEl, pad) {
    if (!scroll || !msgEl) return;
    pad = pad != null ? pad : 16;
    var scrollRect = scroll.getBoundingClientRect();
    var msgRect = msgEl.getBoundingClientRect();
    var nextTop = scroll.scrollTop + (msgRect.top - scrollRect.top) - pad;
    scroll.scrollTop = Math.max(0, nextTop);
    if (A.Scrollbars) A.Scrollbars.refresh(scroll);
  }

  function materializeWelcomeHeading(h1) {
    if (!h1 || h1.dataset.tsSplit) return;
    h1.dataset.tsSplit = '1';
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var frag = document.createDocumentFragment();
    var wi = 0;

    function appendWord(text, extraClass) {
      if (!text) return;
      var span = document.createElement('span');
      span.className = 'c-welcome-word' + (extraClass ? ' ' + extraClass : '');
      if (!reduced) span.style.animationDelay = (0.1 + wi * 0.16) + 's';
      span.textContent = text;
      frag.appendChild(span);
      frag.appendChild(document.createTextNode('\u00A0'));
      wi++;
    }

    Array.prototype.forEach.call(h1.childNodes, function (node) {
      if (node.nodeType === 3) {
        String(node.textContent || '').trim().split(/\s+/).filter(Boolean).forEach(function (w) {
          appendWord(w);
        });
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.classList && node.classList.contains('acx-grad-text')) {
        appendWord((node.textContent || '').trim(), 'acx-grad-text');
        return;
      }
      String(node.textContent || '').trim().split(/\s+/).filter(Boolean).forEach(function (w) {
        appendWord(w);
      });
    });

    while (frag.lastChild && frag.lastChild.nodeType === 3) frag.removeChild(frag.lastChild);
    h1.textContent = '';
    h1.appendChild(frag);
  }

  function renderWelcome() {
    thread.innerHTML =
      '<div class="c-welcome is-materializing">' +
      '<img class="c-welcome-icon acx-logo" src="/agent-icon.png?v=20261104" alt="" width="64" height="64" draggable="false" />' +
      '<h1>' + welcomeHeadingHtml() + '</h1>' +
      '<div class="c-sug">' +
      shuffledSugs().map(function (s, i) {
        return '<button type="button" data-q="' + A.esc(s.q) + '" style="--sug-i:' + i + '"><span class="ic">' + A.icon(s.icon || 'spark', 18) + '</span><span><b>' + s.t + '</b><span class="sub">' + s.s + '</span></span></button>';
      }).join('') +
      '</div></div>';
    var welcome = thread.querySelector('.c-welcome');
    var h1 = welcome && welcome.querySelector('h1');
    if (h1) materializeWelcomeHeading(h1);
    thread.querySelectorAll('.c-sug button').forEach(function (b) {
      b.addEventListener('click', function () { $('input').value = b.getAttribute('data-q'); send(); });
    });
  }

  function animateMsgFromComposer(el, delayMs) {
    if (!el) return;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.classList.add('acx-enter');
        return;
      }
    } catch (e0) {}
    var fromY = 72;
    try {
      var composer = document.querySelector('.c-composer-wrap') || document.querySelector('.c-composer') || $('input');
      if (composer) {
        var c = composer.getBoundingClientRect();
        var e = el.getBoundingClientRect();
        if (e.height || e.top) {
          fromY = Math.round(Math.max(36, Math.min(260, c.top - e.top + 8)));
        }
      }
    } catch (e1) {}
    el.style.setProperty('--acx-fly-y', fromY + 'px');
    el.style.setProperty('--acx-fly-delay', Math.max(0, delayMs || 0) + 'ms');
    el.classList.remove('acx-enter');
    el.classList.add('acx-enter-fly');
    var done = false;
    function clearFly() {
      if (done) return;
      done = true;
      el.classList.remove('acx-enter-fly');
      el.style.removeProperty('--acx-fly-y');
      el.style.removeProperty('--acx-fly-delay');
      el.removeEventListener('animationend', onEnd);
    }
    function onEnd(ev) {
      if (ev && ev.target !== el) return;
      clearFly();
    }
    el.addEventListener('animationend', onEnd);
    setTimeout(clearFly, 1200 + Math.max(0, delayMs || 0));
  }

  function userMsgEl(text, files, msgIndex) {
    var d = document.createElement('div');
    d.className = 'c-msg user';
    d.dataset.msgIndex = String(msgIndex);
    var filesHtml = '';
    if (files && files.length) {
      filesHtml = '<div class="c-user-files">' + files.map(function (f) {
        if (f.is_image && f.preview_url) return '<span class="c-file-chip"><img src="' + A.esc(f.preview_url) + '" alt="">' + A.esc(f.name || t('msg.image')) + '</span>';
        return '<span class="c-file-chip">' + (f.is_image && f.preview_url ? '<img src="' + A.esc(f.preview_url) + '" alt="">' : '<span class="c-file-ic">' + A.icon('file', 16) + '</span>') + A.esc(f.name || t('msg.file')) + '</span>';
      }).join('') + '</div>';
    }
    d.innerHTML =
      '<div class="c-msg-col">' +
      '<div class="c-bubble-user"></div>' + filesHtml +
      '</div>';
    d.querySelector('.c-bubble-user').textContent = text;
    d.querySelectorAll('.c-file-chip').forEach(function (chip, fi) {
      if (!files || !files[fi]) return;
      chip.classList.add('is-previewable');
      chip.addEventListener('click', function () {
        if (window.ACXAttachPreview) window.ACXAttachPreview.open(files[fi]);
      });
    });
    if (!state.shareMode) addUserActions(d, msgIndex);
    return d;
  }

  function addUserActions(userEl, msgIndex) {
    var col = userEl.querySelector('.c-msg-col');
    if (!col) return;
    var bar = document.createElement('div');
    bar.className = 'c-actions c-actions-user';
    bar.innerHTML =
      '<button type="button" class="c-actbtn" data-act="copy" title="' + A.esc(t('action.copy')) + '">' + A.icon('copy', 17) + '</button>' +
      '<button type="button" class="c-actbtn" data-act="edit" title="' + A.esc(t('action.edit')) + '">' + A.icon('edit', 17) + '</button>' +
      '<button type="button" class="c-actbtn" data-act="branch" title="' + A.esc(t('action.branch')) + '">' + A.icon('branch', 17) + '</button>';
    col.appendChild(bar);
    bar.querySelector('[data-act="copy"]').addEventListener('click', function () {
      var txt = userEl.querySelector('.c-bubble-user').textContent || '';
      copyText(txt).then(function () {
        toast(t('toast.copied'));
      }).catch(function () { toast(t('toast.copyFail'), true); });
    });
    bar.querySelector('[data-act="edit"]').addEventListener('click', function () { editUserMessage(msgIndex); });
    bar.querySelector('[data-act="branch"]').addEventListener('click', function () { branchFromMessage(msgIndex); });
  }

  function streamStatusLabel(phase, mode) {
    var map = {
      think: 'stream.status.think',
      model: 'stream.status.model',
      search: 'stream.status.search',
      web: 'stream.status.search',
      image: 'stream.status.image',
      canvas: 'stream.status.canvas',
      vision: 'stream.status.vision',
      looking: 'stream.status.vision',
      docs: 'stream.status.docs',
      documents: 'stream.status.docs',
      research: 'stream.status.research',
      reason: 'stream.status.reason',
      reasoning: 'stream.status.reason',
      agent: 'stream.status.agent',
      write: 'stream.status.write',
      reply: 'stream.status.write'
    };
    var key = map[String(phase || '').toLowerCase()];
    if (key) return t(key);
    var byMode = {
      web: 'stream.status.search',
      canvas: 'stream.status.canvas',
      image: 'stream.status.vision',
      documents: 'stream.status.docs',
      research: 'stream.status.research',
      reasoning: 'stream.status.reason',
      agent: 'stream.status.agent'
    };
    return t(byMode[mode] || 'stream.status.think');
  }

  function streamStatusVibes(mode) {
    var base = [t('stream.status.think'), t('stream.status.write')];
    if (mode === 'web') return [t('stream.status.search'), t('stream.status.think'), t('stream.status.write')];
    if (mode === 'canvas') return [t('stream.status.canvas'), t('stream.status.image'), t('stream.status.think')];
    if (mode === 'image') return [t('stream.status.vision'), t('stream.status.think')];
    if (mode === 'documents') return [t('stream.status.docs'), t('stream.status.think')];
    if (mode === 'research') return [t('stream.status.research'), t('stream.status.think'), t('stream.status.write')];
    if (mode === 'reasoning') return [t('stream.status.reason'), t('stream.status.think')];
    if (mode === 'agent') return [t('stream.status.agent'), t('stream.status.think')];
    return base;
  }

  function aiMsgEl(modelName, modelKey, opts) {
    opts = opts || {};
    var key = modelKey || state.model;
    var d = document.createElement('div');
    d.className = 'c-msg ai' + (opts.agent ? ' is-agent' : '');
    var waitLabel = opts.waitLabel || streamStatusLabel(opts.statusPhase || '', opts.mode || state.mode);
    var bodyHtml = opts.static
      ? '<div class="c-ai-body acx-md"></div>'
      : '<div class="c-ai-body acx-md is-streaming">' + A.streamWaitHtml(waitLabel) + '</div>';
    var metaClass = 'c-ai-meta ' + modelDotClass(key) + (opts.hideModel || opts.agent ? ' is-hidden' : '');
    d.innerHTML =
      '<div class="c-av ai"><img class="acx-logo" src="/agent-icon.png?v=20261104" alt="ASSISTIX" width="36" height="36" draggable="false" /></div>' +
      '<div class="c-ai-wrap">' +
      bodyHtml +
      '<div class="' + metaClass + '">' + modelDotBall(key, 9) + ' ' + A.esc(modelName) + '</div></div>';
    return d;
  }

  function renderThreadFromMessages() {
    thread.innerHTML = '';
    document.documentElement.classList.toggle('is-compact', !!state.compactMode);
    if (!state.messages.length) { renderWelcome(); return; }
    state.messages.forEach(function (m, i) {
      if (m.role === 'user') thread.appendChild(userMsgEl(m.content, m.attachments, i));
      else if (m.role === 'assistant') {
        var histModelKey = m.model || state.model;
        var histModel = modelByKey(histModelKey);
        var el = aiMsgEl(histModel.name, histModel.key, { static: true, agent: !!m.agent, hideModel: !!m.agent });
        var aiBody = el.querySelector('.c-ai-body');
        var showContent = m.content && m.content !== '[рассуждение]';
        if (m.reasoning) mountThinkBlock(el, m.reasoning, !showContent);
        if (showContent) {
          A.revealMarkdown(aiBody, m.content, { static: true });
          if (m.widgets && m.widgets.length && window.ACXWidgets) {
            window.ACXWidgets.decorateBody(aiBody, m.content, m.widgets);
          }
        } else if (m.reasoning) {
          aiBody.innerHTML = '<p style="color:var(--ink-400)">' + A.esc(t('stream.noAnswer')) + '</p>';
        } else {
          A.revealMarkdown(aiBody, m.content || '', { static: true });
        }
        if (m.research && m.research.query) {
          var rw = createResearchWidget(m.research.query);
          finishResearchWidget(rw, m.research.query);
          if (aiBody) {
            aiBody.innerHTML = '';
            aiBody.classList.add('c-ai-body--research-hidden');
          }
          el.querySelector('.c-ai-wrap').insertBefore(rw, el.querySelector('.c-ai-body'));
          bindResearchPanelOpen(rw, function () {
            return {
              query: m.research.query,
              bundle: m.research.bundle || null,
              content: m.research.report || m.content,
              sources: m.research.sources || m.sources || [],
              generatedAt: formatResearchTime(new Date())
            };
          });
        }
        attachSources(el, m.sources);
        addActions(el, m.content, i);
        revealMessageChrome(el, { instant: true, hideModel: !!m.agent });
        if (window.ACXEnhance && window.ACXEnhance.enhanceMessage) {
          window.ACXEnhance.enhanceMessage(el.querySelector('.c-ai-body'));
        }
        thread.appendChild(el);
      }
    });
    scrollDown();
  }

  function addActions(aiEl, text, msgIndex) {
    var wrap = aiEl.querySelector('.c-ai-wrap');
    if (!wrap || wrap.querySelector('.c-actions')) return;
    var bar = document.createElement('div');
    bar.className = 'c-actions';
    bar.innerHTML =
      '<button type="button" class="c-actbtn" data-act="copy" title="' + A.esc(t('action.copy')) + '">' + A.icon('copy', 17) + '</button>' +
      '<div class="c-regen-wrap">' +
      '<button type="button" class="c-actbtn" data-act="regen" title="' + A.esc(t('action.regen')) + '">' + A.icon('refresh', 17) + '</button>' +
      '<div class="c-regen-menu" hidden></div></div>';
    wrap.appendChild(bar);
    bar.querySelector('[data-act="copy"]').addEventListener('click', function () {
      copyMessageText(bar.querySelector('[data-act="copy"]'), aiEl, text);
    });
    var regenBtn = bar.querySelector('[data-act="regen"]');
    var regenMenu = bar.querySelector('.c-regen-menu');
    if (regenMenu && !state.guest && state.boot && state.boot.data && state.boot.data.models) {
      regenMenu.innerHTML = state.boot.data.models.filter(function (m) { return m.key !== 'GUEST'; }).map(function (m) {
        return '<button type="button" data-model="' + A.esc(m.key) + '">' + A.esc(m.name) + '</button>';
      }).join('');
    }
    regenBtn.addEventListener('click', function (e) {
      if (state.streaming) return;
      if (regenMenu && regenMenu.children.length && e.shiftKey) {
        regenMenu.hidden = !regenMenu.hidden;
        return;
      }
      doRegen(aiEl, msgIndex, null);
    });
    if (regenMenu) {
      regenMenu.querySelectorAll('[data-model]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          regenMenu.hidden = true;
          doRegen(aiEl, msgIndex, btn.getAttribute('data-model'));
        });
      });
    }
  }

  function doRegen(aiEl, msgIndex, modelKey) {
    while (state.messages.length && state.messages[state.messages.length - 1].role === 'assistant') {
      state.messages.pop();
    }
    aiEl.remove();
    var lastUser = state.messages[state.messages.length - 1];
    if (lastUser && lastUser.role === 'user') {
      var idx = state.messages.length - 1;
      var prevModel = state.model;
      if (modelKey) state.model = modelKey;
      truncateMessages(idx + 1).then(function () {
        send(lastUser.content, lastUser.attachments || []);
        if (modelKey) state.model = prevModel;
      });
    }
  }

  /* attachments */
  function detectFileKind(file) {
    var name = file.name || '';
    var mime = file.type || '';
    if (/\.pdf$/i.test(name) || mime === 'application/pdf') return 'pdf';
    if (/\.(docx|doc)$/i.test(name) || mime.indexOf('word') >= 0) return 'docx';
    if (/\.(html|htm)$/i.test(name) || mime === 'text/html') return 'html';
    if (mime.indexOf('image/') === 0) return 'image';
    return 'text';
  }

  function attachRingHtml(pct, inner) {
    var c = 2 * Math.PI * 15.5;
    var p = Math.min(100, Math.max(0, pct || 0));
    var off = c * (1 - p / 100);
    return '<span class="c-attach-ring-wrap">' + inner +
      '<svg class="c-attach-ring" viewBox="0 0 36 36" aria-hidden="true">' +
      '<circle class="c-attach-ring-bg" cx="18" cy="18" r="15.5" fill="none" stroke-width="3"/>' +
      '<circle class="c-attach-ring-fg" cx="18" cy="18" r="15.5" fill="none" stroke-width="3" ' +
      'stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" transform="rotate(-90 18 18)"/>' +
      '</svg></span>';
  }

  function findAttachmentIdx(pred) {
    for (var i = 0; i < state.attachments.length; i++) {
      if (pred(state.attachments[i])) return i;
    }
    return -1;
  }

  function revokePendingPreview(att) {
    if (att && att._localPreview && att._localPreview !== state.pdfPreviewBlob) {
      try { URL.revokeObjectURL(att._localPreview); } catch (e) {}
    }
  }

  function renderAttachRow() {
    var row = $('attachRow');
    if (!state.attachments.length) {
      row.hidden = true;
      row.innerHTML = '';
      renderPdfAnalysisPanel();
      return;
    }
    row.hidden = false;
    row.innerHTML = state.attachments.map(function (a, i) {
      var thumbInner;
      if (a.is_image && (a.preview_url || a._localPreview)) {
        thumbInner = '<img src="' + A.esc(a.preview_url || a._localPreview) + '" alt="">';
      } else if (a.kind === 'pdf' && pdfPreviewSrc(a)) {
        thumbInner = '<span class="c-attach-pdf-thumb"><iframe src="' + A.esc(pdfPreviewSrc(a)) + '" tabindex="-1" aria-hidden="true"></iframe></span>';
      } else {
        thumbInner = '<span class="c-file-ic">' + A.icon('file', 18) + '</span>';
      }
      var uploading = !!a._uploading;
      var thumb = uploading
        ? attachRingHtml(a.upload_pct || 0, thumbInner)
        : thumbInner;
      var busy = !uploading && a.kind === 'pdf' && (a.extract_status === 'pending' || a.extract_status === 'processing');
      var done = !uploading && a.kind === 'pdf' && a.extract_status === 'done';
      var status = '';
      if (uploading) status = '<span class="c-attach-status">' + A.esc(t('attach.uploading', { n: a.upload_pct || 0 })) + '</span>';
      else if (busy && a.extract_progress) status = '<span class="c-attach-status">' + A.esc(a.extract_progress.label || t('pdf.extracting')) + '</span>';
      else if (done && a.extract_meta && a.extract_meta.pages) status = '<span class="c-attach-status">' + A.esc(t('pdf.pages', { n: a.extract_meta.pages })) + '</span>';
      var cls = 'c-attach-chip is-previewable';
      if (uploading) cls += ' is-uploading';
      if (busy) cls += ' is-pdf-busy';
      return '<span class="' + cls + '" data-i="' + i + '">' + thumb +
        '<span class="nm">' + A.esc(a.name || 'file') + '</span>' + status +
        '<button type="button" class="rm" data-i="' + i + '">' + A.icon('x', 14) + '</button></span>';
    }).join('');
    row.querySelectorAll('.rm').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.getAttribute('data-i'), 10);
        var rem = state.attachments[idx];
        if (rem && rem._uploading && rem._xhr) {
          try { rem._xhr.abort(); } catch (err) {}
        }
        if (rem && rem._uploading) revokePendingPreview(rem);
        if (rem && rem.id && state.pdfExtractors[rem.id]) {
          state.pdfExtractors[rem.id].abort();
          delete state.pdfExtractors[rem.id];
        }
        if (rem && rem.kind === 'pdf') revokePdfPreviewBlob();
        state.attachments.splice(idx, 1);
        renderAttachRow();
        renderPdfAnalysisPanel();
        updateSend();
      });
    });
    row.querySelectorAll('.c-attach-chip.is-previewable').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        if (e.target.closest('.rm')) return;
        var idx = parseInt(chip.getAttribute('data-i'), 10);
        var att = state.attachments[idx];
        if (att && window.ACXAttachPreview) window.ACXAttachPreview.open(att);
      });
    });
    renderPdfAnalysisPanel();
    syncComposerModeFromAttachments();
  }

  $('attachBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    var menu = $('attachMenu');
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', function () { $('attachMenu').hidden = true; });
  $('attachMenu').querySelectorAll('button').forEach(function (b) {
    var pick = b.getAttribute('data-pick');
    var ic = b.querySelector('.ic');
    if (ic) ic.innerHTML = A.icon(pick === 'file' ? 'file' : (pick === 'image' ? 'image' : 'camera'), 18);
    b.addEventListener('click', function () {
      var pick = b.getAttribute('data-pick');
      if (pick === 'file') $('fileInput').click();
      else if (pick === 'image') $('imageInput').click();
      else $('cameraInput').click();
      $('attachMenu').hidden = true;
    });
  });

  function handleFileSelect(file) {
    if (!file) return;
    var maxAtt = state.guest ? 1 : maxAttachments();
    if (state.attachments.length >= maxAtt) {
      toast(t('toast.attachMax', { n: maxAtt }), true);
      return;
    }
    var meta = {};
    if (state.conversationId) meta.conversation_id = state.conversationId;
    var kind = detectFileKind(file);
    var isPdf = kind === 'pdf';
    var isImage = kind === 'image' || (file.type || '').indexOf('image/') === 0;
    var tempId = 'up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    var pending = {
      _tempId: tempId,
      _uploading: true,
      upload_pct: 0,
      name: file.name || 'file',
      mime: file.type || '',
      kind: isImage ? 'image' : kind,
      is_image: isImage,
      _localPreview: isImage ? URL.createObjectURL(file) : null,
      _file: file
    };
    if (isPdf && !state.guest) {
      setPdfPreviewBlob(file);
      renderPdfAnalysisPanel();
    }
    state.attachments.push(pending);
    renderAttachRow();
    updateSend();

    A.API.upload(file, meta, {
      onXhr: function (xhr) { pending._xhr = xhr; },
      onUploadProgress: function (pct) {
        var idx = findAttachmentIdx(function (a) { return a._tempId === tempId; });
        if (idx < 0) return;
        state.attachments[idx].upload_pct = pct;
        renderAttachRow();
        if (isPdf && !state.guest) renderPdfAnalysisPanel();
      }
    }).then(function (j) {
      if (!j.success) throw new Error(j.error || 'Ошибка загрузки');
      var att = j.attachment;
      var idx = findAttachmentIdx(function (a) { return a._tempId === tempId; });
      if (idx < 0) return;
      revokePendingPreview(state.attachments[idx]);
      if (att.preview_url) revokePdfPreviewBlob();
      if (att.warning && att.extract_status === 'done') toast(att.warning);
      state.attachments.splice(idx, 1, att);
      renderAttachRow();
      updateSend();
      if (state.mode === 'chat' && att.is_image) { state.mode = 'image'; syncModeTags(); }
      else if (state.mode === 'chat' && !att.is_image) { state.mode = 'documents'; syncModeTags(); }
      else syncComposerModeFromAttachments();
      if (att.kind === 'pdf' && att.extract_status === 'pending') {
        startPdfExtraction(att, idx);
      }
    }).catch(function (e) {
      var idx = findAttachmentIdx(function (a) { return a._tempId === tempId; });
      if (idx >= 0) {
        revokePendingPreview(state.attachments[idx]);
        state.attachments.splice(idx, 1);
        renderAttachRow();
        updateSend();
      }
      revokePdfPreviewBlob();
      renderPdfAnalysisPanel();
      if (e && e.message !== 'upload_failed') toast(e.message || t('toast.error'), true);
    });
  }

  $('fileInput').addEventListener('change', function () { handleFileSelect(this.files[0]); this.value = ''; });
  $('imageInput').addEventListener('change', function () { handleFileSelect(this.files[0]); this.value = ''; });
  $('cameraInput').addEventListener('change', function () { handleFileSelect(this.files[0]); this.value = ''; });

  renderModeTags();

  /* composer */
  var input = $('input');
  var voice = null;

  function syncVoiceBtn() {
    var btn = $('voiceBtn');
    if (!btn) return;
    var ok = voice && voice.supported() && !state.shareMode;
    btn.hidden = !ok;
    btn.disabled = !!state.streaming;
    btn.setAttribute('aria-label', t('voice.start'));
  }

  function stopVoiceIfActive(discard) {
    if (voice && voice.active) voice.stop(!!discard);
  }

  if (window.ACXVoice) {
    voice = window.ACXVoice.create({
      $: $,
      input: input,
      t: t,
      uiLang: uiLang,
      A: A,
      onTranscript: function () { updateSend(); },
      onCommitted: function () { autosize(); updateSend(); input.focus(); },
      onStateChange: function (on) {
        state.voiceActive = on;
        syncVoiceBtn();
        updateSend();
      },
      onError: function (code) {
        if (code === 'unsupported') toast(t('voice.unsupported'), true);
        else if (code === 'not-allowed') toast(t('voice.denied'), true);
        else if (code !== 'no-speech' && code !== 'aborted') toast(t('voice.error'), true);
      }
    });
  }

  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 200) + 'px'; }

  input.addEventListener('paste', function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        var file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleFileSelect(file);
          toast(t('toast.pasteImage'));
        }
        return;
      }
    }
  });

  var composerWrap = document.querySelector('.c-composer-wrap');
  var mainDropZone = document.querySelector('.c-main');

  function hasFileDrag(e) {
    var dt = e.dataTransfer;
    if (!dt || !dt.types) return false;
    for (var i = 0; i < dt.types.length; i++) {
      if (dt.types[i] === 'Files') return true;
    }
    return false;
  }

  function setComposerDragHighlight(on) {
    if (composerWrap) composerWrap.classList.toggle('is-dragover', on);
  }

  if (mainDropZone && composerWrap && !mainDropZone._acxFileDrop) {
    mainDropZone._acxFileDrop = true;
    mainDropZone.addEventListener('dragenter', function (e) {
      if (!hasFileDrag(e) || state.shareMode) return;
      e.preventDefault();
      if (!mainDropZone.contains(e.relatedTarget)) setComposerDragHighlight(true);
    });
    mainDropZone.addEventListener('dragover', function (e) {
      if (!hasFileDrag(e) || state.shareMode) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setComposerDragHighlight(true);
    });
    mainDropZone.addEventListener('dragleave', function (e) {
      if (!mainDropZone.contains(e.relatedTarget)) setComposerDragHighlight(false);
    });
    mainDropZone.addEventListener('drop', function (e) {
      if (!hasFileDrag(e)) return;
      e.preventDefault();
      setComposerDragHighlight(false);
      if (state.shareMode) return;
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      for (var i = 0; i < files.length; i++) {
        handleFileSelect(files[i]);
        if (state.guest) break;
      }
    });
  }

  function updateSend() {
    var sendBtn = $('send');
    if (state.streaming) {
      stopVoiceIfActive(true);
      sendBtn.classList.add('is-stop');
      sendBtn.classList.remove('ready');
      sendBtn.innerHTML = A.icon('stop', 18);
      sendBtn.setAttribute('aria-label', t('action.stop'));
      syncVoiceBtn();
      return;
    }
    sendBtn.classList.remove('is-stop');
    if (state.voiceActive && voice) {
      var hasTx = !!voice.getTranscript();
      sendBtn.innerHTML = A.icon('check', 20);
      sendBtn.setAttribute('aria-label', t('voice.confirm'));
      sendBtn.classList.toggle('ready', hasTx);
      return;
    }
    sendBtn.innerHTML = A.icon('send', 19);
    sendBtn.setAttribute('aria-label', t('send'));
    var ready = (!!input.value.trim() || state.attachments.length) && !attachmentsExtracting();
    sendBtn.classList.toggle('ready', ready);
  }
  input.addEventListener('input', function () { autosize(); updateSend(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!state.streaming) send(); }
    else if (e.key.length === 1 && A.haptics) A.haptics.key();
    if (e.key === 'Escape' && state.voiceActive && voice) voice.cancel();
  });
  $('send').addEventListener('click', function () {
    if (state.streaming) stopGeneration();
    else if (state.voiceActive && voice) {
      if (voice.getTranscript()) voice.commit();
    }
    else send();
  });

  function formatThinkTime(ms) {
    return t('think.sec', { n: (Math.max(0, ms) / 1000).toFixed(1) });
  }

  function extractFinalFromReasoning(reasoning) {
    if (!reasoning || !reasoning.trim()) return '';
    var patterns = [
      /(?:финальн(?:ый|ого)\s+ответ|итог(?:овый)?(?:\s+ответ)?|теперь\s+дам\s+финальный\s+ответ)[:\s]*\n+([\s\S]+)$/i,
      /(?:final\s+answer|conclusion|in\s+summary)[:\s]*\n+([\s\S]+)$/i,
      /(?:risposta\s+finale|in\s+sintesi)[:\s]*\n+([\s\S]+)$/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = reasoning.match(patterns[i]);
      if (m && m[1] && m[1].trim().length >= 20) return m[1].trim();
    }
    return '';
  }

  function mountThinkBlock(aiEl, reasoning, collapsed) {
    if (!reasoning || !reasoning.trim()) return null;
    var block = createThinkBlock();
    block.classList.remove('is-thinking', 'is-open');
    if (!collapsed) block.classList.add('is-open');
    var label = block.querySelector('.c-think-label');
    var body = block.querySelector('.c-think-body');
    if (label) label.textContent = t('think.done');
    if (body) body.textContent = reasoning;
    var wrap = aiEl.querySelector('.c-ai-wrap');
    var aiBody = aiEl.querySelector('.c-ai-body');
    if (wrap && aiBody) wrap.insertBefore(block, aiBody);
    return block;
  }

  function createThinkBlock() {
    var block = document.createElement('div');
    block.className = 'c-think-block is-open is-thinking';
    block.innerHTML =
      '<button type="button" class="c-think-head">' +
      '<span class="c-think-ic">' + A.icon('lightbulb', 16) + '</span>' +
      '<span class="c-think-label">' + t('think.label') + '</span>' +
      '<span class="c-think-time">' + formatThinkTime(0) + '</span>' +
      '<span class="c-think-chev">' + A.icon('chevron', 14) + '</span></button>' +
      '<div class="c-think-body acx-scroll"></div>';
    block.querySelector('.c-think-head').addEventListener('click', function () {
      block.classList.toggle('is-open');
    });
    return block;
  }

  function send(forceText, forceAtt, sendOpts) {
    sendOpts = sendOpts || {};
    if (attachmentsExtracting()) {
      toast(t('toast.pdfWait'), true);
      return;
    }
    var pdfBlock = pdfAttachmentSendBlocked();
    if (pdfBlock) {
      toast(t(pdfBlock), true);
      return;
    }
    var text = (typeof forceText === 'string' ? forceText : input.value).trim();
    var att = forceAtt || state.attachments.slice();
    if ((!text && !att.length) || state.streaming) return;
    if (A.haptics) A.haptics.press();
    var streamUserText = text;

    if (state.messages.length === 0) thread.innerHTML = '';
    var cur = displayModelForSend();
    var displayText = text || (att.length ? t('chat.analyzeFiles') : '');

    state.messages.push({ role: 'user', content: displayText, attachments: att });
    var userEl = userMsgEl(displayText, att, state.messages.length - 1);
    thread.appendChild(userEl);
    animateMsgFromComposer(userEl, 0);
    input.value = '';
    state.attachments = [];
    syncComposerModeFromAttachments();
    renderAttachRow();
    autosize();
    updateSend();

    var sendModeHint = state.mode;
    var aiEl = aiMsgEl(cur.name, cur.key, {
      agent: state.mode === 'agent',
      hideModel: state.mode === 'agent',
      mode: sendModeHint,
      statusPhase: state.mode === 'canvas' ? 'canvas' : (state.mode === 'web' ? 'search' : (state.mode === 'agent' ? 'agent' : 'think'))
    });
    var body = aiEl.querySelector('.c-ai-body');
    var thinkBlock = null;
    var thinkBody = null;
    var thinkStarted = null;
    var thinkTimerId = null;
    var thinkDone = false;
    var researchWidget = null;
    var panelData = null;
    var isAgentTurn = state.mode === 'agent';
    var statusVibeTimer = null;
    var statusVibeIdx = 0;
    var statusLocked = false;

    function setWaitStatus(label, lock) {
      if (!body || !label) return;
      if (statusLocked && !lock) return;
      if (lock) statusLocked = true;
      if (A.setStreamWaitStatus) A.setStreamWaitStatus(body, label);
      else {
        var el = body.querySelector('[data-stream-status]');
        if (el) el.textContent = label;
      }
    }

    function startStatusVibes() {
      stopStatusVibes();
      if (isAgentTurn) return; // agent plate already narrates
      var pool = streamStatusVibes(sendModeHint);
      statusVibeIdx = 0;
      statusVibeTimer = setInterval(function () {
        if (!body || !body.classList.contains('is-streaming') || statusLocked) return;
        if (!body.querySelector('.acx-stream-wait')) {
          stopStatusVibes();
          return;
        }
        statusVibeIdx = (statusVibeIdx + 1) % pool.length;
        setWaitStatus(pool[statusVibeIdx], false);
      }, 2200);
    }

    function stopStatusVibes() {
      if (statusVibeTimer) {
        clearInterval(statusVibeTimer);
        statusVibeTimer = null;
      }
    }
    if (state.mode === 'research') {
      if (sendOpts.researchContinue && state.researchPanelData) {
        panelData = {
          query: sendOpts.researchQuery || state.researchPanelData.query || text,
          bundle: state.researchPanelData.bundle || null,
          sources: (state.researchPanelData.sources || []).slice(),
          skeleton: state.researchPanelData.skeleton || null,
          collectStarted: Date.now(),
          content: '',
          streaming: true,
          phase: 'collecting'
        };
      } else {
        panelData = { query: text, bundle: null, content: '', sources: [], streaming: true, phase: 'collecting', collectStarted: Date.now() };
      }
      researchWidget = createResearchWidget(panelData.query || text);
      aiEl.querySelector('.c-ai-wrap').insertBefore(researchWidget, aiEl.querySelector('.c-ai-body'));
      body.classList.add('c-ai-body--research-hidden');
      bindResearchPanelOpen(researchWidget, function () { return panelData; });
      state.researchPanelData = panelData;
      openResearchPanel(panelData);
      setTimeout(function () {
        if (researchWidget && researchWidget.classList.contains('is-active') && researchWidget.dataset.phase === '1') {
          setResearchPhase(researchWidget, 2);
        }
      }, 4000);
    }

    function syncResearchPanel() {
      if (!panelData) return;
      panelData.content = stripResearchStreamContent(acc);
      panelData.sources = streamSources.slice();
      if (state.researchPanelOpen) {
        if (panelData.streaming) renderResearchPanelStreaming(panelData);
        else renderResearchPanelBody(panelData, true);
      }
    }

    if (state.mode === 'reasoning') {
      thinkBlock = createThinkBlock();
      thinkBody = thinkBlock.querySelector('.c-think-body');
      aiEl.querySelector('.c-ai-wrap').insertBefore(thinkBlock, aiEl.querySelector('.c-ai-body'));
    }
    var agentWidget = null;
    if (state.mode === 'agent') {
      agentWidget = createAgentWidget();
      aiEl.querySelector('.c-ai-wrap').insertBefore(agentWidget, aiEl.querySelector('.c-ai-body'));
      setAgentPhase(agentWidget, 'plan');
    }
    thread.appendChild(aiEl);
    animateMsgFromComposer(aiEl, 90);
    scrollToMessageStart(aiEl);

    state.streaming = true;
    stopVoiceIfActive(true);
    updateSend();
    var acc = '';
    var accReason = '';
    var streamSources = [];
    var streamWidgets = [];
    var streamRaf = null;

    function updateThinkTimer() {
      if (!thinkBlock || !thinkStarted) return;
      var elapsed = Date.now() - thinkStarted;
      var timeEl = thinkBlock.querySelector('.c-think-time');
      if (timeEl) timeEl.textContent = formatThinkTime(elapsed);
    }

    function startThinkTimer() {
      if (!thinkBlock || thinkStarted) return;
      thinkStarted = Date.now();
      updateThinkTimer();
      thinkTimerId = setInterval(updateThinkTimer, 100);
    }

    function finishThinkBlock() {
      if (!thinkBlock || thinkDone) return;
      thinkDone = true;
      if (thinkTimerId) { clearInterval(thinkTimerId); thinkTimerId = null; }
      var elapsed = thinkStarted ? Date.now() - thinkStarted : 0;
      thinkBlock.classList.remove('is-thinking', 'is-open');
      var label = thinkBlock.querySelector('.c-think-label');
      var timeEl = thinkBlock.querySelector('.c-think-time');
      if (label) label.textContent = t('think.done');
      if (timeEl) timeEl.textContent = formatThinkTime(elapsed);
      if (!accReason.trim()) thinkBlock.hidden = true;
    }


    var linkEnhanceAt = 0;
    function flushStream() {
      streamRaf = null;
      if (state.mode !== 'research') {
        A.syncStreamMarkdown(body, stripMemoryMarkers(acc));
        if (streamWidgets.length && window.ACXWidgets && !body.querySelector('.acx-md-widget-layout')) {
          window.ACXWidgets.decorateBody(body, acc, streamWidgets);
        }
        var now = Date.now();
        if (window.ACXEnhance && window.ACXEnhance.enhanceMessageLinks && now - linkEnhanceAt > 900) {
          linkEnhanceAt = now;
          window.ACXEnhance.enhanceMessageLinks(body);
        }
      }
      syncResearchPanel();
      scrollToMessageStart(aiEl);
    }

    function scheduleStream() {
      if (streamRaf) return;
      streamRaf = requestAnimationFrame(flushStream);
    }

    function startChatStream(preparedAtt) {
      var sendMode = resolveSendMode(preparedAtt, state.mode);
      sendModeHint = sendMode;
      if (!statusLocked) setWaitStatus(streamStatusLabel('', sendMode), false);
      startStatusVibes();
      var payload = {
        message: displayText,
        model: cur.key,
        web: state.web || state.mode === 'web',
        mode: sendMode,
        attachments: preparedAtt,
        conversation_id: state.conversationId || 0,
        local_id: state.localId || '',
        locale: uiLang()
      };
      if (state.ephemeral || state.ephemeralPending) payload.ephemeral = true;
      if (sendOpts.researchContinue && sendOpts.researchBase) {
        payload.research_continue = true;
        payload.research_base = sendOpts.researchBase;
        if (sendOpts.researchQuery) payload.research_query = sendOpts.researchQuery;
      }
      state.lastStreamPayload = payload;

      state.stream = A.API.chatStream(payload, {
        onStatus: function (payload) {
          if (!payload) return;
          var phase = payload.phase || payload.status || '';
          if (payload.label) {
            setWaitStatus(String(payload.label), true);
            return;
          }
          setWaitStatus(streamStatusLabel(phase, sendModeHint), true);
        },
        onMeta: function (meta) {
          if (meta.conversation_id) state.conversationId = meta.conversation_id;
          if (meta.local_id) state.localId = meta.local_id;
          if (meta.model_key) {
            var used = modelByKey(meta.model_key);
            var badge = aiEl.querySelector('.c-ai-meta');
            if (badge) {
              badge.className = 'c-ai-meta ' + modelDotClass(used.key);
              badge.innerHTML = modelDotBall(used.key, 9) + ' ' + A.esc(used.name);
            }
            if (meta.model_fallback_from && meta.model_fallback_from !== meta.model_key) {
              toast(t('toast.researchFallback', {
                from: modelByKey(meta.model_fallback_from).name,
                to: used.name
              }));
            }
          }
          if (state.ephemeral || state.ephemeralPending) {
            state.ephemeral = true;
            state.ephemeralPending = false;
            updateEphemeralUI();
          }
          if (!state.chatTitle) state.chatTitle = t('chat.new');
          syncChatUrl(true);
          updateChatTitleBar();
          if (!state.ephemeral) noteLiveChat();
        },
        onReasoning: function (piece) {
          // Рассуждение приходит в любом режиме. Режим «Рассуждение» рисует его
          // на лету, остальные режимы только копят (классические deltas).
          if (state.mode === 'reasoning' && thinkBody) startThinkTimer();
          accReason += A.stripCjkLeaks(piece, uiLang(), streamUserText);
          if (state.mode === 'reasoning' && thinkBody) {
            thinkBody.textContent = accReason;
            scrollToMessageStart(aiEl);
          }
        },
        onReplace: function (finalText) {
          // Сервер поправил уже показанный текст (язык/бренд) — заменяем целиком.
          acc = A.stripCjkLeaks(String(finalText || ''), uiLang(), streamUserText);
          scheduleStream();
        },
        onWidgets: function (payload) {
          streamWidgets = (payload && payload.items) ? payload.items.slice() : [];
        },
        onMemory: function (payload) {
          applyMemoryEvent(payload);
        },
        onAgent: function (eventName, payload) {
          handleAgentEvent(agentWidget, eventName, payload || {});
        },
        onResearch: function (payload) {
          if (!panelData || !payload) return;
          panelData.bundle = payload;
          panelData.phase = 'writing';
          if (payload.sources && payload.sources.length) streamSources = payload.sources.slice();
          if (researchWidget) applyResearchBundleToWidget(researchWidget, payload);
          updateResearchPanelChannels(payload);
          if (!state.researchPanelOpen) openResearchPanel(panelData);
          syncResearchPanel();
          scrollDown();
        },
        onResearchProgress: function (progress) {
          if (researchWidget) updateResearchProgress(researchWidget, progress);
          if (panelData && progress) {
            if (!panelData.bundle) panelData.bundle = { stats: {}, channels: [], steps: [], sources: [] };
            if (progress.sources_total != null) {
              panelData.bundle.stats = panelData.bundle.stats || {};
              panelData.bundle.stats.sources_total = progress.sources_total;
            }
            if (progress.channel_log) panelData.bundle.channel_log = progress.channel_log;
            if (progress.channel) {
              var chId = progress.channel;
              var chs = panelData.bundle.channels || [];
              var found = false;
              chs = chs.map(function (ch) {
                if (ch.id === chId) {
                  found = true;
                  return { id: ch.id, label: ch.label, count: (ch.count || 0) + 1, status: 'done' };
                }
                return ch;
              });
              if (!found) {
                chs.push({ id: chId, label: chId, count: 1, status: 'done' });
              }
              panelData.bundle.channels = chs;
              updateResearchPanelChannels(panelData.bundle);
            }
            panelData.phase = 'collecting';
            syncResearchPanel();
          }
        },
        onResearchSkeleton: function (sk) {
          if (researchWidget) applyResearchSkeleton(researchWidget, sk);
          if (panelData) {
            panelData.skeleton = sk;
            panelData.phase = 'collecting';
            if (panelData.bundle) panelData.bundle.outline = sk.sections || panelData.bundle.outline;
            syncResearchPanel();
          }
        },
        onSources: function (payload) {
          streamSources = (payload && payload.sources) || [];
          if (panelData) panelData.sources = streamSources.slice();
          attachSources(aiEl, streamSources);
          if (researchWidget) setResearchPhase(researchWidget, 2);
          syncResearchPanel();
          scrollDown();
        },
        onResearchReport: function (payload) {
          if (!panelData || !payload || !payload.content) return;
          acc = A.stripCjkLeaks(String(payload.content), uiLang(), streamUserText);
          panelData.content = stripResearchStreamContent(acc);
          panelData.phase = 'writing';
          if (state.researchPanelOpen) renderResearchPanelStreaming(panelData);
          scheduleStream();
        },
        onToken: function (piece) {
          if (!acc) {
            stopStatusVibes();
            statusLocked = true;
          }
          if (researchWidget && !acc) setResearchPhase(researchWidget, 3);
          if (thinkBlock && accReason && !acc) finishThinkBlock();
          if (agentWidget && !acc) setAgentPhase(agentWidget, 'done');
          acc += A.stripCjkLeaks(piece, uiLang(), streamUserText);
          if (panelData && state.mode === 'research') {
            panelData.phase = 'writing';
            panelData.content = stripResearchStreamContent(acc);
            if (state.researchPanelOpen) renderResearchPanelStreaming(panelData);
          }
          scheduleStream();
        },
        onDone: function (meta) {
          stopStatusVibes();
          if (streamRaf) { cancelAnimationFrame(streamRaf); streamRaf = null; }
          finishThinkBlock();
          if (agentWidget) setAgentPhase(agentWidget, 'done');
          acc = A.stripCjkLeaks(stripResearchStreamContent(acc), uiLang(), streamUserText);
          if (!acc && accReason.trim()) {
            acc = extractFinalFromReasoning(accReason);
          }
          if (sendOpts.appendResearchBase) {
            acc = sendOpts.appendResearchBase.trim() + '\n\n' + acc;
          }
          state.streaming = false;
          state.stream = null;
          updateSend();
          var aborted = meta && meta.aborted;
          if (!acc && aborted) {
            aiEl.remove();
            return;
          }
          flushStream();
          if (!acc) {
            // Stream often finishes before/without tokens on flaky FCGI — recover from saved history
            // (same effect as Ctrl+Shift+R, without making the user do it).
            recoverAssistantFromHistory().then(function (recovered) {
              if (recovered) {
                acc = recovered;
                finishSuccessfulAssistant(false);
                return;
              }
              body.classList.remove('is-streaming', 'c-ai-body--research-hidden');
              body.innerHTML = '<p style="color:var(--ink-400)">' + (accReason ? t('stream.noAnswer') : t('stream.empty')) + '</p>';
              if (panelData) {
                panelData.streaming = false;
                panelData.content = '';
                if (state.researchPanelOpen) renderResearchPanelBody(panelData);
              }
              if (accReason.trim() && state.mode === 'reasoning') {
                var partialMsg = { role: 'assistant', content: '', reasoning: accReason };
                state.messages.push(partialMsg);
                addActions(aiEl, '', state.messages.length - 1);
                revealMessageChrome(aiEl, { delay: 180, hideModel: isAgentTurn });
              }
              if (!aborted) toast(accReason ? t('stream.noAnswer') : t('stream.empty'), true);
            });
            return;
          }
          finishSuccessfulAssistant(!!aborted);
        },
        onError: function (msg) {
          stopStatusVibes();
          if (streamRaf) { cancelAnimationFrame(streamRaf); streamRaf = null; }
          if (thinkTimerId) { clearInterval(thinkTimerId); thinkTimerId = null; }
          if (agentWidget) setAgentPhase(agentWidget, 'done');
          state.streaming = false;
          state.stream = null;
          updateSend();
          // Sometimes the reply was saved while the SSE channel died — try history first.
          recoverAssistantFromHistory().then(function (recovered) {
            if (recovered) {
              acc = recovered;
              finishSuccessfulAssistant(false);
              return;
            }
            body.classList.remove('is-streaming', 'c-ai-body--research-hidden');
            var errText = A.esc(A.sanitizePublicError(msg || t('toast.error')));
            if (panelData && state.mode === 'research') {
              panelData.streaming = false;
              panelData.content = '';
              panelData.error = errText;
              openResearchPanel(panelData);
            }
            body.innerHTML = '<div class="c-stream-error"><p style="color:var(--ink-400)">' + errText + '</p>' +
              '<button type="button" class="c-retry-btn">' + A.esc(t('action.retry')) + '</button></div>';
            var retryBtn = body.querySelector('.c-retry-btn');
            if (retryBtn) {
              retryBtn.addEventListener('click', function () {
                aiEl.remove();
                var lastUser = state.messages[state.messages.length - 1];
                if (lastUser && lastUser.role === 'user') {
                  var userEl = thread.querySelector('.c-msg.user:last-child');
                  state.messages.pop();
                  if (userEl) userEl.remove();
                  send(lastUser.content, lastUser.attachments || []);
                } else if (state.lastStreamPayload) {
                  send(state.lastStreamPayload.message, state.lastStreamPayload.attachments || []);
                }
              });
            }
            if (researchWidget && researchWidget.classList.contains('is-active')) {
              finishResearchWidget(researchWidget, text);
            }
          });
        }
      });

      function recoverAssistantFromHistory() {
        var cid = state.conversationId;
        var lid = state.localId;
        if (!cid && !lid) return Promise.resolve('');
        var delays = [180, 500, 1100];
        function attempt(i) {
          var params = lid && state.guest ? { local_id: lid } : { conversation_id: cid };
          return A.API.history(params).then(function (j) {
            if (!j || !j.success || !j.messages || !j.messages.length) {
              if (i + 1 < delays.length) {
                return new Promise(function (resolve) {
                  setTimeout(function () { resolve(attempt(i + 1)); }, delays[i + 1]);
                });
              }
              return '';
            }
            var last = j.messages[j.messages.length - 1];
            var content = last && last.role === 'assistant' ? String(last.content || '').trim() : '';
            if (content && content !== '[рассуждение]') return content;
            if (i + 1 < delays.length) {
              return new Promise(function (resolve) {
                setTimeout(function () { resolve(attempt(i + 1)); }, delays[i + 1]);
              });
            }
            return '';
          }).catch(function () {
            if (i + 1 < delays.length) {
              return new Promise(function (resolve) {
                setTimeout(function () { resolve(attempt(i + 1)); }, delays[i + 1]);
              });
            }
            return '';
          });
        }
        return new Promise(function (resolve) {
          setTimeout(function () { resolve(attempt(0)); }, delays[0]);
        });
      }

      function finishSuccessfulAssistant(abortedFlag) {
        if (isAgentTurn) {
          acc = String(acc || '')
            .replace(/\[\[AX_CALL:[a-z0-9_]+\]\][\s\S]*?\[\[\/AX_CALL\]\]/gi, '')
            .replace(/\[\[AX_CALL:[a-z0-9_]+\]\][\s\S]*$/gi, '')
            .replace(/\[\[AX_RESULT:[a-z0-9_]+\]\][\s\S]*?\[\[\/AX_RESULT\]\]/gi, '')
            .replace(/\[\[\s*\/?AX_[A-Z0-9_]+(?::[^\]]*)?\]\]/gi, '')
            .trim();
          if (!acc) acc = t('agent.done');
        }
        A.finishStreamMarkdown(body, acc, { finish: true });
        scrollToMessageStart(aiEl);
        if (streamWidgets.length && window.ACXWidgets) {
          window.ACXWidgets.decorateBody(body, acc, streamWidgets);
        }
        setTimeout(function () {
          if (window.ACXEnhance && window.ACXEnhance.enhanceMessage) {
            window.ACXEnhance.enhanceMessage(body);
          }
        }, 900);
        if (researchWidget) {
          finishResearchWidget(researchWidget, text);
          body.innerHTML = '';
          body.classList.add('c-ai-body--research-hidden');
          bindResearchPanelOpen(researchWidget, function () { return panelData; });
        }
        if (streamSources.length) attachSources(aiEl, streamSources);
        var assistantMsg = { role: 'assistant', content: acc };
        if (isAgentTurn) assistantMsg.agent = true;
        if (state.mode === 'reasoning' && accReason.trim()) assistantMsg.reasoning = accReason;
        if (streamWidgets.length) assistantMsg.widgets = streamWidgets.slice();
        if (streamSources.length) assistantMsg.sources = streamSources.slice();
        if (panelData) {
          panelData.streaming = false;
          panelData.phase = 'done';
          panelData.content = acc;
          panelData.generatedAt = formatResearchTime(new Date());
          assistantMsg.research = {
            query: panelData.query,
            bundle: panelData.bundle,
            sources: streamSources.slice()
          };
          state.researchPanelData = panelData;
          if (!state.researchPanelOpen) openResearchPanel(panelData);
          if (state.researchPanelOpen) {
            finishResearchPanelStream(acc, function () {
              var panel = $('researchPanel');
              if (panel) panel.classList.remove('c-rpanel--streaming');
              renderResearchPanelBody(panelData, true);
              syncResearchContinueBtn(panelData);
            });
          } else {
            var panel = $('researchPanel');
            if (panel) panel.classList.remove('c-rpanel--streaming');
          }
          syncResearchContinueBtn(panelData);
          if (!abortedFlag) {
            var rTitle = (panelData.bundle && panelData.bundle.skeleton && panelData.bundle.skeleton.title) ||
              (panelData.bundle && panelData.bundle.title) || researchShortTitle(panelData.query || '');
            maybeNotifyResearchDone(rTitle);
          }
        }
        syncResearchTemplates();
        state.messages.push(assistantMsg);
        addActions(aiEl, acc, state.messages.length - 1);
        revealMessageChrome(aiEl, { delay: isAgentTurn ? 120 : 320, hideModel: isAgentTurn });
        if (!abortedFlag && panelData && researchContentTooShort(acc)) {
          toast(t('research.reportShort') || t('stream.empty'), true);
        }
        if (!abortedFlag) maybeGenerateTitle();
        if (!abortedFlag) A.API.bootstrap().then(function (b) { state.boot = b; renderUsage(); if (window.ACXEnhance) window.ACXEnhance.onBootstrap(b); });
        if (state.guest) {
          state.guestUserMsgCount = state.messages.filter(function (m) { return m.role === 'user'; }).length;
          if (window.ACXEnhance) window.ACXEnhance.maybeGuestUpsell(state.guestUserMsgCount);
        }
      }
    }

    prepareAttachmentsForSend(att).then(function (prepared) {
      var sendMode = resolveSendMode(prepared, state.mode);
      if (!preparedHasDocContent(prepared, sendMode)) {
        state.streaming = false;
        state.stream = null;
        updateSend();
        aiEl.remove();
        state.messages.pop();
        var userEl = thread.querySelector('.c-msg.user:last-child');
        if (userEl) userEl.remove();
        toast(t('toast.pdfNotReady'), true);
        return;
      }
      startChatStream(prepared);
    }).catch(function (e) {
      state.streaming = false;
      updateSend();
      aiEl.remove();
      state.messages.pop();
      toast(e.message || t('toast.error'), true);
    });
  }

  function resetChatView(skipUrl, opts) {
    opts = opts || {};
    if (state.stream) state.stream.abort();
    closeResearchPanel(true);
    state.researchPanelData = null;
    toggleSideSearch(false);
    state.messages = [];
    state.conversationId = null;
    state.localId = null;
    state.chatTitle = '';
    state.shareMode = false;
    state.titleGenPending = false;
    state.attachments = [];
    state.mode = 'chat';
    state.web = false;
    state.ephemeral = !!opts.ephemeral;
    state.ephemeralPending = !!opts.ephemeralPending;
    revokePdfPreviewBlob();
    state.streaming = false;
    stopVoiceIfActive(true);
    renderAttachRow();
    setShareBanner(false);
    input.value = '';
    autosize();
    updateSend();
    renderWelcome();
    renderHistory();
    syncModeTags();
    openSide(false);
    if (!skipUrl) history.pushState({ chat: null, share: null, lang: uiLang() }, '', localizedPath('/'));
    updateChatTitleBar();
    updateEphemeralUI();
    syncVoiceBtn();
    document.title = 'BEAM AGENT';
    input.focus();
  }

  function newChat(skipUrl) {
    purgeEphemeralChat().finally(function () {
      resetChatView(skipUrl, { ephemeral: false, ephemeralPending: false });
    });
  }

  function newTempChat(skipUrl) {
    purgeEphemeralChat().finally(function () {
      resetChatView(skipUrl, { ephemeral: true, ephemeralPending: true });
    });
  }

  $('newChat').addEventListener('click', function () { newChat(); });
  $('newChatTop').addEventListener('click', function () { newChat(); });
  if (tempChatBtn) tempChatBtn.addEventListener('click', function () { newTempChat(); });

  var deleteModal = $('deleteChatModal');
  if ($('deleteChatConfirm')) {
    $('deleteChatConfirm').addEventListener('click', function () { closeDeleteChatModal(true); });
  }
  if ($('deleteChatCancel')) {
    $('deleteChatCancel').addEventListener('click', function () { closeDeleteChatModal(false); });
  }
  if (deleteModal) {
    deleteModal.addEventListener('click', function (ev) {
      if (ev.target === deleteModal) closeDeleteChatModal(false);
    });
  }

  document.querySelectorAll('.acx-logo, .c-brand img, .c-top-pill img').forEach(function (el) {
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });

  window.addEventListener('beforeunload', function () {
    if (!state.ephemeral) return;
    if (state.guest && !state.localId) return;
    if (!state.guest && !state.conversationId) return;
    var payload = state.guest
      ? JSON.stringify({ action: 'guest_delete', local_id: state.localId })
      : JSON.stringify({ action: 'delete', conversation_id: state.conversationId });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(location.origin + '/api/chat.php', new Blob([payload], { type: 'application/json' }));
    }
  });

  var historySearch = $('historySearch');
  if (historySearch) {
    historySearch.addEventListener('input', function () {
      state.historyFilter = historySearch.value || '';
      renderHistory();
    });
  }

  function getChatReturnUrl() {
    var ret = window.location.href.split('#')[0];
    if (!/^https:\/\/agent\.assistix\.org/i.test(ret)) ret = 'https://agent.assistix.org/';
    return ret;
  }
  function buildChatLoginUrl() {
    var d = state.boot && state.boot.data;
    if (d && d.login_url) return d.login_url;
    var ret = getChatReturnUrl();
    return 'https://id.assistix.org/auth/?redirect_uri=' + encodeURIComponent('https://agent.assistix.org/auth/callback.php')
      + '&client_id=assistix-chat&state=' + encodeURIComponent(btoa(JSON.stringify({ next: ret, app: 'chat' })));
  }
  function cleanupIdProbe() {
    if (state.idProbeTimer) { clearTimeout(state.idProbeTimer); state.idProbeTimer = null; }
    window.removeEventListener('message', onAssistixIdEmbedMessage);
  }
  function onAssistixIdEmbedMessage(ev) {
    if (ev.origin !== ID_ORIGIN) return;
    var d = ev.data;
    if (!d || d.type !== 'assistix_id_session') return;
    cleanupIdProbe();
    state.idEmbedProbeComplete = true;
    if (!d.logged_in || !d.user) return;
    showIdResumeModal(d.user);
  }
  function hideIdResumeModal() {
    if (state.idModalEscBound) {
      document.removeEventListener('keydown', onIdResumeModalEsc);
      state.idModalEscBound = false;
    }
    var m = $('idResumeModal');
    if (m) m.classList.add('hidden');
  }
  function dismissIdResumeModal() {
    try {
      sessionStorage.setItem('assistix_id_hint_dismissed', '1');
      localStorage.setItem('assistix_chat_id_hint_snooze', String(Date.now()));
    } catch (e) {}
    hideIdResumeModal();
  }
  function onIdResumeModalEsc(ev) {
    if (ev.key !== 'Escape') return;
    var m = $('idResumeModal');
    if (!m || m.classList.contains('hidden')) return;
    dismissIdResumeModal();
  }
  function showIdResumeModal(user) {
    var m = $('idResumeModal');
    var tx = $('idResumeText');
    if (!m || !tx) return;
    var name = (user.display_name || '').trim();
    var em = (user.email_masked || '').trim();
    var line = name && em ? name + ' · ' + em : (em || name || t('modal.idAccount'));
    tx.textContent = t('modal.idResume', { line: line });
    m.classList.remove('hidden');
    var cont = $('idResumeContinueBtn');
    var dis = $('idResumeDismissBtn');
    if (cont) cont.onclick = function () { window.location.href = buildChatLoginUrl(); };
    if (dis) dis.onclick = dismissIdResumeModal;
    if (!state.idModalEscBound) {
      document.addEventListener('keydown', onIdResumeModalEsc);
      state.idModalEscBound = true;
    }
  }
  function maybeProbeAssistixIdSession() {
    if (!state.boot || !state.boot.data || state.boot.data.authenticated) return;
    if (state.idEmbedProbeComplete) return;
    try {
      if (sessionStorage.getItem('assistix_id_hint_dismissed') === '1') {
        state.idEmbedProbeComplete = true;
        return;
      }
      var sn = localStorage.getItem('assistix_chat_id_hint_snooze');
      if (sn && Date.now() - parseInt(sn, 10) < 86400000) {
        state.idEmbedProbeComplete = true;
        return;
      }
    } catch (e) {}
    window.addEventListener('message', onAssistixIdEmbedMessage);
    state.idProbeTimer = setTimeout(function () {
      cleanupIdProbe();
      state.idEmbedProbeComplete = true;
    }, 12000);
    var iframe = $('idSessionProbeFrame');
    if (!iframe) { cleanupIdProbe(); state.idEmbedProbeComplete = true; return; }
    iframe.src = ID_ORIGIN + '/api/embed-session-hint.php?parent_origin=' + encodeURIComponent(window.location.origin);
  }

  function handleRoute() {
    var sp = new URLSearchParams(location.search);
    var oauthErr = sp.get('oauth_error');
    if (oauthErr) {
      toast(t('toast.oauth', { err: oauthErr }), true);
      history.replaceState({}, '', localizedPath(window.ACX_I18N ? window.ACX_I18N.stripLangFromPath(location.pathname) : location.pathname));
    }
    var route = parseRoute();
    if (route && route.type === 'share') {
      loadShareView(route.token);
      return;
    }
    if (route && route.type === 'chat') {
      var isGuest = String(route.id).indexOf('g_') === 0;
      loadThread(route.id, isGuest || state.guest);
      return;
    }
    var q0 = sp.get('q');
    if (q0) {
      state.web = true;
      setComposerMode('web');
      input.value = q0;
      autosize();
      updateSend();
      setTimeout(function () { send(q0); history.replaceState({}, '', localizedPath('/')); }, 120);
      return;
    }
    if (!state.messages.length) input.focus();
  }

  window.addEventListener('popstate', function () {
    if (state.streaming) return;
    var route = parseRoute();
    if (!route) {
      if (state.conversationId || state.localId || state.shareMode) newChat(true);
      return;
    }
    if (route.type === 'share') loadShareView(route.token);
    else loadThread(route.id, String(route.id).indexOf('g_') === 0);
  });

  var chatShareBtn = $('chatShareBtn');
  if (chatShareBtn) {
    chatShareBtn.innerHTML = A.icon('share', 18);
    chatShareBtn.addEventListener('click', shareChat);
  }
  var shareLoginLink = $('shareLoginLink');
  if (shareLoginLink) {
    shareLoginLink.addEventListener('click', function (e) {
      e.preventDefault();
      var ret = location.href;
      location.href = buildChatLoginUrl();
    });
  }
  var shareCopyBtn = $('shareCopyBtn');
  if (shareCopyBtn) {
    shareCopyBtn.addEventListener('click', function () {
      var input = $('shareUrlInput');
      if (!input || !input.value) return;
      copyText(input.value).then(function () { toast(t('toast.linkCopied')); }).catch(function () { toast(t('toast.copyFail'), true); });
    });
  }
  var shareCloseBtn = $('shareCloseBtn');
  if (shareCloseBtn) shareCloseBtn.addEventListener('click', closeShareModal);
  var shareNativeBtn = $('shareNativeBtn');
  if (shareNativeBtn) {
    shareNativeBtn.addEventListener('click', function () {
      var input = $('shareUrlInput');
      if (!input || !input.value || !window.ACXSEO) return;
      window.ACXSEO.nativeShare({ title: document.title, url: input.value }).catch(function () {});
    });
  }
  var shareModal = $('shareModal');
  if (shareModal) {
    shareModal.addEventListener('click', function (e) {
      if (e.target === shareModal) closeShareModal();
    });
  }

  function findConversationInHistory(id) {
    var keys = Object.keys(state.historyGroups);
    for (var k = 0; k < keys.length; k++) {
      var list = state.historyGroups[keys[k]] || [];
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) === String(id) || list[i].local_id === id) return list[i];
      }
    }
    return null;
  }

  var idModal = $('idResumeModal');
  if (idModal) {
    idModal.addEventListener('click', function (ev) {
      if (ev.target === idModal) dismissIdResumeModal();
    });
  }

  function syncResearchPanelChrome() {
    var rpClose = $('researchPanelClose');
    if (rpClose) rpClose.setAttribute('aria-label', t('side.close'));
    var rpExportMd = $('researchExportMd');
    var rpExportPdf = $('researchExportPdf');
    var rpExportTxt = $('researchExportTxt');
    var rpExportDocx = $('researchExportDocx');
    if (rpExportMd) rpExportMd.title = t('action.exportMd');
    if (rpExportPdf) rpExportPdf.title = t('action.exportPdfShort');
    if (rpExportTxt) rpExportTxt.title = t('action.exportTxt');
    if (rpExportDocx) rpExportDocx.title = t('action.exportDocx');
  }

  function relocalizeMessageActions() {
    var map = {
      copy: 'action.copy',
      edit: 'action.edit',
      branch: 'action.branch',
      regen: 'action.regen'
    };
    thread.querySelectorAll('.c-actbtn[data-act]').forEach(function (btn) {
      var key = map[btn.getAttribute('data-act')];
      if (key) btn.title = t(key);
    });
  }

  function relocalizeThinkBlocks() {
    thread.querySelectorAll('.c-think-block').forEach(function (block) {
      var label = block.querySelector('.c-think-label');
      if (!label) return;
      label.textContent = block.classList.contains('is-thinking') ? t('think.label') : t('think.done');
    });
  }

  function applyUiLocale() {
    syncResearchPanelChrome();
    updateSend();
    relocalizeMessageActions();
    relocalizeThinkBlocks();
    if (findPdfAttachment() || state.pdfPreviewBlob) renderPdfAnalysisPanel();
    if (A.relocalizeCodeCopyButtons) A.relocalizeCodeCopyButtons(thread);
    if (state.researchPanelOpen && state.researchPanelData) renderResearchPanelBody(state.researchPanelData);
    var profileModal = $('profileModal');
    if (profileModal && !profileModal.classList.contains('hidden')) renderProfileModalContent();
    var subModal = $('subModal');
    if (subModal && !subModal.classList.contains('hidden')) renderSubscriptionModalContent();
  }

  /* init */
  if (window.ACX_I18N) {
    window.ACX_I18N.onChange = function () {
      $('newChatTop').innerHTML = A.icon('plus', 16) + ' <span class="tx">' + t('top.new') + '</span>';
      syncComposerPlaceholder();
      renderModeTags();
      renderSelectors();
      renderUsage();
      renderAuth();
      loadHistoryList();
      updateEphemeralUI();
      syncVoiceBtn();
      applyUiLocale();
      applyPageSeo();
      if (voice && voice.active) voice.refreshUi();
      if (!state.messages.length && !parseRoute()) renderWelcome();
    };
    window.ACX_I18N.init();
  }
  renderWelcome();
  updateEphemeralUI();
  syncVoiceBtn();
  updateSend();
  if (window.ACXAttachPreview) window.ACXAttachPreview.init({ A: A, t: t });

  A.API.bootstrap().then(function (b) {
    state.boot = b;
    state.guest = !(b.data && b.data.authenticated);
    if (!state.guest) {
      var saved = localStorage.getItem('acx_model');
      if (saved) state.model = saved;
      if (window.ACXEnhance) window.ACXEnhance.importGuestIfNeeded();
    } else {
      state.model = 'GUEST';
    }
    renderAuth();
    renderUsage();
    renderSelectors();
    syncModeTags();
    syncComposerPlaceholder();
    if (window.ACXEnhance) window.ACXEnhance.onBootstrap(b);
    return loadHistoryList(true);
  }).then(function () {
    if (!state.messages.length && !parseRoute()) renderWelcome();
    handleRoute();
    if (!parseRoute()) applyPageSeo();
    maybeProbeAssistixIdSession();
    if (window.ACXEnhance) window.ACXEnhance.init();
  }).catch(function () { toast(t('toast.loadFail'), true); });

  window.ACXChat = {
    state: state,
    t: t,
    $: $,
    A: A,
    toast: toast,
    send: send,
    loadHistoryList: loadHistoryList,
    loadThread: loadThread,
    openProfile: openProfileModal,
    buildChatLoginUrl: buildChatLoginUrl,
    exportResearchMarkdown: exportResearchMarkdown,
    openResearchPanel: openResearchPanel,
    renderResearchPanelBody: renderResearchPanelBody,
    researchShortTitle: researchShortTitle,
    markdownToc: markdownToc
  };

  function exportResearchMarkdown(data) {
    data = data || state.researchPanelData;
    if (!data) return;
    var RX = window.ACXResearchExport;
    if (!RX || !RX.exportMarkdown) return;
    RX.exportMarkdown(data, t, markdownToc).catch(function () {
      if (typeof toast === 'function') toast(t('toast.error'), true);
    });
  }

})();
