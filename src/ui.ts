import { wordmarkSvg } from './logo'
import {
  APP_DOCUMENT_TITLE,
  FOOTER,
  compute,
  defaults,
  formatFlex,
  formatNumber,
  formatSigned,
  type Inputs,
  type OkResult,
  type Result,
} from './model'
import {
  buildComparisonPdf,
  buildProjectPdf,
  pdfFileName,
  shareOrDownload,
  type ComparisonRow,
  type PdfLine,
} from './pdf'
import {
  deleteProject,
  loadProjects,
  newId,
  storageAvailable,
  upsertProject,
  type SavedProject,
} from './storage'

let inputs: Inputs = defaults()
let activeId: string | null = null
let sheetMode: 'project' | 'comparison' = 'project'
let logoDataUrl: Promise<string | undefined> | null = null

const NUMERIC: Array<[keyof Inputs, string]> = [
  ['pileCount', 'pile-count'],
  ['lengthPerPileFt', 'length-ft'],
  ['bagsPerBatch', 'bags-per-batch'],
  ['lbPerBag', 'lb-per-bag'],
  ['waterGalPerBatch', 'water-gal'],
  ['waterLbPerGal', 'water-lb-per-gal'],
  ['densityLbPerGal', 'density'],
  ['batchesPerPile', 'batches-per-pile'],
  ['tankResidualGal', 'residual'],
  ['reservePercent', 'reserve'],
  ['bagsPerPallet', 'bags-per-pallet'],
  ['waterGalPerBag', 'water-per-bag'],
  ['drillBitIn', 'drill-bit'],
  ['barOdMm', 'bar-od'],
  ['barIdMm', 'bar-id'],
  ['barCount', 'bar-count'],
  ['barFeet', 'bar-feet'],
  ['barInches', 'bar-inches'],
  ['couplerCount', 'couplers'],
]

export function mount(root: HTMLElement): void {
  root.innerHTML = shell()
  bind()
  applyInputs()
  refresh()
}

function shell(): string {
  return `
    <div id="app-main">
      <header class="top">
        ${wordmarkSvg('onDark')}
        <p class="product">MicroPile Hub</p>
        <h1>Grout Consumption Calculator</h1>
        <p class="where">St. George, Utah</p>
      </header>
      <p id="live" class="sr-only" aria-live="polite"></p>
      <form id="calc" autocomplete="off">
        <section class="card" id="project">
          <div class="card-head">
            <h2>Project</h2>
            <button type="button" class="btn" id="reset">Reset</button>
          </div>
          <div class="grid-2">
            ${field('project-name', 'Project name', 'text', 'e.g. River Road wall', true)}
            ${numField('pile-count', 'Number of piles', '1', '0')}
            ${numField('length-ft', 'Length per pile (ft)', '0.1', '0')}
          </div>
          <p class="total-ft" id="total-ft"></p>
        </section>

        <section class="card" id="field">
          <p><span class="badge" id="inferred-badge">INFERRED</span></p>
          <h2>Field consumption</h2>
          <p class="hero-num"><span id="inferred-value">—</span> <span class="unit">gal / pile</span></p>
          <p class="equation" id="field-equation"></p>
          <p class="note">Mass balance minus what stays in the tank. This is not a hole-volume estimate.</p>
          <p class="banner banner-warn" id="spec-banner" hidden></p>
          <p class="banner banner-error" id="error-banner" hidden></p>
        </section>

        <section class="card" id="batch">
          <h2>Batch and tank</h2>
          <div class="grid-2">
            ${numField('bags-per-batch', 'Bags per batch', '1', '0')}
            ${numField('lb-per-bag', 'Pounds per bag', '0.1', '0')}
            ${numField('water-gal', 'Water per batch (gal)', '0.1', '0')}
            ${numField('water-lb-per-gal', 'Water (lb/gal)', '0.01', '0')}
            ${numField('density', 'Grout density (lb/gal)', '0.1', '0')}
            ${numField('batches-per-pile', 'Batches per pile', '0.1', '0')}
            ${numField('residual', 'Tank residual (gal)', '0.1', '0')}
          </div>
          <p class="statline" id="batch-stats"></p>
        </section>

        <section class="card" id="range">
          <h2>Planning range, ±10%</h2>
          <h3>Per pile (1 decimal)</h3>
          <div class="trio" id="pile-range"></div>
          <h3 id="project-range-label">Project</h3>
          <div class="trio" id="project-range"></div>
          <p class="note">Low and high are the 2-decimal field figure times 0.90 and 1.10. The purchase reserve does not change these gallons.</p>
        </section>

        <section class="card" id="purchase">
          <h2>Cement and water to buy</h2>
          <div class="purchase" id="purchase-rows"></div>
          <label class="field reserve-field" for="reserve">Purchase reserve – simple ground (%)
            <input id="reserve" type="number" inputmode="decimal" min="0" step="0.1" />
          </label>
          <label class="field reserve-field" for="bags-per-pallet">Pallets (bags per pallet)
            <input id="bags-per-pallet" type="number" inputmode="decimal" min="1" step="1" />
          </label>
          <label class="field reserve-field" for="water-per-bag">Water to buy (gal per bag)
            <input id="water-per-bag" type="number" inputmode="decimal" min="0" step="0.1" />
          </label>
          <p class="note">3% is the reserve for simple, standard ground. Medium and hard ground will get their own factors in a future version. The reserve changes bags, pallets, and water to buy only. It does not change the low, standard, or high gallons.</p>
        </section>

        <section class="card" id="scenarios">
          <h2>Density scenarios</h2>
          <p class="note">Same batch, batches per pile, and residual. Any density under 15 lb/gal is out of spec.</p>
          <table>
            <thead>
              <tr><th>Density</th><th>Gal / pile</th><th>Status</th></tr>
            </thead>
            <tbody id="scenario-body"></tbody>
          </table>
        </section>

        <section class="card" id="geometry">
          <h2>Theoretical geometry</h2>
          <p class="note">Separate from field consumption. Not added to the gallons or the purchase.</p>
          <p class="statline" id="geom-spec"></p>
          <div class="geom-figures">
            <article><span>Annular grout</span><strong id="geom-annular">—</strong></article>
            <article><span>Inner grout</span><strong id="geom-inner">—</strong></article>
            <article><span>Total theoretical</span><strong id="geom-total">—</strong></article>
          </div>
          <p class="note" id="geom-note"></p>
          <p class="banner banner-warn" id="geom-warn" hidden></p>
          <details>
            <summary>Edit drill bit, bar, and couplers</summary>
            <div class="grid-2" style="margin-top:12px">
              ${numField('drill-bit', 'Drill bit (in)', '0.01', '0')}
              ${numField('bar-od', 'Bar OD (mm)', '0.1', '0')}
              ${numField('bar-id', 'Bar ID (mm)', '0.1', '0')}
              ${numField('bar-count', 'Number of bars', '1', '0')}
              ${numField('bar-feet', 'Each bar (ft)', '1', '0')}
              ${numField('bar-inches', 'Each bar (in)', '1', '0')}
              ${numField('couplers', 'Couplers', '1', '0')}
            </div>
          </details>
        </section>

        <section class="card card-soon" id="special" aria-disabled="true">
          <div class="card-head">
            <h2>Special conditions</h2>
            <span class="badge badge-warn">Coming soon</span>
          </div>
          <p>Coming soon. Medium and hard ground will get their own purchase factors in a future version. The reserve above stays at 3% for simple, standard ground.</p>
          <ul class="soon-list">
            <li>Fractured rock</li>
            <li>Voids and cavities</li>
            <li>High water table</li>
            <li>Loose fill</li>
          </ul>
          <button type="button" class="btn" id="special-open" disabled>Not available in 1.1</button>
        </section>

        <details class="card formulas" id="formulas">
          <summary>Formulas and assumptions</summary>
          <ul>
            <li>Cement mass = bags × pounds per bag. Default 5 × 94 = 470 lb.</li>
            <li>Water mass = gallons × 8.34 lb/gal. Default 35 × 8.34 = 291.9 lb.</li>
            <li>Batch mass = 761.9 lb. Batch volume = mass ÷ density. At 15 lb/gal that is 50.793… gal, shown as 50.79.</li>
            <li>Field gallons per pile = batches × batch volume − tank residual, then rounded to 2 decimals (35.79). Labeled INFERRED.</li>
            <li>Low / high = that 2-decimal figure × 0.90 / × 1.10. Per pile is shown to 1 decimal (32.2 / 35.8 / 39.4). Project gallons multiply by the pile count and are shown to 1 decimal.</li>
            <li>Displayed yield = 50.79 ÷ 5 = 10.158 gal/bag. Purchasing uses the unrounded yield (batch volume ÷ bags) so the project total is not shorted by rounding.</li>
            <li>Project bags = ceil(standard gallons ÷ yield) on the project total. 50 piles is 176.155 bags, which rounds up to 177. 3.52 × 50 = 176 would be one bag short.</li>
            <li>Bags to buy = ceil(exact bags × (1 + reserve)). The default reserve is 3% for simple, standard ground. Water to buy = bags to buy × 7 gal. Pallets to buy = ceil(bags to buy ÷ 35), and 35 bags per pallet can be edited. Reserve never changes low, standard, or high gallons.</li>
            <li>Density scenarios are 16, 15, and 14 lb/gal. Under 15 lb/gal is OUT OF SPEC.</li>
            <li>Geometry uses a 2.5 in bit, a 40 mm OD / 20 mm ID bar, and 3 bars of 9 ft 10 in (29.5 ft). A US gallon is 231 in³ and 25.4 mm is 1 in. Two couplers are counted as hardware and are not given a volume.</li>
            <li>Special conditions (fractured rock, voids, high water, loose fill, medium and hard ground) stay out of the 1.1 math. Their factors are coming later.</li>
          </ul>
          <p id="formula-now"></p>
        </details>

        <section class="card" id="projects">
          <h2>Saved on this phone</h2>
          <p class="note" id="storage-note"></p>
          <p class="status" id="save-status" role="status"></p>
          <p class="note" id="active-label"></p>
          <div class="actions">
            <button type="button" class="btn btn-primary" id="save">Save project</button>
            <button type="button" class="btn" id="save-new" hidden>Save as new</button>
            <button type="button" class="btn" id="preview-pdf">Preview PDF</button>
            <button type="button" class="btn" id="download-pdf">Download PDF</button>
          </div>
          <h3>Comparison</h3>
          <div id="cmp-wrap"></div>
          <div class="actions">
            <button type="button" class="btn" id="preview-comparison">Preview comparison PDF</button>
            <button type="button" class="btn" id="download-comparison">Download comparison PDF</button>
          </div>
        </section>
      </form>
      <footer class="site-footer">
        <div>${FOOTER}</div>
        <p class="install">On iPhone, open Share and tap Add to Home Screen. After one visit the calculator stays on the phone.</p>
      </footer>
    </div>
    <div id="pdf-preview" hidden>
      <div class="preview-bar no-print">
        <button type="button" class="btn" id="close-preview">Back</button>
        <button type="button" class="btn" id="preview-download">Download PDF</button>
        <button type="button" class="btn btn-primary" id="do-print">Print / Save as PDF</button>
      </div>
      <article class="sheet" id="sheet"></article>
    </div>
  `
}

function field(id: string, label: string, type: string, placeholder: string, span: boolean): string {
  return `<label class="field${span ? ' span-2' : ''}" for="${id}">${label}
    <input id="${id}" name="${id}" type="${type}" placeholder="${placeholder}" spellcheck="${type === 'text' ? 'true' : 'false'}" />
  </label>`
}

function numField(id: string, label: string, step: string, min: string): string {
  return `<label class="field" for="${id}">${label}
    <input id="${id}" name="${id}" type="number" inputmode="decimal" min="${min}" step="${step}" />
  </label>`
}

function bind(): void {
  byId<HTMLFormElement>('calc').addEventListener('submit', (event) => event.preventDefault())
  byId('calc').addEventListener('input', () => {
    inputs = readInputs()
    refresh()
  })
  byId('reset').addEventListener('click', () => {
    if (!confirm('Reset all inputs to the BASEco defaults?')) return
    inputs = defaults()
    activeId = null
    applyInputs()
    refresh()
    setStatus('Inputs reset to the BASEco defaults.')
  })
  byId('save').addEventListener('click', () => onSave(false))
  byId('save-new').addEventListener('click', () => onSave(true))
  byId('preview-pdf').addEventListener('click', () => openPreview('project'))
  byId('download-pdf').addEventListener('click', () => void downloadCurrent())
  byId('preview-comparison').addEventListener('click', () => openPreview('comparison'))
  byId('download-comparison').addEventListener('click', () => void downloadComparison())
  byId('close-preview').addEventListener('click', closePreview)
  byId('preview-download').addEventListener('click', () => {
    if (sheetMode === 'comparison') void downloadComparison()
    else void downloadCurrent()
  })
  byId('do-print').addEventListener('click', () => window.print())
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing #${id}`)
  return node as T
}

function readInputs(): Inputs {
  const next = defaults()
  next.projectName = byId<HTMLInputElement>('project-name').value
  for (const [key, id] of NUMERIC) {
    const raw = byId<HTMLInputElement>(id).value.trim()
    const value = raw === '' ? Number.NaN : Number(raw)
    if (key !== 'projectName') next[key] = value as never
  }
  return next
}

function applyInputs(): void {
  byId<HTMLInputElement>('project-name').value = inputs.projectName
  for (const [key, id] of NUMERIC) {
    const value = inputs[key]
    byId<HTMLInputElement>(id).value = typeof value === 'number' ? String(value) : ''
  }
}

function refresh(): void {
  const result = compute(inputs)
  paint(result)
  paintProjects()
  if (byId('pdf-preview').hidden) fillProjectSheet(result)
  else fillSheet(result)
}

function paint(result: Result): void {
  const error = byId('error-banner')
  const spec = byId('spec-banner')
  if (!result.ok) {
    error.hidden = false
    error.textContent = result.error
    spec.hidden = true
    text('inferred-value', '—')
    text('field-equation', '')
    text('total-ft', '')
    text('batch-stats', '')
    text('formula-now', '')
    byId('pile-range').replaceChildren()
    byId('project-range').replaceChildren()
    byId('purchase-rows').replaceChildren()
    byId('scenario-body').replaceChildren()
    text('geom-annular', '—')
    text('geom-inner', '—')
    text('geom-total', '—')
    text('geom-note', '')
    text('live', result.error)
    return
  }
  error.hidden = true
  text('total-ft', `${formatFlex(result.inputs.pileCount)} piles · ${formatFlex(result.totalFt)} ft`)
  text(
    'batch-stats',
    `Cement ${formatFlex(result.cementLb, 1)} lb + water ${formatFlex(result.waterLb, 1)} lb = ${formatFlex(result.totalLb, 1)} lb. Batch volume ${formatNumber(result.batchGal, 2)} gal.`,
  )
  text('inferred-value', formatNumber(result.perPile.standard, 2))
  text('field-equation', result.equation)
  spec.hidden = !result.densityOutOfSpec
  spec.textContent = result.densityOutOfSpec
    ? `OUT OF SPEC — ${formatFlex(result.inputs.densityLbPerGal, 2)} lb/gal is below 15.`
    : ''
  fillTrio('pile-range', result.perPile, 1, 'gal')
  text(
    'project-range-label',
    `Project (${formatFlex(result.inputs.pileCount)} piles · ${formatFlex(result.totalFt)} ft)`,
  )
  fillTrio('project-range', result.project, 1, 'gal')
  fillPurchase(result)
  fillScenarios(result)
  fillGeometry(result)
  text(
    'formula-now',
    `With the numbers on screen: ${result.equation}. Exact bags ${formatNumber(result.bagsExact, 3)}. Project bags ${formatNumber(result.bagsCeil, 0)}. Bags to buy ${formatNumber(result.bagsToBuy, 0)}. Water ${formatFlex(result.waterToBuyGal)} gal.`,
  )
  text('live', `${formatNumber(result.perPile.standard, 2)} gallons per pile, inferred.`)
  const save = byId<HTMLButtonElement>('save')
  save.textContent = activeId ? 'Update project' : 'Save project'
  byId('save-new').hidden = !activeId
  text('active-label', activeId ? 'Editing a saved project. Update replaces it. Save as new keeps the old one.' : '')
}

function fillTrio(id: string, range: { low: number; standard: number; high: number }, digits: number, unit: string): void {
  const host = byId(id)
  host.replaceChildren()
  for (const [label, value] of [
    ['Low', range.low],
    ['Standard', range.standard],
    ['High', range.high],
  ] as const) {
    const cell = document.createElement('div')
    const strong = document.createElement('strong')
    strong.textContent = formatNumber(value, digits)
    const caption = document.createElement('span')
    caption.textContent = `${label} ${unit}`
    cell.append(strong, caption)
    host.append(cell)
  }
}

function fillPurchase(result: OkResult): void {
  const host = byId('purchase-rows')
  host.replaceChildren()
  const rows: Array<[string, string]> = [
    ['Yield', `${formatNumber(result.yieldDisplay, 3)} gal/bag`],
    ['Bags per pile', formatNumber(result.bagsPerPile, 2)],
    ['Exact bags', formatNumber(result.bagsExact, 3)],
    ['Project bags', formatNumber(result.bagsCeil, 0)],
    ['Purchase reserve – simple ground', `${formatFlex(result.inputs.reservePercent)}%`],
    ['Bags to buy', formatNumber(result.bagsToBuy, 0)],
    [`Pallets (${formatFlex(result.inputs.bagsPerPallet)} bags/pallet)`, formatNumber(result.palletsToBuy, 0)],
    ['Water to buy', `${formatFlex(result.waterToBuyGal)} gal`],
  ]
  for (const [label, value] of rows) {
    const row = document.createElement('div')
    row.className = 'purchase-row'
    const span = document.createElement('span')
    span.textContent = label
    const strong = document.createElement('strong')
    strong.textContent = value
    row.append(span, strong)
    host.append(row)
  }
}

function fillScenarios(result: OkResult): void {
  const body = byId('scenario-body')
  body.replaceChildren()
  for (const row of result.scenarios) {
    const tr = document.createElement('tr')
    if (row.outOfSpec) tr.classList.add('out')
    if (row.active) tr.classList.add('active')
    addCell(tr, 'Density', `${formatFlex(row.density, 2)} lb/gal`)
    addCell(tr, 'Gal / pile', formatNumber(row.galPerPile, 2))
    addCell(tr, 'Status', row.outOfSpec ? 'OUT OF SPEC' : row.active ? 'In spec · used' : 'In spec')
    body.append(tr)
  }
}

function fillGeometry(result: OkResult): void {
  const { geometry, inputs: current } = result
  const length = formatFlex(geometry.lengthFt, 2)
  text(
    'geom-spec',
    `${formatFlex(current.drillBitIn, 2)} in bit · OD ${formatFlex(current.barOdMm, 1)} mm · ID ${formatFlex(current.barIdMm, 1)} mm · ${formatFlex(current.barCount)} × ${formatFlex(current.barFeet)} ft ${formatFlex(current.barInches)} in = ${length} ft · ${formatFlex(current.couplerCount)} couplers`,
  )
  text('geom-annular', `${formatNumber(geometry.annularGal, 3)} gal`)
  text('geom-inner', `${formatNumber(geometry.innerGal, 3)} gal`)
  text('geom-total', `${formatNumber(geometry.totalGal, 3)} gal`)
  text(
    'geom-note',
    `Reference sheet ${formatNumber(geometry.reference.annular, 2)} / ${formatNumber(geometry.reference.inner, 2)} / ${formatNumber(geometry.reference.total, 2)} gal. This geometry differs by ${formatSigned(geometry.delta.annular, 3)} / ${formatSigned(geometry.delta.inner, 3)} / ${formatSigned(geometry.delta.total, 3)} gal (π, 231 in³ per gallon, 25.4 mm per inch). Couplers are counted only.`,
  )
  const warn = byId('geom-warn')
  if (current.barIdMm >= current.barOdMm) {
    warn.hidden = false
    warn.textContent = 'Bar ID should be smaller than the OD.'
  } else if (current.drillBitIn * 25.4 <= current.barOdMm) {
    warn.hidden = false
    warn.textContent = 'Drill bit is not larger than the bar. Check the diameters.'
  } else {
    warn.hidden = true
    warn.textContent = ''
  }
}

function paintProjects(): void {
  const note = byId('storage-note')
  note.textContent = storageAvailable()
    ? 'Projects stay in this phone’s browser. They are not sent to a server.'
    : 'This phone blocked local storage. You can still calculate and export a PDF.'
  const projects = loadProjects()
  const wrap = byId('cmp-wrap')
  wrap.replaceChildren()
  if (projects.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'note'
    empty.textContent = 'No saved projects yet. Name this job and tap Save.'
    wrap.append(empty)
  } else {
    const table = document.createElement('table')
    table.className = 'cmp'
    const thead = document.createElement('thead')
    const head = document.createElement('tr')
    for (const label of ['Project', 'Piles', 'ft', 'Low gal', 'Std gal', 'High gal', 'Bags', 'Bags w/ reserve', 'Pallets', 'Water gal', 'Actions']) {
      const th = document.createElement('th')
      th.textContent = label
      th.scope = 'col'
      head.append(th)
    }
    thead.append(head)
    const tbody = document.createElement('tbody')
    for (const project of projects) {
      tbody.append(projectRow(project))
    }
    table.append(thead, tbody)
    wrap.append(table)
  }
  const empty = projects.length === 0
  byId<HTMLButtonElement>('preview-comparison').disabled = empty
  byId<HTMLButtonElement>('download-comparison').disabled = empty
}

function projectRow(project: SavedProject): HTMLTableRowElement {
  const tr = document.createElement('tr')
  const result = compute(project.inputs)
  const name = project.inputs.projectName || 'Untitled'
  if (!result.ok) {
    addCell(tr, 'Project', name)
    addCell(tr, 'Piles', '—')
    const td = document.createElement('td')
    td.colSpan = 8
    td.dataset.label = 'Status'
    td.textContent = result.error
    tr.append(td)
  } else {
    addCell(tr, 'Project', name)
    addCell(tr, 'Piles', formatFlex(result.inputs.pileCount))
    addCell(tr, 'ft', formatFlex(result.totalFt))
    addCell(tr, 'Low gal', formatNumber(result.project.low, 1))
    addCell(tr, 'Std gal', formatNumber(result.project.standard, 1))
    addCell(tr, 'High gal', formatNumber(result.project.high, 1))
    addCell(tr, 'Bags', formatNumber(result.bagsCeil, 0))
    addCell(tr, 'Bags w/ reserve', formatNumber(result.bagsToBuy, 0))
    addCell(tr, 'Pallets', formatNumber(result.palletsToBuy, 0))
    addCell(tr, 'Water gal', formatFlex(result.waterToBuyGal))
  }
  const actions = document.createElement('td')
  actions.className = 'actions-cell'
  actions.dataset.label = 'Actions'
  actions.append(
    actionButton('Load', () => onLoad(project.id)),
    actionButton('PDF', () => openSavedPreview(project.id)),
    actionButton('Delete', () => onDelete(project.id), 'btn-danger'),
  )
  tr.append(actions)
  return tr
}

function actionButton(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `btn ${className}`.trim()
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function addCell(tr: HTMLTableRowElement, label: string, value: string): void {
  const td = document.createElement('td')
  td.dataset.label = label
  td.textContent = value
  tr.append(td)
}

function onSave(asNew: boolean): void {
  const name = inputs.projectName.trim()
  if (!name) {
    setStatus('Enter a project name before saving.')
    byId<HTMLInputElement>('project-name').focus()
    return
  }
  const result = compute({ ...inputs, projectName: name })
  if (!result.ok) {
    setStatus(result.error)
    return
  }
  if (!storageAvailable()) {
    setStatus('This phone blocked local storage, so the project was not saved.')
    return
  }
  const updating = !asNew && activeId !== null
  const id = updating ? activeId! : newId()
  try {
    upsertProject({
      id,
      savedAt: new Date().toISOString(),
      inputs: { ...result.inputs, projectName: name },
    })
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not save.')
    return
  }
  activeId = id
  inputs = { ...inputs, projectName: name }
  byId<HTMLInputElement>('project-name').value = name
  setStatus(updating ? 'Updated on this phone.' : 'Saved on this phone.')
  refresh()
}

function onLoad(id: string): void {
  const project = loadProjects().find((item) => item.id === id)
  if (!project) return
  inputs = { ...defaults(), ...project.inputs }
  activeId = id
  applyInputs()
  refresh()
  window.scrollTo({ top: 0, behavior: 'smooth' })
  setStatus(`Loaded ${inputs.projectName}.`)
}

function onDelete(id: string): void {
  const project = loadProjects().find((item) => item.id === id)
  if (!project) return
  if (!confirm(`Delete ${project.inputs.projectName || 'this project'}?`)) return
  try {
    deleteProject(id)
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not delete.')
    return
  }
  if (activeId === id) activeId = null
  setStatus('Deleted.')
  refresh()
}

function setStatus(message: string): void {
  text('save-status', message)
}

function text(id: string, value: string): void {
  byId(id).textContent = value
}

function openPreview(mode: 'project' | 'comparison'): void {
  sheetMode = mode
  const result = compute(inputs)
  if (mode === 'project' && !result.ok) {
    setStatus(result.error)
    return
  }
  fillSheet(result)
  byId('pdf-preview').hidden = false
  document.body.classList.add('pdf-open')
  window.scrollTo({ top: 0 })
}

function openSavedPreview(id: string): void {
  const project = loadProjects().find((item) => item.id === id)
  if (!project) return
  const result = compute(project.inputs)
  sheetMode = 'project'
  fillProjectSheet(result)
  byId('pdf-preview').hidden = false
  document.body.classList.add('pdf-open')
  window.scrollTo({ top: 0 })
}

function closePreview(): void {
  byId('pdf-preview').hidden = true
  document.body.classList.remove('pdf-open')
}

function fillSheet(result: Result): void {
  if (sheetMode === 'comparison') fillComparisonSheet()
  else fillProjectSheet(result)
}

function fillProjectSheet(result: Result): void {
  const sheet = byId('sheet')
  sheet.replaceChildren()
  sheet.insertAdjacentHTML('afterbegin', wordmarkSvg('onLight'))
  sheet.append(p('doc-kicker', APP_DOCUMENT_TITLE))
  sheet.append(p('sheet-meta', 'BASEco · St. George, Utah'))
  if (!result.ok) {
    sheet.append(p('', result.error))
    sheet.append(p('sheet-foot', FOOTER))
    return
  }
  sheet.append(h('h2', result.inputs.projectName.trim() || 'Untitled project'))
  sheet.append(p('sheet-meta', new Date().toLocaleDateString('en-US', { dateStyle: 'long' })))
  if (result.densityOutOfSpec) sheet.append(p('banner banner-warn', 'OUT OF SPEC — density is below 15 lb/gal.'))
  sheet.append(p('sheet-kicker', 'INFERRED field consumption'))
  sheet.append(p('big', `${formatNumber(result.perPile.standard, 2)} gal / pile`))
  sheet.append(p('sheet-meta', result.equation))
  const summary = document.createElement('div')
  summary.className = 'sheet-grid'
  for (const line of [
    ['Piles', formatFlex(result.inputs.pileCount)],
    ['Length', `${formatFlex(result.totalFt)} ft`],
    ['Low', `${formatNumber(result.project.low, 1)} gal`],
    ['Standard', `${formatNumber(result.project.standard, 1)} gal`],
    ['High', `${formatNumber(result.project.high, 1)} gal`],
    ['Project bags', formatNumber(result.bagsCeil, 0)],
    ['Purchase reserve – simple ground', `${formatFlex(result.inputs.reservePercent)}%`],
    ['Bags to buy', formatNumber(result.bagsToBuy, 0)],
    [`Pallets (${formatFlex(result.inputs.bagsPerPallet)} bags/pallet)`, formatNumber(result.palletsToBuy, 0)],
    ['Water', `${formatFlex(result.waterToBuyGal)} gal`],
    ['Annular', `${formatNumber(result.geometry.annularGal, 3)} gal`],
    ['Inner', `${formatNumber(result.geometry.innerGal, 3)} gal`],
    ['Geometry total', `${formatNumber(result.geometry.totalGal, 3)} gal`],
  ] as const) {
    summary.append(lineRow({ label: line[0], value: line[1] }))
  }
  sheet.append(summary)
  sheet.append(
    p(
      'sheet-meta',
      'Geometry is theoretical and is not included in the gallons above. ' +
        `Sheet reference ${formatNumber(result.geometry.reference.annular, 2)} / ${formatNumber(result.geometry.reference.inner, 2)} / ${formatNumber(result.geometry.reference.total, 2)}.`,
    ),
  )
  sheet.append(p('sheet-foot', FOOTER))
}

function fillComparisonSheet(): void {
  const sheet = byId('sheet')
  sheet.replaceChildren()
  sheet.insertAdjacentHTML('afterbegin', wordmarkSvg('onLight'))
  sheet.append(p('doc-kicker', APP_DOCUMENT_TITLE))
  sheet.append(h('h2', 'Saved project comparison'))
  sheet.append(p('', new Date().toLocaleDateString('en-US', { dateStyle: 'long' })))
  const projects = loadProjects()
  if (projects.length === 0) sheet.append(p('', 'No saved projects.'))
  for (const project of projects) {
    const result = compute(project.inputs)
    sheet.append(h('h3', project.inputs.projectName || 'Untitled'))
    if (!result.ok) {
      sheet.append(p('', result.error))
      continue
    }
    const row = comparisonRow(result)
    for (const [label, value] of [
      ['Piles', row.piles],
      ['ft', row.feet],
      ['Low gal', row.low],
      ['Std gal', row.standard],
      ['High gal', row.high],
      ['Bags', row.bags],
      ['Bags w/ reserve', row.bagsReserve],
      ['Pallets', row.pallets],
      ['Water gal', row.water],
    ]) {
      sheet.append(lineRow({ label, value }))
    }
  }
  sheet.append(p('sheet-foot', FOOTER))
}

function projectLines(result: OkResult): PdfLine[] {
  return [
    { label: 'Piles', value: formatFlex(result.inputs.pileCount) },
    { label: 'Length', value: `${formatFlex(result.totalFt)} ft` },
    { label: 'Low / pile', value: `${formatNumber(result.perPile.low, 1)} gal` },
    { label: 'Standard / pile', value: `${formatNumber(result.perPile.standard, 1)} gal` },
    { label: 'High / pile', value: `${formatNumber(result.perPile.high, 1)} gal` },
    { label: 'Low total', value: `${formatNumber(result.project.low, 1)} gal` },
    { label: 'Standard total', value: `${formatNumber(result.project.standard, 1)} gal` },
    { label: 'High total', value: `${formatNumber(result.project.high, 1)} gal` },
    { label: 'Yield', value: `${formatNumber(result.yieldDisplay, 3)} gal/bag` },
    { label: 'Bags per pile', value: formatNumber(result.bagsPerPile, 2) },
    { label: 'Exact bags', value: formatNumber(result.bagsExact, 3) },
    { label: 'Project bags', value: formatNumber(result.bagsCeil, 0) },
    { label: 'Purchase reserve – simple ground', value: `${formatFlex(result.inputs.reservePercent)}%` },
    { label: 'Bags to buy', value: formatNumber(result.bagsToBuy, 0) },
    { label: `Pallets (${formatFlex(result.inputs.bagsPerPallet)} bags/pallet)`, value: formatNumber(result.palletsToBuy, 0) },
    { label: 'Water to buy', value: `${formatFlex(result.waterToBuyGal)} gal` },
  ]
}

function geometryLines(result: OkResult): PdfLine[] {
  return [
    { label: 'Annular', value: `${formatNumber(result.geometry.annularGal, 3)} gal` },
    { label: 'Inner', value: `${formatNumber(result.geometry.innerGal, 3)} gal` },
    { label: 'Total', value: `${formatNumber(result.geometry.totalGal, 3)} gal` },
    { label: 'Couplers', value: formatFlex(result.inputs.couplerCount) },
  ]
}

function comparisonRow(result: OkResult): ComparisonRow {
  return {
    name: result.inputs.projectName || 'Untitled',
    piles: formatFlex(result.inputs.pileCount),
    feet: formatFlex(result.totalFt),
    low: formatNumber(result.project.low, 1),
    standard: formatNumber(result.project.standard, 1),
    high: formatNumber(result.project.high, 1),
    bags: formatNumber(result.bagsCeil, 0),
    bagsReserve: formatNumber(result.bagsToBuy, 0),
    pallets: formatNumber(result.palletsToBuy, 0),
    water: formatFlex(result.waterToBuyGal),
  }
}

function lineRow(line: PdfLine): HTMLElement {
  const row = document.createElement('div')
  row.className = 'purchase-row'
  const span = document.createElement('span')
  span.textContent = line.label
  const strong = document.createElement('strong')
  strong.textContent = line.value
  row.append(span, strong)
  return row
}

function p(className: string, value: string): HTMLParagraphElement {
  const node = document.createElement('p')
  if (className) node.className = className
  node.textContent = value
  return node
}

function h(tag: 'h2' | 'h3', value: string): HTMLElement {
  const node = document.createElement(tag)
  node.textContent = value
  return node
}

async function logo(): Promise<string | undefined> {
  if (!logoDataUrl) {
    logoDataUrl = fetch(`${import.meta.env.BASE_URL}icons/icon-192.png`, { signal: AbortSignal.timeout(4000) })
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          }),
      )
      .catch(() => undefined)
  }
  return logoDataUrl
}

async function downloadCurrent(): Promise<void> {
  const result = compute(inputs)
  if (!result.ok) {
    setStatus(result.error)
    return
  }
  const logoUrl = await logo()
  const doc = buildProjectPdf(
    {
      projectName: result.inputs.projectName.trim() || 'Untitled project',
      date: new Date().toLocaleDateString('en-US', { dateStyle: 'long' }),
      outOfSpec: result.densityOutOfSpec,
      lines: projectLines(result),
      geometry: geometryLines(result),
      note: 'Field gallons are the mass balance minus the tank residual. Geometry is theoretical and is not included in the purchase. On iPhone, Print / Save as PDF uses the on-screen sheet if the download does not open.',
    },
    { logoDataUrl: logoUrl },
  )
  const how = await shareOrDownload(doc, pdfFileName(result.inputs.projectName, 'grout'))
  setStatus(how === 'shared' ? 'PDF shared.' : 'PDF download started.')
}

async function downloadComparison(): Promise<void> {
  const rows = loadProjects()
    .map((project) => compute(project.inputs))
    .filter((result): result is OkResult => result.ok)
    .map(comparisonRow)
  if (rows.length === 0) {
    setStatus('Save at least one project before exporting the comparison.')
    return
  }
  const logoUrl = await logo()
  const doc = buildComparisonPdf(rows, new Date().toLocaleDateString('en-US', { dateStyle: 'long' }), {
    logoDataUrl: logoUrl,
  })
  const how = await shareOrDownload(doc, 'grout-comparison.pdf')
  setStatus(how === 'shared' ? 'Comparison shared.' : 'Comparison download started.')
}
