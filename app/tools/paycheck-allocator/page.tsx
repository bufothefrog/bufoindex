import type { Metadata } from 'next'
import { PaycheckAllocator } from '@/components/calculator/PaycheckAllocator'

export const metadata: Metadata = {
  title: 'Paycheck Allocator',
  description:
    'Allocate a monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, with the arithmetic shown at each step.',
}

export default function PaycheckAllocatorPage() {
  return <PaycheckAllocator />
}
