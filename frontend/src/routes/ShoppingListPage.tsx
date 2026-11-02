import { useEffect, useState } from 'react'
import { useShoppingList } from '../api/shoppingList'
import { Button, EmptyState, ErrorBanner, Field, Input, Spinner, cx } from '../components/ui'
import { formatQuantity } from '../lib/units'
import { weekOf } from '../lib/week'

const STORAGE_KEY = 'mealplan.shopping.ticked'

/**
 * Ticking something off is a note to yourself while you walk round a shop, not
 * a fact about the plan — so it lives in this browser and never reaches the
 * backend. Keyed by ingredient and unit, matching a line's identity.
 */
function useTicked() {
  const [ticked, setTicked] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return new Set<string>(stored === null ? [] : (JSON.parse(stored) as string[]))
    } catch {
      return new Set<string>()
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ticked]))
  }, [ticked])

  const toggle = (key: string) =>
    setTicked((current) => {
      const next = new Set(current)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return { ticked, toggle, clear: () => setTicked(new Set()) }
}

export default function ShoppingListPage() {
  const thisWeek = weekOf(new Date())
  const [from, setFrom] = useState(thisWeek.from)
  const [to, setTo] = useState(thisWeek.to)

  const { data, isPending, error } = useShoppingList(from, to)
  const { ticked, toggle, clear } = useTicked()

  const categories = data ?? []
  const total = categories.reduce((count, category) => count + category.lines.length, 0)

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Shopping list</h1>
        <p className="text-sm text-ink-soft">Everything the planned meals need, summed per ingredient.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Button
          onClick={() => {
            const week = weekOf(new Date())
            setFrom(week.from)
            setTo(week.to)
          }}
        >
          This week
        </Button>
        {ticked.size > 0 && (
          <Button variant="ghost" onClick={clear}>
            Untick all
          </Button>
        )}
      </div>

      <ErrorBanner error={error} />

      {isPending ? (
        <Spinner />
      ) : total === 0 ? (
        <EmptyState title="Nothing to buy">No meals are planned in this range.</EmptyState>
      ) : (
        <div className="space-y-5">
          {categories.map((category) => (
            <section key={category.category}>
              <h2 className="mb-2 text-xs font-medium tracking-wide text-ink-soft uppercase">
                {category.category}
              </h2>
              <ul className="overflow-hidden rounded-lg border border-line">
                {category.lines.map((line) => {
                  const key = `${line.ingredientId}:${line.unit}`
                  const done = ticked.has(key)

                  return (
                    <li key={key} className="border-b border-line last:border-b-0">
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-sunken/50">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggle(key)}
                          className="size-4 accent-[var(--color-accent)]"
                        />
                        <span className={cx('grow text-sm', done && 'text-ink-soft line-through')}>
                          {line.name}
                        </span>
                        <span className={cx('text-sm tabular-nums', done ? 'text-ink-soft' : 'text-ink-soft')}>
                          {formatQuantity(line.amount, line.unit)}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
