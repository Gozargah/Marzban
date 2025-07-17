"use client"

import { useState } from "react"
import {
  useGetAllGroups,
  useGetUsers,
  useGetAdmins,
  useBulkModifyUsersExpire,
} from "@/service/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "react-i18next"
import { useEffect } from "react"
import { Input } from "@/components/ui/input"
import { CalendarIcon } from "lucide-react"
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import useDirDetection from '@/hooks/use-dir-detection'

const ExpiryDateField = ({
  value,
  onChange,
}: {
  value: number | undefined // seconds
  onChange: (seconds: number | undefined) => void
}) => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const expireInfo = useRelativeExpiryDate(value ? Math.floor(Date.now() / 1000) + value : null)
  type ExpiryUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'months'
  const [unit, setUnit] = useState<ExpiryUnit>('days')
  const [amount, setAmount] = useState<string>('')

  // When amount or unit changes, update the seconds
  useEffect(() => {
    if (amount === '' || isNaN(Number(amount))) {
      onChange(undefined)
      return
    }
    const num = Number(amount)
    if (num === 0) {
      onChange(undefined)
      return
    }
    let seconds = num
    switch (unit) {
      case 'minutes': seconds = num * 60; break
      case 'hours': seconds = num * 3600; break
      case 'days': seconds = num * 86400; break
      case 'months': seconds = num * 2592000; break // 30 days
      // seconds: do nothing
    }
    onChange(seconds)
  }, [amount, unit])

  // Preview: show the relative time from now
  const preview = value
    ? t('bulk.previewSeconds', { count: value, defaultValue: `+${value} seconds` })
    : t('bulk.noDateSelected', { defaultValue: 'No date selected' })

  // Direction-aware classes
  const inputRadius = dir === 'rtl' ? 'rounded-r-full rounded-l-none' : 'rounded-l-full rounded-r-none'
  const selectRadius = dir === 'rtl' ? 'rounded-l-full rounded-r-none' : 'rounded-r-full rounded-l-none'
  const inputBorderFix = dir === 'rtl' ? 'border-l-0' : 'border-r-0'
  const selectBorderFix = dir === 'rtl' ? 'border-r-0' : 'border-l-0'

  return (
    <div className="w-full flex flex-col md:flex-row gap-4 p-0 sm:p-2 items-center justify-between" dir={dir}>
      <div className="flex flex-col gap-1 w-full max-w-md items-center">
        <div className={`flex gap-0 w-full justify-center items-center`}>
          <Input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={""}
            className={`text-sm font-normal ${inputRadius} ${inputBorderFix} border border-input bg-background px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all w-32 text-center shadow-none hover:border-primary/60 focus:border-primary/80`}
            min="-999999"
            max="999999"
            inputMode="numeric"
            aria-label={"0"}
            dir={dir}
          />
          <Select value={unit} onValueChange={v => setUnit(v as ExpiryUnit)}>
            <SelectTrigger className={`${selectRadius} flex px-4 ${selectBorderFix}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50" dir={dir}>
              <SelectGroup>
                <SelectItem value="seconds">{t('time.seconds', { defaultValue: 'Seconds' })}</SelectItem>
                <SelectItem value="minutes">{t('time.mins', { defaultValue: 'Minutes' })}</SelectItem>
                <SelectItem value="hours">{t('time.hours', { defaultValue: 'Hours' })}</SelectItem>
                <SelectItem value="days">{t('time.days', { defaultValue: 'Days' })}</SelectItem>
                <SelectItem value="months">{t('time.months', { defaultValue: 'Months' })}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col items-center w-fit">
        <div className="w-full px-20 max-w-md rounded-lg border border-primary/10 py-2 flex flex-col items-center gap-1 bg-background" dir={dir}>
          <span className="text-sm font-medium text-primary text-center break-all leading-tight w-full" dir="ltr">{preview}</span>
          {expireInfo && expireInfo.time && (
            <span className="text-xs text-muted-foreground text-center w-full" dir={dir}>{expireInfo.time !== '0' && expireInfo.time !== '0s'
              ? t('expires', { time: expireInfo.time, defaultValue: 'Expires in {{time}}' })
              : t('expired', { time: expireInfo.time, defaultValue: 'Expired in {{time}}' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BulkExpirePage() {
  const { t } = useTranslation()
  const { data: usersData } = useGetUsers()
  const { data: adminsData } = useGetAdmins()
  const { data: groupsData } = useGetAllGroups()

  // State for expire seconds
  const [expireSeconds, setExpireSeconds] = useState<number | undefined>(undefined)

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
    if (!expireSeconds) {
      toast.error(t("error", { defaultValue: "Error" }), {
        description: t("bulk.expireDateRequired", { defaultValue: "Please select an expire date." }),
      })
      return
    }

    setShowConfirmDialog(true)
  }

  const confirmApply = () => {
    if (!expireSeconds) return

    const payload = {
      amount: expireSeconds,
      group_ids: selectedGroups.length ? selectedGroups : undefined,
      users: selectedUsers.length ? selectedUsers : undefined,
      admins: selectedAdmins.length ? selectedAdmins : undefined,
      // If all are empty, treat as 'apply to all' (no filters)
    }

    mutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast.success(t("operationSuccess", { defaultValue: "Operation successful!" }))
          // Reset selections after successful operation
          setExpireSeconds(undefined)
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
  const isApplyToAll = totalTargets === 0

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
              value={expireSeconds}
              onChange={setExpireSeconds}
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
              {expireSeconds ? `${expireSeconds}s` : t("bulk.noDateSelected", { defaultValue: "No date selected" })}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {t("bulk.targetsCount", { count: totalTargets, defaultValue: "{{count}} targets" })}
            </Badge>
          </div>

          <Button
            onClick={handleApply}
            className="flex items-center gap-2 px-6"
            disabled={!expireSeconds || mutation.isPending}
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
              {isApplyToAll
                ? t("bulk.confirmApplyExpireDescriptionAll", {
                    defaultValue:
                      "Are you sure you want to apply the expiration date {{expireDate}} to ALL users, admins, and groups? This will update the expiration date for everyone.",
                    expireDate: expireSeconds ? `${expireSeconds}s` : "",
                  })
                : t("bulk.confirmApplyExpireDescription", {
                    defaultValue:
                      "Are you sure you want to apply the expiration date {{expireDate}} to {{totalTargets}} target(s)? This will update the expiration date for all selected groups, users, and admins.",
                    expireDate: expireSeconds ? `${expireSeconds}s` : "",
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
