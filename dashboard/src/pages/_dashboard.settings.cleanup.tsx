import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Calendar as PersianCalendar } from '@/components/ui/persian-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { useClearUsageData, useDeleteExpiredUsers, useGetAdmins, useGetCurrentAdmin, useResetUsersDataUsage, type AdminDetails, type UsageTable } from '@/service/api'
import { format } from 'date-fns'
import { debounce } from 'es-toolkit'
import { AlertTriangle, CalendarIcon, Check, ChevronDown, Database, Loader2, RotateCcw, Server, Trash2, UserCog, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const PAGE_SIZE = 20

export default function CleanupSettings() {
  const { t, i18n } = useTranslation()
  const dir = useDirDetection()
  const isPersianLocale = i18n.language === 'fa'
  const [expiredAfter, setExpiredAfter] = useState<Date | undefined>()
  const [expiredBefore, setExpiredBefore] = useState<Date | undefined>()
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [clearDataAfter, setClearDataAfter] = useState<Date | undefined>()
  const [clearDataBefore, setClearDataBefore] = useState<Date | undefined>()

  const { data: currentAdmin } = useGetCurrentAdmin()
  const is_sudo = currentAdmin?.is_sudo || false

  // Admin search state
  const [selectedAdmin, setSelectedAdmin] = useState<AdminDetails | undefined>()
  const [adminSearch, setAdminSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [admins, setAdmins] = useState<AdminDetails[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setOffset(0)
      setAdmins([])
      setHasMore(true)
      setAdminSearch(value)
    }, 300),
    [],
  )

  let usernameParam: string | undefined = undefined
  if (adminSearch && adminSearch !== 'system' && adminSearch !== currentAdmin?.username) {
    usernameParam = adminSearch
  }

  const { data: fetchedAdmins = [] } = useGetAdmins(
    {
      limit: PAGE_SIZE,
      offset,
      ...(usernameParam ? { username: usernameParam } : {}),
    },
    {
      query: {
        enabled: is_sudo,
      },
    },
  )

  useEffect(() => {
    if (fetchedAdmins) {
      setAdmins(prev => (offset === 0 ? fetchedAdmins : [...prev, ...fetchedAdmins]))
      setHasMore(fetchedAdmins.length === PAGE_SIZE)
      setIsLoading(false)
    }
  }, [fetchedAdmins, offset])

  const handleScroll = useCallback(() => {
    if (!listRef.current || isLoading || !hasMore) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    if (scrollHeight - scrollTop - clientHeight < 100) {
      setIsLoading(true)
      setOffset(prev => prev + PAGE_SIZE)
    }
  }, [isLoading, hasMore])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // API Mutations
  const deleteExpiredUsersMutation = useDeleteExpiredUsers()
  const resetUsersDataUsageMutation = useResetUsersDataUsage()
  const clearUsageDataMutation = useClearUsageData()

  const usageDataTables = [
    { value: 'node_user_usages', label: t('settings.cleanup.clearUsageData.tables.nodeUserUsages') },
    { value: 'user_usages', label: t('settings.cleanup.clearUsageData.tables.userUsages') },
  ]

  const handleDeleteExpired = async () => {
    const params: any = {}
    if (expiredAfter) params.expired_after = expiredAfter.toISOString()
    if (expiredBefore) params.expired_before = expiredBefore.toISOString()
    if (selectedAdmin) params.admin_username = selectedAdmin.username

    deleteExpiredUsersMutation.mutate(
      { params: Object.keys(params).length > 0 ? params : undefined },
      {
        onSuccess: response => {
          const count = response?.count || 0
          toast.success(t('settings.cleanup.expiredUsers.deleteSuccess', { count }))
        },
        onError: () => {
          toast.error(t('settings.cleanup.expiredUsers.deleteFailed'))
        },
      },
    )
  }

  const formatDate = (date: Date) => {
    if (isPersianLocale) {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date)
    }
    return format(date, 'PPP')
  }

  const handleResetUsage = async () => {
    resetUsersDataUsageMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('settings.cleanup.resetUsage.resetSuccess'))
      },
      onError: () => {
        toast.error(t('settings.cleanup.resetUsage.resetFailed'))
      },
    })
  }

  const handleClearUsageData = async () => {
    if (!selectedTable) {
      toast.error(t('settings.cleanup.clearUsageData.noTableSelected'))
      return
    }

    const params: any = {}
    if (clearDataAfter) params.start = clearDataAfter.toISOString()
    if (clearDataBefore) params.end = clearDataBefore.toISOString()

    clearUsageDataMutation.mutate(
      {
        table: selectedTable as UsageTable,
        params: Object.keys(params).length > 0 ? params : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('settings.cleanup.clearUsageData.clearSuccess', { table: selectedTable }))
        },
        onError: () => {
          toast.error(t('settings.cleanup.clearUsageData.clearFailed'))
        },
      },
    )
  }

  const filteredAdmins = admins.filter(admin => admin.username !== 'system')

  return (
    <div className="space-y-6 p-6">
      {/* Delete Expired Users Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('settings.cleanup.expiredUsers.title')}
          </CardTitle>
          <CardDescription>{t('settings.cleanup.expiredUsers.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative mb-3 w-full max-w-xs sm:mb-4 sm:max-w-sm lg:max-w-md" dir={dir}>
            <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('h-8 w-full justify-between px-2 transition-colors hover:bg-muted/50 sm:h-9 sm:px-3', 'min-w-0 text-xs font-medium sm:text-sm')}>
                  <div className={cn('flex min-w-0 flex-1 items-center gap-1 sm:gap-2', dir === 'rtl' ? 'flex-row-reverse' : 'flex-row')}>
                    <Avatar className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5">
                      <AvatarFallback className="bg-muted text-xs font-medium">{selectedAdmin?.username?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs sm:text-sm">{selectedAdmin?.username || t('selectAdmin')}</span>
                    {selectedAdmin && <div className="flex-shrink-0">{selectedAdmin.is_sudo ? <UserCog className="h-3 w-3 text-primary" /> : <UserRound className="h-3 w-3 text-primary" />}</div>}
                  </div>
                  <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-1 sm:w-72 lg:w-80" sideOffset={4} align={dir === 'rtl' ? 'end' : 'start'}>
                <Command>
                  <CommandInput placeholder={t('search')} onValueChange={debouncedSearch} className="mb-1 h-7 text-xs sm:h-8 sm:text-sm" />
                  <CommandList ref={listRef}>
                    <CommandEmpty>
                      <div className="py-3 text-center text-xs text-muted-foreground sm:py-4 sm:text-sm">{t('noAdminsFound') || 'No admins found'}</div>
                    </CommandEmpty>

                    <CommandItem
                      onSelect={() => {
                        setSelectedAdmin(undefined)
                        setDropdownOpen(false)
                      }}
                      className={cn('flex min-w-0 items-center gap-2 px-2 py-1.5 text-xs sm:text-sm', dir === 'rtl' ? 'flex-row-reverse' : 'flex-row')}
                    >
                      <Avatar className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5">
                        <AvatarFallback className="bg-primary/10 text-xs font-medium">N</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">All</span>
                      <div className="flex flex-shrink-0 items-center gap-1">{!selectedAdmin && <Check className="h-3 w-3 text-primary" />}</div>
                    </CommandItem>

                    {filteredAdmins.map(admin => (
                      <CommandItem
                        key={admin.username}
                        onSelect={() => {
                          setSelectedAdmin(admin)
                          setDropdownOpen(false)
                        }}
                        className={cn('flex min-w-0 items-center gap-2 px-2 py-1.5 text-xs sm:text-sm', dir === 'rtl' ? 'flex-row-reverse' : 'flex-row')}
                      >
                        <Avatar className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5">
                          <AvatarFallback className="bg-muted text-xs font-medium">{admin.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{admin.username}</span>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          {admin.is_sudo ? <UserCog className="h-3 w-3 text-primary" /> : <UserRound className="h-3 w-3 text-primary" />}
                          {selectedAdmin?.username === admin.username && <Check className="h-3 w-3 text-primary" />}
                        </div>
                      </CommandItem>
                    ))}

                    {isLoading && (
                      <div className="flex justify-center py-2">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.cleanup.expiredUsers.expiredAfter')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !expiredAfter && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiredAfter ? formatDate(expiredAfter) : t('settings.cleanup.expiredUsers.expiredAfterPlaceholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  {isPersianLocale ? (
                    <PersianCalendar
                      mode="single"
                      selected={expiredAfter}
                      onSelect={setExpiredAfter}
                      disabled={date => date > new Date() || date < new Date('1900-01-01')}
                      captionLayout="dropdown"
                      formatters={{
                        formatMonthDropdown: date => date.toLocaleString('fa-IR', { month: 'short' }),
                      }}
                    />
                  ) : (
                    <Calendar
                      mode="single"
                      selected={expiredAfter}
                      onSelect={setExpiredAfter}
                      disabled={date => date > new Date() || date < new Date('1900-01-01')}
                      captionLayout="dropdown"
                      formatters={{
                        formatMonthDropdown: date => date.toLocaleString('default', { month: 'short' }),
                      }}
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.cleanup.expiredUsers.expiredBefore')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !expiredBefore && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiredBefore ? formatDate(expiredBefore) : t('settings.cleanup.expiredUsers.expiredBeforePlaceholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  {isPersianLocale ? (
                    <PersianCalendar
                      mode="single"
                      selected={expiredBefore}
                      onSelect={setExpiredBefore}
                      disabled={date => date > new Date() || date < new Date('1900-01-01')}
                      captionLayout="dropdown"
                      formatters={{
                        formatMonthDropdown: date => date.toLocaleString('fa-IR', { month: 'short' }),
                      }}
                    />
                  ) : (
                    <Calendar
                      mode="single"
                      selected={expiredBefore}
                      onSelect={setExpiredBefore}
                      disabled={date => date > new Date() || date < new Date('1900-01-01')}
                      captionLayout="dropdown"
                      formatters={{
                        formatMonthDropdown: date => date.toLocaleString('default', { month: 'short' }),
                      }}
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">{t('settings.cleanup.expiredUsers.selectDateRange')}</div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleteExpiredUsersMutation.isPending} className="w-full">
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteExpiredUsersMutation.isPending ? t('settings.cleanup.expiredUsers.deleting') : t('settings.cleanup.expiredUsers.deleteExpired')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  {t('settings.cleanup.expiredUsers.confirmDelete')}
                </AlertDialogTitle>
                <AlertDialogDescription className={cn(dir === 'rtl' ? 'text-right' : 'text-left', 'text-sm')}>{t('settings.cleanup.expiredUsers.confirmDeleteMessage')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteExpired} disabled={deleteExpiredUsersMutation.isPending} className="!m-0 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t('settings.cleanup.expiredUsers.deleteExpired')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Reset Usage Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            {t('settings.cleanup.resetUsage.title')}
          </CardTitle>
          <CardDescription>{t('settings.cleanup.resetUsage.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t('settings.cleanup.resetUsage.warning')}</AlertDescription>
          </Alert>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={resetUsersDataUsageMutation.isPending} className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" />
                {resetUsersDataUsageMutation.isPending ? t('settings.cleanup.resetUsage.resetting') : t('settings.cleanup.resetUsage.resetAll')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir={dir}>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  {t('settings.cleanup.resetUsage.confirmReset')}
                </AlertDialogTitle>
                <AlertDialogDescription className={cn(dir === 'rtl' ? 'text-right' : 'text-left')}>{t('settings.cleanup.resetUsage.confirmResetMessage')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetUsage} disabled={resetUsersDataUsageMutation.isPending} className="!m-0 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t('settings.cleanup.resetUsage.resetAll')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Clear Usage Data Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t('settings.cleanup.clearUsageData.title')}
          </CardTitle>
          <CardDescription>{t('settings.cleanup.clearUsageData.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.cleanup.clearUsageData.selectTable')}</label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('settings.cleanup.clearUsageData.selectTablePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {usageDataTables.map(table => (
                  <SelectItem key={table.value} value={table.value}>
                    {table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.cleanup.clearUsageData.dataAfter')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !clearDataAfter && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {clearDataAfter ? formatDate(clearDataAfter) : t('settings.cleanup.clearUsageData.dataAfterPlaceholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  {isPersianLocale ? (
                    <PersianCalendar
                      mode="single"
                      selected={clearDataAfter}
                      onSelect={setClearDataAfter}
                      disabled={date => date > new Date() || date < new Date('1900-01-01')}
                      captionLayout="dropdown"
                      formatters={{
                        formatMonthDropdown: date => date.toLocaleString('fa-IR', { month: 'short' }),
                      }}
                    />
                  ) : (
                    <Calendar
                      mode="single"
                      selected={clearDataAfter}
                      onSelect={setClearDataAfter}
                      disabled={date => date > new Date() || date < new Date('1900-01-01')}
                      captionLayout="dropdown"
                      formatters={{
                        formatMonthDropdown: date => date.toLocaleString('default', { month: 'short' }),
                      }}
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.cleanup.clearUsageData.dataBefore')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !clearDataBefore && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {clearDataBefore ? formatDate(clearDataBefore) : t('settings.cleanup.clearUsageData.dataBeforePlaceholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  {isPersianLocale ? (
                    <PersianCalendar
                      mode="single"
                      selected={clearDataBefore}
                      onSelect={setClearDataBefore}
                      disabled={date => date > new Date() || date < new Date('1900-01-01')}
                      captionLayout="dropdown"
                      formatters={{
                        formatMonthDropdown: date => date.toLocaleString('fa-IR', { month: 'short' }),
                      }}
                    />
                  ) : (
                    <Calendar
                      mode="single"
                      selected={clearDataBefore}
                      onSelect={setClearDataBefore}
                      disabled={date => date > new Date() || date < new Date('1900-01-01')}
                      captionLayout="dropdown"
                      formatters={{
                        formatMonthDropdown: date => date.toLocaleString('default', { month: 'short' }),
                      }}
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">{t('settings.cleanup.clearUsageData.selectDateRange')}</div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t('settings.cleanup.clearUsageData.warning')}</AlertDescription>
          </Alert>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!selectedTable || clearUsageDataMutation.isPending} className="w-full">
                <Server className="mr-2 h-4 w-4" />
                {clearUsageDataMutation.isPending ? t('settings.cleanup.clearUsageData.clearing') : t('settings.cleanup.clearUsageData.clearData')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir={dir}>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  {t('settings.cleanup.clearUsageData.confirmClear')}
                </AlertDialogTitle>
                <AlertDialogDescription className={cn(dir === 'rtl' ? 'text-right' : 'text-left')}>
                  {t('settings.cleanup.clearUsageData.confirmClearMessage', { table: selectedTable })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearUsageData} disabled={clearUsageDataMutation.isPending} className="!m-0 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t('settings.cleanup.clearUsageData.clearData')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
