import { describe, expect, it } from 'vitest'
import {
  FOOTER,
  ceilStable,
  compute,
  defaults,
  formatNumber,
  roundHalfUp,
  type Inputs,
} from './model'

function at(piles: number, extra: Partial<Inputs> = {}) {
  const result = compute({ ...defaults(), pileCount: piles, ...extra })
  if (!result.ok) throw new Error(result.error)
  return result
}

describe('rounding', () => {
  it('rounds half up, including values that sit on a binary .5 boundary', () => {
    expect(roundHalfUp(32.211, 2)).toBe(32.21)
    expect(roundHalfUp(39.369, 2)).toBe(39.37)
    expect(roundHalfUp(1610.55, 1)).toBe(1610.6)
    expect(roundHalfUp(1968.45, 1)).toBe(1968.5)
    expect(formatNumber(1073.7, 1)).toBe('1,073.7')
    expect(formatNumber(1610.55, 1)).toBe('1,610.6')
    expect(formatNumber(1968.45, 1)).toBe('1,968.5')
  })
})

describe('default batch', () => {
  const result = at(30)

  it('builds 470 lb cement + 291.9 lb water = 761.9 lb and 50.79 gal', () => {
    expect(result.cementLb).toBe(470)
    expect(result.waterLb).toBe(291.9)
    expect(result.totalLb).toBe(761.9)
    expect(result.batchGal).toBe(50.79)
    expect(result.inputs.batchesPerPile).toBe(1)
    expect(result.perPile.standard).toBe(35.79)
    expect(result.equation).toBe('1 x 50.79 gal - 15 gal residual = 35.79 gal')
    expect(result.totalFt).toBe(900)
  })

  it('shows cement yield 10.158 gal/bag and 3.52 bags per pile', () => {
    expect(result.yieldDisplay).toBe(10.158)
    expect(roundHalfUp(result.bagsPerPile, 2)).toBe(3.52)
  })

  it('plans the per-pile range at 1 decimal from the 2-decimal 35.79', () => {
    expect(formatNumber(result.perPile.low, 1)).toBe('32.2')
    expect(formatNumber(result.perPile.standard, 1)).toBe('35.8')
    expect(formatNumber(result.perPile.high, 1)).toBe('39.4')
  })
})

describe('reference projects', () => {
  it('1 pile: 32.21 / 35.79 / 39.37 gal, 4 bags, 1 batch', () => {
    const result = at(1)
    expect(result.inputs.batchesPerPile).toBe(1)
    expect(roundHalfUp(result.project.low, 2)).toBe(32.21)
    expect(roundHalfUp(result.project.standard, 2)).toBe(35.79)
    expect(roundHalfUp(result.project.high, 2)).toBe(39.37)
    expect(result.bagsCeil).toBe(4)
  })

  it('10 piles: 322.1 / 357.9 / 393.7 gal, 36 bags', () => {
    const result = at(10)
    expect(formatNumber(result.project.low, 1)).toBe('322.1')
    expect(formatNumber(result.project.standard, 1)).toBe('357.9')
    expect(formatNumber(result.project.high, 1)).toBe('393.7')
    expect(result.bagsCeil).toBe(36)
  })

  it('30 piles at 3% simple-ground reserve: 106 project bags, 109 to buy, 763 gal water', () => {
    const result = at(30)
    expect(result.inputs.reservePercent).toBe(3)
    expect(formatNumber(result.project.low, 1)).toBe('966.3')
    expect(formatNumber(result.project.standard, 1)).toBe('1,073.7')
    expect(formatNumber(result.project.high, 1)).toBe('1,181.1')
    expect(roundHalfUp(result.bagsExact, 3)).toBe(105.693)
    expect(result.bagsCeil).toBe(106)
    expect(result.bagsToBuy).toBe(109)
    expect(result.waterToBuyGal).toBe(763)
    expect(result.inputs.bagsPerPallet).toBe(35)
    expect(roundHalfUp(result.palletsExact, 2)).toBe(3.11)
    expect(result.palletsToBuy).toBe(4)
  })

  it('120 piles: exact 422.772 bags, 423 base, 436 with 3%, 466 with 10%', () => {
    const result = at(120)
    expect(roundHalfUp(result.bagsExact, 3)).toBe(422.772)
    expect(result.bagsExact).toBeCloseTo(422.772, 3)
    expect(result.bagsCeil).toBe(423)
    expect(result.bagsToBuy).toBe(436)
    expect(result.waterToBuyGal).toBe(3052)
    expect(result.palletsToBuy).toBe(13)
    const ten = at(120, { reservePercent: 10 })
    expect(ten.bagsCeil).toBe(423)
    expect(ten.bagsToBuy).toBe(466)
    expect(ten.project).toEqual(result.project)
  })

  it('50 piles: 1,610.6 / 1,789.5 / 1,968.5 gal and 177 bags, not 3.52 x 50', () => {
    const result = at(50)
    expect(formatNumber(result.project.low, 1)).toBe('1,610.6')
    expect(formatNumber(result.project.standard, 1)).toBe('1,789.5')
    expect(formatNumber(result.project.high, 1)).toBe('1,968.5')
    expect(roundHalfUp(result.bagsExact, 3)).toBe(176.155)
    expect(result.bagsExact).toBeCloseTo(176.155, 3)
    expect(result.bagsCeil).toBe(177)
    expect(ceilStable(3.52 * 50)).toBe(176)
    expect(result.bagsCeil).not.toBe(176)
  })
})

describe('reserve and density', () => {
  it('applies the reserve only to bags and water', () => {
    const base = at(30, { reservePercent: 10 })
    const more = at(30, { reservePercent: 25 })
    expect(more.project).toEqual(base.project)
    expect(more.perPile).toEqual(base.perPile)
    expect(more.bagsCeil).toBe(base.bagsCeil)
    expect(more.bagsToBuy).toBeGreaterThan(base.bagsToBuy)
    expect(more.waterToBuyGal).toBe(more.bagsToBuy * more.inputs.waterGalPerBag)
    const ten = at(30, { reservePercent: 10 })
    expect(ten.bagsToBuy).toBe(117)
    expect(ten.waterToBuyGal).toBe(819)
    expect(ten.project).toEqual(base.project)
  })

  it('flags density under 15 lb/gal and keeps the 16 / 15 / 14 table', () => {
    const result = at(1)
    expect(result.densityOutOfSpec).toBe(false)
    expect(result.scenarios.map((row) => row.density)).toEqual([16, 15, 14])
    expect(result.scenarios.map((row) => row.galPerPile)).toEqual([32.62, 35.79, 39.42])
    expect(result.scenarios.map((row) => row.outOfSpec)).toEqual([false, false, true])
    expect(at(1, { densityLbPerGal: 14.99 }).densityOutOfSpec).toBe(true)
    expect(at(1, { densityLbPerGal: 14 }).densityOutOfSpec).toBe(true)
    expect(at(1, { densityLbPerGal: 16 }).densityOutOfSpec).toBe(false)
    expect(at(1, { densityLbPerGal: 16 }).perPile.standard).toBe(32.62)
  })
})

describe('geometry', () => {
  it('computes annular, inner, and total separately from the bar and the bit', () => {
    const result = at(30)
    expect(result.geometry.lengthFt).toBeCloseTo(29.5, 5)
    expect(result.geometry.annularGal).toBeCloseTo(4.5376, 3)
    expect(result.geometry.innerGal).toBeCloseTo(0.7462, 3)
    expect(result.geometry.totalGal).toBeCloseTo(5.2838, 3)
    expect(result.geometry.annularGal + result.geometry.innerGal).toBeCloseTo(result.geometry.totalGal, 8)
    expect(result.geometry.reference).toEqual({ annular: 4.53, inner: 0.77, total: 5.3 })
    expect(result.geometry.delta.annular).toBeGreaterThan(0)
    expect(result.geometry.delta.annular).toBeLessThan(0.02)
    expect(result.geometry.delta.inner).toBeLessThan(0)
    expect(result.geometry.delta.inner).toBeGreaterThan(-0.03)
  })

  it('does not mix geometry or coupler count into field consumption', () => {
    const base = at(30)
    const changed = at(30, { drillBitIn: 4.5, couplerCount: 11, barOdMm: 50 })
    expect(changed.project).toEqual(base.project)
    expect(changed.bagsCeil).toBe(base.bagsCeil)
    expect(changed.bagsToBuy).toBe(base.bagsToBuy)
    expect(changed.geometry.annularGal).not.toBeCloseTo(base.geometry.annularGal, 2)
    const couplersOnly = at(30, { couplerCount: 8 })
    expect(couplersOnly.geometry.totalGal).toBeCloseTo(base.geometry.totalGal, 8)
  })
})

describe('footer', () => {
  it('uses the required credit line', () => {
    expect(FOOTER).toBe('v1.1 — developed by ED')
  })
})

describe('invalid input', () => {
  it('rejects a zero density', () => {
    const result = compute({ ...defaults(), densityLbPerGal: 0 })
    expect(result.ok).toBe(false)
  })
})
