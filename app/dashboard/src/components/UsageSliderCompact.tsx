import { statusColors } from '@/constants/UserSettings'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/utils/formatByte'
import { useTranslation } from 'react-i18next'
import { Progress } from './ui/progress'

type UsageSliderProps = {
  used: number
  total: number | null | undefined
  dataLimitResetStrategy: string | undefined
  totalUsedTraffic: number | undefined
  status: string
  isMobile?: boolean
}

const UsageSliderCompact: React.FC<UsageSliderProps> = ({ used, total = 0, status, dataLimitResetStrategy, totalUsedTraffic, isMobile }) => {
  const isUnlimited = total === 0 || total === null
  const progressValue = isUnlimited ? 100 : (used / total) * 100
  const color = statusColors[status]?.sliderColor
  const { t } = useTranslation()
  return (
    <div className="flex flex-col justify-between text-xs text-muted-foreground font-medium w-full gap-y-1">
      <Progress indicatorClassName={color} value={progressValue} className={cn(isMobile ? 'block' : 'hidden md:block')} />
      <div className="flex items-center justify-between">
        <span dir="ltr">
          {formatBytes(used)} / {isUnlimited ? <span className="font-system-ui">∞</span> : formatBytes(total)}
        </span>
        <span className={cn(isMobile ? 'block' : 'hidden md:block')}>
          {t('usersTable.total')}: {formatBytes(totalUsedTraffic || 0)}
        </span>
      </div>
    </div>
  )
}
export default UsageSliderCompact
