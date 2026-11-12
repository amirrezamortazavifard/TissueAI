import * as React from "react"
import { cn } from "@/lib/utils"

type RadioGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string
  onValueChange?: (value: string) => void
}

function RadioGroup({
  className,
  onValueChange,
  children,
  ...props
}: RadioGroupProps) {
  return (
    <div
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      role="radiogroup"
      {...props}
    >
      {children}
    </div>
  )
}

type RadioGroupItemProps = React.InputHTMLAttributes<HTMLInputElement> & {
  value?: string
}

function RadioGroupItem({
  className,
  value,
  ...props
}: RadioGroupItemProps) {
  return (
    <input
      type="radio"
      data-slot="radio-group-item"
      value={value}
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { RadioGroup, RadioGroupItem }
