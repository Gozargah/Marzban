import {AdminDetails} from '@/service/api'
import {ColumnDef} from '@tanstack/react-table'
import {ChartPie, ChevronDown, MoreVertical, Power, PowerOff, Trash2, User} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";

export const setupColumns = (
    {
        t,
        handleSort,
        filters,
        onDelete,
        toggleStatus
    }: {
        t: (key: string) => string
        handleSort: (column: string) => void
        filters: { sort: string }
        onDelete: (admin: AdminDetails) => void
        toggleStatus: (admin: AdminDetails) => void
    }): ColumnDef<AdminDetails>[] => [
    {
        accessorKey: 'username',
        header: () => (
            <button onClick={handleSort.bind(null, 'username')} className="flex gap-1  py-3 w-full items-center">
                <div className="text-xs">
                    {t('username')}
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
        cell: ({row}) => (
            <div className="flex items-start gap-x-3 py-1 px-1">
                <div className="pt-1">
                    {row.original.is_disabled ? <div
                            className="min-h-[10px] min-w-[10px] rounded-full border border-gray-400 dark:border-gray-600 shadow-sm"/> :
                        <div
                            className="min-h-[10px] min-w-[10px] rounded-full bg-green-300 dark:bg-green-500 shadow-sm animate-greenPulse"/>}
                </div>
                <div
                    className="whitespace-nowrap text-ellipsis px-2 overflow-hidden text-sm font-medium">{row.getValue('username')}</div>
            </div>
        ),
    },
    {
        accessorKey: 'is_sudo',
        header: () => <div className="text-xs flex items-center capitalize">{t('admins.role')}</div>,
        cell: ({row}) => {
            const isSudo = row.getValue('is_sudo')
            return <div className="flex items-center gap-2">
                {isSudo ? (
                    <span>{t('sudo')}</span>
                ) : (
                    <span>{t('admin')}</span>
                )}
            </div>
        },
    },
    {
        accessorKey: 'users_count',
        header: () => (
            <button onClick={handleSort.bind(null, 'users_count')} className="flex gap-1 py-3 w-full items-center">
                <div className="text-xs">
                    {t('admins.users.count')}
                </div>
                {filters.sort && (filters.sort === 'users_count' || filters.sort === '-users_count') && (
                    <ChevronDown
                        size={16}
                        className={`
              transition-transform duration-300
              ${filters.sort === 'users_count' ? 'rotate-180' : ''}
              ${filters.sort === '-users_count' ? 'rotate-0' : ''}
            `}
                    />
                )}
            </button>
        ),
        cell: ({row}) => (
            <div className="flex items-center gap-2">
                <span><User className="h-4 w-4"/></span>
                <span>{row.getValue('users_count') || 0}</span>
            </div>
        ),
    },
    {
        accessorKey: 'users_usage',
        header: () => (
            <button onClick={handleSort.bind(null, 'users_usage')} className="flex gap-1 py-3 w-full items-center">
                <div className="text-xs">
                    {t('admins.users.usage')}
                </div>
                {filters.sort && (filters.sort === 'users_usage' || filters.sort === '-users_usage') && (
                    <ChevronDown
                        size={16}
                        className={`
              transition-transform duration-300
              ${filters.sort === 'users_usage' ? 'rotate-180' : ''}
              ${filters.sort === '-users_usage' ? 'rotate-0' : ''}
            `}
                    />
                )}
            </button>
        ),
        cell: ({row}) => {
            const traffic = row.getValue('users_usage') as number | null
            return (
                <div className="flex gap-2 items-center">
                    <span><ChartPie className="h-4 w-4"/></span>
                    <span>{traffic ? `${(traffic / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB` : '0 TB'}</span>
                </div>)
        },
    },
    {
        id: 'actions',
        cell: ({row}) => (
            <div className="flex justify-end gap-2 items-center">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleStatus(row.original)
                        }}>
                            {row.original.is_disabled ? <Power className="h-4 w-4 mr-2"/> :
                                <PowerOff className="h-4 w-4 mr-2"/>}
                            {row.original.is_disabled ? t("enable") : t("disable")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem
                            className="text-destructive"
                            onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDelete(row.original);
                            }}
                        >
                            <Trash2 className="h-4 w-4 mr-2"/>
                            {t("delete")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        ),
    },
    {
        id: 'chevron',
        cell: () => <div className="flex flex-wrap justify-between"></div>,
    },
]