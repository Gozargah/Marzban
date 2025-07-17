"use client"

import { useState } from "react"
import {
  useGetAllGroups,
  useGetUsers,
  useGetAdmins,
  useBulkAddGroupsToUsers,
  useBulkRemoveUsersFromGroups,
} from "@/service/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Users2, User, Shield, Plus, Minus } from "lucide-react"
import { SelectorPanel } from "@/components/bulk/SelectorPanel"

export default function BulkGroupsPage() {
  const { t } = useTranslation()
  const { data: usersData } = useGetUsers()
  const { data: adminsData } = useGetAdmins()
  const { data: groupsData } = useGetAllGroups()

  // State for the four sections
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])
  const [selectedHasGroups, setSelectedHasGroups] = useState<number[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [selectedAdmins, setSelectedAdmins] = useState<number[]>([])

  // Search states
  const [groupSearch, setGroupSearch] = useState("")
  const [hasGroupSearch, setHasGroupSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [adminSearch, setAdminSearch] = useState("")

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  const addMutation = useBulkAddGroupsToUsers()
  const removeMutation = useBulkRemoveUsersFromGroups()

  const handleBulk = (action: "add" | "remove") => {
    const payload = {
      group_ids: selectedGroups,
      has_group_ids: selectedHasGroups,
      users: selectedUsers.length ? selectedUsers : undefined,
      admins: selectedAdmins.length ? selectedAdmins : undefined,
    }
    const mutation = action === "add" ? addMutation : removeMutation
    mutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast.success(t("operationSuccess", { defaultValue: "Operation successful!" }))
          // Reset selections after successful operation
          setSelectedGroups([])
          setSelectedHasGroups([])
          setSelectedUsers([])
          setSelectedAdmins([])
        },
        onError: () => toast.error(t("operationFailed", { defaultValue: "Operation failed!" })),
      },
    )
  }

  const totalTargets = selectedUsers.length + selectedAdmins.length + selectedHasGroups.length;
  const totalGroups = selectedGroups.length;
  const isApplyToAll = totalTargets === 0;

  return (
    <div className="flex flex-col w-full space-y-6 mt-3">
      {/* Groups Section */}
      <Card className="bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users2 className="h-5 w-5" />
            {t("bulk.groups", { defaultValue: "Groups" })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("bulk.groupsDescShort", { defaultValue: "Select the groups you want to apply" })}</p>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Apply To Section */}
      <Card className="bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            {t("bulk.applyTo", { defaultValue: "Apply To" })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("bulk.applyToDesc", { defaultValue: "Select the user or admin you want to apply settings" })}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SelectorPanel
              icon={Users2}
              title={t("bulk.selectHasGroups", { defaultValue: "Select Has Groups" })}
              items={groupsData?.groups || []}
              selected={selectedHasGroups}
              setSelected={setSelectedHasGroups}
              search={hasGroupSearch}
              setSearch={setHasGroupSearch}
              searchPlaceholder={t("bulk.searchHasGroups", { defaultValue: "Search has groups..." })}
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
              {t("bulk.applyDescription", {
                defaultValue: "Apply the selected group assignments to the selected users and admins.",
              })}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge variant="outline" className="flex items-center gap-1">
              <Users2 className="h-3 w-3" />
              {t("bulk.groupsCount", { count: totalGroups, defaultValue: "{{count}} groups" })}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {t("bulk.targetsCount", { count: totalTargets, defaultValue: "{{count}} targets" })}
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2 px-6"
              disabled={totalGroups === 0 || addMutation.isPending}
              size="lg"
            >
              <Plus className="h-4 w-4" />
              {t("bulk.addGroupsToUsers", { defaultValue: "Add Groups to Users" })}
            </Button>

            <Button
              variant="destructive"
              onClick={() => setShowRemoveDialog(true)}
              className="flex items-center gap-2 px-6"
              disabled={totalGroups === 0 || totalTargets === 0}
              size="lg"
            >
              <Minus className="h-4 w-4" />
              {t("bulk.removeGroupsFromUsers", { defaultValue: "Remove Groups from Users" })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Groups Confirmation Dialog */}
      <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("bulk.confirmAddGroupsTitle", { defaultValue: "Confirm Add Groups" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isApplyToAll
                ? t("bulk.confirmApplyGroupsDescriptionAll", {
                    totalGroups,
                    defaultValue: "Are you sure you want to apply the group changes to ALL users, admins, and groups? This will update the groups for everyone.",
                  })
                : t("bulk.confirmApplyGroupsDescription", {
                    totalGroups,
                    totalTargets,
                    defaultValue: "Are you sure you want to apply the group changes to {{totalTargets}} target(s)? This will update the groups for all selected users and admins.",
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", { defaultValue: "Cancel" })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleBulk("add")
                setShowAddDialog(false)
              }}
            >
              {t("bulk.addGroupsToUsers", { defaultValue: "Add Groups" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Groups Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("bulk.confirmRemoveGroupsTitle", { defaultValue: "Confirm Remove Groups" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulk.confirmRemoveGroupsDescription", {
                defaultValue:
                  "Are you sure you want to remove {{totalGroups}} group(s) from {{totalTargets}} target(s)? This action will remove the selected groups from all selected users and admins.",
                totalGroups,
                totalTargets,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", { defaultValue: "Cancel" })}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                handleBulk("remove")
                setShowRemoveDialog(false)
              }}
            >
              {t("bulk.removeGroupsFromUsers", { defaultValue: "Remove Groups" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
