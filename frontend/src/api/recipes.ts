import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from './client'
import type { Recipe, RecipeRequest } from './types'

// A type alias rather than an interface: only aliases get the implicit index
// signature that `query` needs.
export type RecipeFilters = {
  search?: string
  tag?: string
}

export const recipeKeys = {
  all: ['recipes'] as const,
  list: (filters: RecipeFilters) => ['recipes', filters] as const,
  one: (id: string) => ['recipe', id] as const,
}

export const useRecipes = (filters: RecipeFilters = {}) =>
  useQuery({
    queryKey: recipeKeys.list(filters),
    queryFn: () => api.get<Recipe[]>(`/recipes${query(filters)}`),
  })

export const useRecipe = (id: string | undefined) =>
  useQuery({
    queryKey: recipeKeys.one(id ?? ''),
    queryFn: () => api.get<Recipe>(`/recipes/${id}`),
    enabled: id !== undefined,
  })

/** Everything a recipe write touches: the lists, the plan grid, the list. */
function invalidateAll(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: recipeKeys.all })
  void client.invalidateQueries({ queryKey: ['plan'] })
  void client.invalidateQueries({ queryKey: ['shoppingList'] })
}

export function useSaveRecipe() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...request }: RecipeRequest & { id?: string }) =>
      id === undefined
        ? api.post<Recipe>('/recipes', request)
        : api.put<Recipe>(`/recipes/${id}`, request),
    onSuccess: (saved) => {
      invalidateAll(client)
      void client.invalidateQueries({ queryKey: recipeKeys.one(saved.id) })
    },
  })
}

export function useDeleteRecipe() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: () => invalidateAll(client),
  })
}
