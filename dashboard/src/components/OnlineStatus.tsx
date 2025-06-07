import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { useRelativeExpiryDate } from '@/utils/dateFormatter'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

type UserStatusProps = {
  lastOnline: string | number | null | undefined
}

const convertDateFormat = (lastOnline: UserStatusProps['lastOnline']): number | null => {
  if (!lastOnline) {
    return null
  }

  const date = new Date(lastOnline + 'Z')
  return Math.floor(date.getTime() / 1000)
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
      {timeDifferenceInSeconds && timeDifferenceInSeconds <= 60 ? 'Online' : timeDifferenceInSeconds ? `${dateInfo.time}` : dateInfo.time}
    </span>
  )
}
