// Mirrors backend/MealPlan.Host/Contracts.cs. Kept by hand — the surface is
// small, and the alternative (generating from the OpenAPI document) is more
// machinery than four screens justify.

export const MEAL_TIMES = ['breakfast', 'lunch', 'dinner', 'supper'] as const
export type MealTime = (typeof MEAL_TIMES)[number]

export const UNITS = ['piece', 'gram', 'ml'] as const
export type Unit = (typeof UNITS)[number]

export interface Ingredient {
  id: string
  name: string
  category: string
}

export interface IngredientRequest {
  name: string
  category: string
}

export interface RecipeIngredient {
  ingredientId: string
  name: string
  category: string
  amount: number
  unit: Unit
}

export interface Recipe {
  id: string
  name: string
  steps: string[]
  ingredients: RecipeIngredient[]
  reference: string | null
  tags: string[]
}

export interface RecipeRequest {
  name: string
  steps: string[]
  ingredients: { ingredientId: string; amount: number; unit: Unit }[]
  reference: string | null
  tags: string[]
}

export interface RecipeSummary {
  id: string
  name: string
  tags: string[]
}

export interface Day {
  /** yyyy-MM-dd */
  date: string
  meals: Partial<Record<MealTime, RecipeSummary>>
}

export interface ShoppingLine {
  ingredientId: string
  name: string
  amount: number
  unit: Unit
}

export interface ShoppingCategory {
  category: string
  lines: ShoppingLine[]
}
