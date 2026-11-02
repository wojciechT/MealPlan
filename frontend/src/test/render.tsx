import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'

/** A fresh client per test, with retries off so failures surface at once. */
export function renderPage(ui: ReactElement, route = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

export const ingredients = [
  { id: 'i1', name: 'Tomato', category: 'Vegetables' },
  { id: 'i2', name: 'Pasta', category: 'Dry goods' },
]

export const recipes = [
  {
    id: 'r1',
    name: 'Tomato pasta',
    steps: ['Boil the pasta.', 'Toss together.'],
    ingredients: [
      { ingredientId: 'i1', name: 'Tomato', category: 'Vegetables', amount: 250, unit: 'gram' },
      { ingredientId: 'i2', name: 'Pasta', category: 'Dry goods', amount: 200, unit: 'gram' },
    ],
    reference: null,
    tags: ['quick'],
  },
]

export const shoppingList = [
  {
    category: 'Vegetables',
    lines: [{ ingredientId: 'i1', name: 'Tomato', amount: 500, unit: 'gram' }],
  },
]

/** Answers each endpoint the pages call, by path. */
export function stubApi(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/api/ingredients': ingredients,
    '/api/recipes': recipes,
    '/api/plan': [],
    '/api/shopping-list': shoppingList,
    ...overrides,
  }

  return async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://localhost').pathname
    const body = routes[path]

    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({ detail: `No stub for ${path}.` }) } as Response
    }

    return { ok: true, status: 200, json: async () => body } as Response
  }
}
