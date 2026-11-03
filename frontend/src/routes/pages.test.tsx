import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IngredientsPage from './IngredientsPage'
import PlannerPage from './PlannerPage'
import RecipeEditorPage from './RecipeEditorPage'
import RecipesPage from './RecipesPage'
import ShoppingListPage from './ShoppingListPage'
import { renderPage, stubApi } from '../test/render'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(stubApi()))
})

afterEach(() => vi.unstubAllGlobals())

describe('IngredientsPage', () => {
  it('lists what the catalogue returns', async () => {
    renderPage(<IngredientsPage />)

    expect(await screen.findByText('Tomato')).toBeInTheDocument()
    expect(screen.getByText('Dry goods')).toBeInTheDocument()
  })

  it('shows the error the backend sent when a delete is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return {
            ok: false,
            status: 409,
            json: async () => ({ detail: 'Something still uses this, so it cannot be deleted.' }),
          } as Response
        }

        return stubApi()(input)
      }),
    )

    renderPage(<IngredientsPage />)
    await screen.findByText('Tomato')
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    expect(await screen.findByRole('alert')).toHaveTextContent('Something still uses this')
  })
})

describe('RecipesPage', () => {
  it('renders a recipe card with its tags and ingredients', async () => {
    renderPage(<RecipesPage />)

    // 'quick' is both a filter chip and a tag on the card, so scope to the card.
    const card = (await screen.findByText('Tomato pasta')).closest('li')!

    expect(within(card).getByText('quick')).toBeInTheDocument()
    expect(within(card).getByText(/Tomato 250 g/)).toBeInTheDocument()
    expect(within(card).getByText('2 steps')).toBeInTheDocument()
  })
})

describe('RecipeEditorPage', () => {
  it('starts blank with one empty step', async () => {
    renderPage(<RecipeEditorPage />, '/recipes/new')

    expect(await screen.findByRole('heading', { name: 'New recipe' })).toBeInTheDocument()
    expect(screen.getByLabelText('Step 1')).toHaveValue('')
  })

  it('offers the catalogue as ingredients to add', async () => {
    renderPage(<RecipeEditorPage />, '/recipes/new')

    // The select exists before its options do, so wait on an option.
    expect(await screen.findByRole('option', { name: 'Tomato (Vegetables)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pasta (Dry goods)' })).toBeInTheDocument()
  })
})

describe('PlannerPage', () => {
  it('renders seven days with four meal slots each', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        stubApi({
          '/api/plan': Array.from({ length: 7 }, (_, i) => ({
            date: `2026-11-0${i + 2}`,
            meals: {},
          })),
        }),
      ),
    )

    renderPage(<PlannerPage />)

    expect(await screen.findByRole('heading', { name: 'Planner' })).toBeInTheDocument()
    // Seven days x four meal times, every one an empty "add" button.
    expect(await screen.findAllByRole('button', { name: /^Add / })).toHaveLength(28)
    expect(screen.getAllByText('Breakfast')).toHaveLength(7)
  })

  it('renders every recipe planned in a slot', async () => {
    const today = new Date()
    const iso = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`

    vi.stubGlobal(
      'fetch',
      vi.fn(
        stubApi({
          '/api/plan': [
            {
              date: iso,
              meals: {
                dinner: [
                  { id: 'r1', name: 'Tomato pasta', tags: ['quick'] },
                  { id: 'r2', name: 'Green salad', tags: [] },
                ],
              },
            },
          ],
        }),
      ),
    )

    renderPage(<PlannerPage />)

    expect(await screen.findByText('Tomato pasta')).toBeInTheDocument()
    expect(screen.getByText('Green salad')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Remove Tomato pasta from Dinner for ${iso}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Remove Green salad from Dinner for ${iso}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Add another recipe to Dinner for ${iso}` })).toBeInTheDocument()
  })
})

describe('ShoppingListPage', () => {
  it('groups lines under their category with a summed quantity', async () => {
    renderPage(<ShoppingListPage />)

    expect(await screen.findByText('Vegetables')).toBeInTheDocument()
    expect(screen.getByText('Tomato')).toBeInTheDocument()
    expect(screen.getByText('500 g')).toBeInTheDocument()
  })

  it('ticks a line off and remembers it', async () => {
    renderPage(<ShoppingListPage />)
    await screen.findByText('Tomato')

    const box = screen.getByRole('checkbox')
    await userEvent.click(box)

    expect(box).toBeChecked()
    expect(localStorage.getItem('mealplan.shopping.ticked')).toContain('i1:gram')
  })
})
