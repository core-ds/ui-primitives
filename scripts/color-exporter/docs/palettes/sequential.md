# Sequential

## Источник и результат

- страница Figma: `colors_sequential.json`;
- файл в коде: `styles/colors_sequential.json`;
- модуль: `src/palettes/sequential.mts`.

## Секции и состояния

Секция имеет вид `light/sequential-<color>` или `dark/sequential-<color>`: слева находится режим переменной Figma, справа — семейство. Имя цвета и имя шага состоят из строчных букв, цифр и дефисов. После безусловного игнорирования любого числа `empty` каждый фрейм содержит ровно один настоящий `default`.

## Алгоритм полей JSON

Sequential полностью использует [стандартный алгоритм всех пяти полей](../TOKEN_FIELDS.md) без отличий.

## Пример

```text
секция: dark/sequential-blue
фрейм: 8
```

```text
key   = dark_sequential_blue_8
figma = sequential-blue/8
web   = --color-dark-sequential-blue-8
alias = sequentialBlueColor8
```

Новый шаг, например `9`, экспортируется без изменения модуля.
