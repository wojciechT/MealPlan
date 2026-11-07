import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShoppingLine } from '../api/types'
import IngredientsPage from './IngredientsPage'
import PlannerPage from './PlannerPage'
import RecipeEditorPage from './RecipeEditorPage'
import RecipesPage from './RecipesPage'
import ShoppingListPage from './ShoppingListPage'
import { downloadShoppingListPdf } from '../lib/shoppingListPdf'
import { ingredients, renderPage, shoppingList, stubApi } from '../test/render'

vi.mock('../lib/shoppingListPdf', () => ({ downloadShoppingListPdf: vi.fn(async () => {}) }))

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

  it('shows the error the backend sent when a duplicate is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? ({
              ok: false,
              status: 409,
              json: async () => ({ detail: "An ingredient named 'tomato' already exists." }),
            } as Response)
          : stubApi()(input),
      ),
    )

    renderPage(<IngredientsPage />)
    await screen.findByText('Tomato')
    await userEvent.type(screen.getByLabelText('New ingredient name'), 'tomato')
    await userEvent.type(screen.getByLabelText('New ingredient category'), 'Vegetables{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
    expect(screen.getByLabelText('New ingredient name')).toHaveValue('tomato')
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

  it('copies a recipe as a new one under a marked name', async () => {
    const fetchStub = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => stubApi()(input))
    vi.stubGlobal('fetch', fetchStub)

    renderPage(<RecipesPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Copy Tomato pasta' }))

    const post = await vi.waitFor(() => {
      const call = fetchStub.mock.calls.find(([, init]) => init?.method === 'POST')
      expect(call).toBeDefined()
      return call!
    })

    expect(String(post[0])).toBe('/api/recipes')
    expect(JSON.parse(String(post[1]?.body))).toEqual({
      name: 'Tomato pasta (copy)',
      steps: ['Boil the pasta.', 'Toss together.'],
      ingredients: [
        { ingredientId: 'i1', amount: 250, unit: 'gram' },
        { ingredientId: 'i2', amount: 200, unit: 'gram' },
      ],
      reference: null,
      tags: ['quick'],
    })
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

    await userEvent.click(await screen.findByRole('combobox', { name: 'Add ingredient' }))

    // The list opens before the catalogue arrives, so wait on an option.
    expect(await screen.findByRole('option', { name: 'Tomato (Vegetables)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pasta (Dry goods)' })).toBeInTheDocument()
  })

  it('narrows the ingredients by name or category, ignoring case', async () => {
    renderPage(<RecipeEditorPage />, '/recipes/new')
    const search = await screen.findByRole('combobox', { name: 'Add ingredient' })
    await userEvent.click(search)
    await screen.findByRole('option', { name: 'Tomato (Vegetables)' })

    await userEvent.type(search, 'TOM')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Tomato (Vegetables)'])

    await userEvent.clear(search)
    await userEvent.type(search, 'dry')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Pasta (Dry goods)'])

    await userEvent.clear(search)
    await userEvent.type(search, 'xyz')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.getByText('No ingredients match.')).toBeInTheDocument()
  })

  it('ignores accents on either side of the search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        stubApi({
          '/api/ingredients': [
            { id: 'i1', name: 'Łosoś', category: 'Ryby' },
            { id: 'i2', name: 'Pomidor', category: 'Warzywa' },
            { id: 'i3', name: 'Crème fraîche', category: 'Nabiał' },
          ],
        }),
      ),
    )

    renderPage(<RecipeEditorPage />, '/recipes/new')
    const search = await screen.findByRole('combobox', { name: 'Add ingredient' })
    await userEvent.click(search)
    await screen.findAllByRole('option')

    const shownFor = async (text: string) => {
      await userEvent.clear(search)
      await userEvent.type(search, text)
      return screen.queryAllByRole('option').map((o) => o.textContent)
    }

    expect(await shownFor('losos')).toEqual(['Łosoś (Ryby)'])
    expect(await shownFor('ŁOSOŚ')).toEqual(['Łosoś (Ryby)'])
    expect(await shownFor('pomidór')).toEqual(['Pomidor (Warzywa)'])
    expect(await shownFor('creme')).toEqual(['Crème fraîche (Nabiał)'])
    expect(await shownFor('nabial')).toEqual(['Crème fraîche (Nabiał)'])
    expect(await shownFor('losus')).toEqual([])
  })

  it('adds a clicked ingredient and stops offering it', async () => {
    renderPage(<RecipeEditorPage />, '/recipes/new')
    const search = await screen.findByRole('combobox', { name: 'Add ingredient' })
    await userEvent.click(search)
    await userEvent.click(await screen.findByRole('option', { name: 'Pasta (Dry goods)' }))

    expect(screen.getByRole('button', { name: 'Remove Pasta' })).toBeInTheDocument()
    expect(search).toHaveValue('')

    // Scoped to the list: the new row's unit select has options of its own.
    await userEvent.click(search)
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Tomato (Vegetables)',
    ])
  })

  it('picks an ingredient with the keyboard', async () => {
    renderPage(<RecipeEditorPage />, '/recipes/new')
    const search = await screen.findByRole('combobox', { name: 'Add ingredient' })
    await userEvent.click(search)
    await screen.findByRole('option', { name: 'Tomato (Vegetables)' })

    // Tomato is highlighted first, so one step down lands on Pasta.
    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByRole('button', { name: 'Remove Pasta' })).toBeInTheDocument()

    await userEvent.type(search, 'tom{Enter}')

    expect(screen.getByRole('button', { name: 'Remove Tomato' })).toBeInTheDocument()
  })

  it('saves a recipe whose only step was left blank with no steps', async () => {
    const fetchStub = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => stubApi()(input))
    vi.stubGlobal('fetch', fetchStub)

    renderPage(<RecipeEditorPage />, '/recipes/new')
    await userEvent.click(await screen.findByRole('button', { name: 'Save recipe' }))

    const post = await vi.waitFor(() => {
      const call = fetchStub.mock.calls.find(([, init]) => init?.method === 'POST')
      expect(call).toBeDefined()
      return call!
    })

    expect(JSON.parse(String(post[1]?.body))).toMatchObject({ steps: [] })
  })

  it('creates an ingredient in place and adds it to the recipe', async () => {
    let catalogue = ingredients

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const added = { id: 'i3', ...(JSON.parse(String(init.body)) as { name: string; category: string }) }
          catalogue = [...catalogue, added]
          return { ok: true, status: 201, json: async () => added } as Response
        }

        return stubApi({ '/api/ingredients': catalogue })(input)
      }),
    )

    renderPage(<RecipeEditorPage />, '/recipes/new')

    await userEvent.type(await screen.findByLabelText('Step 1'), 'Chop.')
    await userEvent.click(screen.getByRole('button', { name: 'New ingredient' }))
    await userEvent.type(screen.getByLabelText('New ingredient name'), 'Basil')
    await userEvent.type(screen.getByLabelText('New ingredient category'), 'Herbs')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    // Named on the row means the row found its ingredient in the catalogue.
    expect(await screen.findByRole('button', { name: 'Remove Basil' })).toBeInTheDocument()
    expect(screen.queryByLabelText('New ingredient name')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Step 1')).toHaveValue('Chop.')
  })

  it('keeps the form open and shows why when adding an ingredient fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? ({ ok: false, status: 400, json: async () => ({ detail: 'That is not an ingredient.' }) } as Response)
          : stubApi()(input),
      ),
    )

    renderPage(<RecipeEditorPage />, '/recipes/new')
    await userEvent.click(await screen.findByRole('button', { name: 'New ingredient' }))
    await userEvent.type(screen.getByLabelText('New ingredient name'), 'Basil')
    await userEvent.type(screen.getByLabelText('New ingredient category'), 'Herbs{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('That is not an ingredient.')
    expect(screen.getByLabelText('New ingredient name')).toHaveValue('Basil')
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

  it('downloads what is on screen, ticks included', async () => {
    vi.mocked(downloadShoppingListPdf).mockClear()
    renderPage(<ShoppingListPage />)
    await screen.findByText('Tomato')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))

    await vi.waitFor(() => expect(downloadShoppingListPdf).toHaveBeenCalledOnce())

    const [categories, from, to, isTicked] = vi.mocked(downloadShoppingListPdf).mock.calls[0]
    expect(categories).toEqual(shoppingList)
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(isTicked(shoppingList[0].lines[0] as ShoppingLine)).toBe(true)
  })

  it('offers no download when there is nothing to buy', async () => {
    vi.stubGlobal('fetch', vi.fn(stubApi({ '/api/shopping-list': [] })))

    renderPage(<ShoppingListPage />)

    expect(await screen.findByText('Nothing to buy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled()
  })

  it('shows why a download failed', async () => {
    vi.mocked(downloadShoppingListPdf).mockRejectedValueOnce(new Error('The PDF font could not be loaded.'))

    renderPage(<ShoppingListPage />)
    await screen.findByText('Tomato')
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The PDF font could not be loaded.')
  })
})
