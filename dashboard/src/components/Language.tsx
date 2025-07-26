import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LanguagesIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const Language: React.FC = () => {
  const { i18n } = useTranslation()
  const supportedLangs = ['en', 'fa', 'zh', 'ru']

  const changeLanguage = async (lang: string) => {
    if (lang === 'system') {
      // detect browser language and change without reload
      const detectedLang = navigator.language.split('-')[0] // e.g., 'en-US' -> 'en'
      const langToSet = supportedLangs.includes(detectedLang) ? detectedLang : 'en'
      await i18n.changeLanguage(langToSet)
      document.documentElement.lang = i18n.language
      document.documentElement.setAttribute('dir', i18n.dir())
    } else {
      await i18n.changeLanguage(lang)
      document.documentElement.lang = lang
      document.documentElement.setAttribute('dir', i18n.dir())
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <LanguagesIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onClick={() => changeLanguage('system')}>System</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('en')}>English</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('fa')}>فارسی</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('zh')}>简体中文</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('ru')}>Русский</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
