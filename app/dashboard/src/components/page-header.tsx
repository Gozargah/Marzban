import { Plus, LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from 'react-i18next'

interface PageHeaderProps {
    title: string
    description?: string
    buttonText?: string
    onButtonClick?: () => void
    buttonIcon?: LucideIcon
    dir?: 'ltr' | 'rtl'
}

export default function PageHeader({
    title,
    description,
    buttonText,
    onButtonClick,
    buttonIcon: Icon = Plus,
    dir = 'ltr',
}: PageHeaderProps) {
    const { t } = useTranslation()

    return (
        <>
            <div dir={dir} className="mx-auto pt-6 gap-4 flex items-center justify-between flex-wrap px-4 sm:px-6 pb-4">
                <div className="flex flex-col gap-y-2">
                    <h1 className="font-semibold text-2xl sm:text-3xl">{t(title)}</h1>
                    {description && <span className="text-muted-foreground text-xs sm:text-sm">{t(description)}</span>}
                </div>
                {buttonText && onButtonClick && (
                    <div>
                        <Button className="flex items-center" onClick={onButtonClick}>
                            {Icon && <Icon />}
                            <span>{t(buttonText)}</span>
                        </Button>
                    </div>
                )}
            </div>
            <Separator />
        </>
    )
}
