import { CardContent } from '@/components/ui/card'
import { TrendingUp, Database, Wifi, Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface EmptyStateProps {
  type: 'no-data' | 'no-nodes' | 'loading' | 'error'
  title?: string
  description?: string
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({ type, title, description, icon, className = 'max-h-[300px] min-h-[200px]' }: EmptyStateProps) {
  const { t } = useTranslation()

  const getEmptyStateContent = () => {
    switch (type) {
      case 'no-data':
        return {
          icon: icon || <TrendingUp className="h-12 w-12 text-muted-foreground/50" />,
          title: title || t('statistics.noDataAvailable'),
          description: description || t('statistics.noDataDescription'),
        }
      case 'no-nodes':
        return {
          icon: icon || <Database className="h-12 w-12 text-muted-foreground/50" />,
          title: title || t('statistics.noNodesAvailable'),
          description: description || t('statistics.noNodesDescription'),
        }
      case 'loading':
        return {
          icon: icon || <Activity className="h-12 w-12 animate-pulse text-muted-foreground/50" />,
          title: title || t('loading'),
          description: description || t('statistics.loadingDescription'),
        }
      case 'error':
        return {
          icon: icon || <Wifi className="h-12 w-12 text-destructive/50" />,
          title: title || t('errors.failedToLoad'),
          description: description || t('errors.connectionFailed'),
        }
      default:
        return {
          icon: <TrendingUp className="h-12 w-12 text-muted-foreground/50" />,
          title: t('statistics.noDataAvailable'),
          description: t('statistics.noDataDescription'),
        }
    }
  }

  const content = getEmptyStateContent()

  return (
    <div className={`flex w-full flex-col items-center justify-center ${className}`}>
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">{content.icon}</div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{content.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{content.description}</p>
        </div>
      </div>
    </div>
  )
}

export function ChartEmptyState({ type, title, description, icon, className = 'max-h-[300px] min-h-[200px]' }: EmptyStateProps) {
  return (
    <CardContent className="pt-6">
      <EmptyState type={type} title={title} description={description} icon={icon} className={className} />
    </CardContent>
  )
}
