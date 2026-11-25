import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const logo = await readFile(path.join(root, 'public/logo.svg'), 'utf8')
const inner = logo.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FFFFFF"/>
  <svg x="128" y="22" width="256" height="308" viewBox="0 0 118 142">
    <rect width="118" height="142" fill="#FFFFFF"/>
    ${inner}
  </svg>
  <g>
    <rect x="240" y="308" width="32" height="72" rx="3" fill="#141414"/>
    <rect x="251" y="316" width="10" height="56" fill="#F77F4B"/>
    <polygon points="216,318 296,318 282,336 202,336" fill="#F77F4B" stroke="#141414" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="216,346 296,346 282,364 202,364" fill="#F77F4B" stroke="#141414" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="216,374 296,374 282,392 202,392" fill="#F77F4B" stroke="#141414" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="210,396 302,396 256,454" fill="#141414"/>
    <polygon points="230,408 282,408 256,440" fill="#F77F4B"/>
  </g>
</svg>`

const splashSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="2532" viewBox="0 0 1170 2532">
  <rect width="1170" height="2532" fill="#FFFFFF"/>
  <rect x="0" y="0" width="1170" height="18" fill="#F77F4B"/>
  <svg x="145" y="980" width="880" height="292" viewBox="0 0 427 142">
    ${inner}
  </svg>
</svg>`

const icon = Buffer.from(iconSvg)
const outDir = path.join(root, 'public/icons')
const files = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-192-maskable.png', 192],
  ['icon-512-maskable.png', 512],
]
for (const [name, size] of files) {
  await sharp(icon, { density: 192 })
    .resize(size, size)
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(outDir, name))
  console.log(name, size)
}

await sharp(Buffer.from(logo), { density: 288 })
  .resize(1281, 426)
  .flatten({ background: '#FFFFFF' })
  .png()
  .toFile(path.join(root, 'public/logo.png'))
console.log('logo.png')

await sharp(Buffer.from(splashSvg), { density: 72 })
  .resize(1170, 2532)
  .flatten({ background: '#FFFFFF' })
  .png()
  .toFile(path.join(root, 'public/splash.png'))
console.log('splash.png')

await sharp(icon, { density: 192 }).resize(512, 512).flatten({ background: '#FFFFFF' }).png().toFile('/tmp/icon-512-preview.png')
