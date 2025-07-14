import { Badge } from '@/components/ui/badge'
import { statusColors } from '@/constants/UserSettings'
import { cn } from '@/lib/utils'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { UserRound, Shield } from 'lucide-react'

type AdminStatusProps = {
  isSudo: boolean
  isDisabled: boolean
}

export const AdminStatusBadge: FC<AdminStatusProps> = ({ isSudo, isDisabled }) => {
  const { t } = useTranslation()

  const getStatusInfo = () => {
    if (isDisabled) {
      return {
        color: statusColors['disabled']?.statusColor || 'bg-gray-400 text-white',
        icon: null,
        text: t('disabled'),
      }
    }

    if (isSudo) {
      return {
        color: 'bg-violet-500 text-white',
        icon: Shield,
        text: t('sudo'),
      }
    }

    return {
      color: statusColors['active']?.statusColor || 'bg-green-500 text-white',
      icon: UserRound,
      text: t('admin'),
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <Badge className={cn('pointer-events-none flex w-fit items-center justify-center gap-x-2 rounded-full px-2 py-1', statusInfo.color, 'h-6 px-1.5 py-2.5 sm:h-auto sm:px-1 sm:py-0.5')}>
      <div className="flex items-center gap-1 sm:px-1">
        {StatusIcon && <StatusIcon className="h-4 w-4 sm:h-3 sm:w-3" />}
        <span className="text-nowrap text-xs font-medium capitalize">{statusInfo.text}</span>
      </div>
    </Badge>
  )
}
