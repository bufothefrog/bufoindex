import { afterEach, describe, expect, it, vi } from 'vitest'
import { Global } from 'recharts'
import {
  CHART_MARGINS,
  CHART_SERIES_DEFAULTS,
  FONT_MONO_FALLBACK,
  MAX_CHART_POINTS,
  chartAxisProps,
  chartGridProps,
  chartLegendStyle,
  getChartTheme,
  getChartThemeForMode,
  getServerThemeModeSnapshot,
  getThemeModeSnapshot,
  subscribeToThemeChanges,
  thinPoints,
} from '@/lib/chart-theme'

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

afterEach(() => {
  const root = document.documentElement
  root.className = ''
  root.removeAttribute('style')
})

describe('Recharts devtools', () => {
  it('turns the Redux DevTools hook off on import', () => {
    expect(Global.devToolsEnabled).toBe(false)
  })
})

describe('getChartTheme', () => {
  it('reads the semantic CSS variables and the mono font token', () => {
    const root = document.documentElement
    root.style.setProperty('--primary', '106 29% 32%')
    root.style.setProperty('--border', '214 32% 91%')
    root.style.setProperty('--font-mono', 'Menlo, monospace')
    const theme = getChartTheme()
    expect(theme.primary).toBe('hsl(106 29% 32%)')
    expect(theme.grid).toBe('hsl(214 32% 91%)')
    expect(theme.fontMono).toBe('Menlo, monospace')
    expect(theme.accent).toBe('#7fb069')
  })

  it('falls back to the system mono stack when the token is absent', () => {
    expect(getChartTheme().fontMono).toBe(FONT_MONO_FALLBACK)
  })

  it('returns the light fallback on the server', () => {
    vi.stubGlobal('window', undefined)
    try {
      const theme = getChartTheme()
      expect(theme.primary).toBe('#4a6d3c')
      expect(theme.fontMono).toBe(FONT_MONO_FALLBACK)
      expect(getChartThemeForMode('dark').primary).toBe('#4a6d3c')
      expect(subscribeToThemeChanges(() => {})()).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('getChartThemeForMode', () => {
  it('returns one shared object per mode and recomputes on a mode change', () => {
    const root = document.documentElement
    root.style.setProperty('--primary', '1 1% 1%')
    const light = getChartThemeForMode('light')
    expect(getChartThemeForMode('light')).toBe(light)
    root.style.setProperty('--primary', '2 2% 2%')
    const dark = getChartThemeForMode('dark')
    expect(dark).not.toBe(light)
    expect(dark.primary).toBe('hsl(2 2% 2%)')
  })
})

describe('theme mode snapshot and subscription', () => {
  it('reports the class on <html>', () => {
    expect(getThemeModeSnapshot()).toBe('light')
    document.documentElement.classList.add('dark')
    expect(getThemeModeSnapshot()).toBe('dark')
    expect(getServerThemeModeSnapshot()).toBe('light')
  })

  it('notifies every listener on a class change and stops after unsubscribe', async () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = subscribeToThemeChanges(a)
    const offB = subscribeToThemeChanges(b)
    document.documentElement.classList.add('dark')
    await vi.waitFor(() => expect(a).toHaveBeenCalledTimes(1))
    expect(b).toHaveBeenCalledTimes(1)
    offA()
    document.documentElement.classList.remove('dark')
    await vi.waitFor(() => expect(b).toHaveBeenCalledTimes(2))
    expect(a).toHaveBeenCalledTimes(1)
    offB()
    document.documentElement.classList.add('dark')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(b).toHaveBeenCalledTimes(2)
  })
})

describe('shared Recharts props', () => {
  const theme = { ...getChartTheme(), muted: 'M', grid: 'G', text: 'T', success: 'S', fontMono: 'F' }

  it('axis props use the muted color and the mono font, or a given series color', () => {
    expect(chartAxisProps(theme)).toEqual({ stroke: 'M', tick: { fill: 'M', fontSize: 12, fontFamily: 'F' } })
    expect(chartAxisProps(theme, theme.success).tick.fill).toBe('S')
  })

  it('grid and legend props come from the theme', () => {
    expect(chartGridProps(theme)).toEqual({ strokeDasharray: '3 3', stroke: 'G', opacity: 0.4 })
    expect(chartLegendStyle(theme)).toEqual({ fontSize: 12, fontFamily: 'F', color: 'T' })
  })

  it('series default to no animation, and margins have both presets', () => {
    expect(CHART_SERIES_DEFAULTS).toEqual({ isAnimationActive: false })
    expect(CHART_MARGINS.compact).toEqual({ top: 8, right: 8, left: 0, bottom: 0 })
    expect(CHART_MARGINS.labeled.bottom).toBe(60)
  })
})

describe('thinPoints', () => {
  it('returns short series unchanged (same array)', () => {
    const points = range(120)
    expect(thinPoints(points)).toBe(points)
    expect(thinPoints([])).toEqual([])
  })

  it('keeps both endpoints and never exceeds the limit', () => {
    for (const n of [121, 241, 361, 721, 1000]) {
      for (const max of [2, 3, 10, 60, MAX_CHART_POINTS]) {
        const out = thinPoints(range(n), max)
        expect(out[0]).toBe(0)
        expect(out[out.length - 1]).toBe(n - 1)
        expect(out.length).toBeLessThanOrEqual(max)
      }
    }
  })

  it('samples on a regular stride', () => {
    // 241 monthly points (20 years), max 121 -> every 2nd month, 121 points.
    const out = thinPoints(range(241), 121)
    expect(out).toHaveLength(121)
    expect(out.slice(0, 4)).toEqual([0, 2, 4, 6])
    // 241 points, default 120 -> stride 3, plus the final month.
    const def = thinPoints(range(241))
    expect(def.slice(0, 3)).toEqual([0, 3, 6])
    expect(def[def.length - 2]).toBe(237)
    expect(def[def.length - 1]).toBe(240)
  })

  it('treats a max below 2 as 2', () => {
    expect(thinPoints(range(5), 0)).toEqual([0, 4])
  })
})
