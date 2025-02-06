import { cn } from '@/lib/utils'
import * as React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, error, ...props }, ref) => {
  return (
    <div>
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-border bg-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-input-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
          {
            'border-destructive': !!error,
          },
        )}
        ref={ref}
        {...props}
      />
      {error && <span className="text-destructive text-sm my-1 inline-block">{error}</span>}
    </div>
  )
})
Input.displayName = 'Input'

export { Input }
