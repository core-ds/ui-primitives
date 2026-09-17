# Исключения из общих правил

Применяются вместе с [общими правилами и глоссарием](01-general-rules.md#глоссарий). В схемах используются обозначения `[режим]`, `[семейство]`, `[токен]` и `[состояние]`; в примерах указаны их конкретные значения из JSON. Сборка раскладки описана в [инструкции для ИИ](03-ai-layout-guide.md).

## X5

**Отличие.** Статическая секция называется `static/[семейство]` вместо общего `static_[семейство]`. Слеш сохраняется в поле `figma`.

**Пример из [JSON](https://github.com/core-ds/ui-primitives/blob/dd2f172c960ec2df2e9ee24ba4c1dede68d1c27c/styles/colors_x5.json):**

```text
[секция] = static/brand
[токен] = primary
[состояние] = default
[ключ] = static_brand_primary
figma: static/brand/primary
alias: staticBrandColorPrimary
```

**Зачем.** Общая схема — `static_[семейство]`. Для X5 нужно сохранить `static/[семейство]`: замена разделителя изменила бы поле `figma` с `static/brand/primary` на `static_brand/primary`.

## SuperApp

**Отличие.** У семейств `superapp-surface` и `superapp-component` при расчёте `alias` начальная часть `bg` переносится из `[токен]` в конец `[семейство]`, перед `Color`. Поле `figma` сохраняет актуальное имя без такого переноса.

**Пример из [JSON](https://github.com/core-ds/ui-primitives/blob/dd2f172c960ec2df2e9ee24ba4c1dede68d1c27c/styles/colors_superapp.json):**

```text
[режим] = light
[семейство] = superapp-component
[токен] = bg-secondary
[состояние] = press
[ключ] = light_superapp_component_bg_secondary_press
figma: superapp-component/bg-secondary/press
alias: superappComponentBgColorSecondaryPress
```

**Зачем.** Общая формула дала бы `superappComponentColorBgSecondaryPress`. Исключение сохраняет прежний псевдоним после переименования переменной. Ключ, `web` и цвета при этом не меняются; `figma` сохраняет новый путь. Перестраивать Figma под старый `alias` не нужно.

Правило реализовано в [модуле SuperApp](../../src/palettes/superapp.mts). Оно применяется и при `[inverted]`; остальные семейства и токены без начального `bg-` используют общую формулу.
