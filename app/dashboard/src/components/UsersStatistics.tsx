import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { useGetSystemStats } from '@/service/api'
import { numberWithCommas } from '@/utils/formatByte'
import { Plus, Users, Wifi } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Card, CardTitle } from './ui/card'

const UsersStatistics = () => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  const { data } = useGetSystemStats({
    query: {
      refetchInterval: 5000,
    },
  })
  return (
    <div className="flex flex-col gap-y-4">
      <div dir={dir} className="flex items-start flex-col flex-wrap gap-0 mb-2">
        <div dir={dir} className="flex gap-y-2 w-full justify-between items-center">
          <h1 className="font-medium text-xl md:text-xl sm:text-2xl">{t('users')}</h1>
          <Button size="sm">
            <Plus />
            <span>{t('createUser')}</span>
          </Button>
        </div>
        <div>
          <span className="text-muted-foreground text-xs sm:text-sm">{t('manageAccounts')}</span>
        </div>
      </div>
      <div className={cn('flex flex-col lg:flex-row items-center justify-between gap-x-4 gap-y-4', dir === 'rtl' && 'lg:flex-row-reverse')}>
        {/* Online Users */}
        <Card dir={dir} className="py-6 px-4 w-full rounded-md">
          <CardTitle className="flex items-center justify-between gap-x-4">
            <div className="flex items-center gap-x-4">
              <div className="min-h-[10px] min-w-[10px] rounded-full bg-green-300 dark:bg-green-500 shadow-sm" />
              <span className="">{t('onlineUsers')}</span>
            </div>
            <span className="text-3xl mx-2">{data && numberWithCommas(data.online_users)}</span>
          </CardTitle>
        </Card>
        <Card dir={dir} className="py-6 px-4 w-full rounded-md">
          <CardTitle className="flex items-center justify-between gap-x-4">
            <div className="flex items-center gap-x-4">
              <Wifi className="h-5 w-5" />
              <span className="">{t('activeUsers')}</span>
            </div>
            <span className="text-3xl mx-2">{data && numberWithCommas(data?.users_active)}</span>
          </CardTitle>
        </Card>
        <Card dir={dir} className="py-6 px-4 w-full rounded-md">
          <CardTitle className="flex items-center justify-between gap-x-4">
            <div className="flex items-center gap-x-4">
              <Users className="h-5 w-5" />
              <span className="">{t('totalUsers')}</span>
            </div>
            <span className="text-3xl mx-2">{data && numberWithCommas(data?.total_user)}</span>
          </CardTitle>
        </Card>
      </div>
    </div>
  )
}

export default UsersStatistics
