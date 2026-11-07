import type { KeyboardEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAddIngredient, useIngredients } from '../api/ingredients'
import { useRecipe, useSaveRecipe } from '../api/recipes'
import type { Ingredient, Recipe, RecipeRequest, Unit } from '../api/types'
import { UNITS } from '../api/types'
import { Button, ErrorBanner, Field, Input, Select, Spinner, cx } from '../components/ui'
import { unitLabel } from '../lib/units'

interface IngredientRow {
  ingredientId: string
  amount: string
  unit: Unit
}

interface Draft {
  name: string
  steps: string[]
  ingredients: IngredientRow[]
  reference: string
  tags: string
}

const emptyDraft: Draft = {
  name: '',
  steps: [''],
  ingredients: [],
  reference: '',
  tags: '',
}

const toDraft = (recipe: Recipe): Draft => ({
  name: recipe.name,
  steps: recipe.steps.length > 0 ? recipe.steps : [''],
  ingredients: recipe.ingredients.map((i) => ({
    ingredientId: i.ingredientId,
    amount: String(i.amount),
    unit: i.unit,
  })),
  reference: recipe.reference ?? '',
  tags: recipe.tags.join(', '),
})

/**
 * The backend owns validation — `RecipeService.validate` decides what a valid
 * recipe is, and it returns messages written for a person. So this only shapes
 * the request and lets the 400 do the talking.
 */
const toRequest = (draft: Draft): RecipeRequest => ({
  name: draft.name,
  steps: draft.steps.filter((step) => step.trim() !== ''),
  ingredients: draft.ingredients.map((row) => ({
    ingredientId: row.ingredientId,
    amount: Number(row.amount) || 0,
    unit: row.unit,
  })),
  reference: draft.reference.trim() === '' ? null : draft.reference,
  tags: draft.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== ''),
})

// Letters with a stroke rather than an accent, which NFD leaves in one piece.
const undecomposed: Record<string, string> = { ł: 'l', ø: 'o', đ: 'd', ħ: 'h', ß: 'ss', æ: 'ae', œ: 'oe' }

/** Lower case with accents gone, so "losos" and "ŁOSOŚ" both find "Łosoś". */
const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[łøđħßæœ]/g, (letter) => undecomposed[letter])

const matches = (ingredient: Ingredient, search: string) =>
  fold(`${ingredient.name} ${ingredient.category}`).includes(fold(search.trim()))

function IngredientSearch({
  ingredients,
  onPick,
}: {
  ingredients: Ingredient[]
  onPick: (ingredient: Ingredient) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const list = useRef<HTMLUListElement>(null)

  const found = ingredients.filter((ingredient) => matches(ingredient, search))

  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (ingredient: Ingredient) => {
    onPick(ingredient)
    setSearch('')
    setActive(0)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Enter') {
      if (open && found[active] !== undefined) {
        pick(found[active])
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()

      if (!open) {
        setOpen(true)
      } else if (found.length > 0) {
        setActive((active + (e.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length)
      }
    }
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        value={search}
        placeholder="Search ingredients to add…"
        aria-label="Add ingredient"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && found.length > 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => {
          setSearch(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />

      {open && found.length === 0 && (
        <p className="absolute z-10 mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink-soft shadow-md">
          {search.trim() === '' ? 'No more ingredients to add.' : 'No ingredients match.'}
        </p>
      )}

      <ul
        ref={list}
        id={listId}
        role="listbox"
        aria-label="Ingredients"
        hidden={!open || found.length === 0}
        className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-md"
      >
        {open &&
          found.map((ingredient, index) => (
            <li
              key={ingredient.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={cx('cursor-pointer px-2.5 py-1.5 text-sm', index === active && 'bg-surface-sunken')}
              onMouseEnter={() => setActive(index)}
              // On mouse down, not click: keeps focus in the input, whose blur
              // would otherwise close the list before the click lands.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(ingredient)
              }}
            >
              {ingredient.name} <span className="text-xs text-ink-soft">({ingredient.category})</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

function NewIngredientForm({
  onAdded,
  onCancel,
}: {
  onAdded: (ingredient: Ingredient) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const add = useAddIngredient()

  const submit = () => {
    if (name.trim() === '' || category.trim() === '' || add.isPending) {
      return
    }

    // `useAddIngredient` waits on the catalogue refetch before this runs, so
    // the new row can already find its ingredient by id.
    add.mutate({ name, category }, { onSuccess: onAdded })
  }

  return (
    <div className="space-y-2 rounded-md border border-line bg-surface-sunken/40 p-2">
      <ErrorBanner error={add.error} />
      <div className="flex items-center gap-2">
        <Input
          value={name}
          placeholder="Tomato"
          aria-label="New ingredient name"
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Input
          value={category}
          placeholder="Vegetables"
          aria-label="New ingredient category"
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Button variant="primary" onClick={submit} disabled={add.isPending}>
          Add
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export default function RecipeEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useRecipe(id)
  const { data: catalogue } = useIngredients()
  const save = useSaveRecipe()

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [creatingIngredient, setCreatingIngredient] = useState(false)

  // The form is uncontrolled by the server after the first load: re-seeding it
  // on every refetch would discard whatever is half-typed.
  useEffect(() => {
    if (existing.data !== undefined) {
      setDraft(toDraft(existing.data))
    }
  }, [existing.data])

  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }))

  const setStep = (index: number, text: string) =>
    patch({ steps: draft.steps.map((step, i) => (i === index ? text : step)) })

  const moveStep = (index: number, by: number) => {
    const target = index + by

    if (target < 0 || target >= draft.steps.length) {
      return
    }

    const steps = [...draft.steps]
    ;[steps[index], steps[target]] = [steps[target], steps[index]]
    patch({ steps })
  }

  const setRow = (index: number, changes: Partial<IngredientRow>) =>
    patch({
      ingredients: draft.ingredients.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    })

  // Works from the current draft: a new ingredient lands after a round trip,
  // and anything typed in the meantime has to survive it.
  const addRow = (ingredientId: string) =>
    setDraft((current) => ({
      ...current,
      ingredients: [...current.ingredients, { ingredientId, amount: '1', unit: 'gram' }],
    }))

  const submit = () =>
    save.mutate({ id, ...toRequest(draft) }, { onSuccess: () => void navigate('/recipes') })

  if (id !== undefined && existing.isPending) {
    return <Spinner />
  }

  if (existing.error !== null) {
    return <ErrorBanner error={existing.error} />
  }

  const unused = (catalogue ?? []).filter(
    (ingredient) => !draft.ingredients.some((row) => row.ingredientId === ingredient.id),
  )

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">{id === undefined ? 'New recipe' : 'Edit recipe'}</h1>

      <ErrorBanner error={save.error} />

      <Field label="Name">
        <Input value={draft.name} placeholder="Tomato pasta" onChange={(e) => patch({ name: e.target.value })} />
      </Field>

      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-wide text-ink-soft uppercase">Ingredients</h2>

        {draft.ingredients.map((row, index) => {
          const ingredient = catalogue?.find((i) => i.id === row.ingredientId)

          return (
            <div key={row.ingredientId} className="flex items-center gap-2">
              <span className="min-w-0 grow truncate text-sm">
                {ingredient?.name ?? 'Unknown ingredient'}
                <span className="ml-1.5 text-xs text-ink-soft">{ingredient?.category}</span>
              </span>
              <Input
                type="number"
                min={1}
                value={row.amount}
                aria-label="Amount"
                className="w-24! shrink-0"
                onChange={(e) => setRow(index, { amount: e.target.value })}
              />
              <Select
                value={row.unit}
                aria-label="Unit"
                className="w-24! shrink-0"
                onChange={(e) => setRow(index, { unit: e.target.value as Unit })}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unitLabel(unit)}
                  </option>
                ))}
              </Select>
              <Button
                variant="danger"
                aria-label={`Remove ${ingredient?.name ?? 'ingredient'}`}
                onClick={() =>
                  patch({ ingredients: draft.ingredients.filter((_, i) => i !== index) })
                }
              >
                ✕
              </Button>
            </div>
          )
        })}

        <IngredientSearch ingredients={unused} onPick={(ingredient) => addRow(ingredient.id)} />

        {creatingIngredient ? (
          <NewIngredientForm
            onAdded={(ingredient) => {
              addRow(ingredient.id)
              setCreatingIngredient(false)
            }}
            onCancel={() => setCreatingIngredient(false)}
          />
        ) : (
          <Button onClick={() => setCreatingIngredient(true)}>New ingredient</Button>
        )}

        {catalogue?.length === 0 && (
          <p className="text-sm text-ink-soft">No ingredients in the catalogue yet — create the first one here.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-wide text-ink-soft uppercase">Steps</h2>

        {draft.steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-sm text-ink-soft">{index + 1}.</span>
            <Input
              value={step}
              placeholder="Boil the pasta."
              aria-label={`Step ${index + 1}`}
              onChange={(e) => setStep(index, e.target.value)}
            />
            <Button
              variant="ghost"
              aria-label={`Move step ${index + 1} up`}
              disabled={index === 0}
              onClick={() => moveStep(index, -1)}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              aria-label={`Move step ${index + 1} down`}
              disabled={index === draft.steps.length - 1}
              onClick={() => moveStep(index, 1)}
            >
              ↓
            </Button>
            <Button
              variant="danger"
              aria-label={`Remove step ${index + 1}`}
              disabled={draft.steps.length === 1}
              onClick={() => patch({ steps: draft.steps.filter((_, i) => i !== index) })}
            >
              ✕
            </Button>
          </div>
        ))}

        <Button onClick={() => patch({ steps: [...draft.steps, ''] })}>Add step</Button>
      </section>

      <Field label="Tags">
        <Input
          value={draft.tags}
          placeholder="quick, vegetarian"
          onChange={(e) => patch({ tags: e.target.value })}
        />
      </Field>

      <Field label="Reference">
        <Input
          value={draft.reference}
          placeholder="https://example.com/the-original"
          onChange={(e) => patch({ reference: e.target.value })}
        />
      </Field>

      <div className={cx('flex gap-2 border-t border-line pt-4')}>
        <Button variant="primary" onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save recipe'}
        </Button>
        <Button onClick={() => void navigate('/recipes')}>Cancel</Button>
      </div>
    </div>
  )
}
