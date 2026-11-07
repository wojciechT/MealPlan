import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, query } from './client'

const respondWith = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    }),
  )

afterEach(() => vi.unstubAllGlobals())

describe('query', () => {
  it('omits empty and missing values', () => {
    expect(query({ from: '2026-11-02', to: undefined, search: '' })).toBe('?from=2026-11-02')
  })

  it('is empty when nothing is set', () => {
    expect(query({ search: undefined })).toBe('')
  })

  it('encodes values', () => {
    expect(query({ search: 'tomato & basil' })).toBe('?search=tomato+%26+basil')
  })
})

describe('error handling', () => {
  it('surfaces the domain messages from a validation failure', async () => {
    respondWith(400, {
      title: 'The recipe is not valid.',
      status: 400,
      errors: ['A recipe needs a name.', 'A recipe needs at least one ingredient.'],
    })

    const error = await api.post('/recipes', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).messages).toEqual([
      'A recipe needs a name.',
      'A recipe needs at least one ingredient.',
    ])
  })

  it('falls back to the detail when there is no errors array', async () => {
    respondWith(404, { title: 'Not Found', status: 404, detail: 'No recipe with id 1.' })

    const error = (await api.get('/recipes/1').catch((e: unknown) => e)) as ApiError

    expect(error.status).toBe(404)
    expect(error.messages).toEqual(['No recipe with id 1.'])
  })

  it('still reports something when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('not json')),
      }),
    )

    const error = (await api.get('/ingredients').catch((e: unknown) => e)) as ApiError

    expect(error.status).toBe(502)
    expect(error.messages).toEqual(['Request failed with status 502.'])
  })
})

describe('responses', () => {
  it('returns nothing for a 204', async () => {
    respondWith(204, undefined)

    await expect(api.delete('/ingredients/1')).resolves.toBeUndefined()
  })

  it('parses a JSON body', async () => {
    respondWith(200, [{ id: '1', name: 'Tomato', category: 'Vegetables' }])

    await expect(api.get('/ingredients')).resolves.toEqual([
      { id: '1', name: 'Tomato', category: 'Vegetables' },
    ])
  })
})
