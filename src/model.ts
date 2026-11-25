/** BASEco grout model. Field gallons use the mass balance rounded to 2 decimals (35.79), then the ±10% range. Bag purchasing divides that project total by the unrounded yield so 50 piles is 176.155 bags, not 3.52 × 50. */

export const APP_VERSION = '1.2'
export const FOOTER = `v${APP_VERSION} — developed by ED`
export const APP_DOCUMENT_TITLE = `MicroPile Hub – Grout Consumption Calculator ${APP_VERSION}`
export const SPEC_DENSITY_LB_PER_GAL = 15
export const SCENARIO_DENSITIES = [16, 15, 14] as const
export const GEOMETRY_REFERENCE = { annular: 4.53, inner: 0.77, total: 5.3 } as const

const CUBIC_INCHES_PER_GALLON = 231
const MM_PER_INCH = 25.4

export interface Inputs {
  projectName: string
  pileCount: number
  lengthPerPileFt: number
  bagsPerBatch: number
  lbPerBag: number
  waterGalPerBatch: number
  waterLbPerGal: number
  densityLbPerGal: number
  batchesPerPile: number
  tankResidualGal: number
  reservePercent: number
  bagsPerPallet: number
  waterGalPerBag: number
  drillBitIn: number
  barOdMm: number
  barIdMm: number
  barCount: number
  barFeet: number
  barInches: number
  couplerCount: number
}

export function defaults(): Inputs {
  return {
    projectName: '',
    pileCount: 30,
    lengthPerPileFt: 30,
    bagsPerBatch: 5,
    lbPerBag: 94,
    waterGalPerBatch: 35,
    waterLbPerGal: 8.34,
    densityLbPerGal: 15,
    batchesPerPile: 1,
    tankResidualGal: 15,
    reservePercent: 3,
    bagsPerPallet: 35,
    waterGalPerBag: 7,
    drillBitIn: 2.5,
    barOdMm: 40,
    barIdMm: 20,
    barCount: 3,
    barFeet: 9,
    barInches: 10,
    couplerCount: 2,
  }
}

export interface RangeGal {
  low: number
  standard: number
  high: number
}

export interface DensityScenario {
  density: number
  galPerPile: number
  outOfSpec: boolean
  active: boolean
}

export interface Geometry {
  lengthFt: number
  annularGal: number
  innerGal: number
  totalGal: number
  reference: { annular: number; inner: number; total: number }
  delta: { annular: number; inner: number; total: number }
}

export interface OkResult {
  ok: true
  inputs: Inputs
  cementLb: number
  waterLb: number
  totalLb: number
  batchGalPrecise: number
  batchGal: number
  perPile: RangeGal
  project: RangeGal
  totalFt: number
  yieldDisplay: number
  yieldPrecise: number
  bagsPerPile: number
  bagsExact: number
  bagsCeil: number
  bagsToBuy: number
  palletsExact: number
  palletsToBuy: number
  waterToBuyGal: number
  densityOutOfSpec: boolean
  scenarios: DensityScenario[]
  geometry: Geometry
  equation: string
}

export interface ErrResult {
  ok: false
  error: string
  inputs: Inputs
}

export type Result = OkResult | ErrResult

export function roundHalfUp(value: number, digits: number): number {
  if (!Number.isFinite(value)) return Number.NaN
  const sign = value < 0 ? -1 : 1
  const factor = 10 ** digits
  const shifted = Math.abs(value) * factor
  const corrected = Math.round(shifted * 1e6) / 1e6
  return (sign * Math.round(corrected)) / factor
}

export function formatNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = roundHalfUp(value, digits)
  const negative = rounded < 0
  const fixed = Math.abs(rounded).toFixed(digits)
  const [whole, frac] = fixed.split('.')
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = digits > 0 ? `${withCommas}.${frac}` : withCommas
  return negative ? `-${body}` : body
}

export function formatSigned(value: number, digits: number): string {
  const body = formatNumber(value, digits)
  if (value > 0 && body !== '—') return `+${body}`
  return body
}

export function formatFlex(value: number, maxDigits = 2): string {
  if (!Number.isFinite(value)) return '—'
  for (let digits = 0; digits <= maxDigits; digits += 1) {
    if (Math.abs(value - roundHalfUp(value, digits)) < 1e-8) return formatNumber(value, digits)
  }
  return formatNumber(value, maxDigits)
}

export function ceilStable(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN
  const nearest = Math.round(value)
  if (Math.abs(value - nearest) < 1e-8) return nearest
  return Math.ceil(value)
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function validate(input: Inputs): string | null {
  const fields: Array<[number, string]> = [
    [input.pileCount, 'Number of piles'],
    [input.lengthPerPileFt, 'Length per pile'],
    [input.bagsPerBatch, 'Bags per batch'],
    [input.lbPerBag, 'Pounds per bag'],
    [input.waterGalPerBatch, 'Water per batch'],
    [input.waterLbPerGal, 'Water density'],
    [input.densityLbPerGal, 'Grout density'],
    [input.batchesPerPile, 'Batches per pile'],
    [input.tankResidualGal, 'Tank residual'],
    [input.reservePercent, 'Purchase reserve'],
    [input.bagsPerPallet, 'Bags per pallet'],
    [input.waterGalPerBag, 'Water per bag'],
    [input.drillBitIn, 'Drill bit'],
    [input.barOdMm, 'Bar outside diameter'],
    [input.barIdMm, 'Bar inside diameter'],
    [input.barCount, 'Number of bars'],
    [input.barFeet, 'Bar length feet'],
    [input.barInches, 'Bar length inches'],
    [input.couplerCount, 'Couplers'],
  ]
  for (const [value, label] of fields) {
    if (!finite(value)) return `Enter a number for ${label}.`
  }
  if (input.pileCount < 0) return 'Number of piles cannot be negative.'
  if (input.lengthPerPileFt < 0) return 'Length per pile cannot be negative.'
  if (!(input.bagsPerBatch > 0)) return 'Bags per batch must be greater than 0.'
  if (!(input.bagsPerPallet > 0)) return 'Bags per pallet must be greater than 0.'
  if (!(input.densityLbPerGal > 0)) return 'Grout density must be greater than 0 lb/gal.'
  if (input.lbPerBag < 0 || input.waterGalPerBatch < 0 || input.waterLbPerGal < 0) {
    return 'Batch weights and water cannot be negative.'
  }
  if (input.batchesPerPile < 0 || input.tankResidualGal < 0) {
    return 'Batches and tank residual cannot be negative.'
  }
  return null
}

function circleArea(diameter: number): number {
  return (Math.PI * diameter * diameter) / 4
}

export function geometryOf(input: Inputs): Geometry {
  const lengthFt = input.barCount * (input.barFeet + input.barInches / 12)
  const lengthIn = lengthFt * 12
  const odIn = input.barOdMm / MM_PER_INCH
  const idIn = input.barIdMm / MM_PER_INCH
  const annularGal = ((circleArea(input.drillBitIn) - circleArea(odIn)) * lengthIn) / CUBIC_INCHES_PER_GALLON
  const innerGal = (circleArea(idIn) * lengthIn) / CUBIC_INCHES_PER_GALLON
  const totalGal = annularGal + innerGal
  return {
    lengthFt,
    annularGal,
    innerGal,
    totalGal,
    reference: { ...GEOMETRY_REFERENCE },
    delta: {
      annular: annularGal - GEOMETRY_REFERENCE.annular,
      inner: innerGal - GEOMETRY_REFERENCE.inner,
      total: totalGal - GEOMETRY_REFERENCE.total,
    },
  }
}

function galAtDensity(totalLb: number, batchesPerPile: number, residual: number, density: number): number {
  const batchGal = totalLb / density
  return batchesPerPile * batchGal - residual
}

export function compute(input: Inputs): Result {
  const error = validate(input)
  if (error) return { ok: false, error, inputs: input }

  const cementLb = roundHalfUp(input.bagsPerBatch * input.lbPerBag, 4)
  const waterLb = roundHalfUp(input.waterGalPerBatch * input.waterLbPerGal, 4)
  const totalLb = roundHalfUp(cementLb + waterLb, 4)
  const batchGalPrecise = totalLb / input.densityLbPerGal
  const batchGal = roundHalfUp(batchGalPrecise, 2)
  const rawPerPile = galAtDensity(totalLb, input.batchesPerPile, input.tankResidualGal, input.densityLbPerGal)
  const standard = roundHalfUp(rawPerPile, 2)
  const perPile: RangeGal = {
    low: standard * 0.9,
    standard,
    high: standard * 1.1,
  }
  const piles = input.pileCount
  const project: RangeGal = {
    low: perPile.low * piles,
    standard: perPile.standard * piles,
    high: perPile.high * piles,
  }
  const yieldPrecise = batchGalPrecise / input.bagsPerBatch
  const yieldDisplay = roundHalfUp(batchGal / input.bagsPerBatch, 3)
  const bagsExact = piles === 0 ? 0 : project.standard / yieldPrecise
  const bagsPerPile = standard / yieldPrecise
  const bagsCeil = ceilStable(bagsExact)
  const bagsToBuy = ceilStable(bagsExact * (1 + input.reservePercent / 100))
  const palletsExact = bagsToBuy / input.bagsPerPallet
  const palletsToBuy = ceilStable(palletsExact)
  const waterToBuyGal = bagsToBuy * input.waterGalPerBag
  const scenarios: DensityScenario[] = SCENARIO_DENSITIES.map((density) => ({
    density,
    galPerPile: roundHalfUp(
      galAtDensity(totalLb, input.batchesPerPile, input.tankResidualGal, density),
      2,
    ),
    outOfSpec: density < SPEC_DENSITY_LB_PER_GAL,
    active: Math.abs(density - input.densityLbPerGal) < 1e-9,
  }))
  const batchesLabel = formatFlex(input.batchesPerPile, 2)
  const equation = `${batchesLabel} x ${formatNumber(batchGal, 2)} gal - ${formatFlex(input.tankResidualGal, 2)} gal residual = ${formatNumber(standard, 2)} gal`

  return {
    ok: true,
    inputs: input,
    cementLb,
    waterLb,
    totalLb,
    batchGalPrecise,
    batchGal,
    perPile,
    project,
    totalFt: input.pileCount * input.lengthPerPileFt,
    yieldDisplay,
    yieldPrecise,
    bagsPerPile,
    bagsExact,
    bagsCeil,
    bagsToBuy,
    palletsExact,
    palletsToBuy,
    waterToBuyGal,
    densityOutOfSpec: input.densityLbPerGal < SPEC_DENSITY_LB_PER_GAL,
    scenarios,
    geometry: geometryOf(input),
    equation,
  }
}
