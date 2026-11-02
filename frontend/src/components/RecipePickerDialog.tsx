import { useState } from 'react'
import { useRecipes } from '../api/recipes'
import type { RecipeSummary } from '../api/types'
import { Dialog, EmptyState, ErrorBanner, Input, Spinner } from './ui'

export function RecipePickerDialog({
  open,
  title,
  onClose,
  onPick,
}: {
  open: boolean
  title: string
  onClose: () => void
  onPick: (recipe: RecipeSummary) => void
}) {
  const [search, setSearch] = useState('')
  // Unfiltered on the server, filtered here: the list is already cached for
  // the grid, so searching costs nothing and stays instant.
  const { data, isPending, error } = useRecipes()

  const matches = (data ?? []).filter((recipe) =>
    recipe.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <Input
        value={search}
        placeholder="Search recipes…"
        aria-label="Search recipes"
        autoFocus
        onChange={(e) => setSearch(e.target.value)}
      />

      <ErrorBanner error={error} />

      {isPending ? (
        <Spinner />
      ) : matches.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No recipes match">
            {data?.length === 0 ? 'Create a recipe first.' : 'Try a different search.'}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {matches.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-sunken"
                onClick={() => {
                  onPick({ id: recipe.id, name: recipe.name, tags: recipe.tags })
                  onClose()
                }}
              >
                <span className="font-medium">{recipe.name}</span>
                {recipe.tags.length > 0 && (
                  <span className="ml-2 text-xs text-ink-soft">{recipe.tags.join(' · ')}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
