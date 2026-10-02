import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

/**
 * Buttons are made of the materials in `styles/materials.css`: the accent is
 * the one filled button of a view, `secondary` is a lit control, `ghost` a
 * quiet action that only shows on hover.
 */
export const buttonVariants = cva(
  "press inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium outline-none disabled:pointer-events-none disabled:opacity-45 focus-visible:ring-3 focus-visible:ring-ring/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'material-accent',
        secondary: 'material-control text-foreground',
        outline: 'material-control text-foreground',
        ghost:
          'text-ink-muted transition-[background-color,color] duration-100 hover:bg-row-hover hover:text-foreground',
        destructive:
          'bg-state-error text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_0_0_1px_rgb(0_0_0/0.25),0_1px_2px_rgb(0_0_0/0.2)] transition-opacity duration-100 hover:opacity-90',
        link: 'text-foreground underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 has-[>svg]:px-2.5',
        xs: "h-6 rounded-[5px] px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-7 px-2.5 text-[12.5px] has-[>svg]:px-2',
        lg: 'h-9 px-4',
        icon: 'size-8',
        'icon-xs': "size-6 rounded-[5px] [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': 'size-7',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
