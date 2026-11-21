import { createLink } from '@tanstack/react-router'
import type { VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof buttonVariants>

const ButtonAnchor = forwardRef<HTMLAnchorElement, Props>(({ className, variant, size, ...props }, ref) => (
  <a ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
ButtonAnchor.displayName = 'ButtonAnchor'

export const ButtonLink = createLink(ButtonAnchor)
