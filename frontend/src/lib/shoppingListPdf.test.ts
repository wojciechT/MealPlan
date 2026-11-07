import inlineFont from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?inline'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { ShoppingCategory } from '../api/types'
import { buildShoppingListPdf } from './shoppingListPdf'

const fontBytes = Uint8Array.from(atob(inlineFont.split(',')[1]), (c) => c.charCodeAt(0))

const line = (name: string, index = 0) =>
  ({ ingredientId: `i${index}`, name, amount: 250, unit: 'gram' }) as const

const pageCount = async (categories: ShoppingCategory[]) => {
  const bytes = await buildShoppingListPdf(categories, '2 Nov 2026 – 8 Nov 2026', () => false, fontBytes)
  return (await PDFDocument.load(bytes)).getPageCount()
}

describe('buildShoppingListPdf', () => {
  it('takes letters the standard PDF fonts refuse', async () => {
    expect(await pageCount([{ category: 'Ryby', lines: [line('Łosoś'), line('Żółć')] }])).toBe(1)
  })

  it('moves on to another page when the lines run out of room', async () => {
    const lines = Array.from({ length: 120 }, (_, i) => line(`Ingredient ${i}`, i))

    expect(await pageCount([{ category: 'Everything', lines }])).toBeGreaterThan(1)
  })

  it('wraps a name too long for one line, even without a space in it', async () => {
    const lines = [line('word '.repeat(60)), line('x'.repeat(300))]

    expect(await pageCount([{ category: 'Long', lines }])).toBe(1)
  })
})
