import { Checkbox } from '@/components/ui/checkbox'
import { FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetAllGroups } from '@/service/api'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Control, FieldPath, FieldValues, useController } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

interface GroupsSelectorProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  onGroupsChange?: (groups: number[]) => void
  disabled?: boolean
}

export default function GroupsSelector<T extends FieldValues>({ 
  control, 
  name, 
  onGroupsChange,
  disabled = false 
}: GroupsSelectorProps<T>) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const { field } = useController({
    control,
    name,
  })

  const { data: groupsData, isLoading: groupsLoading } = useGetAllGroups(undefined, {
    query: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  })

  const selectedGroups = (field.value as number[]) || []
  const filteredGroups = (groupsData?.groups || []).filter((group: any) => group.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleSelectAll = (checked: boolean) => {
    const newGroups = checked ? filteredGroups.map((group: any) => group.id) : []
    field.onChange(newGroups)
    onGroupsChange?.(newGroups)
  }

  const handleGroupChange = (checked: boolean, groupId: number) => {
    const newGroups = checked ? [...selectedGroups, groupId] : selectedGroups.filter(id => id !== groupId)

    field.onChange(newGroups)
    onGroupsChange?.(newGroups)
  }

  if (groupsLoading) {
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
            placeholder={t('search', { defaultValue: 'Search' }) + ' ' + t('groups', { defaultValue: 'groups' })}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8"
            disabled={disabled}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 hover:bg-accent">
          <Checkbox checked={filteredGroups.length > 0 && selectedGroups.length === filteredGroups.length} onCheckedChange={handleSelectAll} disabled={disabled} />
          <span className="text-sm font-medium">{t('selectAll', { defaultValue: 'Select All' })}</span>
        </label>
        <div className="max-h-[200px] space-y-2 overflow-y-auto rounded-md border p-2">
          {filteredGroups.length === 0 ? (
            <div className="flex w-full flex-col gap-4 rounded-md border border-yellow-500 p-4">
              <span className="text-sm font-bold text-yellow-500">{t('warning')}</span>
              <span className="text-sm font-medium text-foreground">
                <Trans
                  i18nKey={'templates.groupsExistingWarning'}
                  components={{
                    a: (
                      <a
                        href="/groups"
                        className="font-bold text-primary hover:underline"
                        onClick={e => {
                          e.preventDefault()
                          navigate('/groups')
                        }}
                      />
                    ),
                  }}
                />
              </span>
            </div>
          ) : (
            filteredGroups.map((group: any) => (
              <label key={group.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-accent">
                <Checkbox checked={selectedGroups.includes(group.id)} onCheckedChange={checked => handleGroupChange(!!checked, group.id)} disabled={disabled} />
                <span className="text-sm">{group.name}</span>
              </label>
            ))
          )}
        </div>
        {selectedGroups.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {t('userDialog.selectedGroups', {
              count: selectedGroups.length,
              defaultValue: '{{count}} groups selected',
            })}
          </div>
        )}
      </div>
      <FormMessage />
    </FormItem>
  )
}
