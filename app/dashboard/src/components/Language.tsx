import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LanguagesIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const Language: React.FC = () => {
  const { i18n } = useTranslation()

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
    document.documentElement.lang = lang
    document.documentElement.setAttribute('dir', i18n.dir())
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <LanguagesIcon className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onClick={() => changeLanguage('en')}>English</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('fa')}>فارسی</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('zh')}>简体中文</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('ru')}>Русский</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
