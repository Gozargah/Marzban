import '@/locales/i18n'
import dayjs from 'dayjs'
import Duration from 'dayjs/plugin/duration'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import RelativeTime from 'dayjs/plugin/relativeTime'
import Timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(Timezone)
dayjs.extend(LocalizedFormat)
dayjs.extend(utc)
dayjs.extend(RelativeTime)
dayjs.extend(Duration)
