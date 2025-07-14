import { cn } from '@/lib/utils'
import * as React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  isError?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, error, isError, ...props }, ref) => {
  return (
    <div className="flex-1">
      <input
        type={type}
        dir="ltr"
        className={cn(
          'flex h-9 w-full rounded-md border border-border bg-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-input-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
          {
            'border-destructive': !!error || isError,
          },
        )}
        ref={ref}
        {...props}
      />
      {error && <span className="my-1 inline-block text-sm text-destructive">{error}</span>}
    </div>
  )
})
Input.displayName = 'Input'

export { Input }
