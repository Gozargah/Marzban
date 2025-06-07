import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

export const useRelativeExpiryDate = (
  expiryDate: number | null | undefined,
) => {
  const { t } = useTranslation()
  const dateInfo = { status: '', time: '' }

  if (!expiryDate) {
    return dateInfo
  }

  const isAfter = dayjs(expiryDate * 1000)
    .utc()
    .isAfter(dayjs().utc())
  
  dateInfo.status = isAfter ? t('expires') : t('expired')
  
  const durationSlots: string[] = []
  const duration = dayjs.duration(
    dayjs(expiryDate * 1000)
      .utc()
      .diff(dayjs()),
  )
  
  if (duration.years() != 0) {
    durationSlots.push(
      Math.abs(duration.years()) +
      ' ' +
      t(
        `time.${Math.abs(duration.years()) !== 1 ? 'years' : 'year'}`
      )
    )
  }
  if (duration.months() != 0) {
    durationSlots.push(
      Math.abs(duration.months()) +
      ' ' +
      t(
        `time.${Math.abs(duration.months()) !== 1 ? 'months' : 'month'}`
      )
    )
  }
  if (duration.days() != 0) {
    durationSlots.push(
      Math.abs(duration.days()) +
      ' ' +
      t(
        `time.${Math.abs(duration.days()) !== 1 ? 'days' : 'day'}`
      )
    )
  }
  if (durationSlots.length === 0) {
    if (duration.hours() != 0) {
      durationSlots.push(
        Math.abs(duration.hours()) +
        ' ' +
        t(
          `time.${Math.abs(duration.hours()) !== 1 ? 'hours' : 'hour'}`
        )
      )
    }
    if (duration.minutes() != 0) {
      durationSlots.push(
        Math.abs(duration.minutes()) +
        ' ' +
        t(
          `time.${Math.abs(duration.minutes()) !== 1 ? 'mins' : 'min'}`
        )
      )
    }
  }
  
  // Add "ago" for past dates
  if (!isAfter && durationSlots.length > 0) {
    dateInfo.time = durationSlots.join(', ') + ' ' + t('time.ago')
  } else {
    dateInfo.time = durationSlots.join(', ')
  }

  return dateInfo
}
