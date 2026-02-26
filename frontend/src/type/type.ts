import type { Ice, Method, Glass } from '@/type/consts'

// ----------------- Основной коктейль -----------------
export type Cocktail = {
  id: string
  name: string
  ingredients: CocktailIngredient[] // То, что реально добавлено в коктейль
  params: {
    glass: Glass
    ice: Ice
    method: Method
  }
  comment: string
  garnish: string | null // Гарнир может быть отдельным объектом
}

// // ----------------- "Просто ингредиент" -----------------
export type Ingredient = {
  name: string // Например, "Водка", "Сок"
}

// ----------------- Добавляемый в коктейль ингредиент -----------------
export type CocktailIngredient = {
  id: string
  name: string // Имя ингредиента или кастомного ингредиента
  amount: number | null // Количество
  unit: string // Единица измерения
}

// ----------------- Составной ингредиент -----------------
export type CustomIngredient = {
  id: string
  name: string
  ingredients: CocktailIngredient[] // Составные части
  comment: string // Описание приготовления
}

// ----------------- Гарнир -----------------
export type Garnish = {
  name: string
}

export type CustomGarnish = {
  id: string
  name: string
  ingredients: CocktailIngredient[] // Что входит в гарнир
  comment: string // Как приготовить/украсить
}

export type Task = {
  id: string
  name: string
  done: boolean
}

export type ToDo = {
  id: string
  name: string
  tasks: Task[]
}

// ----------------- Библиотеки -----------------
export type CocktailLib = Cocktail[] // Все коктейли
export type IngredientLib = Ingredient[] // Все базовые ингредиенты
export type CustomIngredientLib = CustomIngredient[] // Все составные
export type GarnishLib = Garnish[] // Все гарниры
export type CustomGarnishLib = CustomGarnish[]
export type ToDoLib = ToDo[]
