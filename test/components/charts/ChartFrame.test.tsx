import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Line, LineChart } from 'recharts'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import {
  CHART_HEIGHT_CLASS,
  ChartFrame,
  ChartPlaceholder,
  ChartTooltipCard,
  ChartViewportMount,
  chartLoading,
  useChartTheme,
} from '@/components/ui/charts'

afterEach(() => {
  const root = document.documentElement
  root.className = ''
  root.removeAttribute('style')
  vi.unstubAllGlobals()
})

function Probe() {
  const theme = useChartTheme()
  return <span data-testid="primary">{theme.primary}</span>
}

describe('useChartTheme', () => {
  it('re-renders with the new colors when the theme class changes', async () => {
    const root = document.documentElement
    root.classList.add('light')
    root.style.setProperty('--primary', '106 29% 32%')
    render(<Probe />)
    expect(screen.getByTestId('primary')).toHaveTextContent('hsl(106 29% 32%)')

    await act(async () => {
      root.style.setProperty('--primary', '106 29% 55%')
      root.classList.replace('light', 'dark')
    })
    await vi.waitFor(() =>
      expect(screen.getByTestId('primary')).toHaveTextContent('hsl(106 29% 55%)')
    )
  })
})

describe('ChartFrame', () => {
  // jsdom has no layout, so ResponsiveContainer measures 0x0 and warns.
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const chart = (
    <LineChart data={[{ x: 1, y: 2 }]}>
      <Line dataKey="y" isAnimationActive={false} />
    </LineChart>
  )

  it('renders the caption as a figcaption and the mode note above the plot', () => {
    render(
      <ChartFrame caption="Median of 1,000 paths" modeNote="in today's dollars">
        {chart}
      </ChartFrame>
    )
    const figure = screen.getByRole('figure')
    const caption = figure.querySelector('figcaption')
    expect(caption).toHaveTextContent('Median of 1,000 paths')
    expect(figure.lastElementChild).toBe(caption)
    expect(screen.getByText("in today's dollars")).toBeInTheDocument()
  })

  it('sizes the plot area by height preset and omits absent notes', () => {
    const { container } = render(<ChartFrame height="tall">{chart}</ChartFrame>)
    const plot = container.querySelector('[data-chart-frame]')
    expect(plot).toHaveClass(...CHART_HEIGHT_CLASS.tall.split(' '))
    expect(container.querySelector('figcaption')).toBeNull()
    expect(container.querySelector('p')).toBeNull()
  })
})

describe('ChartPlaceholder', () => {
  it('matches the ChartFrame plot height and announces loading', () => {
    render(<ChartPlaceholder height="compact" modeNote caption />)
    const status = screen.getByRole('status', { name: 'Loading chart' })
    const box = status.querySelector(`.${CSS.escape('md:h-96')}`)
    expect(box).toHaveClass(...CHART_HEIGHT_CLASS.compact.split(' '))
    expect(status.children).toHaveLength(3)
  })

  it('chartLoading builds a next/dynamic loading component', () => {
    const Loading = chartLoading('tall', { label: 'Loading projection' })
    render(<Loading />)
    expect(screen.getByRole('status', { name: 'Loading projection' })).toBeInTheDocument()
  })
})

describe('ChartViewportMount', () => {
  it('mounts children at once when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(
      <ChartViewportMount>
        <p>chart</p>
      </ChartViewportMount>
    )
    expect(screen.getByText('chart')).toBeInTheDocument()
  })

  it('shows the placeholder until the slot nears the viewport', () => {
    let fire: (hit: boolean) => void = () => {}
    const disconnect = vi.fn()
    class IO {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        fire = (hit) => cb([{ isIntersecting: hit }])
      }
      observe() {}
      disconnect = disconnect
    }
    vi.stubGlobal('IntersectionObserver', IO)
    render(
      <ChartViewportMount height="tall">
        <p>chart</p>
      </ChartViewportMount>
    )
    expect(screen.queryByText('chart')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => fire(false))
    expect(screen.queryByText('chart')).toBeNull()

    act(() => fire(true))
    expect(screen.getByText('chart')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    expect(disconnect).toHaveBeenCalled()
  })
})

describe('ChartViewportMount hydration', () => {
  it('server and client first render match, with or without IntersectionObserver', async () => {
    class IO {
      observe() {}
      disconnect() {}
    }
    for (const clientIO of [IO, undefined]) {
      const tree = (
        <ChartViewportMount height="tall">
          <p>chart</p>
        </ChartViewportMount>
      )
      vi.stubGlobal('IntersectionObserver', undefined)
      const html = renderToString(tree)
      expect(html).toContain('data-chart-placeholder')
      expect(html).not.toContain('<p>chart</p>')

      vi.stubGlobal('IntersectionObserver', clientIO)
      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      const errors: unknown[] = []
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      let root: ReturnType<typeof hydrateRoot> | undefined
      await act(async () => {
        root = hydrateRoot(container, tree, {
          onRecoverableError: (error) => errors.push(error),
        })
      })
      expect(errors).toEqual([])
      expect(consoleError).not.toHaveBeenCalled()
      consoleError.mockRestore()
      if (clientIO === undefined) {
        expect(container.querySelector('p')?.textContent).toBe('chart')
      } else {
        expect(container.querySelector('[data-chart-placeholder]')).not.toBeNull()
      }
      act(() => root?.unmount())
      container.remove()
    }
  })
})

describe('ChartTooltipCard', () => {
  it('renders the title and one term/value pair per row', () => {
    render(
      <ChartTooltipCard
        title="Age 65"
        rows={[
          { label: 'Net worth', value: '$1,200,000', color: 'hsl(1 1% 1%)' },
          { id: 'band', label: '10th to 90th', value: '$800k to $1.6M', muted: true },
        ]}
      />
    )
    expect(screen.getByText('Age 65')).toBeInTheDocument()
    const terms = screen.getAllByRole('term')
    expect(terms.map((t) => t.textContent)).toEqual(['Net worth:', '10th to 90th:'])
    expect(terms[0]).toHaveStyle({ color: 'hsl(1 1% 1%)' })
    expect(screen.getAllByRole('definition').map((d) => d.textContent)).toEqual([
      '$1,200,000',
      '$800k to $1.6M',
    ])
  })
})
