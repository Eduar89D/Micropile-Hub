import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.env.SHOT_URL ?? 'http://127.0.0.1:4173/Micropile-Hub/'
const outDir = process.env.SHOT_DIR ?? '/opt/cursor/artifacts'
const chrome = process.env.CHROME ?? '/usr/bin/google-chrome-stable'

await mkdir(outDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
})

const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
await page.setUserAgent(
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
)
page.on('dialog', (dialog) => dialog.accept())

await page.goto(base, { waitUntil: 'networkidle0' })
await page.waitForSelector('#inferred-value')

const text = await page.evaluate(() => document.body.innerText)
const must = [
  'INFERRED',
  '35.79',
  '900 ft',
  '50.79',
  '761.9',
  '32.2',
  '35.8',
  '39.4',
  '1,073.7',
  '106',
  '117',
  '819',
  '10.158',
  '3.52',
  'OUT OF SPEC',
  'Coming soon',
  'v1.0 — developed by ED',
  '4.538',
  '0.746',
  '5.284',
  '4.53',
]
for (const snippet of must) {
  if (!text.includes(snippet)) throw new Error(`Missing on page: ${snippet}`)
}

const specialDisabled = await page.$eval('#special-open', (el) => el.disabled)
if (!specialDisabled) throw new Error('Special conditions should be disabled')

await page.screenshot({ path: path.join(outDir, 'iphone_main_calculator.png') })

await page.evaluate(() => document.getElementById('scenarios')?.scrollIntoView({ block: 'start' }))
await page.evaluate(() => window.scrollBy(0, -8))
await page.screenshot({ path: path.join(outDir, 'iphone_scenarios_geometry.png') })

async function setValue(id, value) {
  await page.$eval(
    `#${id}`,
    (el, next) => {
      el.value = next
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    value,
  )
}

await setValue('density', '14')
await page.waitForSelector('#spec-banner:not([hidden])')
await setValue('density', '15')

await setValue('project-name', 'River Road wall')
await setValue('pile-count', '30')
await page.click('#save')
await page.waitForFunction(() => document.getElementById('save-status')?.textContent?.includes('Saved'))

await setValue('project-name', 'Red Hills')
await setValue('pile-count', '10')
await page.click('#save-new')

await setValue('project-name', 'Bloomington')
await setValue('pile-count', '50')
await page.click('#save-new')

await page.waitForFunction(() => document.body.innerText.includes('1,789.5'))
await page.evaluate(() => document.querySelector('#cmp-wrap table')?.scrollIntoView({ block: 'start' }))
await page.evaluate(() => window.scrollBy(0, -70))
await page.screenshot({ path: path.join(outDir, 'iphone_saved_projects.png') })

const loadButtons = await page.$$('#cmp-wrap button')
for (const button of loadButtons) {
  const label = await button.evaluate((el) => el.textContent)
  if (label === 'Load') {
    const rowText = await button.evaluate((el) => el.closest('tr')?.innerText ?? '')
    if (rowText.includes('River Road')) {
      await button.click()
      break
    }
  }
}
await page.waitForFunction(() => document.getElementById('project-name')?.value === 'River Road wall')
await page.click('#preview-pdf')
await page.waitForSelector('#pdf-preview:not([hidden])')
await page.screenshot({ path: path.join(outDir, 'iphone_pdf_output.png') })

const pdfHeader = await page.evaluate(async () => {
  const original = URL.createObjectURL.bind(URL)
  let header = ''
  URL.createObjectURL = (object) => {
    if (object instanceof Blob) {
      object.slice(0, 5).arrayBuffer().then((buffer) => {
        header = String.fromCharCode(...new Uint8Array(buffer))
      })
    }
    return original(object)
  }
  document.getElementById('preview-download')?.click()
  for (let i = 0; i < 20 && header !== '%PDF'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return header
})
if (!pdfHeader.startsWith('%PDF')) throw new Error(`PDF header was ${JSON.stringify(pdfHeader)}`)

const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg?.scope ?? ''
})
if (!sw.includes('/Micropile-Hub/')) throw new Error(`Unexpected service worker scope: ${sw}`)

await browser.close()
console.log('screenshots written to', outDir)
