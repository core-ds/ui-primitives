# SuperApp

Страница `colors_superapp.json`; [модуль](../../src/palettes/superapp.mts).

Для секций `light/superapp-surface`, `dark/superapp-surface`, `light/superapp-component`, `dark/superapp-component`, включая их `_inverted`, действует исключение совместимости. Оно применяется к фреймам с префиксом `bg-` и непустым остатком имени, например `bg-primary` и `bg-secondary`. Остальные секции и фреймы экспортируются по общим правилам.

Только при расчёте `alias` экспортёр переносит `bg` из начала имени фрейма в конец имени семейства. Это сохраняет прежний программный псевдоним, а `figma` отражает актуальное имя переменной. Например, `light/superapp-component` → `bg-secondary` → `press` даёт:

| Поле | Значение |
|---|---|
| Ключ | `light_superapp_component_bg_secondary_press` |
| `figma` | `superapp-component/bg-secondary/press` |
| `web` | `--color-light-superapp-component-bg-secondary-press` |
| `alias` | `superappComponentBgColorSecondaryPress` |

Без исключения `alias` стал бы `superappComponentColorBgSecondaryPress`; правило сохраняет `superappComponentBgColorSecondaryPress`. Ключ и `web` строятся по общей формуле из актуальной раскладки. Восемь существующих записей с актуальным `figma` уже опубликованы: повторный экспорт сохраняет их при неизменных цветах. Правило действует только для SuperApp и не переименовывает переменные Figma. Смешение старого и нового пути одного токена обнаруживает общая проверка уникальности.

У `_inverted` часть `bg` добавляется перед модификатором семейства: `dark/superapp-component_inverted` → `bg-secondary` → `press` даёт `superappComponentBgColorSecondaryInvertedPress`. Новый токен `text-primary` того же семейства использует общую формулу: `superappComponentColorTextPrimary`.

Цвет берётся из живого образца, а не из прежнего JSON. Состав состояний общий: любое непустое упорядоченное подмножество `default`, `hover`, `press`; `empty` пропускается. Изменённые цвета и новые имена проходят обычный экспорт. Проверки уникальности, порядок полей, сортировка и устаревание общие.

[Общий алгоритм](../FIGMA_FORMAT.md).
