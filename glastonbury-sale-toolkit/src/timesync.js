// Measures how far your machine's clock is from real time.
//
// Why this matters: the queue is a random draw among everyone already on the
// page when the sale opens. You want to be loaded and idle a few minutes early.
// If your laptop clock is 40 seconds fast you may think you have time when the
// draw has already happened, and if it is slow you may still be typing the URL.
//
// NTP proper needs UDP/123, which is blocked on plenty of networks (and by
// corporate proxies), so this uses HTTPS sources instead and compensates for
// round-trip latency the same way NTP does:
//
//   offset = serverTime - (t0 + t1) / 2
//
// where t0/t1 bracket the request locally. Sources that report sub-second time
// are preferred; an HTTP `Date` header is only accurate to the second, so it is
// used as a fallback and its resolution is reported honestly.

export const SOURCES = [
  {
    name: 'cloudflare',
    url: 'https://cloudflare.com/cdn-cgi/trace',
    resolutionMs: 1,
    parse: text => {
      const line = text.split('\n').find(l => l.startsWith('ts='))
      if (!line) return null
      const seconds = Number(line.slice(3))
      return Number.isFinite(seconds) ? seconds * 1000 : null
    }
  },
  {
    name: 'worldtimeapi',
    url: 'https://worldtimeapi.org/api/timezone/Etc/UTC',
    resolutionMs: 1,
    parse: text => {
      try {
        const t = Date.parse(JSON.parse(text).datetime)
        return Number.isFinite(t) ? t : null
      } catch { return null }
    }
  },
  // Date-header fallbacks. Only good to the second, but they keep the tool
  // working on networks that block the two sources above.
  { name: 'github', url: 'https://github.com', method: 'HEAD', resolutionMs: 1000 },
  { name: 'npm', url: 'https://registry.npmjs.org', method: 'HEAD', resolutionMs: 1000 }
]

async function sampleSource (source, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const t0 = Date.now()
  try {
    const res = await fetch(source.url, {
      method: source.method || 'GET',
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' }
    })
    const text = source.parse ? await res.text() : ''
    const t1 = Date.now()

    // A captive portal, corporate proxy or egress filter will happily return an
    // error page with its own Date header. That is not an authoritative time
    // source, so anything but a success is discarded rather than trusted.
    if (!res.ok) return null

    let serverMs = source.parse ? source.parse(text) : null
    let resolutionMs = source.resolutionMs

    // Fall back to the Date header if the body did not give us a time.
    if (serverMs === null) {
      const header = res.headers.get('date')
      const parsed = header ? Date.parse(header) : NaN
      if (!Number.isFinite(parsed)) return null
      // A Date header is truncated to the second, so on average it reads 500ms
      // early. Adding half a second removes that systematic bias.
      serverMs = parsed + 500
      resolutionMs = 1000
    }

    const rtt = t1 - t0
    const offset = serverMs - (t0 + rtt / 2)
    return { source: source.name, offset, rtt, resolutionMs }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function median (numbers) {
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Returns { offsetMs, samples, uncertaintyMs, ok }.
 * offsetMs is what to ADD to Date.now() to get real time.
 * Falls back to a zero offset (with ok:false) when the network is unreachable,
 * so the rest of the toolkit still works offline.
 */
export async function measureOffset ({ rounds = 3, timeoutMs = 4000 } = {}) {
  const samples = []
  for (let round = 0; round < rounds; round++) {
    const results = await Promise.all(SOURCES.map(s => sampleSource(s, timeoutMs)))
    for (const r of results) if (r) samples.push(r)
  }

  if (samples.length === 0) {
    return { offsetMs: 0, samples: [], uncertaintyMs: null, ok: false }
  }

  // Prefer sub-second sources when we have any; they are an order of magnitude
  // tighter than a Date header and mixing the two just adds noise.
  const precise = samples.filter(s => s.resolutionMs <= 1)
  const used = precise.length ? precise : samples

  const offsetMs = median(used.map(s => s.offset))
  const bestRtt = Math.min(...used.map(s => s.rtt))
  const resolution = Math.min(...used.map(s => s.resolutionMs))

  // Half the best round trip is the irreducible asymmetry we cannot see, plus
  // whatever the source's own resolution costs us.
  const uncertaintyMs = Math.round(bestRtt / 2 + resolution)

  return { offsetMs: Math.round(offsetMs), samples: used, uncertaintyMs, ok: true }
}

/** A clock that reports corrected real time. */
export function correctedClock (offsetMs) {
  return () => Date.now() + offsetMs
}

export function describeOffset (offsetMs) {
  const abs = Math.abs(offsetMs)
  if (abs < 250) return 'your clock is accurate'
  const direction = offsetMs > 0 ? 'SLOW' : 'FAST'
  const amount = abs >= 1000 ? (abs / 1000).toFixed(1) + ' seconds' : abs + 'ms'
  return `your clock is ${amount} ${direction}`
}
