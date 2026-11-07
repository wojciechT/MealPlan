import fontkit from '@pdf-lib/fontkit'
import fontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url'
import { PDFDocument, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import type { ShoppingCategory, ShoppingLine } from '../api/types'
import { formatRange } from './week'
import { formatQuantity } from './units'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 50

const LINE_SIZE = 11
const LINE_LEADING = 15
const LINE_GAP = 6
const BOX_SIZE = 10
const BOX_GAP = 8

const INK = rgb(0.13, 0.12, 0.1)
const SOFT = rgb(0.42, 0.41, 0.39)

/** Breaks on spaces, and inside a word only when it fills a line by itself. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const fits = (candidate: string) => font.widthOfTextAtSize(candidate, size) <= width
  const lines: string[] = []
  let current = ''

  for (const word of text.split(/\s+/).filter((part) => part !== '')) {
    const candidate = current === '' ? word : `${current} ${word}`

    if (fits(candidate)) {
      current = candidate
      continue
    }

    if (current !== '') {
      lines.push(current)
    }

    current = ''

    for (const letter of word) {
      if (!fits(current + letter)) {
        lines.push(current)
        current = ''
      }

      current += letter
    }
  }

  return current === '' ? lines : [...lines, current]
}

/**
 * The standard PDF fonts stop at Western European letters and would refuse a
 * name like "Łosoś", so a font has to be embedded. Only the letters used are
 * kept, which holds the file to a few kilobytes.
 */
export async function buildShoppingListPdf(
  categories: ShoppingCategory[],
  range: string,
  isTicked: (line: ShoppingLine) => boolean,
  fontBytes: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`Shopping list, ${range}`)

  const font = await pdf.embedFont(fontBytes, { subset: true })

  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const makeRoom = (height: number) => {
    if (y - height < MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
  }

  y -= 20
  page.drawText('Shopping list', { x: MARGIN, y, size: 20, font, color: INK })
  y -= 18
  page.drawText(range, { x: MARGIN, y, size: 10, font, color: SOFT })
  y -= 12

  for (const category of categories) {
    // Enough for the first line too, so a heading never ends a page alone.
    makeRoom(24 + LINE_LEADING + LINE_GAP)
    y -= 24
    page.drawText(category.category.toUpperCase(), { x: MARGIN, y, size: 9, font, color: SOFT })
    y -= 6

    for (const line of category.lines) {
      const ticked = isTicked(line)
      const color = ticked ? SOFT : INK
      const quantity = formatQuantity(line.amount, line.unit)
      const quantityWidth = font.widthOfTextAtSize(quantity, LINE_SIZE)
      const nameX = MARGIN + BOX_SIZE + BOX_GAP
      const nameWidth = PAGE_WIDTH - MARGIN - quantityWidth - 12 - nameX
      const nameLines = wrap(line.name, font, LINE_SIZE, nameWidth)

      makeRoom(nameLines.length * LINE_LEADING + LINE_GAP)
      y -= LINE_LEADING

      page.drawRectangle({
        x: MARGIN,
        y: y - 1,
        width: BOX_SIZE,
        height: BOX_SIZE,
        borderColor: SOFT,
        borderWidth: 0.75,
      })

      if (ticked) {
        const stroke = { thickness: 1.25, color: INK }
        page.drawLine({ start: { x: MARGIN + 2, y: y + 4 }, end: { x: MARGIN + 4, y: y + 1.5 }, ...stroke })
        page.drawLine({ start: { x: MARGIN + 4, y: y + 1.5 }, end: { x: MARGIN + 8, y: y + 7 }, ...stroke })
      }

      page.drawText(quantity, { x: PAGE_WIDTH - MARGIN - quantityWidth, y, size: LINE_SIZE, font, color })

      nameLines.forEach((text, index) => {
        page.drawText(text, { x: nameX, y: y - index * LINE_LEADING, size: LINE_SIZE, font, color })
      })

      y -= (nameLines.length - 1) * LINE_LEADING + LINE_GAP
    }
  }

  return pdf.save()
}

export async function downloadShoppingListPdf(
  categories: ShoppingCategory[],
  from: string,
  to: string,
  isTicked: (line: ShoppingLine) => boolean,
) {
  const response = await fetch(fontUrl)

  if (!response.ok) {
    throw new Error('The PDF font could not be loaded.')
  }

  const bytes = await buildShoppingListPdf(categories, formatRange(from, to), isTicked, await response.arrayBuffer())

  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `shopping-list-${from}-to-${to}.pdf`
  link.click()

  // Not at once: some browsers are still starting the download after click().
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
