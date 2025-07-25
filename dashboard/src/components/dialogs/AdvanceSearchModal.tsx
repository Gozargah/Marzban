import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form.tsx'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch.tsx'
import { Button } from '@/components/ui/button.tsx'
import { LoaderButton } from '@/components/ui/loader-button.tsx'
import useDirDetection from '@/hooks/use-dir-detection.tsx'
import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx'
import GroupsSelector from '@/components/common/GroupsSelector.tsx'
import AdminsSelector from "@/components/common/AdminsSelector.tsx";

interface AdvanceSearchModalProps {
    isDialogOpen: boolean
    onOpenChange: (open: boolean) => void
    form: UseFormReturn<AdvanceSearchFormValue>
    onSubmit: (values: AdvanceSearchFormValue) => void
}

export const advanceSearchFormSchema = z.object({
    is_username: z.boolean().default(true),
    is_protocol: z.boolean().default(false),
    admin: z.array(z.string()).optional(),
    group: z.array(z.number()).optional(),
    status: z
        .array(z.enum(['0', 'active', 'on_hold', 'disabled', 'expired', 'limited']))
        .default(['0'])
        .optional(),
})

export type AdvanceSearchFormValue = z.infer<typeof advanceSearchFormSchema>
export default function AdvanceSearchModal({ isDialogOpen, onOpenChange, form, onSubmit }: AdvanceSearchModalProps) {
    const dir = useDirDetection()
    const { t } = useTranslation()

    return (
        <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-full max-w-[650px] flex-col justify-start sm:h-auto" onOpenAutoFocus={e => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className={`${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir}>
                        {t('advanceSearch.title')}
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col justify-between space-y-4">
                        <div className="-mr-4 max-h-[80dvh] overflow-y-auto px-2 pr-4 sm:max-h-[75dvh]">
                            <div className="flex w-full flex-1 flex-col items-start gap-4 pb-4">
                                <FormField
                                    control={form.control}
                                    name="is_username"
                                    render={({ field }) => {
                                        return (
                                            <FormItem className="flex w-full flex-1 items-center justify-between">
                                                <FormLabel>{t('advanceSearch.byUsername')}</FormLabel>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="is_protocol"
                                    render={({ field }) => {
                                        return (
                                            <FormItem className="flex w-full flex-1 items-center justify-between">
                                                <FormLabel>{t('advanceSearch.byProtocol')}</FormLabel>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="group"
                                    render={({ field }) => {
                                        return (
                                            <FormItem className="w-full flex-1">
                                                <FormLabel>{t('advanceSearch.byGroup')}</FormLabel>
                                                <FormControl>
                                                    <Accordion type="single" collapsible className="w-full">
                                                        <AccordionItem value="group-select" className="border-none [&_[data-state=closed]]:no-underline [&_[data-state=open]]:no-underline">
                                                            <AccordionTrigger className="rounded-md border p-2">{t('advanceSearch.selectGroup')}</AccordionTrigger>
                                                            <AccordionContent>
                                                                <div className="mt-2">
                                                                    <GroupsSelector control={form.control} name="group" onGroupsChange={field.onChange} />
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="admin"
                                    render={({ field }) => {
                                        return (
                                            <FormItem className="w-full flex-1">
                                                <FormLabel>{t('advanceSearch.byAdmin')}</FormLabel>
                                                <FormControl>
                                                    <Accordion type="single" collapsible className="w-full">
                                                        <AccordionItem value="admin-select" className="border-none [&_[data-state=closed]]:no-underline [&_[data-state=open]]:no-underline">
                                                            <AccordionTrigger className="rounded-md border p-2">{t('advanceSearch.selectAdmin')}</AccordionTrigger>
                                                            <AccordionContent>
                                                                <div className="mt-2">
                                                                    <AdminsSelector control={form.control} name="admin" onAdminsChange={field.onChange} />
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => {
                                        const statusOptions = [
                                            { value: '0', label: t('allStatuses') },
                                            { value: 'active', label: t('advanceSearch.status.active') },
                                            { value: 'on_hold', label: t('advanceSearch.status.onHold') },
                                            { value: 'disabled', label: t('advanceSearch.status.disable') },
                                            { value: 'expired', label: t('advanceSearch.status.expired') },
                                            { value: 'limited', label: t('advanceSearch.status.limited') },
                                        ]
                                        // Only allow one status to be selected
                                        const selectedStatus = Array.isArray(field.value) ? field.value[0] : field.value
                                        return (
                                            <FormItem className="w-full flex-1">
                                                <FormLabel>{t('advanceSearch.byStatus')}</FormLabel>
                                                <FormControl>
                                                    <div>
                                                        <Select value={selectedStatus || '0'} onValueChange={value => field.onChange(value === '0' ? [] : [value])} dir={dir}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={t('advanceSearch.selectStatus')} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {statusOptions.map(status => (
                                                                    <SelectItem key={status.value} value={status.value}>
                                                                        {status.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
