import { jsPDF } from 'jspdf'
import { FOOTER } from './model'

export interface PdfLine {
  label: string
  value: string
}

export interface ComparisonRow {
  name: string
  piles: string
  feet: string
  low: string
  standard: string
  high: string
  bags: string
  bagsReserve: string
  water: string
}

const MARGIN = 40
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const BOTTOM = 64

function newDoc(compress: boolean): jsPDF {
  return new jsPDF({ unit: 'pt', format: 'letter', compress })
}

function footer(doc: jsPDF): void {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(20, 63, 50)
    doc.setLineWidth(1)
    doc.line(MARGIN, PAGE_HEIGHT - 48, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 48)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(20, 63, 50)
    doc.text(FOOTER, MARGIN, PAGE_HEIGHT - 32)
    doc.text(`${page} / ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 32, { align: 'right' })
  }
}

function header(doc: jsPDF, logoDataUrl: string | undefined, subtitle: string): number {
  let y = MARGIN
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', MARGIN, y, 42, 42)
  }
  const textX = logoDataUrl ? MARGIN + 52 : MARGIN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 63, 50)
  doc.text('BASEco', textX, y + 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(26, 23, 20)
  doc.text('MicroPile Hub – Grout Consumption Calculator 1.0', textX, y + 34)
  y += 56
  doc.setFontSize(10)
  doc.setTextColor(58, 52, 44)
  doc.text('St. George, Utah', MARGIN, y)
  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 23, 20)
  doc.text(subtitle, MARGIN, y)
  y += 8
  doc.setDrawColor(20, 63, 50)
  doc.setLineWidth(1.5)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  return y + 18
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20, 63, 50)
  doc.text(title, MARGIN, y)
  return y + 16
}

function lines(doc: jsPDF, rows: PdfLine[], y: number): number {
  doc.setFontSize(11)
  for (const row of rows) {
    if (y > PAGE_HEIGHT - BOTTOM) {
      doc.addPage()
      y = MARGIN
    }
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(58, 52, 44)
    doc.text(row.label, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(26, 23, 20)
    doc.text(row.value, PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 16
  }
  return y + 6
}

export function buildProjectPdf(
  details: {
    projectName: string
    date: string
    outOfSpec: boolean
    lines: PdfLine[]
    geometry: PdfLine[]
    note: string
  },
  options?: { logoDataUrl?: string; compress?: boolean },
): jsPDF {
  const doc = newDoc(options?.compress ?? true)
  let y = header(doc, options?.logoDataUrl, details.projectName || 'Untitled project')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(58, 52, 44)
  doc.text(details.date, MARGIN, y)
  y += 18
  if (details.outOfSpec) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(138, 62, 0)
    doc.text('OUT OF SPEC — density is below 15 lb/gal.', MARGIN, y)
    y += 18
  }
  y = sectionTitle(doc, 'Field consumption (INFERRED)', y)
  y = lines(doc, details.lines, y)
  y = sectionTitle(doc, 'Theoretical geometry (not included above)', y)
  y = lines(doc, details.geometry, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(58, 52, 44)
  const note = doc.splitTextToSize(details.note, PAGE_WIDTH - MARGIN * 2) as string[]
  doc.text(note, MARGIN, y)
  footer(doc)
  return doc
}

export function buildComparisonPdf(
  rows: ComparisonRow[],
  date: string,
  options?: { logoDataUrl?: string; compress?: boolean },
): jsPDF {
  const doc = newDoc(options?.compress ?? true)
  let y = header(doc, options?.logoDataUrl, 'Saved project comparison')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(58, 52, 44)
  doc.text(date, MARGIN, y)
  y += 20

  const columns: Array<{ key: keyof ComparisonRow; label: string; width: number }> = [
    { key: 'name', label: 'Project', width: 108 },
    { key: 'piles', label: 'Piles', width: 40 },
    { key: 'feet', label: 'ft', width: 42 },
    { key: 'low', label: 'Low', width: 58 },
    { key: 'standard', label: 'Std', width: 62 },
    { key: 'high', label: 'High', width: 58 },
    { key: 'bags', label: 'Bags', width: 40 },
    { key: 'bagsReserve', label: 'Reserve', width: 52 },
    { key: 'water', label: 'Water', width: 48 },
  ]

  const drawHead = (top: number): number => {
    doc.setFillColor(20, 63, 50)
    doc.rect(MARGIN, top, PAGE_WIDTH - MARGIN * 2, 18, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(244, 240, 228)
    let x = MARGIN + 4
    for (const column of columns) {
      doc.text(column.label, x, top + 12)
      x += column.width
    }
    return top + 24
  }

  y = drawHead(y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  rows.forEach((row, index) => {
    if (y > PAGE_HEIGHT - BOTTOM) {
      doc.addPage()
      y = drawHead(MARGIN)
    }
    if (index % 2 === 0) {
      doc.setFillColor(243, 238, 228)
      doc.rect(MARGIN, y - 10, PAGE_WIDTH - MARGIN * 2, 16, 'F')
    }
    doc.setTextColor(26, 23, 20)
    let x = MARGIN + 4
    for (const column of columns) {
      const raw = row[column.key]
      const clipped = raw.length > 18 && column.key === 'name' ? `${raw.slice(0, 17)}...` : raw
      doc.text(clipped, x, y)
      x += column.width
    }
    y += 16
  })

  if (rows.length === 0) {
    doc.setFontSize(11)
    doc.text('No saved projects.', MARGIN, y)
  }

  footer(doc)
  return doc
}

export async function shareOrDownload(doc: jsPDF, filename: string): Promise<'shared' | 'downloaded'> {
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })
  let canShareFiles = false
  try {
    canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  } catch {
    canShareFiles = false
  }
  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}

export function pdfFileName(projectName: string, prefix: string): string {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${prefix}${slug ? `-${slug}` : ''}.pdf`
}
