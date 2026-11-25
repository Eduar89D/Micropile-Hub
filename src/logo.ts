import raw from './logo-wordmark.svg?raw'

/** Official BASEco mark. Orange #F77F4B is sampled from the foundation-systems logo. */
export function wordmarkSvg(): string {
  if (raw.includes('class="wordmark"')) return raw
  return raw.replace('<svg ', '<svg class="wordmark" ')
}
