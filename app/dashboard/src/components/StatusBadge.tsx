import { Badge } from '@/components/ui/badge'
import { statusColors } from '@/constants/UserSettings'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { Status as UserStatusType } from '@/types/User'
import { relativeExpiryDate } from '@/utils/dateFormatter'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

type UserStatusProps = {
  expiryDate?: string | number | null | undefined
  status: UserStatusType
  extraText?: string | null
  isMobile?: boolean
}

export const StatusBadge: FC<UserStatusProps> = ({ expiryDate = null, status: userStatus, extraText, isMobile }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const convertDateFormat = (expire: UserStatusProps['expiryDate']) => {
    const date = new Date(expire + 'Z')
    return Math.floor(date.getTime() / 1000)
  }
  const unixTime = convertDateFormat(expiryDate)

  const dateInfo = relativeExpiryDate(unixTime)

  return (
    <div className="flex items-center gap-x-2">
      <Badge
        className={cn(
          'flex items-center justify-center rounded-full px-0.5 sm:px-2 py-0.5 w-fit max-w-[150px] gap-x-2 pointer-events-none',
          statusColors[userStatus]?.statusColor || 'bg-gray-400 text-white',
          isMobile && 'py-0 h-4',
        )}
      >
        <div>
          <span className={cn('capitalize font-medium text-xs', isMobile && 'text-[11.1px] leading-3')}>{userStatus && t(`status.${userStatus}`)}</span>
        </div>
      </Badge>
      <div className={cn(!dateInfo.time && !dateInfo.status && 'hidden')}>
        <div className={cn(isMobile ? 'block' : 'hidden md:block')}>
          <span className={cn('inline-block text-xs font-normal ml-2 text-muted-foreground dark:text-muted-foreground', dir === 'rtl' && 'ml-0 mr-1')}>
            {t(dateInfo.status, { time: dateInfo.time })}
          </span>
        </div>
      </div>
    </div>
  )
}
