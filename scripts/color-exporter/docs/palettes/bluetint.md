# BlueTint

## Источник и результат

- страница Figma: `colors_bluetint.json`;
- файл в коде: `styles/colors_bluetint.json`;
- модуль: `src/palettes/bluetint.mts`.

## Секции и состояния

Динамическая секция имеет вид `<light|dark>/<семейство>` или `<light|dark>/<семейство>_inverted`: слева записан режим переменной Figma, справа — путь имени. Статическая секция имеет вид `static_<семейство>` или `static_<семейство>_inverted`: здесь `static` является режимом токена и уже записан в имени переменной. Эти формы не объединяются. После безусловного игнорирования всех прямоугольников с точным именем `empty` фрейм содержит непустое подмножество состояний `default`, `hover`, `press` в этом порядке. Необязательное состояние можно пропустить.

`empty` можно повторять в любой позиции. Его свойства не читаются, он не заменяет конкретное состояние и просто не экспортируется. Общее правило описано в [`../FIGMA_FORMAT.md`](../FIGMA_FORMAT.md#служебный-прямоугольник-empty).

## Алгоритм полей JSON

BlueTint полностью использует [стандартный алгоритм всех пяти полей](../TOKEN_FIELDS.md) без отличий. Секция проверяется более узким правилом BlueTint, но формулы `key`, `rgba`, `hex`, `figma`, `web` и `alias` стандартные.

## Пример

```text
секция: dark/accent_inverted
фрейм: primary
состояние: hover
```

Результат:

```text
key   = dark_accent_primary_inverted_hover
figma = accent_inverted/primary/hover
web   = --color-dark-accent-primary-inverted-hover
alias = accentColorPrimaryInvertedHover
```

Новое имя фрейма из строчных букв, цифр и дефисов проходит ту же формулу.
