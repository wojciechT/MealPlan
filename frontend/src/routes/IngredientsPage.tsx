import { useState } from 'react'
import {
  useAddIngredient,
  useDeleteIngredient,
  useIngredients,
  useUpdateIngredient,
} from '../api/ingredients'
import type { Ingredient } from '../api/types'
import { Button, EmptyState, ErrorBanner, Input, Spinner } from '../components/ui'

function EditableRow({ ingredient, onDone }: { ingredient: Ingredient; onDone: () => void }) {
  const [name, setName] = useState(ingredient.name)
  const [category, setCategory] = useState(ingredient.category)
  const update = useUpdateIngredient()

  const save = () => update.mutate({ id: ingredient.id, name, category }, { onSuccess: onDone })

  return (
    <>
      <tr className="border-t border-line">
        <td className="p-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" autoFocus />
        </td>
        <td className="p-2">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" />
        </td>
        <td className="p-2 text-right whitespace-nowrap">
          <Button variant="primary" onClick={save} disabled={update.isPending}>
            Save
          </Button>
          <Button variant="ghost" onClick={onDone} className="ml-1">
            Cancel
          </Button>
        </td>
      </tr>
      {update.error !== null && (
        <tr>
          <td colSpan={3} className="px-2 pb-2">
            <ErrorBanner error={update.error} />
          </td>
        </tr>
      )}
    </>
  )
}

function Row({ ingredient }: { ingredient: Ingredient }) {
  const [editing, setEditing] = useState(false)
  const remove = useDeleteIngredient()

  if (editing) {
    return <EditableRow ingredient={ingredient} onDone={() => setEditing(false)} />
  }

  return (
    <>
      <tr className="border-t border-line hover:bg-surface-sunken/50">
        <td className="p-2 font-medium">{ingredient.name}</td>
        <td className="p-2 text-ink-soft">{ingredient.category}</td>
        <td className="p-2 text-right whitespace-nowrap">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            variant="danger"
            className="ml-1"
            disabled={remove.isPending}
            onClick={() => remove.mutate(ingredient.id)}
          >
            Delete
          </Button>
        </td>
      </tr>
      {remove.error !== null && (
        <tr>
          <td colSpan={3} className="px-2 pb-2">
            {/* An ingredient a recipe still uses comes back as a 409. */}
            <ErrorBanner error={remove.error} />
          </td>
        </tr>
      )}
    </>
  )
}

function NewRow() {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const add = useAddIngredient()

  const submit = () => {
    if (name.trim() === '' || category.trim() === '') {
      return
    }

    add.mutate(
      { name, category },
      {
        onSuccess: () => {
          setName('')
          setCategory('')
        },
      },
    )
  }

  return (
    <>
      <tr className="border-t border-line bg-surface-sunken/40">
        <td className="p-2">
          <Input
            value={name}
            placeholder="Tomato"
            aria-label="New ingredient name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </td>
        <td className="p-2">
          <Input
            value={category}
            placeholder="Vegetables"
            aria-label="New ingredient category"
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </td>
        <td className="p-2 text-right">
          <Button variant="primary" onClick={submit} disabled={add.isPending}>
            Add
          </Button>
        </td>
      </tr>
      {add.error !== null && (
        <tr>
          <td colSpan={3} className="px-2 pb-2">
            <ErrorBanner error={add.error} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function IngredientsPage() {
  const { data, isPending, error } = useIngredients()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ingredients</h1>
        <p className="text-sm text-ink-soft">
          The catalogue recipes draw on. Categories group the shopping list.
        </p>
      </div>

      <ErrorBanner error={error} />

      {isPending ? (
        <Spinner />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-xs tracking-wide text-ink-soft uppercase">
              <tr>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Category</th>
                <th className="w-44" />
              </tr>
            </thead>
            <tbody>
              <NewRow />
              {data?.map((ingredient) => <Row key={ingredient.id} ingredient={ingredient} />)}
            </tbody>
          </table>
        </div>
      )}

      {data?.length === 0 && <EmptyState title="No ingredients yet">Add one above to get started.</EmptyState>}
    </div>
  )
}
