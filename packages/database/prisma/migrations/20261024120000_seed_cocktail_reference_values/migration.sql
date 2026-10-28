INSERT INTO "reference_values" (
  "id",
  "type",
  "code",
  "label",
  "venueId",
  "sortOrder",
  "isActive",
  "createdByUserId",
  "createdAt"
)
SELECT
  gen_random_uuid(),
  seed."type"::"ReferenceValueType",
  seed."code",
  seed."label",
  NULL,
  0,
  true,
  NULL,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('GLASS', 'бокал-маргарита', 'Бокал «Маргарита»'),
    ('GLASS', 'винный-бокал', 'Винный бокал'),
    ('GLASS', 'коктейльная-рюмка', 'Коктейльная рюмка'),
    ('GLASS', 'рокс', 'Рокс'),
    ('GLASS', 'флюте', 'Флюте'),
    ('GLASS', 'хайбол', 'Хайбол'),
    ('GLASS', 'шале', 'Шале'),
    ('GLASS', 'шот', 'Шот'),
    ('ICE', 'без-льда', 'Без льда'),
    ('ICE', 'крупный-куб', 'Крупный куб'),
    ('ICE', 'кубики-льда', 'Кубики льда'),
    ('ICE', 'фраппе', 'Фраппе'),
    ('ICE', 'шар', 'Шар'),
    ('PREPARATION_METHOD', 'билд', 'Билд'),
    ('PREPARATION_METHOD', 'бленд', 'Бленд'),
    ('PREPARATION_METHOD', 'драй-шейк', 'Драй-шейк'),
    ('PREPARATION_METHOD', 'ролл', 'Ролл'),
    ('PREPARATION_METHOD', 'сквизл', 'Сквизл'),
    ('PREPARATION_METHOD', 'стир', 'Стир'),
    ('PREPARATION_METHOD', 'шейк', 'Шейк')
) AS seed("type", "code", "label")
WHERE NOT EXISTS (
  SELECT 1
  FROM "reference_values" existing
  WHERE existing."venueId" IS NULL
    AND existing."type" = seed."type"::"ReferenceValueType"
    AND existing."code" = seed."code"
);
