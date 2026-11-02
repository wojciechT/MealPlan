import type { MealTime, Unit } from '../api/types'

const unitLabels: Record<Unit, string> = {
  piece: 'pcs',
  gram: 'g',
  ml: 'ml',
}

export const unitLabel = (unit: Unit) => unitLabels[unit] ?? unit

/** "250 g", "2 pcs" — the amount as it reads on a shopping list. */
export const formatQuantity = (amount: number, unit: Unit) => `${amount} ${unitLabel(unit)}`

const mealTimeLabels: Record<MealTime, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  supper: 'Supper',
}

export const mealTimeLabel = (mealTime: MealTime) => mealTimeLabels[mealTime] ?? mealTime
