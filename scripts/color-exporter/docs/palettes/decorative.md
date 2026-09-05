# Decorative

## Источник и результат

- страница Figma: `colors_decorative.json`;
- файл в коде: `styles/colors_decorative.json`;
- модуль: `src/palettes/decorative.mts`.

## Секции

Разрешены режимы переменной Figma `light` и `dark`: секция записывается как `<light|dark>/<family>`. Обычный и `_inverted` варианты допускаются для следующих семей:

- `decorative`;
- `decorative-soft`;
- `decorative-muted`;
- `decorative-muted-alt`;
- `decorative-text`.

## Состояния

- `decorative-text` содержит только `default`;
- фреймы `red` и `yellow` во всех семьях содержат только `default`;
- остальные фреймы содержат любое непустое подмножество `default`, `hover`, `press` в таком порядке;
- любое число `empty` в любой позиции безусловно игнорируется, их остальные свойства не читаются.

## Алгоритм полей JSON

Decorative полностью использует [стандартный алгоритм всех пяти полей](../TOKEN_FIELDS.md) без отличий. Особый модуль только ограничивает допустимые семьи и настоящие состояния отдельных фреймов.

## Пример

```text
секция: dark/decorative-soft_inverted
фрейм: green
состояние: press
```

```text
key   = dark_decorative_soft_green_inverted_press
figma = decorative-soft_inverted/green/press
web   = --color-dark-decorative-soft-green-inverted-press
alias = decorativeSoftColorGreenInvertedPress
```
