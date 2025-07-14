import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Input, InputProps } from './input'

export interface PasswordInputProps extends InputProps {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(({ className, type, error, isError, value, ...props }, ref) => {
  const [showPassword, setShowPassword] = React.useState(false)
  const [hasValue, setHasValue] = React.useState(false)

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(e.target.value.length > 0)
    // Call the original onChange if it exists
    if (props.onChange) {
      props.onChange(e)
    }
  }

  return (
    <div className="relative">
      <Input type={showPassword ? 'text' : 'password'} className={cn('pr-10', className)} ref={ref} error={error} isError={isError} value={value} {...props} onChange={handleInputChange} />
      {(value || hasValue) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 flex h-full items-center justify-center px-3 py-2 transition-opacity duration-200 hover:bg-transparent"
          onClick={togglePasswordVisibility}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
        </Button>
      )}
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
