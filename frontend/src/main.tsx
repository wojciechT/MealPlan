import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import App from './App'
import './index.css'
import IngredientsPage from './routes/IngredientsPage'
import PlannerPage from './routes/PlannerPage'
import RecipeEditorPage from './routes/RecipeEditorPage'
import RecipesPage from './routes/RecipesPage'
import ShoppingListPage from './routes/ShoppingListPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The data only changes when this browser changes it, so refetching on
      // every window focus is noise.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const router = createBrowserRouter([
  {
    path: '/',
    Component: App,
    children: [
      { index: true, Component: PlannerPage },
      { path: 'recipes', Component: RecipesPage },
      { path: 'recipes/new', Component: RecipeEditorPage },
      { path: 'recipes/:id', Component: RecipeEditorPage },
      { path: 'ingredients', Component: IngredientsPage },
      { path: 'shopping', Component: ShoppingListPage },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
