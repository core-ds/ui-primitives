# Students

## Где находится набор

- страница Figma: `colors_students.json`;
- файл в коде: `styles/colors_students.json`;
- модуль: `src/palettes/students.mts`.

## Допустимая раскладка

На странице разрешена ровно одна секция: `static_students`. `static` является режимом токена и записан в имени переменной. Имя фрейма состоит из строчных латинских букв, цифр и дефисов. После безусловного игнорирования любого числа `empty` каждый фрейм содержит ровно один настоящий `default`; состояния взаимодействия не разрешены.

Новый фрейм с допустимым именем проходит ту же формулу автоматически. Список названий цветов в модуле не зашит.

## Алгоритм полей JSON

Students полностью использует [стандартный алгоритм всех пяти полей](../TOKEN_FIELDS.md) без отличий. `hex` всегда пересчитывается и записывается строчными буквами, как у всех остальных наборов.

## Формула

```text
секция: static_students
фрейм:  electric-lime

key   = static_students_electric_lime
figma = static_students/electric-lime
web   = --color-static-students-electric-lime
alias = staticStudentsColorElectricLime
```

Полный объект после чтения цвета `#8fff00`:

```json
{
    "rgba": "rgba(143, 255, 0, 1)",
    "hex": "#8fff00",
    "figma": "static_students/electric-lime",
    "web": "--color-static-students-electric-lime",
    "alias": "staticStudentsColorElectricLime"
}
```
