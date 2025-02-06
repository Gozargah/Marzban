import { User } from '@/types/User'
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
  filters: { sort: string }
  handleStatusFilter: (value: any) => void
  dir: any
}): ColumnDef<User>[] => [
  {
    accessorKey: 'username',
    header: () => (
      <button onClick={handleSort.bind(null, 'username')} className="flex gap-1 px-2 py-3 w-full items-center">
        <div className="text-xs">
          <span className="md:hidden">{t('users')}</span>
          <span className="hidden md:block capitalize">{t('username')}</span>
        </div>
        {filters.sort && (filters.sort === 'username' || filters.sort === '-username') && (
          <ChevronDown
            size={16}
            className={`
              transition-transform duration-300
              ${filters.sort === 'username' ? 'rotate-180' : ''}
              ${filters.sort === '-username' ? 'rotate-0' : ''}
            `}
          />
        )}
      </button>
    ),
    cell: ({ row }) => {
      return (
        <div className="font-medium pl-1 md:pl-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <div className="flex items-start gap-x-3 py-1 px-1">
            <div className="pt-1">
              <OnlineBadge lastOnline={row.original.online_at} />
            </div>
            <div className="flex flex-col gap-y-0.5 whitespace-nowrap text-ellipsis overflow-hidden">
              <span className="whitespace-nowrap text-ellipsis overflow-hidden text-sm font-medium">{row.getValue('username')}</span>
              {row.original.admin?.username && (
                <span className="flex items-center gap-x-0.5 overflow-hidden text-xs text-muted-foreground font-normal">
                  <span className="hidden sm:block">{t('created')}</span>
                  <span>{t('by')}</span>
                  <span className="text-blue-500">{row.original.admin?.username}</span>
                </span>
              )}
            </div>
            {/* <div className="hidden md:block">
              <OnlineStatus lastOnline={row.original.online_at} />
            </div> */}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: () => (
      <div className="flex items-center">
        <Select dir={dir || ''} onValueChange={handleStatusFilter}>
          <SelectTrigger icon={false} className="border-none p-0 ring-none px-1 max-w-28 w-fit">
            <span className="capitalize text-xs px-1">{t('usersTable.status')}</span>
          </SelectTrigger>
          <SelectContent dir="ltr">
            <SelectItem className="py-4" value="0"></SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="limited">Limited</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <div className="items-center hidden sm:flex">
          <span>/</span>
          <button className="flex gap-1 px-2 py-3 w-full items-center" onClick={handleSort.bind(null, 'expire')}>
            <div className="text-xs capitalize">
              <span className="md:hidden">{t('expire')}</span>
              <span className="hidden md:block">{t('expire')}</span>
            </div>
            {filters.sort && (filters.sort === 'expire' || filters.sort === '-expire') && (
              <ChevronDown
                size={16}
                className={`
              transition-transform duration-300
              ${filters.sort === 'expire' ? 'rotate-180' : ''}
              ${filters.sort === '-expire' ? 'rotate-0' : ''}
            `}
              />
            )}
          </button>
        </div>
      </div>
    ),
    cell: ({ row }) => {
      const status: User['status'] = row.getValue('status')
      const expire = row.original.expire
      return (
        <div className="flex flex-col gap-y-2 py-1">
          <StatusBadge expiryDate={expire} status={status} />
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
      <button className="flex gap-1 px-2 py-3 w-full items-center" onClick={handleSort.bind(null, 'used_traffic')}>
        <div className="text-xs capitalize">
          <span className="md:hidden">{t('dataUsage')}</span>
          <span className="hidden md:block">{t('dataUsage')}</span>
        </div>
        {filters.sort && (filters.sort === 'used_traffic' || filters.sort === '-used_traffic') && (
          <ChevronDown
            size={16}
            className={`
              transition-transform duration-300
              ${filters.sort === 'used_traffic' ? 'rotate-180' : ''}
              ${filters.sort === '-used_traffic' ? 'rotate-0' : ''}
            `}
          />
        )}
      </button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2 justify-between">
        <UsageSliderCompact
          total={row.original.data_limit}
          used={row.original.used_traffic}
          totalUsedTraffic={row.original.lifetime_used_traffic}
          dataLimitResetStrategy={row.original.data_limit_reset_strategy}
          status={row.original.status}
        />
        <div className="hidden md:block w-[200px] px-4 py-1">
          <ActionButtons user={row.original} />
        </div>
      </div>
    ),
  },
  {
    id: 'chevron',
    cell: () => <div className="flex flex-wrap justify-between"></div>,
  },
]
