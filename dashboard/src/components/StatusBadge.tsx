import { Badge } from '@/components/ui/badge'
import { statusColors } from '@/constants/UserSettings'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { UserStatus } from '@/service/api'
import { useRelativeExpiryDate } from '@/utils/dateFormatter'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

type UserStatusProps = {
  expiryDate?: string | number | null | undefined
  status: UserStatus
  showExpiry?: boolean
  showOnlyExpiry?: boolean // Added prop to only show expiry date without badge
}

export const StatusBadge: FC<UserStatusProps> = ({ expiryDate = null, status: userStatus, showExpiry, showOnlyExpiry }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const convertDateFormat = (expire: UserStatusProps['expiryDate']) => {
    if (!expire) return null
    // If it's already a number, return it
    if (typeof expire === 'number') return expire
    // If it's a string that's a number, convert it
    if (typeof expire === 'string') {
      const num = Number(expire)
      if (!isNaN(num)) return num
    }
    // For date strings, convert to timestamp
    const date = new Date(expire)
    return Math.floor(date.getTime() / 1000)
  }
  const unixTime = convertDateFormat(expiryDate)

  const dateInfo = useRelativeExpiryDate(unixTime)
  const StatusIcon = statusColors[userStatus]?.icon

  if (showOnlyExpiry) {
    return (
      <div className={cn('flex flex-wrap gap-x-2 justify-start')}>
        <div className={cn(!dateInfo.time && !dateInfo.status && 'hidden', showExpiry ? 'block' : 'hidden md:block')}>
          <div>
            <span className={cn('inline-block text-xs font-medium', dir === 'rtl' ? 'mr-0.5 md:mr-2' : 'ml-0.5 md:ml-2', 'text-gray-600 dark:text-gray-400')}>
              {t(dateInfo.status, { time: dateInfo.time })}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap gap-x-2 justify-start')}>
      <Badge
        className={cn(
          'flex items-center justify-center rounded-full px-0.5 sm:px-2 py-0.5 w-fit max-w-[150px] gap-x-2 pointer-events-none',
          statusColors[userStatus]?.statusColor || 'bg-gray-400 text-white',
          'py-2.5 h-6 px-1.5 sm:py-0.5 sm:h-auto sm:px-0.5',
        )}
      >
        <div className={cn('flex items-center gap-1 sm:px-1', showExpiry && 'px-1')}>
          {StatusIcon && <StatusIcon className="w-4 h-4 sm:w-3 sm:h-3" />}
          <span className={cn('capitalize text-nowrap font-medium text-xs hidden sm:block', showExpiry && 'block')}>{userStatus && t(`status.${userStatus}`)}</span>
        </div>
      </Badge>
      <div className={cn(!dateInfo.time && !dateInfo.status && 'hidden', showExpiry ? 'block' : 'hidden md:block')}>
        <div>
          <span className={cn('inline-block text-[11.5px] sm:text-xs font-normal text-muted-foreground dark:text-muted-foreground', dir === 'rtl' && 'ml-0 mr-1')}>
            {t(dateInfo.status, { time: dateInfo.time })}
          </span>
        </div>
      </div>
    </div>
  )
}
