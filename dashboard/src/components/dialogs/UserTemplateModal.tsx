import {z} from "zod";
import {
    ShadowsocksMethods,
    useAddUserTemplate,
    useModifyUserTemplate,
    UserStatusCreate,
    XTLSFlows
} from '@/service/api'
import {UseFormReturn} from "react-hook-form";
import {useTranslation} from "react-i18next";
import useDirDetection from "@/hooks/use-dir-detection.tsx";
import {toast} from "@/hooks/use-toast.ts";
import {queryClient} from "@/utils/query-client.ts";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog.tsx";
import {cn} from "@/lib/utils.ts";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Button} from "@/components/ui/button.tsx";

export const userTemplateFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    status: z.enum([UserStatusCreate.active, UserStatusCreate.on_hold]).default(UserStatusCreate.active),
    username_prefix: z.string().optional(),
    username_suffix: z.string().optional(),
    data_limit: z.number().optional(),
    expire_duration: z.number().optional(),
    on_hold_timeout: z.number().optional(),
    method: z.enum([ShadowsocksMethods["aes-128-gcm"], ShadowsocksMethods["aes-256-gcm"], ShadowsocksMethods["chacha20-ietf-poly1305"], ShadowsocksMethods["xchacha20-poly1305"]]),
    flow: z.enum([XTLSFlows[""], XTLSFlows["xtls-rprx-vision"]]),
    groups: z.array(z.number()).min(1, 'At least one group is required'),
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
    const {t} = useTranslation()
    const dir = useDirDetection()
    const addUserTemplateMutation = useAddUserTemplate()
    const modifyUserTemplateMutation = useModifyUserTemplate()

    const onSubmit = async (values: UserTemplatesFromValue) => {
        try {
            // Convert keep_alive to seconds based on unit

            if (editingUserTemplate && editingUserTemplateId) {
                await modifyUserTemplateMutation.mutateAsync({
                    templateId: editingUserTemplateId,
                    data: values
                })
                toast({
                    title: t('success', {defaultValue: 'Success'}),
                    description: t('templates.editSuccess', {
                        name: values.name,
                        defaultValue: 'User Templates «{name}» has been updated successfully'
                    })
                })
            } else {
                await addUserTemplateMutation.mutateAsync({
                    data: values
                })
                toast({
                    title: t('success', {defaultValue: 'Success'}),
                    description: t('templates.createSuccess', {
                        name: values.name,
                        defaultValue: 'User Templates «{name}» has been created successfully'
                    })
                })
            }

            // Invalidate nodes queries after successful operation
            queryClient.invalidateQueries({queryKey: ['/api/user_template']})
            onOpenChange(false)
            form.reset()
        } catch (error: any) {
            console.error('User Templates operation failed:', error)
            toast({
                title: t('error', {defaultValue: 'Error'}),
                description: t(editingUserTemplate ? 'templates.editFailed' : 'templates.createFailed', {
                    name: values.name,
                    error: error?.message || '',
                    defaultValue: `Failed to ${editingUserTemplate ? 'update' : 'create'} node «{name}». {error}`
                }),
                variant: "destructive"
            })
        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className={cn("text-xl text-start font-semibold", dir === "rtl" && "sm:text-right")}>
                        {editingUserTemplate ? t('editUserTemplateModal.title') : t('userTemplateModal.title')}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col space-y-1">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('templates.name')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('templates.name')} {...field} />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="status"
                            render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('templates.status')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('templates.status')} {...field} />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="username_prefix"
                            render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('templates.prefix')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder={t('templates.prefix')}
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="username_suffix"
                            render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('templates.suffix')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder={t('templates.suffix')}
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="data_limit"
                            render={({field}) => (
                                <FormItem className='flex-1'>
                                    <FormLabel>{t('templates.dataLimit')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            placeholder={t('templates.dataLimit')}
                                            {...field}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="expire_duration"
                            render={({field}) => (
                                <FormItem className='flex-1'>
                                    <FormLabel>{t('templates.expire')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder={t('templates.expire')}
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="on_hold_timeout"
                            render={({field}) => (
                                <FormItem className='flex-1'>
                                    <FormLabel>{t('templates.onHoldTimeout')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder={t('templates.onHoldTimeout')}
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="method"
                            render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('templates.method')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            placeholder={t('templates.method')}
                                            autoComplete="off"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.value)}
                                        />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="flow"
                            render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('templates.flow')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            placeholder={t('templates.flow')}
                                            autoComplete="off"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.value)}
                                        />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}/>

                        <FormField
                            control={form.control}
                            name="groups"
                            render={() => (
                                <FormItem className="flex-1 w-full mb-6 md:mb-0 h-full">
                                    <FormLabel>{t('templates.groups')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            placeholder={t('templates.groups')}
                                            autoComplete="off"
                                        />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <Button type="submit">
                                {editingUserTemplate ? t('save') : t('create')}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}