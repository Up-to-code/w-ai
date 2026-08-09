import * as React from "react"
import { VariantProps, cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border rounded-sm px-2 py-0.5 text-xs font-medium transition-brand focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background border-transparent",
        secondary:
          "bg-w-canvas text-foreground border-border",
        destructive:
          "bg-w-red-soft text-w-red border-w-red/20",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
