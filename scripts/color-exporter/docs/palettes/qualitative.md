# Qualitative

## Источник и результат

- страница Figma: `colors_qualitative.json`;
- файл в коде: `styles/colors_qualitative.json`;
- модуль: `src/palettes/qualitative.mts`.

## Секции и состояния

Режим переменной Figma равен `light` или `dark` и отделяется `/`. Разрешены пути:

- `qualitative-flexible`;
- `qualitative-monocolor`;
- `qualitative-duocolor/set-*`;
- `qualitative-tricolor/set-*`;
- `qualitative-tetracolor/set-*`.

После безусловного игнорирования любого числа `empty` каждый фрейм содержит ровно один настоящий `default`; состояния взаимодействия не разрешены.

## Алгоритм полей JSON

Qualitative полностью использует [стандартный алгоритм всех пяти полей](../TOKEN_FIELDS.md) без преобразования пути. Имя секции уже содержит настоящий путь `qualitative-duocolor/set-a`; режим слева от первого `/` не входит в `figma`, а внутренний `/set-a` сохраняется.

Полный пример:

```text
секция: light/qualitative-duocolor/set-a
фрейм: 1
```

```text
key   = light_qualitative_duocolor_set_a_1
figma = qualitative-duocolor/set-a/1
web   = --color-light-qualitative-duocolor-set-a-1
alias = qualitativeDuocolorSetAColor1
```
