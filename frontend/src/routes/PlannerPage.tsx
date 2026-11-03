import { useState } from 'react'
import { Link } from 'react-router'
import { useAddMeal, usePlan, useRemoveMeal } from '../api/plan'
import type { Day, MealTime, RecipeSummary } from '../api/types'
import { MEAL_TIMES } from '../api/types'
import { RecipePickerDialog } from '../components/RecipePickerDialog'
import { Button, ErrorBanner, Spinner, cx } from '../components/ui'
import { mealTimeLabel } from '../lib/units'
import { formatDayName, formatDayNumber, formatRange, isToday, shiftWeeks, weekOf } from '../lib/week'

interface Target {
  date: string
  mealTime: MealTime
}

function Slot({
  day,
  mealTime,
  onPick,
  onRemove,
}: {
  day: Day
  mealTime: MealTime
  onPick: () => void
  onRemove: (recipe: RecipeSummary) => void
}) {
  const recipes = day.meals[mealTime] ?? []
  const label = `${mealTimeLabel(mealTime)} for ${day.date}`

  if (recipes.length === 0) {
    return (
      <button
        type="button"
        onClick={onPick}
        aria-label={`Add ${label}`}
        className="h-full min-h-16 w-full rounded-md border border-dashed border-line text-ink-soft/50 transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
      >
        +
      </button>
    )
  }

  return (
    <div className="space-y-1">
      {recipes.map((recipe) => (
        <div key={recipe.id} className="group relative rounded-md border border-line bg-surface p-2">
          <p className="pr-4 text-sm leading-snug font-medium">{recipe.name}</p>
          {recipe.tags.length > 0 && (
            <p className="mt-1 truncate text-xs text-ink-soft">{recipe.tags.join(' · ')}</p>
          )}
          <button
            type="button"
            onClick={() => onRemove(recipe)}
            aria-label={`Remove ${recipe.name} from ${label}`}
            className="absolute top-1 right-1 rounded px-1 text-ink-soft opacity-0 transition hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onPick}
        aria-label={`Add another recipe to ${label}`}
        className="w-full rounded-md border border-dashed border-line py-0.5 text-xs text-ink-soft/50 transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
      >
        +
      </button>
    </div>
  )
}

export default function PlannerPage() {
  const [week, setWeek] = useState(() => weekOf(new Date()))
  const [target, setTarget] = useState<Target | null>(null)

  const { data, isPending, error } = usePlan(week.from, week.to)
  const addMeal = useAddMeal(week.from, week.to)
  const removeMeal = useRemoveMeal(week.from, week.to)

  const days = data ?? []

  const pick = (recipe: RecipeSummary) => {
    if (target !== null) {
      addMeal.mutate({ ...target, recipe })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Planner</h1>
          <p className="text-sm text-ink-soft">{formatRange(week.from, week.to)}</p>
        </div>

        <div className="flex gap-1">
          <Button onClick={() => setWeek(shiftWeeks(week, -1))} aria-label="Previous week">
            ←
          </Button>
          <Button onClick={() => setWeek(weekOf(new Date()))}>This week</Button>
          <Button onClick={() => setWeek(shiftWeeks(week, 1))} aria-label="Next week">
            →
          </Button>
        </div>
      </div>

      <ErrorBanner error={error ?? addMeal.error ?? removeMeal.error} />

      {isPending ? (
        <Spinner />
      ) : (
        // Seven columns on a wide screen; one day per block on a narrow one,
        // which is the only layout that stays readable on a phone.
        <div className="grid gap-3 lg:grid-cols-7">
          {days.map((day) => (
            <section key={day.date} className="space-y-2">
              <h2
                className={cx(
                  'flex items-baseline gap-1.5 border-b pb-1 text-sm',
                  isToday(day.date) ? 'border-accent text-accent' : 'border-line',
                )}
              >
                <span className="font-semibold">{formatDayName(day.date)}</span>
                <span className="text-xs text-ink-soft">{formatDayNumber(day.date)}</span>
              </h2>

              {MEAL_TIMES.map((mealTime) => (
                <div key={mealTime}>
                  <p className="mb-1 text-[0.65rem] tracking-wide text-ink-soft uppercase">
                    {mealTimeLabel(mealTime)}
                  </p>
                  <Slot
                    day={day}
                    mealTime={mealTime}
                    onPick={() => setTarget({ date: day.date, mealTime })}
                    onRemove={(recipe) => removeMeal.mutate({ date: day.date, mealTime, recipe })}
                  />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <p className="text-sm text-ink-soft">
        Everything planned this week rolls up into the{' '}
        <Link to="/shopping" className="text-accent underline underline-offset-2">
          shopping list
        </Link>
        .
      </p>

      <RecipePickerDialog
        open={target !== null}
        title={
          target === null
            ? ''
            : `${mealTimeLabel(target.mealTime)} · ${formatDayName(target.date)} ${formatDayNumber(target.date)}`
        }
        onClose={() => setTarget(null)}
        onPick={pick}
      />
    </div>
  )
}
