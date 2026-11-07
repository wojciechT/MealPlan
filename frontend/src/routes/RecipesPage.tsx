import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useCopyRecipe, useDeleteRecipe, useRecipes } from '../api/recipes'
import { formatQuantity } from '../lib/units'
import { Button, EmptyState, ErrorBanner, Input, Spinner, cx } from '../components/ui'

export default function RecipesPage() {
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | undefined>(undefined)
  const { data, isPending, error } = useRecipes({ search, tag })
  const copy = useCopyRecipe()
  const remove = useDeleteRecipe()

  const recipes = data ?? []

  // Tags come off the unfiltered-by-tag result, so picking one never empties
  // the chip row it was picked from.
  const { data: unfiltered } = useRecipes({ search })

  const tags = useMemo(
    () => [...new Set((unfiltered ?? []).flatMap((recipe) => recipe.tags))].sort(),
    [unfiltered],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recipes</h1>
          <p className="text-sm text-ink-soft">What you can put on the plan.</p>
        </div>
        <Button variant="primary" className="shrink-0">
          <Link to="/recipes/new">New recipe</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          placeholder="Search by name…"
          aria-label="Search recipes"
          className="max-w-xs"
          onChange={(e) => setSearch(e.target.value)}
        />
        {tags.map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setTag(tag === candidate ? undefined : candidate)}
            className={cx(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              tag === candidate
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-soft hover:bg-surface-sunken',
            )}
          >
            {candidate}
          </button>
        ))}
      </div>

      <ErrorBanner error={error ?? copy.error ?? remove.error} />

      {isPending ? (
        <Spinner />
      ) : recipes.length === 0 ? (
        <EmptyState title="No recipes match">
          {search === '' && tag === undefined ? 'Create one to get started.' : 'Try a different search or tag.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="flex flex-col rounded-lg border border-line bg-surface p-4">
              <Link to={`/recipes/${recipe.id}`} className="font-medium hover:text-accent">
                {recipe.name}
              </Link>

              {recipe.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {recipe.tags.map((t) => (
                    <span key={t} className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-soft">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-2 line-clamp-2 grow text-sm text-ink-soft">
                {recipe.ingredients
                  .map((i) => `${i.name} ${formatQuantity(i.amount, i.unit)}`)
                  .join(', ')}
              </p>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
                <span className="text-xs text-ink-soft">
                  {recipe.steps.length} step{recipe.steps.length === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    aria-label={`Copy ${recipe.name}`}
                    disabled={copy.isPending}
                    onClick={() => copy.mutate(recipe)}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="danger"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(recipe.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
