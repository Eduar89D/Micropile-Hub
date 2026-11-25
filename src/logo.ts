export function wordmarkSvg(tone: 'onDark' | 'onLight'): string {
  const ink = tone === 'onDark' ? '#F4F0E4' : '#143F32'
  const accent = tone === 'onDark' ? '#F0C36A' : '#1E5C45'
  const tile = tone === 'onDark' ? '#F4F0E4' : '#143F32'
  const tileInk = tone === 'onDark' ? '#143F32' : '#F4F0E4'
  const core = '#C47B12'
  return `<svg class="wordmark" viewBox="0 0 250 56" width="220" height="50" role="img" aria-label="BASEco">
    <rect x="0" y="0" width="56" height="56" rx="12" fill="${tile}"/>
    <circle cx="28" cy="28" r="14" fill="none" stroke="${tileInk}" stroke-width="4.5"/>
    <circle cx="28" cy="28" r="4" fill="${core}"/>
    <text x="68" y="40" fill="${ink}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="36" font-weight="700">BASE<tspan fill="${accent}">co</tspan></text>
  </svg>`
}
