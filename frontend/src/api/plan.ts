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
  /** Present when filling a slot, absent when clearing it. */
  recipe?: RecipeSummary
}

/**
 * Writing a slot is optimistic: the grid is the thing you are looking at while
 * you click, so waiting for a round trip to see your own change reads as lag.
 * A failure rolls the cache back and surfaces the error.
 */
function useSlotMutation(
  from: string,
  to: string,
  write: (change: SlotChange) => Promise<unknown>,
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

          if (change.recipe === undefined) {
            delete meals[change.mealTime]
          } else {
            meals[change.mealTime] = change.recipe
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

export const useSetMeal = (from: string, to: string) =>
  useSlotMutation(from, to, (change) =>
    api.put(`/plan/${change.date}/${change.mealTime}`, { recipeId: change.recipe!.id }),
  )

export const useClearMeal = (from: string, to: string) =>
  useSlotMutation(from, to, (change) => api.delete(`/plan/${change.date}/${change.mealTime}`))
