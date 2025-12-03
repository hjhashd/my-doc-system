'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'

const SlotClone = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => (
  <Slot ref={ref} {...props} />
))
SlotClone.displayName = Slot.displayName

export { SlotClone }