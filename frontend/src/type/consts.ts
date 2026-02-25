export const UNITS = ['мл', 'гр', 'л', 'кг', 'шт', 'дэш'] as const
export const GLASS = ['Винный бокал', 'Коктейльная рюмка', 'Рокс', 'Хайбол', 'Флюте'] as const
export const ICE = ['Фрапе', 'Куб', 'Без льда', 'Шар'] as const
export const METHOD = ['Билд', 'Шейк', 'Мадл', 'Стир'] as const

export type Unit = (typeof UNITS)[number] | ''
export type Glass = (typeof GLASS)[number] | ''
export type Ice = (typeof ICE)[number] | ''
export type Method = (typeof METHOD)[number] | ''
