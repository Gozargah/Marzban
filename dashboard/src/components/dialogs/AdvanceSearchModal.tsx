import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog.tsx";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form.tsx";
import {Switch} from "@/components/ui/switch.tsx";
import {Button} from "@/components/ui/button.tsx";
import {LoaderButton} from "@/components/ui/loader-button.tsx";
import useDirDetection from "@/hooks/use-dir-detection.tsx";
import {UseFormReturn} from "react-hook-form";
import {useTranslation} from "react-i18next";
import {z} from "zod";
import {useGetAdmins, useGetAllGroups} from "@/service/api";
import {Checkbox} from "@/components/ui/checkbox.tsx";
import {ChevronUp} from "lucide-react";

interface AdvanceSearchModalProps {
    isDialogOpen: boolean
    onOpenChange: (open: boolean) => void
    form: UseFormReturn<AdvanceSearchFormValue>
}

export const advanceSearchFormSchema = z.object({
    is_username: z.boolean().default(true),
    is_protocol: z.boolean().default(false),
    admins: z.array(z.number()).optional(),
    groups: z.array(z.number()).optional(),
    status: z.array(z.enum(
        ['active', 'on_hold', 'disable', 'expired', 'limited']
    )).optional(),
})

export type AdvanceSearchFormValue = z.infer<typeof advanceSearchFormSchema>
export default function AdvanceSearchModal({
                                               isDialogOpen,
                                               onOpenChange,
                                               form
                                           }: AdvanceSearchModalProps) {
    const dir = useDirDetection()
    const {t} = useTranslation()
    const {data: groupsData, isLoading: groupsLoading} = useGetAllGroups()
    const {data: adminData, isLoading: adminsLoading} = useGetAdmins()

    return (
        <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[650px] h-full sm:h-auto " onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className={`${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                 dir={dir}>{t('advanceSearch.title')}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(() => {
                    })} className="space-y-4">
                        <div className="max-h-[80dvh] overflow-y-auto pr-4 -mr-4 sm:max-h-[75dvh] px-2">
                            <div className="flex flex-col w-full flex-1 items-start gap-4 pb-4">
                                    <FormField
                                        control={form.control}
                                        name="is_username"
                                        render={({field}) => {
                                            return (
                                                <FormItem className="flex-1 justify-between flex w-full items-center">
                                                    <FormLabel>{t('advanceSearch.byUsername')}</FormLabel>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange}/>
                                                    </FormControl>
                                                    <FormMessage/>
                                                </FormItem>
                                            )
                                        }}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="is_protocol"
                                        render={({field}) => {
                                            return (
                                                <FormItem className="flex-1 w-full justify-between flex items-center">
                                                    <FormLabel>{t('advanceSearch.byProtocol')}</FormLabel>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange}/>
                                                    </FormControl>
                                                    <FormMessage/>
                                                </FormItem>
                                            )
                                        }}
                                    />
                                    {groupsLoading ? (
                                            <div>{t('Loading...', {defaultValue: 'Loading...'})}</div>
                                        ) :
                                        (<FormField
                                            control={form.control}
                                            name="groups"
                                            render={({field}) => {
                                                const selectedGroups = field.value || []
                                                const handleGroupChange = (checked: boolean, groupId: number) => {
                                                    if (checked) {
                                                        field.onChange([...selectedGroups, groupId])
                                                    } else {
                                                        field.onChange(selectedGroups.filter((id: number) => id !== groupId))
                                                    }
                                                }
                                                return (
                                                    <FormItem className="flex-1 w-full">
                                                        <FormLabel>{t('advanceSearch.byGroup')}</FormLabel>
                                                        <FormControl>
                                                            <div className="flex gap-2 flex-col">
                                                                <label
                                                                    className="flex justify-between items-center border border-border gap-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                                                                    <span
                                                                        className="text-sm font-medium">{t('advanceSearch.selectGroup')}</span>
                                                                    <ChevronUp className="w-4 h-4"/>
                                                                </label>
                                                                <div className="border rounded-md">
                                                                    {groupsData?.groups.map((group: any) => (
                                                                        <label key={group.id}
                                                                               className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                                                                            <Checkbox
                                                                                checked={selectedGroups.includes(group.id)}
                                                                                onCheckedChange={checked => handleGroupChange(!!checked, group.id)}/>
                                                                            <span
                                                                                className="text-sm">{group.name}</span>
                                                                        </label>)
                                                                    )}
                                                                </div>
                                                                </div>
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )
                                            }}
                                        />)}
                                {adminsLoading ? (
                                        <div>{t('Loading...', {defaultValue: 'Loading...'})}</div>
                                    ) :
                                    (<FormField
                                            control={form.control}
                                            name="admins"
                                            render={({field}) => {
                                                const selectedAdmins = field.value || []
                                                const handleAdminChange = (checked: boolean, adminId: number) => {
                                                    if (checked) {
                                                        field.onChange([...selectedAdmins, adminId])
                                                    } else {
                                                        field.onChange(selectedAdmins.filter((id: number) => id !== adminId))
                                                    }
                                                }
                                                return (
                                                    <FormItem className="flex-1 w-full">
                                                        <FormLabel>{t('advanceSearch.byAdmin')}</FormLabel>
                                                        <FormControl>
                                                            <div className="flex gap-2 flex-col">
                                                                <label
                                                                    className="flex justify-between items-center border border-border gap-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                                                                    <span
                                                                        className="text-sm font-medium">{t('advanceSearch.selectAdmin')}</span>
                                                                    <ChevronUp className="w-4 h-4"/>
                                                                </label>
                                                                <div className="w-full border rounded-md ">
                                                                    {adminData?.map((admin: any) => (
                                                                        <label key={admin.id}
                                                                               className="flex w-full items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                                                                            <Checkbox
                                                                                checked={selectedAdmins.includes(admin.id)}
                                                                                onCheckedChange={checked => handleAdminChange(!!checked, admin.id)}/>
                                                                            <span
                                                                                className="text-sm">{admin.username}</span>
                                                                        </label>)
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                            )
                                            }}
                                            />)}
                                                <FormField
                                                    control={form.control}
                                                    name="status"
                                                    render={({field}) => {
                                                        const statusOptions = [
                                                            {value: 'active', label: t('advanceSearch.status.active')},
                                                            {value: 'on_hold', label: t('advanceSearch.status.onHold')},
                                                {value: 'disable', label: t('advanceSearch.status.disable')},
                                                {value: 'expired', label: t('advanceSearch.status.expired')},
                                                {value: 'limited', label: t('advanceSearch.status.limited')}
                                            ]
                                            const selectedStatus = field.value || []
                                            const handleStatusChange = (checked: boolean, status: string) => {
                                                if (checked) {
                                                    field.onChange([...selectedStatus, status])
                                                } else {
                                                    field.onChange(selectedStatus.filter((value: string) => value !== status))
                                                }
                                            }
                                            return (
                                                <FormItem className="flex-1 w-full ">
                                                    <FormLabel>{t('advanceSearch.byStatus')}</FormLabel>
                                                    <FormControl>
                                                        <div className="flex gap-2 flex-col">
                                                            <label
                                                                className="flex justify-between items-center border border-border gap-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                                                                    <span
                                                                        className="text-sm font-medium">{t('advanceSearch.selectStatus')}</span>
                                                                <ChevronUp className="w-4 h-4"/>
                                                            </label>
                                                            <div className="border rounded-md">
                                                                {statusOptions?.map((status: any) => (
                                                                    <label key={status.value}
                                                                           className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                                                                        <span className="text-sm">{status.label}</span>
                                                                    </label>)
                                                                )}
                                                            </div>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage/>
                                                </FormItem>
                                                    )
                                                    }}
                                                    />
                                                    </div>
                                                        <div className="flex justify-end gap-2">
                                                            <Button type="button" variant="outline"
                                                                    onClick={() => onOpenChange(false)}>
                                                                {t('cancel')}
                                                            </Button>
                                                            <LoaderButton
                                                                type="submit"
                                                                // isLoading={addAdminMutation.isPending || modifyAdminMutation.isPending}
                                        // loadingText={editingAdmin ? t('modifying') : t('creating')}
                                    >
                                        {t('apply')}
                                    </LoaderButton>
                                </div>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}