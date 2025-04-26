import {useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Plus} from 'lucide-react'
import {useForm} from 'react-hook-form'
import PageHeader from '@/components/page-header'
import {Separator} from '@/components/ui/separator'
import {useToast} from '@/hooks/use-toast'
import AdminsTable from '@/components/admins/AdminsTable'
import AdminModal, {adminFormSchema, AdminFormValues} from '@/components/dialogs/AdminModal'
import {
    useActivateAllDisabledUsers, useDisableAllActiveUsers,
    useGetAdmins,
    useModifyAdmin,
    useRemoveAdmin
} from '@/service/api'
import type {AdminDetails} from '@/service/api'
import AdminsStatistics from "@/components/AdminStatistics.tsx";
import {zodResolver} from "@hookform/resolvers/zod";
import {queryClient} from "@/utils/query-client.ts";

const initialDefaultValues: Partial<AdminFormValues> = {
    username: '',
    is_sudo: false,
    password: '',
    is_disabled: false,
    discord_webhook: '',
    sub_domain: '',
    sub_template: '',
    support_url: '',
    telegram_id: undefined
}

export default function AdminsPage() {
    const {t} = useTranslation()
    const {toast} = useToast()
    const [editingAdmin, setEditingAdmin] = useState<Partial<AdminDetails> | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const form = useForm<AdminFormValues>({
        resolver: zodResolver(adminFormSchema),
        defaultValues: initialDefaultValues
    })

    const {data: admins = []} = useGetAdmins({})
    const removeAdminMutation = useRemoveAdmin();
    const modifyAdminMutation = useModifyAdmin()
    const modifyDisableAllAdminUsers = useDisableAllActiveUsers()
    const modifyActivateAllAdminUsers = useActivateAllDisabledUsers()
    const handleDelete = async (admin: AdminDetails) => {
        try {
            await removeAdminMutation.mutateAsync({
                username: admin.username
            });
            toast({
                title: t("success", {defaultValue: "Success"}),
                description: t("admins.deleteSuccess", {
                    name: admin.username,
                    defaultValue: "Admin «{{name}}» has been deleted successfully"
                })
            });
            // Invalidate nodes queries
            queryClient.invalidateQueries({queryKey: ['/api/admins']});
        } catch (error) {
            toast({
                title: t("error", {defaultValue: "Error"}),
                description: t("admins.deleteFailed", {
                    name: admin.username,
                    defaultValue: "Failed to delete node «{{name}}»"
                }),
                variant: "destructive"
            });
        }
    };

    const handleToggleStatus = async (admin: AdminDetails, checked: boolean) => {
        try {
            if (!admin.is_disabled && checked) {
                await modifyDisableAllAdminUsers.mutateAsync({
                    username: admin.username
                })
            }

            if (admin.is_disabled && checked) {
                await modifyActivateAllAdminUsers.mutateAsync({
                    username: admin.username
                })
            }
            await modifyAdminMutation.mutateAsync({
                username: admin.username,
                data: {
                    is_sudo: admin.is_sudo,
                    is_disabled: !admin.is_disabled,
                    discord_webhook: admin.discord_webhook,
                    sub_template: admin.sub_template,
                    telegram_id: admin.telegram_id,
                    support_url: admin.support_url,
                    profile_title: admin.profile_title,
                    sub_domain: admin.sub_domain,
                    password: ""
                }
            })

            toast({
                title: t('success', {defaultValue: 'Success'}),
                description: t(admin.is_disabled ? 'admins.enableSuccess' : 'admins.disableSuccess', {
                    name: admin.username,
                    defaultValue: `Admin "{name}" has been ${admin.is_disabled ? 'enabled' : 'disabled'} successfully`
                })
            })

            // Invalidate nodes queries
            queryClient.invalidateQueries({
                queryKey: ["/api/admins"],
            })

        } catch (error) {
            toast({
                title: t('error', {defaultValue: 'Error'}),
                description: t(admin.is_disabled ? 'admins.enableFailed' : 'admins.disableFailed', {
                    name: admin.username,
                    defaultValue: `Failed to ${admin.is_disabled ? 'enable' : 'disable'} admin "{name}"`
                }),
                variant: "destructive"
            })
        }
    }

    const handleEdit = (admin: AdminDetails) => {
        setEditingAdmin(admin)
        form.reset({
            username: admin.username,
            is_sudo: admin.is_sudo,
            is_disabled: admin.is_disabled || undefined,
            discord_webhook: admin.discord_webhook || "",
            sub_template: admin.sub_template || "",
            telegram_id: admin.telegram_id || undefined,
            support_url: admin.support_url || "",
            profile_title: admin.profile_title || "",
            sub_domain: admin.sub_domain || "",
            password: ""

        })
        setIsDialogOpen(true)
    }


    return (
        <div className="flex flex-col gap-2 w-full items-start">
            <PageHeader
                title="admins.title"
                description="admins.description"
                buttonIcon={Plus}
                buttonText="admins.createAdmin"
                onButtonClick={() => setIsDialogOpen(true)}
            />
            <Separator/>
            <div className="px-4 w-full pt-2">
                <AdminsStatistics data={admins}/>
                <AdminsTable
                    data={admins}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                />
                <AdminModal
                    isDialogOpen={isDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditingAdmin(null)
                            form.reset(initialDefaultValues)
                        }
                        setIsDialogOpen(open)
                    }}
                    form={form}
                    editingAdmin={!!editingAdmin}
                    editingAdminUserName={editingAdmin?.username || ""}
                />
            </div>
        </div>
    )
}