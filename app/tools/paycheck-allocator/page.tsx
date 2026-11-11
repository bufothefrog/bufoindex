import { calculatorMetadata } from '@/lib/calculators/registry'
import { PaycheckAllocator } from '@/components/paycheck-allocator/PaycheckAllocator'

export const metadata = calculatorMetadata('paycheck')

export default function PaycheckAllocatorPage() {
  return <PaycheckAllocator />
}
