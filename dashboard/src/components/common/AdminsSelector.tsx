import { Checkbox } from '@/components/ui/checkbox'
import { FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetAdmins } from '@/service/api'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Control, FieldPath, FieldValues, useController } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

interface AdminSelectorProps<T extends FieldValues> {
    control: Control<T>
    name: FieldPath<T>
    onAdminsChange?: (admins: (number | string)[]) => void
    disabled?: boolean
}

export default function AdminsSelector<T extends FieldValues>({ control, name, onAdminsChange, disabled = false }: AdminSelectorProps<T>) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')

    const { field } = useController({
        control,
        name,
    })

    const { data: adminsData, isLoading: adminsLoading } = useGetAdmins(undefined, {
        query: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            refetchOnReconnect: true,
        },
    })

    const selectedAdmins = (field.value as string[]) || []
    const filteredAdmins = (adminsData || []).filter((admin: any) => admin.username.toLowerCase().includes(searchQuery.toLowerCase()))

    const handleSelectAll = (checked: boolean) => {
        const newAdmins = checked ? filteredAdmins.map((admin: any) => admin.username) : []
        field.onChange(newAdmins)
        onAdminsChange?.(newAdmins)
    }

    const handleAdminChange = (checked: boolean, adminUsername: string) => {
        const newAdmins = checked ? [...selectedAdmins, adminUsername] : selectedAdmins.filter(username => username !== adminUsername)

        field.onChange(newAdmins)
        onAdminsChange?.(newAdmins)
    }

    if (adminsLoading) {
        return (
            <FormItem>
                <div className="space-y-4 pt-4">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Skeleton className="h-10 w-full pl-8" />
                    </div>
                    <Skeleton className="h-12 w-full" />
                    <div className="max-h-[200px] space-y-2 overflow-y-auto rounded-md border p-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="flex items-center gap-2 rounded-md p-2">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        ))}
                    </div>
                </div>
            </FormItem>
        )
    }

    return (
        <FormItem>
            <div className="space-y-4 pt-4">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('search', { defaultValue: 'Search' }) + ' ' + t('admins.title', { defaultValue: 'Admins' })}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-8"
                        disabled={disabled}
                    />
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 hover:bg-accent">
                    <Checkbox checked={filteredAdmins.length > 0 && selectedAdmins.length === filteredAdmins.length} onCheckedChange={handleSelectAll} disabled={disabled} />
                    <span className="text-sm font-medium">{t('selectAll', { defaultValue: 'Select All' })}</span>
                </label>
                <div className="max-h-[200px] space-y-2 overflow-y-auto rounded-md border p-2">
                    {filteredAdmins.length === 0 ? (
                        <div className="flex w-full flex-col gap-4 rounded-md border border-yellow-500 p-4">
                            <span className="text-sm font-bold text-yellow-500">{t('warning')}</span>
                            <span className="text-sm font-medium text-foreground">
                <Trans
                    i18nKey={'admins.adminsExistingWarning'}
                    components={{
                        a: (
                            <a
                                href="/admins"
                                className="font-bold text-primary hover:underline"
                                onClick={e => {
                                    e.preventDefault()
                                    navigate('/admins')
                                }}
                            />
                        ),
                    }}
                />
              </span>
                        </div>
                    ) : (
                        filteredAdmins.map((admin: any) => (
                            <label key={admin.username} className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-accent">
                                <Checkbox checked={selectedAdmins.includes(admin.username)} onCheckedChange={checked => handleAdminChange(!!checked, admin.username)} disabled={disabled} />
                                <span className="text-sm">{admin.username}</span>
                            </label>
                        ))
                    )}
                </div>
                {selectedAdmins.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                        {t('admins.selectedAdmins', {
                            count: selectedAdmins.length,
                            defaultValue: '{{count}} admins selected',
                        })}
                    </div>
                )}
            </div>
            <FormMessage />
        </FormItem>
    )
}
