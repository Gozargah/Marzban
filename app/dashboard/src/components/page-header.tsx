import { Button } from '@/components/ui/button'
import useDirDetection from '@/hooks/use-dir-detection'
import { LucideIcon, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PageHeaderProps {
  title: string
  description?: string
  buttonText?: string
  onButtonClick?: () => void
  buttonIcon?: LucideIcon
}

export default function PageHeader({ title, description, buttonText, onButtonClick, buttonIcon: Icon = Plus }: PageHeaderProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()
  return (
    <div dir={dir} className="w-full mx-auto py-4 md:pt-6 gap-4 flex items-start justify-between flex-wrap px-4">
      <div className="flex flex-col gap-y-1">
        <h1 className="font-medium text-lg sm:text-xl">{t(title)}</h1>
        {description && <span className="text-muted-foreground text-xs sm:text-sm">{t(description)}</span>}
      </div>
      {buttonText && onButtonClick && (
        <div>
          <Button className="flex items-center" onClick={onButtonClick} size="sm">
            {Icon && <Icon />}
            <span>{t(buttonText)}</span>
          </Button>
        </div>
      )}
    </div>
  )
}
