"use client"

import { useState } from "react"
import {
  useGetAllGroups,
  useGetUsers,
  useGetAdmins,
  useBulkModifyUsersDatalimit,
} from "@/service/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Users2, User, Shield, HardDrive, Plus, Minus } from "lucide-react"
import { SelectorPanel } from "@/components/bulk/SelectorPanel"
import { formatBytes } from "@/utils/formatByte"

// Helper function to convert GB to bytes
const gbToBytes = (gb: number): number => {
  return gb * 1024 * 1024 * 1024
}

export default function BulkDataPage() {
  const { t } = useTranslation()
  const { data: usersData } = useGetUsers()
  const { data: adminsData } = useGetAdmins()
  const { data: groupsData } = useGetAllGroups()

  // State for data limit
  const [dataLimit, setDataLimit] = useState<number | undefined>(undefined)
  const [operation, setOperation] = useState<"add" | "subtract">("add")

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

  const mutation = useBulkModifyUsersDatalimit()

  const handleApply = () => {
    if (dataLimit === undefined || dataLimit < 0) {
      toast.error(t("error", { defaultValue: "Error" }), {
        description: t("bulk.dataLimitRequired", { defaultValue: "Please enter a valid data limit." }),
      })
      return
    }

    setShowConfirmDialog(true)
  }

  const confirmApply = () => {
    if (dataLimit === undefined) return

    // Convert GB to bytes using the helper function
    let dataLimitBytes = gbToBytes(dataLimit)
    
    // For subtract operation, make the amount negative
    if (operation === "subtract") {
      dataLimitBytes = -dataLimitBytes
    }

    const payload = {
      amount: dataLimitBytes,
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
          setDataLimit(undefined)
          setOperation("add")
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
      {/* Data Limit Section */}
      <Card className="bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardDrive className="h-5 w-5" />
            {t("bulk.dataLimit", { defaultValue: "Data Limit" })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("bulk.dataLimitDesc", { defaultValue: "Set the data limit in GB to add or subtract" })}</p>
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
                  {t("bulk.addDataLimit", { defaultValue: "Add Data Limit" })}
                </Button>
                <Button
                  variant={operation === "subtract" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOperation("subtract")}
                  className="flex items-center gap-2"
                >
                  <Minus className="h-4 w-4" />
                  {t("bulk.subtractDataLimit", { defaultValue: "Subtract Data Limit" })}
                </Button>
              </div>
            </div>

            {/* Data Limit Input */}
            <div className="space-y-2">
              <Label htmlFor="data-limit">{t("bulk.dataLimitLabel", { defaultValue: "Data Limit (GB)" })}</Label>
              <div className="relative">
                <Input
                  id="data-limit"
                  type="number"
                  placeholder={t("bulk.dataLimitPlaceholder", { defaultValue: "Enter data limit in GB" })}
                  value={dataLimit === undefined ? "" : dataLimit}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value)
                    // Allow negative numbers for subtract, positive for add
                    if (!isNaN(value)) {
                      setDataLimit(value)
                    } else if (e.target.value === "") {
                      setDataLimit(undefined)
                    }
                  }}
                  // Remove min="0" to allow negative values if you want
                  step="1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">GB</span>
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
          <p className="text-sm text-muted-foreground">{t("bulk.applyToDataLimitDesc", { defaultValue: "Select the groups, users, or admins you want to apply data limit to" })}</p>
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
              {t("bulk.applyDataLimitDescription", {
                defaultValue: "Apply the selected data limit operation to the selected groups, users, and admins.",
              })}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge variant="outline" className="flex items-center gap-2">
              <HardDrive className="h-3 w-3" />
              {dataLimit !== undefined ? (
                <span dir="ltr" className="flex items-center gap-1">
                  {operation === "add" ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {formatBytes(gbToBytes(dataLimit))}
                </span>
              ) : (
                t("bulk.noLimitSet", { defaultValue: "No limit set" })
              )}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {t("bulk.targetsCount", { count: totalTargets, defaultValue: "{{count}} targets" })}
            </Badge>
          </div>

          <Button
            onClick={handleApply}
            className="flex items-center gap-2 px-6"
            disabled={dataLimit === undefined || mutation.isPending}
            size="lg"
          >
            <HardDrive className="h-4 w-4" />
            {mutation.isPending ? t("applying", { defaultValue: "Applying..." }) : t("bulk.applyDataLimit", { defaultValue: "Apply Data Limit" })}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("bulk.confirmApplyDataLimitTitle", { defaultValue: "Confirm Apply Data Limit" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isApplyToAll
                ? t("bulk.confirmApplyDataLimitDescriptionAll", {
                    dataLimit,
                    defaultValue: "Are you sure you want to apply the data limit of {{dataLimit}} GB to ALL users, admins, and groups? This will update the data limit for everyone.",
                  })
                : t("bulk.confirmApplyDataLimitDescription", {
                    dataLimit,
                    totalTargets,
                    defaultValue: "Are you sure you want to apply the data limit of {{dataLimit}} GB to {{totalTargets}} target(s)? This will update the data limit for all selected groups, users, and admins.",
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", { defaultValue: "Cancel" })}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply} disabled={mutation.isPending}>
              {mutation.isPending ? t("applying", { defaultValue: "Applying..." }) : t("bulk.applyDataLimit", { defaultValue: "Apply Data Limit" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
