import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

// Sample component test to verify React testing setup
function SampleComponent({ value }: { value: number }) {
  return (
    <div>
      <span data-testid="value">{value}</span>
      <span data-testid="formatted-value">${value.toLocaleString()}</span>
    </div>
  )
}

describe('Sample Component Tests', () => {
  it('renders correctly', () => {
    render(<SampleComponent value={1000} />)
    
    expect(screen.getByTestId('value')).toHaveTextContent('1000')
    expect(screen.getByTestId('formatted-value')).toHaveTextContent('$1,000')
  })

  it('handles large numbers', () => {
    render(<SampleComponent value={1234567.89} />)
    
    expect(screen.getByTestId('value')).toHaveTextContent('1234567.89')
    expect(screen.getByTestId('formatted-value')).toHaveTextContent('$1,234,567.89')
  })
})