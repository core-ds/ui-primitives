# Brand

## Источник и результат

- страница Figma: `colors_brand.json`;
- файл в коде: `styles/colors_brand.json`;
- модуль: `src/palettes/brand.mts`.

## Секции и состояния

Допускается только секция `static_brand`. Режим токена `static` записан в имени переменной. После безусловного игнорирования любого числа `empty` каждый фрейм содержит ровно один настоящий `default`.

## Алгоритм полей JSON

Brand полностью использует [стандартный алгоритм всех пяти полей](../TOKEN_FIELDS.md) без отличий. Режим токена `static_` сохраняется и в ключе, и в пути `figma`.

## Пример

```text
секция: static_brand
фрейм: bright-blue
```

```text
key   = static_brand_bright_blue
figma = static_brand/bright-blue
web   = --color-static-brand-bright-blue
alias = staticBrandColorBrightBlue
```

Новое допустимое имя фрейма автоматически проходит ту же формулу.
