import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import { useCallback } from 'react'

export function ModeToggle() {
  const { setTheme, theme } = useTheme()
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [setTheme, theme])
  return (
    <Button variant="outline" size="icon" onClick={toggleTheme}>
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
