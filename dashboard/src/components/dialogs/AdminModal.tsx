import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {Switch} from '@/components/ui/switch'
import {useTranslation} from 'react-i18next'
import {UseFormReturn} from 'react-hook-form'
import {Button} from '@/components/ui/button'
import {z} from "zod";
import {useCreateAdmin, useModifyAdmin} from "@/service/api";
import {toast} from "@/hooks/use-toast.ts";
import {queryClient} from "@/utils/query-client.ts";
import {Eye, EyeOff} from "lucide-react";
import {useState} from "react";

interface AdminModalProps {
    isDialogOpen: boolean
    onOpenChange: (open: boolean) => void
    editingAdmin?: boolean
    editingAdminUserName: string
    form: UseFormReturn<AdminFormValues>
}

const passwordValidation = z.string().refine((value) => {
    if (!value) return false; // Don't allow empty passwords

    // Check in priority order
    if (value.length < 12) {
        return false;
    }
    if ((value.match(/\d/g) || []).length < 2) {
        return false;
    }
    if ((value.match(/[A-Z]/g) || []).length < 2) {
        return false;
    }
    if ((value.match(/[a-z]/g) || []).length < 2) {
        return false;
    }
    return /[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/~`]/.test(value);

}, (value) => {
    // Return specific error message based on the first validation that fails
    if (!value) {
        return {message: "Password is required"};
    }
    if (value.length < 12) {
        return {message: "Password must be at least 12 characters long"};
    }
    if ((value.match(/\d/g) || []).length < 2) {
        return {message: "Password must contain at least 2 digits"};
    }
    if ((value.match(/[A-Z]/g) || []).length < 2) {
        return {message: "Password must contain at least 2 uppercase letters"};
    }
    if ((value.match(/[a-z]/g) || []).length < 2) {
        return {message: "Password must contain at least 2 lowercase letters"};
    }
    if (!/[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/~`]/.test(value)) {
        return {message: "Password must contain at least one special character"};
    }
    return {message: "Invalid password"};
});

export const adminFormSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: passwordValidation,
    passwordConfirm: z.string(),
    is_sudo: z.boolean().default(false),
    is_disabled: z.boolean().optional(),
    discord_webhook: z.string().optional(),
    sub_domain: z.string().optional(),
    sub_template: z.string().optional(),
    support_url: z.string().optional(),
    telegram_id: z.number().optional(),
    profile_title: z.string().optional(),
}).refine((data) => {
    if (!data.password) return true; // Skip validation if password is empty
    return data.password === data.passwordConfirm;
}, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
});

export type AdminFormValues = z.infer<typeof adminFormSchema>
export default function AdminModal({
                                       isDialogOpen,
                                       onOpenChange,
                                       editingAdminUserName,
                                       editingAdmin,
                                       form
                                   }: AdminModalProps) {
    const {t} = useTranslation()
    const addAdminMutation = useCreateAdmin()
    const modifyAdminMutation = useModifyAdmin()
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    const onSubmit = async (values: AdminFormValues) => {
        try {
            if (editingAdmin && editingAdminUserName) {
                await modifyAdminMutation.mutateAsync({
                    username: editingAdminUserName,
                    data: values
                })
                toast({
                    title: t('success', {defaultValue: 'Success'}),
                    description: t('admins.editSuccess', {
                        name: values.username,
                        defaultValue: 'Admin «{{name}}» has been updated successfully'
                    })
                })
            } else {
                await addAdminMutation.mutateAsync({
                    data: values
                })
                toast({
                    title: t('success', {defaultValue: 'Success'}),
                    description: t('admins.createSuccess', {
                        name: values.username,
                        defaultValue: 'Admin «{{name}}» has been created successfully'
                    })
                })
            }
            queryClient.invalidateQueries({queryKey: ['/api/admins']})
            onOpenChange(false)
            form.reset()
        } catch (error: any) {
            console.error('Admin operation failed:', error)
            toast({
                title: t('error', {defaultValue: 'Error'}),
                description: t(editingAdmin ? 'admins.editFailed' : 'admins.createFailed', {
                    name: values.username,
                    error: error?.message || '',
                    defaultValue: `Failed to ${editingAdmin ? 'update' : 'create'} admin «{{name}}». {{error}}`
                }),
                variant: "destructive"
            })
        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingAdmin ? t('admins.editAdmin') : t('admins.createAdmin')}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="username"
                            render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('admins.username')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('admins.enterUsername')} {...field} />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('admins.password')}</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                placeholder={t('admins.enterPassword')}
                                                {...field}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                    </FormControl>

                                    <FormMessage/>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="passwordConfirm"
                            render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('admins.passwordConfirm')}</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                type={showPasswordConfirm ? "text" : "password"}
                                                placeholder={t('admins.enterPasswordConfirm')}
                                                {...field}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                            >
                                                {showPasswordConfirm ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />
                            <FormField control={form.control} name={"telegram_id"} render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('admins.telegramId')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={"Telegram ID (e.g. 36548974)"} {...field} />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name={"discord_webhook"} render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('admins.discord')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('admins.discord')} {...field} />
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}/>
                        <div className="flex flex-row justify-between gap-1 w-full items-center">
                            <FormField control={form.control} name={"support_url"} render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('admins.supportUrl')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('admins.supportUrl')} {...field} className="min-w-28 sm:w-56"/>
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name={"profile_title"} render={({field}) => (
                                <FormItem>
                                    <FormLabel>{t('admins.profile')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('admins.profile')} {...field} className="min-w-24 sm:w-56"/>
                                    </FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}/>
                        </div>
                        <FormField control={form.control} name={"sub_domain"} render={({field}) => (
                            <FormItem>
                                <FormLabel>{t('admins.subDomain')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('admins.subDomain')} {...field} />
                                </FormControl>
                                <FormMessage/>
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name={"sub_template"} render={({field}) => (
                            <FormItem>
                                <FormLabel>{t('admins.subTemplate')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('admins.subTemplate')} {...field} />
                                </FormControl>
                                <FormMessage/>
                            </FormItem>
                        )}/>
                        <FormField
                            control={form.control}
                            name="is_sudo"
                            render={({field}) => (
                                <FormItem
                                    className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">{t('admins.sudo')}</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <Button type="submit">
                                {editingAdmin ? t('save') : t('create')}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
} 