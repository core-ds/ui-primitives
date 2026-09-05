# Monochrome

## Источник и результат

- страница Figma: `colors_monochrome.json`;
- файл в коде: `styles/colors_monochrome.json`;
- модуль: `src/palettes/monochrome.mts`.

## Секции и состояния

Динамические секции имеют вид `<light|dark>/monochrome-<black|white>` с необязательным `_inverted`: режим переменной Figma отделён `/`. Статические секции равны `static_monochrome-black` или `static_monochrome-white`: режим токена `static` записан в имени переменной.

Имя фрейма — целое число процентов. После безусловного игнорирования любого числа `empty` каждый фрейм содержит ровно один настоящий `default`; состояния взаимодействия не разрешены.

## Алгоритм полей JSON

Monochrome полностью использует [стандартный алгоритм всех пяти полей](../TOKEN_FIELDS.md) без отличий. Отличается только проверка имени фрейма: разрешено целое неотрицательное число без дробной части.

## Порядок в JSON

Активные токены сортируются по полному JSON-ключу тем же общим алгоритмом, что и остальные наборы. Числовая часть имени не получает отдельной обработки. Устаревшие токены, если появятся, выносятся в отдельный алфавитный хвост.

## Пример

```text
секция: dark/monochrome-white_inverted
фрейм: 88
```

```text
key   = dark_monochrome_white_88_inverted
figma = monochrome-white_inverted/88
web   = --color-dark-monochrome-white-88-inverted
alias = monochromeWhiteColor88Inverted
```
