import { Theme, useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Moon, Sun } from 'lucide-react'
import { useCallback } from 'react'

export function ThemeToggle() {
  const { setTheme } = useTheme()
  const toggleTheme = useCallback(
    (theme: Theme) => {
      setTheme(theme)
    },
    [setTheme],
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onClick={() => toggleTheme('light')}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleTheme('dark')}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleTheme('system')}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
