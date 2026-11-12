"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

type SheetProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Sheet({ children, ...props }: SheetProps) {
  return <div data-slot="sheet" {...props}>{children}</div>
}

function SheetTrigger({
  children,
  asChild = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp data-slot="sheet-trigger" {...props}>
      {children}
    </Comp>
  )
}

function SheetClose({
  children,
  asChild = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp data-slot="sheet-close" {...props}>
      {children}
    </Comp>
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="sheet-content"
      className={cn(
        "bg-background fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out",
        side === "right" &&
          "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
        side === "left" &&
          "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        side === "top" &&
          "inset-x-0 top-0 h-auto border-b",
        side === "bottom" &&
          "inset-x-0 bottom-0 h-auto border-t",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <button
          className={cn(
            "ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          )}
        >
          <span className="sr-only">Close</span>
        </button>
      )}
    </div>
  )
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold pr-8", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
