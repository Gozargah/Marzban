import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { useRelativeExpiryDate, dateUtils } from '@/utils/dateFormatter'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

type UserStatusProps = {
  lastOnline: string | number | null | undefined
}

const convertDateFormat = (lastOnline: UserStatusProps['lastOnline']): number | null => {
  if (!lastOnline) return null

  // If it's already a timestamp, return it
  if (!isNaN(Number(lastOnline))) {
    return Number(lastOnline)
  }

  // Handle string values
  if (typeof lastOnline === 'string') {
    // If it's an ISO string without timezone, add UTC
    if (lastOnline.endsWith('Z')) {
      return dateUtils.isoToTimestamp(lastOnline)
    }

    // If it's an ISO string with timezone, use it directly
    if (lastOnline.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)) {
      return dateUtils.isoToTimestamp(lastOnline)
    }

    // For any other string format, try to parse it
    const date = new Date(lastOnline)
    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000)
    }
  }

  return null
}

export const OnlineStatus: FC<UserStatusProps> = ({ lastOnline }) => {
  const { t } = useTranslation()
  const currentTimeInSeconds = Math.floor(Date.now() / 1000)
  const unixTime = convertDateFormat(lastOnline)
  const dir = useDirDetection()

  const timeDifferenceInSeconds = unixTime ? currentTimeInSeconds - unixTime : null
  const dateInfo = unixTime ? useRelativeExpiryDate(unixTime) : { status: '', time: t('notConnectedYet') }

  return (
    <span className={cn('inline-block text-xs font-medium', dir === 'rtl' ? 'mr-0.5 md:mr-2' : 'ml-0.5 md:ml-2', 'text-gray-600 dark:text-gray-400')}>
      {timeDifferenceInSeconds && timeDifferenceInSeconds <= 60 ? t('online') : timeDifferenceInSeconds ? `${dateInfo.time}` : dateInfo.time}
    </span>
  )
}
