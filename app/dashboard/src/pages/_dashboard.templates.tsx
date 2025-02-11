import Tabs from '@/components/Tabs'
import { Boxes, UserCog } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const Templates = () => {
    const { t } = useTranslation()
    const tabs = [
        { id: 'user-templates', label: 'templates.userTemplates', icon: UserCog, url: "/templates" },
        { id: 'core', label: 'templates.groupTemplates', icon: Boxes, url: "/templates/group" },
    ]
    return (
        <div className='p-4'>
            <div className="flex flex-col gap-y-2 mb-4">
                <h1 className="font-semibold text-2xl sm:text-3xl">{t('templates.title')}</h1>
                <span className="text-muted-foreground text-xs sm:text-sm">{t('createAndManageTemplates')}</span>
            </div>
            <div>
                <Tabs tabs={tabs} />
            </div>
        </div>
    )
}

export default Templates
