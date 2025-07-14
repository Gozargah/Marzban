import useDirDetection from '@/hooks/use-dir-detection.tsx'
import { cn } from '@/lib/utils.ts'
import { numberWithCommas } from '@/utils/formatByte.ts'
import { useTranslation } from 'react-i18next'
import { Card, CardTitle } from '@/components/ui/card.tsx'
import { type AdminDetails } from '@/service/api'
import { filter } from 'es-toolkit/compat'

interface AdminsStatisticsProps {
  data: AdminDetails[]
}

const AdminsStatistics = ({ data }: AdminsStatisticsProps) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  return (
    <div className="flex flex-col gap-y-4 pb-4">
      <div className={cn('flex flex-col items-center justify-between gap-x-4 gap-y-4 lg:flex-row', dir === 'rtl' && 'lg:flex-row-reverse')}>
        {/* Online Users */}
        <Card dir={dir} className="w-full rounded-md px-4 py-6">
          <CardTitle className="flex items-center justify-between gap-x-4">
            <div className="flex items-center gap-x-4">
              <span className="">{t('admins.total')}</span>
            </div>
            <span className="mx-2 text-3xl">{data.length}</span>
          </CardTitle>
        </Card>
        <Card dir={dir} className="w-full rounded-md px-4 py-6">
          <CardTitle className="flex items-center justify-between gap-x-4">
            <div className="flex items-center gap-x-4">
              <span className="">{t('admins.active')}</span>
            </div>
            <span className="mx-2 text-3xl">{numberWithCommas(data.length - filter(data, 'is_disabled').length)}</span>
          </CardTitle>
        </Card>
        <Card dir={dir} className="w-full rounded-md px-4 py-6">
          <CardTitle className="flex items-center justify-between gap-x-4">
            <div className="flex items-center gap-x-4">
              <span className="">{t('admins.disable')}</span>
            </div>
            <span className="mx-2 text-3xl">{numberWithCommas(filter(data, 'is_disabled').length)}</span>
          </CardTitle>
        </Card>
      </div>
    </div>
  )
}

export default AdminsStatistics
