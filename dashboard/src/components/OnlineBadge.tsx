import { FC } from 'react'
import { dateUtils } from '@/utils/dateFormatter'

type UserStatusProps = {
  lastOnline?: string | null
}

const convertDateFormat = (lastOnline?: string | null): number | null => {
  if (!lastOnline) return null

  // If it's already a timestamp, return it
  if (!isNaN(Number(lastOnline))) {
    return Number(lastOnline)
  }

  // If it's an ISO string without timezone, add UTC
  if (lastOnline.endsWith('Z')) {
    return dateUtils.isoToTimestamp(lastOnline)
  }

  // If it's an ISO string with timezone, use it directly
  if (lastOnline.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)) {
    return dateUtils.isoToTimestamp(lastOnline)
  }

  // For any other format, try to parse it
  const date = new Date(lastOnline)
  if (!isNaN(date.getTime())) {
    return Math.floor(date.getTime() / 1000)
  }

  return null
}

export const OnlineBadge: FC<UserStatusProps> = ({ lastOnline }) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000)
  const unixTime = convertDateFormat(lastOnline)

  if (!lastOnline || unixTime === null) {
    return <div className="min-h-[10px] min-w-[10px] rounded-full border border-gray-400 dark:border-gray-600 shadow-sm" />
  }

  const timeDifferenceInSeconds = currentTimeInSeconds - unixTime

  if (timeDifferenceInSeconds <= 60) {
    return <div className="min-h-[10px] min-w-[10px] rounded-full bg-green-300 dark:bg-green-500 shadow-sm animate-greenPulse" />
  }

  return <div className="min-h-[10px] min-w-[10px] rounded-full bg-gray-400 dark:bg-gray-600 shadow-sm" />
}
