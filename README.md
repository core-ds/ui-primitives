Design tokens for UI libraries. Web, iOS, Android.

-   Colors
-   Typography
-   Grid (gaps)
-   Icons

**Deprecated colors**:

-   `colors.json`
-   `styles/colors.json`
-   `styles/mobile-colors.json`

## Добавление новой палитры
Для того чтобы добавить новую палитру, необходимо переключиться в ветку `gh-pages` и добавить импорт JSON-файла палитры в `src/vars.ts`.

## Работа поиска
Когда происходит запрос, внутри срабатывает проверка по регулярному выражению, к чему относится токен — к цветам или типографике, и вызывается соответствующая функция конвертации.

## Конвертация цветов
Конвертация цветов происходит либо по алиасу, либо по цветовому ключу.

## Конвертация типографики
Конвертация типографики парсит токен и конструирует объект ответа в зависимости от платформы.