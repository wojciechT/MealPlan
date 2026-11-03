import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from './client'
import type { Day, MealTime, RecipeSummary } from './types'

export const planKeys = {
  all: ['plan'] as const,
  range: (from: string, to: string) => ['plan', from, to] as const,
}

export const usePlan = (from: string, to: string) =>
  useQuery({
    queryKey: planKeys.range(from, to),
    queryFn: () => api.get<Day[]>(`/plan${query({ from, to })}`),
  })

interface SlotChange {
  date: string
  mealTime: MealTime
  recipe: RecipeSummary
}

/** What a change does to the recipes already in its slot. */
type Apply = (current: RecipeSummary[], recipe: RecipeSummary) => RecipeSummary[]

/**
 * Writing a slot is optimistic: the grid is the thing you are looking at while
 * you click, so waiting for a round trip to see your own change reads as lag.
 * A failure rolls the cache back and surfaces the error.
 */
function useSlotMutation(
  from: string,
  to: string,
  write: (change: SlotChange) => Promise<unknown>,
  apply: Apply,
) {
  const client = useQueryClient()
  const key = planKeys.range(from, to)

  return useMutation({
    mutationFn: write,
    onMutate: async (change: SlotChange) => {
      await client.cancelQueries({ queryKey: key })

      const previous = client.getQueryData<Day[]>(key)

      client.setQueryData<Day[]>(key, (days) =>
        days?.map((day) => {
          if (day.date !== change.date) {
            return day
          }

          const meals = { ...day.meals }
          const next = apply(meals[change.mealTime] ?? [], change.recipe)

          if (next.length === 0) {
            delete meals[change.mealTime]
          } else {
            meals[change.mealTime] = next
          }

          return { ...day, meals }
        }),
      )

      return { previous }
    },
    onError: (_error, _change, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(key, context.previous)
      }
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: key })
      void client.invalidateQueries({ queryKey: ['shoppingList'] })
    },
  })
}

export const useAddMeal = (from: string, to: string) =>
  useSlotMutation(
    from,
    to,
    (change) => api.post(`/plan/${change.date}/${change.mealTime}`, { recipeId: change.recipe.id }),
    // The server ignores a recipe the slot already holds; so does the cache.
    (current, recipe) => (current.some((r) => r.id === recipe.id) ? current : [...current, recipe]),
  )

export const useRemoveMeal = (from: string, to: string) =>
  useSlotMutation(
    from,
    to,
    (change) => api.delete(`/plan/${change.date}/${change.mealTime}/${change.recipe.id}`),
    (current, recipe) => current.filter((r) => r.id !== recipe.id),
  )
