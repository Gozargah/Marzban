"use client"

import { useState } from "react"
import {
  useGetAllGroups,
  useGetUsers,
  useGetAdmins,
  useBulkModifyUsersProxySettings,
  XTLSFlows,
  ShadowsocksMethods,
} from "@/service/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Users2, User, Shield, Settings } from "lucide-react"
import { SelectorPanel } from "@/components/bulk/SelectorPanel"

export default function BulkProxyPage() {
  const { t } = useTranslation()
  const { data: usersData } = useGetUsers()
  const { data: adminsData } = useGetAdmins()
  const { data: groupsData } = useGetAllGroups()

  // State for proxy settings
  const [selectedFlow, setSelectedFlow] = useState<XTLSFlows | "none" | undefined>(undefined)
  const [selectedMethod, setSelectedMethod] = useState<ShadowsocksMethods | undefined>(undefined)

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

  const mutation = useBulkModifyUsersProxySettings()

  const handleApply = () => {
    const hasValidFlow = selectedFlow && selectedFlow !== "none"
    const hasValidMethod = selectedMethod
    
    if (!hasValidFlow && !hasValidMethod) {
      toast.error(t("error", { defaultValue: "Error" }), {
        description: t("bulk.proxySettingsRequired", { defaultValue: "Please select at least one proxy setting (Flow or Method)." }),
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
    const payload = {
      flow: selectedFlow === "none" ? ("" as XTLSFlows) : selectedFlow,
      method: selectedMethod,
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
          setSelectedFlow(undefined)
          setSelectedMethod(undefined)
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

  return (
    <div className="flex flex-col w-full space-y-6 mt-3">
      {/* Proxy Settings Section */}
      <Card className="bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            {t("bulk.proxySettings", { defaultValue: "Proxy Settings" })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("bulk.proxySettingsDesc", { defaultValue: "Configure the proxy settings to apply" })}</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="flow">{t("bulk.flowLabel", { defaultValue: "Flow" })}</Label>
            <Select value={selectedFlow || ""} onValueChange={(value) => setSelectedFlow(value as XTLSFlows | "none")}>
              <SelectTrigger id="flow">
                <SelectValue placeholder={t("bulk.selectFlowPlaceholder", { defaultValue: "Select flow" })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("none", { defaultValue: "None" })}</SelectItem>
                {Object.values(XTLSFlows)
                  .filter(flow => flow !== "")
                  .map((flow) => (
                    <SelectItem key={flow} value={flow}>
                      {flow}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="method">{t("bulk.methodLabel", { defaultValue: "Method" })}</Label>
            <Select value={selectedMethod || ""} onValueChange={(value) => setSelectedMethod(value as ShadowsocksMethods)}>
              <SelectTrigger id="method">
                <SelectValue placeholder={t("bulk.selectMethodPlaceholder", { defaultValue: "Select method" })} />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ShadowsocksMethods).map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <p className="text-sm text-muted-foreground">{t("bulk.applyToProxyDesc", { defaultValue: "Select the groups, users, or admins you want to apply proxy settings to" })}</p>
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
              {t("bulk.applyProxyDescription", {
                defaultValue: "Apply the selected proxy settings to the selected groups, users, and admins.",
              })}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge variant="outline" className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              {t("bulk.flowMethod", { flow: selectedFlow === "none" || !selectedFlow ? t("none", { defaultValue: "None" }) : selectedFlow, method: selectedMethod || t("none", { defaultValue: "None" }), defaultValue: "Flow: {{flow}} | Method: {{method}}" })}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {t("bulk.targetsCount", { count: totalTargets, defaultValue: "{{count}} targets" })}
            </Badge>
          </div>

          <Button
            onClick={handleApply}
            className="flex items-center gap-2 px-6"
            disabled={
              ((!selectedFlow || selectedFlow === "none") && !selectedMethod) || 
              totalTargets === 0 || 
              mutation.isPending
            }
            size="lg"
          >
            <Settings className="h-4 w-4" />
            {mutation.isPending ? t("applying", { defaultValue: "Applying..." }) : t("bulk.applyProxySettings", { defaultValue: "Apply Proxy Settings" })}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("bulk.confirmApplyProxyTitle", { defaultValue: "Confirm Apply Proxy Settings" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulk.confirmApplyProxyDescription", {
                defaultValue:
                  "Are you sure you want to apply proxy settings (Flow: {{flow}}, Method: {{method}}) to {{totalTargets}} target(s)? This action will update the proxy settings for all selected groups, users, and admins.",
                flow: selectedFlow || "None",
                method: selectedMethod || "None",
                totalTargets,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", { defaultValue: "Cancel" })}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply} disabled={mutation.isPending}>
              {mutation.isPending ? t("applying", { defaultValue: "Applying..." }) : t("bulk.applyProxySettings", { defaultValue: "Apply Proxy Settings" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
