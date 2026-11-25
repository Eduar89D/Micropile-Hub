import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const svg = await readFile(path.join(root, 'assets/icon.svg'))
const outDir = path.join(root, 'public/icons')
await mkdir(outDir, { recursive: true })

const files = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-192-maskable.png', 192],
  ['icon-512-maskable.png', 512],
]

for (const [name, size] of files) {
  await sharp(svg)
    .resize(size, size)
    .flatten({ background: '#143F32' })
    .png()
    .toFile(path.join(outDir, name))
  console.log(`${name} ${size}px`)
}
