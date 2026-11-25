import { describe, expect, it } from 'vitest'
import { buildComparisonPdf, buildProjectPdf, type ComparisonRow } from './pdf'

describe('pdf', () => {
  it('prints the project figures and the credit line', () => {
    const doc = buildProjectPdf(
      {
        projectName: 'River Road',
        date: 'November 25, 2026',
        outOfSpec: false,
        lines: [
          { label: 'Inferred per pile', value: '35.79 gal' },
          { label: 'Project bags', value: '106' },
          { label: 'Bags to buy', value: '117' },
          { label: 'Water to buy', value: '819 gal' },
        ],
        geometry: [
          { label: 'Annular', value: '4.538 gal' },
          { label: 'Inner', value: '0.746 gal' },
          { label: 'Total', value: '5.284 gal' },
        ],
        note: '',
      },
      { compress: false },
    )
    const raw = doc.output()
    expect(raw.startsWith('%PDF')).toBe(true)
    expect(raw).toContain('River Road')
    expect(raw).toContain('35.79 gal')
    expect(raw).toContain('BASEco')
    expect(raw).toContain('developed by ED')
    expect(raw).toContain('v1.3')
  })

  it('prints the comparison columns', () => {
    const rows: ComparisonRow[] = [
      {
        name: 'Red Hills',
        piles: '10',
        feet: '300',
        low: '322.1',
        standard: '357.9',
        high: '393.7',
        bags: '36',
        bagsReserve: '39',
        pallets: '2',
        water: '273',
      },
    ]
    const doc = buildComparisonPdf(rows, 'November 25, 2026', { compress: false })
    const raw = doc.output()
    expect(raw).toContain('Red Hills')
    expect(raw).toContain('357.9')
    expect(raw).toContain('developed by ED')
  })
})
