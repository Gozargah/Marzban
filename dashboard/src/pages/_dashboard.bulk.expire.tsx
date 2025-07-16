"use client"

import { useState } from "react"
import {
  useGetAllGroups,
  useGetUsers,
  useGetAdmins,
  useBulkModifyUsersExpire,
} from "@/service/api"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "react-i18next"
import { useEffect, useTransition, useCallback } from "react"
import { Calendar as PersianCalendar } from "@/components/ui/persian-calendar"
import { Input } from "@/components/ui/input"
import { X, CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRelativeExpiryDate } from "@/utils/dateFormatter"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Users2, User, Shield } from "lucide-react"
import { SelectorPanel } from "@/components/bulk/SelectorPanel"
import { format } from "date-fns"

const ExpiryDateField = ({
  value,
  onChange,
  label,
}: {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  label: string
}) => {
  const { t, i18n } = useTranslation()
  const expireInfo = useRelativeExpiryDate(value ? Math.floor(value.getTime() / 1000) : null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [usePersianCalendar, setUsePersianCalendar] = useState(i18n.language === 'fa')
  const [, startTransition] = useTransition()
  const now = new Date()

  useEffect(() => {
    setUsePersianCalendar(i18n.language === 'fa')
  }, [i18n.language])

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        if (selectedDate < today) {
          date = new Date(now)
        }
        if (selectedDate.getTime() === today.getTime()) {
          date.setHours(23, 59, 59)
        } else {
          date.setHours(now.getHours(), now.getMinutes())
        }
        startTransition(() => {
          onChange(date)
        })
      } else {
        startTransition(() => {
          onChange(undefined)
        })
      }
      setCalendarOpen(false)
    },
    [onChange, now],
  )

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (value && e.target.value) {
        const [hours, minutes] = e.target.value.split(':')
        const newDate = new Date(value)
        newDate.setHours(parseInt(hours), parseInt(minutes))
        if (newDate.toDateString() === now.toDateString() && newDate < now) {
          newDate.setTime(now.getTime())
        }
        startTransition(() => {
          onChange(newDate)
        })
      }
    },
    [value, onChange, now],
  )

  const isDateDisabled = useCallback(
    (date: Date) => {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      if (compareDate < today) return true
      if (date.getFullYear() < now.getFullYear()) return true
      if (date.getFullYear() > now.getFullYear() + 15) return true
      if (date.getFullYear() === now.getFullYear()) {
        if (date.getMonth() < now.getMonth()) return true
        if (date.getMonth() === now.getMonth() && compareDate < today) return true
      }
      return false
    },
    [now],
  )

  return (
    <div className="flex flex-1 flex-col">
      <label className="mb-1 text-sm font-medium">{label}</label>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-full">
            <Button
              dir={'ltr'}
              variant={'outline'}
              className={cn('!mt-3.5 h-fit w-full text-left font-normal', !value && 'text-muted-foreground')}
              type="button"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                setCalendarOpen(true)
              }}
            >
              {value ? (
                usePersianCalendar ? (
                  value.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
                  ' ' +
                  value.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false })
                ) : (
                  value.toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
                  ' ' +
                  value.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })
                )
              ) : (
                <span>{t('userDialog.expireDate', { defaultValue: 'Expire date' })}</span>
              )}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          onInteractOutside={e => {
            e.preventDefault()
            setCalendarOpen(false)
          }}
          onEscapeKeyDown={() => setCalendarOpen(false)}
        >
          {usePersianCalendar ? (
            <PersianCalendar
              mode="single"
              selected={value}
              onSelect={handleDateSelect}
              disabled={isDateDisabled}
              captionLayout="dropdown"
              defaultMonth={value || now}
              startMonth={new Date(now.getFullYear(), now.getMonth(), 1)}
              endMonth={new Date(now.getFullYear() + 15, 11, 31)}
              formatters={{
                formatMonthDropdown: date => date.toLocaleString('fa-IR', { month: 'short' }),
              }}
            />
          ) : (
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleDateSelect}
              disabled={isDateDisabled}
              captionLayout="dropdown"
              defaultMonth={value || now}
              startMonth={new Date(now.getFullYear(), now.getMonth(), 1)}
              endMonth={new Date(now.getFullYear() + 15, 11, 31)}
              formatters={{
                formatMonthDropdown: date => date.toLocaleString('default', { month: 'short' }),
              }}
            />
          )}
          <div className="flex items-center gap-4 border-t p-3">
            <Input
              type="time"
              value={
                value
                  ? value.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })
                  : now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })
              }
              min={
                value && value.toDateString() === now.toDateString()
                  ? now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })
                  : undefined
              }
              onChange={handleTimeChange}
            />
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(undefined)
                  setCalendarOpen(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {expireInfo && (
        <p className={cn(!expireInfo.time && 'hidden', 'text-xs text-muted-foreground mt-2')}>
          {expireInfo.time !== '0' && expireInfo.time !== '0s'
            ? t('expires', { time: expireInfo.time, defaultValue: 'Expires in {{time}}' })
            : t('expired', { time: expireInfo.time, defaultValue: 'Expired in {{time}}' })}
        </p>
      )}
    </div>
  )
}

export default function BulkExpirePage() {
  const { t } = useTranslation()
  const { data: usersData } = useGetUsers()
  const { data: adminsData } = useGetAdmins()
  const { data: groupsData } = useGetAllGroups()

  // State for expire date
  const [expireDate, setExpireDate] = useState<Date | undefined>(undefined)

  // State for the three sections
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [selectedAdmins, setSelectedAdmins] = useState<number[]>([])

  // Search states
  const [groupSearch, setGroupSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [adminSearch, setAdminSearch] = useState("")

  // Dialog states
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const mutation = useBulkModifyUsersExpire()

  const handleApply = () => {
    if (!expireDate) {
      toast.error(t("error", { defaultValue: "Error" }), {
        description: t("bulk.expireDateRequired", { defaultValue: "Please select an expire date." }),
      })
      return
    }

    const totalTargets = selectedUsers.length + selectedAdmins.length + selectedGroups.length
    if (totalTargets === 0) {
      toast.error(t("error", { defaultValue: "Error" }), {
        description: t("bulk.noTargetsSelected", { defaultValue: "Please select at least one target." }),
      })
      return
    }

    setShowConfirmDialog(true)
  }

  const confirmApply = () => {
    if (!expireDate) return

    const payload = {
      amount: Math.floor(expireDate.getTime() / 1000), // Convert to seconds
      group_ids: selectedGroups.length ? selectedGroups : undefined,
      users: selectedUsers.length ? selectedUsers : undefined,
      admins: selectedAdmins.length ? selectedAdmins : undefined,
    }

    mutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast.success(t("operationSuccess", { defaultValue: "Operation successful!" }))
          // Reset selections after successful operation
          setExpireDate(undefined)
          setSelectedGroups([])
          setSelectedUsers([])
          setSelectedAdmins([])
          setShowConfirmDialog(false)
        },
        onError: () => {
          toast.error(t("operationFailed", { defaultValue: "Operation failed!" }))
          setShowConfirmDialog(false)
        },
      },
    )
  }

  const totalTargets = selectedUsers.length + selectedAdmins.length + selectedGroups.length
  const { i18n } = useTranslation()
  const isPersianLocale = i18n.language === 'fa'
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

  return (
    <div className="flex flex-col w-full space-y-6 mt-3">
      {/* Expire Date Section */}
      <Card className="bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5" />
            {t("bulk.expireDate", { defaultValue: "Expire Date" })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("bulk.expireDateDesc", { defaultValue: "Select the expiration date to apply" })}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <ExpiryDateField
              value={expireDate}
              onChange={setExpireDate}
              label={t("bulk.expireDate", { defaultValue: "Expire Date" })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Apply To Section */}
      <Card className="bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            {t("bulk.applyTo", { defaultValue: "Apply To" })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("bulk.applyToExpireDesc", { defaultValue: "Select the groups, users, or admins you want to apply expiration date to" })}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SelectorPanel
              icon={Users2}
              title={t("bulk.selectGroups", { defaultValue: "Select Groups" })}
              items={groupsData?.groups || []}
              selected={selectedGroups}
              setSelected={setSelectedGroups}
              search={groupSearch}
              setSearch={setGroupSearch}
              searchPlaceholder={t("bulk.searchGroups", { defaultValue: "Search groups..." })}
              selectAllLabel={t("selectAll", { defaultValue: "Select All" })}
              deselectAllLabel={t("deselectAll", { defaultValue: "Deselect All" })}
              itemLabelKey="name"
              itemValueKey="id"
              searchKey="name"
              t={t}
            />

            <SelectorPanel
              icon={User}
              title={t("bulk.selectUsers", { defaultValue: "Select Users" })}
              items={usersData?.users || []}
              selected={selectedUsers}
              setSelected={setSelectedUsers}
              search={userSearch}
              setSearch={setUserSearch}
              searchPlaceholder={t("bulk.searchUsers", { defaultValue: "Search users..." })}
              selectAllLabel={t("selectAll", { defaultValue: "Select All" })}
              deselectAllLabel={t("deselectAll", { defaultValue: "Deselect All" })}
              itemLabelKey="username"
              itemValueKey="id"
              searchKey="username"
              t={t}
            />

            <SelectorPanel
              icon={Shield}
              title={t("bulk.selectAdmins", { defaultValue: "Select Admins" })}
              items={(adminsData || [])
                .filter((a) => typeof a.id === "number" && typeof a.username === "string")
                .map((a) => ({ id: a.id as number, username: a.username as string }))}
              selected={selectedAdmins}
              setSelected={setSelectedAdmins}
              search={adminSearch}
              setSearch={setAdminSearch}
              searchPlaceholder={t("bulk.searchAdmins", { defaultValue: "Search admins..." })}
              selectAllLabel={t("selectAll", { defaultValue: "Select All" })}
              deselectAllLabel={t("deselectAll", { defaultValue: "Deselect All" })}
              itemLabelKey="username"
              itemValueKey="id"
              searchKey="username"
              t={t}
            />
          </div>
        </CardContent>
      </Card>

      {/* Apply Section */}
      <Card className="bg-card">
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">{t("bulk.applyChanges", { defaultValue: "Apply Changes" })}</h3>
            <p className="text-sm text-muted-foreground">
              {t("bulk.applyExpireDescription", {
                defaultValue: "Apply the selected expiration date to the selected groups, users, and admins.",
              })}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge variant="outline" className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {expireDate ? formatDate(expireDate) : t("bulk.noDateSelected", { defaultValue: "No date selected" })}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {t("bulk.targetsCount", { count: totalTargets, defaultValue: "{{count}} targets" })}
            </Badge>
          </div>

          <Button
            onClick={handleApply}
            className="flex items-center gap-2 px-6"
            disabled={!expireDate || totalTargets === 0 || mutation.isPending}
            size="lg"
          >
            <CalendarIcon className="h-4 w-4" />
            {mutation.isPending ? t("applying", { defaultValue: "Applying..." }) : t("bulk.applyExpireDate", { defaultValue: "Apply Expire Date" })}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("bulk.confirmApplyExpireTitle", { defaultValue: "Confirm Apply Expire Date" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulk.confirmApplyExpireDescription", {
                defaultValue:
                  "Are you sure you want to apply expire date {{expireDate}} to {{totalTargets}} target(s)? This action will update the expiration date for all selected groups, users, and admins.",
                expireDate: expireDate ? formatDate(expireDate) : "",
                totalTargets,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", { defaultValue: "Cancel" })}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply} disabled={mutation.isPending}>
              {mutation.isPending ? t("applying", { defaultValue: "Applying..." }) : t("bulk.applyExpireDate", { defaultValue: "Apply Expire Date" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
