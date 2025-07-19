"use client"

import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { CalendarIcon, Plus, Minus } from "lucide-react"
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
import { Label } from "@/components/ui/label"

type ExpiryUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'months'

export default function BulkExpirePage() {
  const { t } = useTranslation()
  const { data: usersData } = useGetUsers()
  const { data: adminsData } = useGetAdmins()
  const { data: groupsData } = useGetAllGroups()

  const [operation, setOperation] = useState<"add" | "subtract">("add")

  // State for expire seconds
  const [expireSeconds, setExpireSeconds] = useState<number | undefined>(undefined)
  const [unit, setUnit] = useState<ExpiryUnit>('days')
  const [amount, setAmount] = useState<number | undefined>(undefined)

  // When amount or unit changes, update the seconds
  useEffect(() => {
    if (amount === undefined) {
      setExpireSeconds(undefined)
      return
    }
    const num = Number(amount)
    if (num <= 0) {
      setExpireSeconds(undefined)
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
    setExpireSeconds(seconds)
  }, [amount, unit])


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
      amount: operation === 'subtract' ? -expireSeconds : expireSeconds,
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
          setAmount(undefined)
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
          <div className="space-y-4">
            {/* Operation Selection */}
            <div className="space-y-2">
              <Label>{t("bulk.operationType", { defaultValue: "Operation Type" })}</Label>
              <div className="flex gap-2">
                <Button
                  variant={operation === "add" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOperation("add")}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {t("bulk.addExpiry")}
                </Button>
                <Button
                  variant={operation === "subtract" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOperation("subtract")}
                  className="flex items-center gap-2"
                >
                  <Minus className="h-4 w-4" />
                  {t("bulk.subtractExpiry")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expire-date">{t("bulk.expireDate", { defaultValue: "Expire Date" })}</Label>
              <div className="relative">
                <Input
                  id="expire-date"
                  type="number"
                  placeholder={t("bulk.expire.placeholder", { defaultValue: "Enter expire date" })}
                  value={amount === undefined ? "" : amount}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value)
                    if (!isNaN(value)) {
                      setAmount(value)
                    } else if (e.target.value === "") {
                      setAmount(undefined)
                    }
                  }}
                  step="1"
                  className="pr-24"
                />
                <div className="absolute right-0 top-0 h-full w-20">
                  <Select value={unit} onValueChange={(v) => setUnit(v as ExpiryUnit)}>
                    <SelectTrigger className="h-full rounded-l-none border-l-0 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
            </div>
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
              {expireSeconds ? (
                <span dir="ltr" className="flex items-center gap-1">
                  {operation === "add" ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {`${expireSeconds}s`}
                </span>
              ) : t("bulk.noDateSelected", { defaultValue: "No date selected" })}
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