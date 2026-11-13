import * as React from "react"
import { cn } from "@/lib/utils"
import { FieldMessages, fieldMessageIds } from "@/components/ui/FieldMessages"

export interface CheckboxProps {
  /** Also the base of the input id (`checkbox-${name}`). */
  name: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Shown under the label and linked with aria-describedby; hidden while an error shows. */
  help?: string
  error?: string
  disabled?: boolean
  className?: string
  testId?: string
}

/**
 * A native checkbox with its label beside it, help text and an announced
 * error. The row is 44px tall and the label toggles the box, so the tap
 * target is larger than the box itself.
 */
function Checkbox({
  name,
  label,
  checked,
  onChange,
  help,
  error,
  disabled = false,
  className,
  testId,
}: CheckboxProps) {
  const id = `checkbox-${name}`
  const { describedBy } = fieldMessageIds(id, help, error)

  return (
    <div className={cn("space-y-1", className)} data-testid={testId}>
      <div className="flex min-h-11 items-center gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-4 w-4 shrink-0 rounded border-input accent-sage-600 dark:accent-sage-400",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            "text-sm font-medium leading-snug",
            disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
            error && "text-negative"
          )}
        >
          {label}
        </label>
      </div>
      <FieldMessages id={id} help={help} error={error} className="pl-7" />
    </div>
  )
}

export { Checkbox }
export default Checkbox
