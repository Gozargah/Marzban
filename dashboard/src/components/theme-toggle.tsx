import { Theme, useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

export function ThemeToggle() {
  const { setTheme } = useTheme()
  const { t } = useTranslation()

  const toggleTheme = useCallback(
    (theme: Theme) => {
      setTheme(theme)
    },
    [setTheme],
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="transition-colors duration-200">
          <Sun className="dark:hidden transition-all duration-300 ease-in-out" />
          <Moon className="hidden dark:block transition-all duration-300 ease-in-out" />
          <span className="sr-only">{t('theme.toggle')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="transition-all duration-200 ease-in-out">
        <DropdownMenuItem onClick={() => toggleTheme('light')} className="transition-colors duration-150 hover:bg-accent">
          <Sun className="mr-2 h-4 w-4 transition-transform duration-200 hover:scale-110" />
          {t('theme.light')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleTheme('dark')} className="transition-colors duration-150 hover:bg-accent">
          <Moon className="mr-2 h-4 w-4 transition-transform duration-200 hover:scale-110" />
          {t('theme.dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleTheme('system')} className="transition-colors duration-150 hover:bg-accent">
          <Monitor className="mr-2 h-4 w-4 transition-transform duration-200 hover:scale-110" />
          {t('theme.system')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
