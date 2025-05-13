import { z } from "zod";
import {
    ShadowsocksMethods,
    useCreateUserTemplate,
    useModifyUserTemplate,
    UserStatusCreate,
    XTLSFlows,
    GroupResponse,
    UserDataLimitResetStrategy, useGetAllGroups
} from '@/service/api'
import { UseFormReturn } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import useDirDetection from "@/hooks/use-dir-detection.tsx";
import { toast } from "@/hooks/use-toast.ts";
import { queryClient } from "@/utils/query-client.ts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Check } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import GroupFilterBar from "@/components/templates/GroupsFilter.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { useNavigate } from "react-router";

export const userTemplateFormSchema = z.object({
    name: z.string().min(1, { message: 'validation.required' }),
    status: z.enum([UserStatusCreate.active, UserStatusCreate.on_hold]).default(UserStatusCreate.active),
    username_prefix: z.string().optional(),
    username_suffix: z.string().optional(),
    data_limit: z.number().optional(),
    expire_duration: z.number().optional(),
    on_hold_timeout: z.number().optional(),
    method: z.enum([ShadowsocksMethods["aes-128-gcm"], ShadowsocksMethods["aes-256-gcm"], ShadowsocksMethods["chacha20-ietf-poly1305"], ShadowsocksMethods["xchacha20-poly1305"]]).optional(),
    flow: z.enum([XTLSFlows[""], XTLSFlows["xtls-rprx-vision"]]).optional(),
    groups: z.array(z.number()).min(1, { message: 'validation.required' }),
    resetUsages: z.boolean().optional().default(false),
    data_limit_reset_strategy: z.enum([UserDataLimitResetStrategy["month"], UserDataLimitResetStrategy["day"], UserDataLimitResetStrategy["week"], UserDataLimitResetStrategy["no_reset"], UserDataLimitResetStrategy["week"], UserDataLimitResetStrategy["year"]]).optional(),
})

export type UserTemplatesFromValue = z.infer<typeof userTemplateFormSchema>

interface UserTemplatesModalprops {
    isDialogOpen: boolean
    onOpenChange: (open: boolean) => void
    form: UseFormReturn<UserTemplatesFromValue>
    editingUserTemplate: boolean
    editingUserTemplateId?: number
}

export default function UserTemplateModal({
    isDialogOpen,
    onOpenChange,
    form,
    editingUserTemplate,
    editingUserTemplateId
}: UserTemplatesModalprops) {
    const { t } = useTranslation()
    const dir = useDirDetection()
    const addUserTemplateMutation = useCreateUserTemplate()
    const modifyUserTemplateMutation = useModifyUserTemplate()
    const [filteredGroups, setFilteredGroups] = useState<GroupResponse[]>();
    const { data } = useGetAllGroups({})
    const [checkGroups, setCheckGroups] = useState(false)
    const [timeType, setTimeType] = useState<"seconds" | "hours" | "days">("seconds")
    const navigate = useNavigate()

    // Initialize filteredGroups when data is available
    useEffect(() => {
        if (data?.groups) {
            setFilteredGroups(data.groups);
        }
    }, [data]);

    const checkGroupsExist = useCallback(() => {
        if (!data?.groups || data.groups.length === 0) {
            setCheckGroups(false);
            return;
        }
        setCheckGroups(true);
    }, [data]);

    useEffect(() => {
        if (isDialogOpen) {
            checkGroupsExist();
        }
    }, [isDialogOpen, checkGroupsExist]);

    const onSubmit = async (values: UserTemplatesFromValue) => {
        try {
            // Build payload according to UserTemplateCreate interface
            const submitData = {
                name: values.name,
                data_limit: values.data_limit,
                expire_duration: values.expire_duration,
                username_prefix: values.username_prefix,
                username_suffix: values.username_suffix,
                group_ids: values.groups, // map groups to group_ids
                status: values.status,
                reset_usages: values.resetUsages,
                on_hold_timeout: values.status === UserStatusCreate.on_hold ? values.on_hold_timeout : undefined,
                data_limit_reset_strategy: values.resetUsages ? values.data_limit_reset_strategy : undefined,
                extra_settings: (values.method || values.flow)
                  ? {
                      method: values.method,
                      flow: values.flow,
                    }
                  : undefined,
            };

            if (editingUserTemplate && editingUserTemplateId) {
                await modifyUserTemplateMutation.mutateAsync({
                    templateId: editingUserTemplateId,
                    data: submitData
                })
                toast({
                    title: t('success', { defaultValue: 'Success' }),
                    description: t('templates.editSuccess', {
                        name: values.name,
                        defaultValue: 'User Templates «{name}» has been updated successfully'
                    })
                })
            } else {
                await addUserTemplateMutation.mutateAsync({
                    data: submitData
                })
                toast({
                    title: t('success', { defaultValue: 'Success' }),
                    description: t('templates.createSuccess', {
                        name: values.name,
                        defaultValue: 'User Templates «{name}» has been created successfully'
                    })
                })
            }

            // Invalidate nodes queries after successful operation
            queryClient.invalidateQueries({ queryKey: ['/api/user_templates'] });
            onOpenChange(false)
            form.reset()
        } catch (error: any) {
            console.error('User Templates operation failed:', error)
            toast({
                title: t('error', { defaultValue: 'Error' }),
                description: t(editingUserTemplate ? 'templates.editFailed' : 'templates.createFailed', {
                    name: values.name,
                    error: error?.message || '',
                    defaultValue: `Failed to ${editingUserTemplate ? 'update' : 'create'} user template «{name}». {error}`
                }),
                variant: "destructive"
            })
        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1000px] h-full sm:h-auto">
                <DialogHeader>
                    <DialogTitle className={cn("text-xl text-start font-semibold", dir === "rtl" && "sm:text-right")}>
                        {editingUserTemplate ? t('editUserTemplateModal.title') : t('userTemplateModal.title')}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
                        <div
                            className="max-h-[80vh] overflow-y-auto pr-4 -mr-4 sm:max-h-[75vh] flex flex-col sm:flex-row items-start gap-4 px-2">
                            <div className="flex-1 space-y-4 w-full">
                                <div className="flex flex-row justify-between gap-1 w-full items-center">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('templates.name')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('templates.name')} {...field}
                                                        className="min-w-40 sm:w-72" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem className='w-full'>
                                                <FormLabel>{t('templates.status')}</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Active" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem
                                                            value={UserStatusCreate.active}>Active</SelectItem>
                                                        <SelectItem
                                                            value={UserStatusCreate.on_hold}>OnHold</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="username_prefix"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('templates.prefix')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    placeholder={t('templates.prefix')}
                                                    {...field}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="username_suffix"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('templates.suffix')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    placeholder={t('templates.suffix')}
                                                    {...field}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="data_limit"
                                    render={({ field }) => (
                                        <FormItem className='flex-1'>
                                            <FormLabel>{t('templates.dataLimit')}</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        placeholder={t('templates.dataLimit')}
                                                        {...field}
                                                        onChange={(e) => {
                                                            const value = parseInt(e.target.value);
                                                            // Convert GB to bytes (1 GB = 1024 * 1024 * 1024 bytes)
                                                            field.onChange(value ? value * 1024 * 1024 * 1024 : 0);
                                                        }}
                                                        value={field.value ? Math.round(field.value / (1024 * 1024 * 1024)) : ''}
                                                        className="pr-10"
                                                    />
                                                    <span
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">GB</span>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="resetUsages"
                                    render={({ field }) => (
                                        <FormItem className='flex-1'>
                                            <div className="flex-row justify-between items-center flex">
                                                <FormLabel>{t('templates.resetUsage')}</FormLabel>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </div>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="data_limit_reset_strategy"
                                    render={({ field }) => {
                                        // Only show if resetUsages is enabled
                                        const resetUsages = form.watch("resetUsages");
                                        if (!resetUsages) {
                                            return <></>;
                                        }
                                        return (
                                            <FormItem className='flex-1'>
                                                <FormLabel>{t('templates.userDataLimitStrategy')}</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value={UserDataLimitResetStrategy["no_reset"]}>No
                                                            Reset</SelectItem>
                                                        <SelectItem
                                                            value={UserDataLimitResetStrategy["day"]}>Day</SelectItem>
                                                        <SelectItem
                                                            value={UserDataLimitResetStrategy["week"]}>Week</SelectItem>
                                                        <SelectItem
                                                            value={UserDataLimitResetStrategy["month"]}>Month</SelectItem>
                                                        <SelectItem
                                                            value={UserDataLimitResetStrategy["year"]}>Year</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="expire_duration"
                                    render={({ field }) => (
                                        <FormItem className='flex-1'>
                                            <FormLabel>{t('templates.expire')}</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        placeholder={t('templates.expire')}
                                                        {...field}
                                                        onChange={(e) => {
                                                            const value = parseInt(e.target.value);
                                                            field.onChange(value ? value * 24 * 60 * 60 : 0);
                                                        }}
                                                        value={field.value ? Math.round(field.value / (24 * 60 * 60)) : ''}
                                                        className="pr-14"
                                                    />
                                                    <span
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">Days</span>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="on_hold_timeout"
                                    render={({ field }) => {
                                        const changeValue = (value: number | undefined) => {
                                            if (!value)
                                                return value
                                            switch (timeType) {
                                                case "seconds":
                                                    return value;
                                                case "hours":
                                                    return Math.round(value / 60 / 60)
                                                case "days":
                                                    return Math.round(value / 60 / 60 / 24)
                                                default:
                                                    return value;
                                            }
                                        }
                                        // Only show if status is on_hold
                                        const status = form.watch("status");
                                        if (status !== UserStatusCreate.on_hold) {
                                            return <></>;
                                        }
                                        return (
                                            <FormItem className='flex-1'>
                                                <FormLabel>{t('templates.onHoldTimeout')}</FormLabel>
                                                <FormControl>
                                                    <div
                                                        className="rounded-md border border-border flex flex-row overflow-hidden">
                                                        <div className="flex-[3]">
                                                            <Input
                                                                type="number"
                                                                placeholder={t('templates.onHoldTimeout')}
                                                                {...field}
                                                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                                                value={changeValue(field.value)}
                                                                className="flex-[3] rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                            />
                                                        </div>
                                                        <div className="flex-[2]">
                                                            <Select value={timeType} onValueChange={(v) => setTimeType(v as any)}>
                                                                <SelectTrigger
                                                                    className="w-full rounded-none border-0 focus:ring-0 focus:ring-offset-0">
                                                                    <SelectValue placeholder="Second" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="days">Days</SelectItem>
                                                                    <SelectItem value="hours">Hours</SelectItem>
                                                                    <SelectItem value="seconds">Seconds</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                            </div>
                            <div className="flex-1 space-y-4 w-full">

                                <FormField
                                    control={form.control}
                                    name="method"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('templates.method')}</FormLabel>
                                            <Select
                                                onValueChange={(value) => field.onChange(value === "null" ? undefined : value)}
                                                value={field.value ?? "null"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Method" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="null">None</SelectItem>
                                                    <SelectItem
                                                        value={ShadowsocksMethods["aes-128-gcm"]}>aes-128-gcm</SelectItem>
                                                    <SelectItem
                                                        value={ShadowsocksMethods["aes-256-gcm"]}>aes-256-gcm</SelectItem>
                                                    <SelectItem
                                                        value={ShadowsocksMethods["chacha20-ietf-poly1305"]}>chacha20-ietf-poly1305</SelectItem>
                                                    <SelectItem
                                                        value={ShadowsocksMethods["xchacha20-poly1305"]}>xchacha20-poly1305</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="flow"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('templates.flow')}</FormLabel>
                                            <Select
                                                onValueChange={(value) => field.onChange(value === "null" ? undefined : value)}
                                                value={field.value ?? "null"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="null">None</SelectItem>
                                                    <SelectItem
                                                        value={XTLSFlows["xtls-rprx-vision"]}>xtls-rprx-vision</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                <FormField
                                    control={form.control}
                                    name="groups"
                                    render={({ field }) => (
                                        <FormItem className="flex-1 w-full mb-6 md:mb-0">
                                            <FormLabel>{t('templates.groups')}</FormLabel>
                                            <GroupFilterBar onFilteredGroups={setFilteredGroups} data={data} />
                                            <FormControl>
                                                {checkGroups ? (
                                                    <div className="flex flex-col space-y-4 pb-2">
                                                        {filteredGroups?.map((group) => (
                                                            <div
                                                                key={group.id}
                                                                className={cn(
                                                                    "flex items-center border justify-between p-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors",
                                                                    field.value?.includes(group.id) ? "bg-sidebar/accent border-foreground" : "bg-background border"
                                                                )}
                                                                onClick={() => {
                                                                    const newValue = field.value || [];
                                                                    const index = newValue.indexOf(group.id);
                                                                    if (index === -1) {
                                                                        field.onChange([...newValue, group.id]);
                                                                    } else {
                                                                        field.onChange(newValue.filter(id => id !== group.id));
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn(
                                                                        "w-4 h-4 border rounded flex items-center justify-center",
                                                                        field.value?.includes(group.id) ? "bg-foreground border-foreground" : ""
                                                                    )}>
                                                                        {field.value?.includes(group.id) && <Check
                                                                            className="h-3 w-3 text-primary-foreground" />}
                                                                    </div>
                                                                    <span className="text-sm">{group.name}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="flex flex-col gap-4 w-full border-yellow-500 border p-4 rounded-md">
                                                        <span
                                                            className="text-sm ftext-foreground font-bold text-yellow-500">
                                                            {t('warning')}
                                                        </span>
                                                        <span className="text-sm font-medium text-foreground">
                                                            <Trans i18nKey={'templates.groupsExistingWarning'}
                                                                components={{
                                                                    a: (
                                                                        <a
                                                                            href="/groups"
                                                                            className="font-bold text-primary hover:underline"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                navigate('/groups');
                                                                            }}
                                                                        />
                                                                    )
                                                                }}
                                                            >
                                                            </Trans>
                                                        </span>
                                                    </div>
                                                )}
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4 mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <Button type="submit" disabled={!checkGroups}>
                                {editingUserTemplate ? t('save') : t('create')}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}