import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Ingredient, IngredientRequest } from './types'

export const ingredientKeys = {
  all: ['ingredients'] as const,
}

export const useIngredients = () =>
  useQuery({
    queryKey: ingredientKeys.all,
    queryFn: () => api.get<Ingredient[]>('/ingredients'),
  })

export function useAddIngredient() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (request: IngredientRequest) => api.post<Ingredient>('/ingredients', request),
    onSuccess: () => client.invalidateQueries({ queryKey: ingredientKeys.all }),
  })
}

export function useUpdateIngredient() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...request }: IngredientRequest & { id: string }) =>
      api.put<Ingredient>(`/ingredients/${id}`, request),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ingredientKeys.all })
      // A renamed ingredient shows up inside recipes and the shopping list.
      void client.invalidateQueries({ queryKey: ['recipes'] })
      void client.invalidateQueries({ queryKey: ['shoppingList'] })
    },
  })
}

export function useDeleteIngredient() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/ingredients/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ingredientKeys.all }),
  })
}
