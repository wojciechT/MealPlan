import { useQuery } from '@tanstack/react-query'
import { api, query } from './client'
import type { ShoppingCategory } from './types'

export const shoppingListKeys = {
  range: (from: string, to: string) => ['shoppingList', from, to] as const,
}

export const useShoppingList = (from: string, to: string) =>
  useQuery({
    queryKey: shoppingListKeys.range(from, to),
    queryFn: () => api.get<ShoppingCategory[]>(`/shopping-list${query({ from, to })}`),
  })
