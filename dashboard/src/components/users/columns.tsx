import { UserResponse } from '@/service/api'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronDown } from 'lucide-react'
import ActionButtons from '../ActionButtons'
import { OnlineBadge } from '../OnlineBadge'
import { StatusBadge } from '../StatusBadge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '../ui/select'
import UsageSliderCompact from '../UsageSliderCompact'

export const setupColumns = ({
  t,
  handleSort,
  filters,
  handleStatusFilter,
  dir,
}: {
  t: (key: string) => string
  handleSort: (column: string) => void
  filters: { sort: string; status?: string | null }
  handleStatusFilter: (value: any) => void
  dir: any
}): ColumnDef<UserResponse>[] => [
  {
    accessorKey: 'username',
    header: () => (
      <button onClick={handleSort.bind(null, 'username')} className="flex w-full items-center gap-1 px-2 py-3">
        <div className="text-xs">
          <span className="md:hidden">{t('users')}</span>
          <span className="hidden capitalize md:block">{t('username')}</span>
        </div>
        {filters.sort && (filters.sort === 'username' || filters.sort === '-username') && (
          <ChevronDown size={16} className={`transition-transform duration-300 ${filters.sort === 'username' ? 'rotate-180' : ''} ${filters.sort === '-username' ? 'rotate-0' : ''} `} />
        )}
      </button>
    ),
    cell: ({ row }) => {
      return (
        <div className="overflow-hidden text-ellipsis whitespace-nowrap pl-1 font-medium md:pl-2">
          <div className="flex items-start gap-x-3 px-1 py-1">
            <div className="pt-1">
              <OnlineBadge lastOnline={row.original.online_at} />
            </div>
            <div className="flex flex-col gap-y-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">{row.getValue('username')}</span>
              {row.original.admin?.username && (
                <span className="flex items-center gap-x-0.5 overflow-hidden text-xs font-normal text-muted-foreground">
                  <span className="hidden sm:block">{t('created')}</span>
                  <span>{t('by')}</span>
                  <span className="text-blue-500">{row.original.admin?.username}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: () => (
      <div className="flex items-center">
        <Select dir={dir || ''} onValueChange={handleStatusFilter} value={filters.status || '0'}>
          <SelectTrigger icon={false} className="ring-none w-fit max-w-28 border-none p-0 sm:px-1">
            <span className="px-0 text-xs capitalize">{t('usersTable.status')}</span>
          </SelectTrigger>
          <SelectContent dir="ltr">
            <SelectItem className="py-4" value="0">
              {t('allStatuses')}
            </SelectItem>
            <SelectItem value="active">{t('hostsDialog.status.active')}</SelectItem>
            <SelectItem value="on_hold">{t('hostsDialog.status.onHold')}</SelectItem>
            <SelectItem value="disabled">{t('hostsDialog.status.disabled')}</SelectItem>
            <SelectItem value="limited">{t('hostsDialog.status.limited')}</SelectItem>
            <SelectItem value="expired">{t('hostsDialog.status.expired')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="hidden items-center sm:flex">
          <span>/</span>
          <button className="flex w-full items-center gap-1 px-2 py-3" onClick={handleSort.bind(null, 'expire')}>
            <div className="text-xs capitalize">
              <span className="md:hidden">{t('expire')}</span>
              <span className="hidden md:block">{t('expire')}</span>
            </div>
            {filters.sort && (filters.sort === 'expire' || filters.sort === '-expire') && (
              <ChevronDown size={16} className={`transition-transform duration-300 ${filters.sort === 'expire' ? 'rotate-180' : ''} ${filters.sort === '-expire' ? 'rotate-0' : ''} `} />
            )}
          </button>
        </div>
      </div>
    ),
    cell: ({ row }) => {
      const status: UserResponse['status'] = row.getValue('status')
      const expire = row.original.expire
      return (
        <div className="flex flex-col gap-y-2 py-1">
          <div className="hidden md:block">
            <StatusBadge expiryDate={expire} status={status} showExpiry />
          </div>
          <div className="md:hidden">
            <StatusBadge status={status} />
          </div>
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const expireA = rowA.original.expire || Infinity
      const expireB = rowB.original.expire || Infinity

      if (expireA !== expireB) return +expireA - +expireB

      return rowA.original.used_traffic - rowB.original.used_traffic
    },
  },
  {
    id: 'details',
    header: () => (
      <button className="flex w-full items-center gap-1 px-0 py-3" onClick={handleSort.bind(null, 'used_traffic')}>
        <div className="text-xs capitalize">
          <span className="md:hidden">{t('dataUsage')}</span>
          <span className="hidden md:block">{t('dataUsage')}</span>
        </div>
        {filters.sort && (filters.sort === 'used_traffic' || filters.sort === '-used_traffic') && (
          <ChevronDown size={16} className={`transition-transform duration-300 ${filters.sort === 'used_traffic' ? 'rotate-180' : ''} ${filters.sort === '-used_traffic' ? 'rotate-0' : ''} `} />
        )}
      </button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-between gap-2">
        <UsageSliderCompact total={row.original.data_limit} used={row.original.used_traffic} totalUsedTraffic={row.original.lifetime_used_traffic} status={row.original.status} />
        <div className="hidden w-[200px] px-4 py-1 md:block">
          <ActionButtons user={row.original} />
        </div>
      </div>
    ),
  },
  {
    id: 'chevron',
    header: () => <div className="w-10" />,
    cell: () => <div className="flex flex-wrap justify-between"></div>,
  },
]
