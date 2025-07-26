import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from 'react-i18next'
import { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { z } from 'zod'
import { useCreateAdmin, useModifyAdmin } from '@/service/api'
import { toast } from 'sonner'
import { queryClient } from '@/utils/query-client.ts'
import { PasswordInput } from '@/components/ui/password-input'
import useDynamicErrorHandler from "@/hooks/use-dynamic-errors.ts";
import { LoaderButton } from '@/components/ui/loader-button'
import useDirDetection from '@/hooks/use-dir-detection'

interface AdminModalProps {
    isDialogOpen: boolean
    onOpenChange: (open: boolean) => void
    editingAdmin?: boolean
    editingAdminUserName: string
    form: UseFormReturn<AdminFormValues>
}

const passwordValidation = z.string().refine(
    value => {
        if (!value) return false // Don't allow empty passwords

        // Check in priority order
        if (value.length < 12) {
            return false
        }
        if ((value.match(/\d/g) || []).length < 2) {
            return false
        }
        if ((value.match(/[A-Z]/g) || []).length < 2) {
            return false
        }
        if ((value.match(/[a-z]/g) || []).length < 2) {
            return false
        }
        return /[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/~`]/.test(value)
    },
    value => {
        // Return specific error message based on the first validation that fails
        if (!value) {
            return { message: 'Password is required' }
        }
        if (value.length < 12) {
            return { message: 'Password must be at least 12 characters long' }
        }
        if ((value.match(/\d/g) || []).length < 2) {
            return { message: 'Password must contain at least 2 digits' }
        }
        if ((value.match(/[A-Z]/g) || []).length < 2) {
            return { message: 'Password must contain at least 2 uppercase letters' }
        }
        if ((value.match(/[a-z]/g) || []).length < 2) {
            return { message: 'Password must contain at least 2 lowercase letters' }
        }
        if (!/[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/~`]/.test(value)) {
            return { message: 'Password must contain at least one special character' }
        }
        return { message: 'Invalid password' }
    },
)

export const adminFormSchema = z
    .object({
        username: z.string().min(1, 'Username is required'),
        password: z.string().optional(),
        passwordConfirm: z.string().optional(),
        is_sudo: z.boolean().default(false),
        is_disabled: z.boolean().optional(),
        discord_webhook: z.string().optional(),
        sub_domain: z.string().optional(),
        sub_template: z.string().optional(),
        support_url: z.string().optional(),
        telegram_id: z.number().optional(),
        profile_title: z.string().optional(),
        discord_id: z.number().optional(),
    })
    .superRefine((data, ctx) => {
        // Only validate password if it's provided (for editing) or if it's a new admin
        if (data.password || !data.username) {
            if (!data.password) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Password is required',
                    path: ['password'],
                })
                return
            }

            // Validate password strength
            const passwordResult = passwordValidation.safeParse(data.password)
            if (!passwordResult.success) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: passwordResult.error.errors[0].message,
                    path: ['password'],
                })
                return
            }

            // Validate password confirmation
            if (data.password !== data.passwordConfirm) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Passwords do not match',
                    path: ['passwordConfirm'],
                })
            }
        }
    })

export type AdminFormValues = z.infer<typeof adminFormSchema>
export default function AdminModal({
    isDialogOpen,
    onOpenChange,
    editingAdminUserName,
    editingAdmin,
    form
}: AdminModalProps) {
    const { t } = useTranslation()
    const dir = useDirDetection()
    const handleError = useDynamicErrorHandler();
    const addAdminMutation = useCreateAdmin()
    const modifyAdminMutation = useModifyAdmin()

    // Ensure form is cleared when modal is closed
    const handleClose = (open: boolean) => {
        if (!open) {
            form.reset();
        }
        onOpenChange(open);
    }

    const onSubmit = async (values: AdminFormValues) => {
        try {
            const editData = {
                is_sudo: values.is_sudo,
                password: values.password || undefined,
                is_disabled: values.is_disabled,
                discord_webhook: values.discord_webhook,
                sub_domain: values.sub_domain,
                sub_template: values.sub_template,
                support_url: values.support_url,
                telegram_id: values.telegram_id,
                profile_title: values.profile_title,
                discord_id: values.discord_id,
            }
            if (editingAdmin && editingAdminUserName) {
                await modifyAdminMutation.mutateAsync({
                    username: editingAdminUserName,
                    data: editData,
                })
                toast.success(t('admins.editSuccess', {
                    name: values.username,
                    defaultValue: 'Admin «{{name}}» has been updated successfully',
                }))
            } else {
                if (!values.password) return
                const createData = {
                    ...values,
                    password: values.password, // Ensure password is present
                }
                await addAdminMutation.mutateAsync({
                    data: createData,
                })
                toast.success(t('admins.createSuccess', {
                    name: values.username,
                    defaultValue: 'Admin «{{name}}» has been created successfully',
                }))
            }
            queryClient.invalidateQueries({ queryKey: ['/api/admins'] })
            onOpenChange(false)
            form.reset()
        } catch (error: any) {
            const fields = ['username', 'password', 'passwordConfirm', 'is_sudo', 'is_disabled', 'discord_webhook', 'sub_domain', 'sub_template', 'support_url', 'telegram_id', 'profile_title', 'discord_id']
            handleError({ error, fields, form, contextKey: "admins" })
        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-[750px] h-full sm:h-auto " onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className={`${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir}>{editingAdmin ? t('admins.editAdmin') : t('admins.createAdmin')}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="max-h-[80dvh] overflow-y-auto pr-4 -mr-4 sm:max-h-[75dvh] px-2">
                            <div className="flex flex-col sm:flex-row items-start gap-4 pb-4">
                                <div className="flex-1  w-full">
                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => {
                                            const hasError = !!form.formState.errors.username
                                            return (
                                                <FormItem className="min-h-[100px]">
                                                    <FormLabel>{t('admins.username')}</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder={t('admins.enterUsername')}
                                                            disabled={editingAdmin} isError={hasError} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )
                                        }}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => {
                                            const hasError = !!form.formState.errors.password
                                            return (
                                                <FormItem className="min-h-[100px]">
                                                    <FormLabel>{t('admins.password')}</FormLabel>
                                                    <FormControl>
                                                        <PasswordInput
                                                            placeholder={t('admins.enterPassword')}
                                                            isError={hasError}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )
                                        }}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="passwordConfirm"
                                        render={({ field }) => (
                                            <FormItem className="min-h-[100px]">
                                                <FormLabel>{t('admins.passwordConfirm')}</FormLabel>
                                                <FormControl>
                                                    <PasswordInput
                                                        placeholder={t('admins.enterPasswordConfirm')}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={'telegram_id'}
                                        render={({ field }) => (
                                            <FormItem className="min-h-[100px]">
                                                <FormLabel>{t('admins.telegramId')}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder={t('Telegram ID (e.g. 36548974)')}
                                                        onChange={e => {
                                                            const value = e.target.value
                                                            field.onChange(value ? parseInt(value) : 0)
                                                        }}
                                                        value={field.value ? field.value : ''}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={'discord_id'}
                                        render={({ field }) => (
                                            <FormItem className="min-h-[100px]">
                                                <FormLabel>{t('admins.discordId')}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder={t('admins.discordId')}
                                                        onChange={e => {
                                                            const value = e.target.value
                                                            field.onChange(value ? parseInt(value) : 0)
                                                        }}
                                                        value={field.value ? field.value : ''}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="flex-1  w-full">
                                    <FormField
                                        control={form.control}
                                        name={'discord_webhook'}
                                        render={({ field }) => (
                                            <FormItem className="min-h-[100px]">
                                                <FormLabel>{t('admins.discord')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('admins.discord')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={'support_url'}
                                        render={({ field }) => (
                                            <FormItem className="min-h-[100px]">
                                                <FormLabel>{t('admins.supportUrl')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('admins.supportUrl')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={'profile_title'}
                                        render={({ field }) => (
                                            <FormItem className="min-h-[100px]">
                                                <FormLabel>{t('admins.profile')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('admins.profile')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={'sub_domain'}
                                        render={({ field }) => (
                                            <FormItem className="min-h-[100px]">
                                                <FormLabel>{t('admins.subDomain')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('admins.subDomain')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={'sub_template'}
                                        render={({ field }) => (
                                            <FormItem className="min-h-[100px]">
                                                <FormLabel>{t('admins.subTemplate')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('admins.subTemplate')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="is_sudo"
                                render={({ field }) => (
                                    <FormItem
                                        className="flex flex-row items-center justify-between rounded-lg border p-4 w-full cursor-pointer"
                                        onClick={() => field.onChange(!field.value)}>
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">{t('admins.sudo')}</FormLabel>
                                        </div>
                                        <FormControl>
                                            <div onClick={e => e.stopPropagation()}>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <LoaderButton
                                type="submit"
                                isLoading={addAdminMutation.isPending || modifyAdminMutation.isPending}
                                loadingText={editingAdmin ? t('modifying') : t('creating')}
                            >
                                {editingAdmin ? t('modify') : t('create')}
                            </LoaderButton>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
