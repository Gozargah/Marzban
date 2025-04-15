import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'

import PageHeader from '@/components/page-header'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import AdminsTable from '@/components/admins/AdminsTable'
import AdminModal from '@/components/dialogs/AdminModal'
import { useGetAdmins, useModifyAdmin, useCreateAdmin } from '@/service/api'
import type { AdminDetails, AdminModify } from '@/service/api'
import AdminsStatistics from "@/components/AdminStatistics.tsx";

interface AdminFormValues {
  username: string
  password: string
  is_sudo: boolean
}

export default function AdminsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [editingAdmin, setEditingAdmin] = useState<Partial<AdminDetails> | null>(null)
  const form = useForm<AdminFormValues>()

  const { data: admins = [] } = useGetAdmins({})

  const { mutate: handleAdd } = useCreateAdmin({
    mutation: {
      onSuccess: () => {
        toast({
          title: t('success'),
          description: t('admins.addSuccess')
        })
        setEditingAdmin(null)
      },
      onError: () => toast({
        title: t('error'),
        description: t('admins.addError'),
        variant: 'destructive'
      })
    }
  })

  const { mutate: handleModify } = useModifyAdmin({
    mutation: {
      onSuccess: () => {
        toast({
          title: t('success'),
          description: t('admins.editSuccess')
        })
        setEditingAdmin(null)
      },
      onError: () => toast({
        title: t('error'),
        description: t('admins.editError'),
        variant: 'destructive'
      })
    }
  })

  const handleDelete = useCallback((admin: AdminDetails) => {
    handleModify({
      username: admin.username,
      data: {
        password: '',
        is_sudo: false
      }
    })
  }, [handleModify])

  const handleSubmit = useCallback(
      async (formValues: AdminFormValues) => {
        const adminData: AdminModify = {
          password: formValues.password || '',
          is_sudo: formValues.is_sudo || false
        }

        if (editingAdmin) {
          handleModify({
            username: editingAdmin.username || '',
            data: adminData
          })
        } else {
          handleAdd({
            data: {
              username: formValues.username,
              password: formValues.password,
              is_sudo: formValues.is_sudo
            }
          })
        }
      },
      [editingAdmin, handleAdd, handleModify]
  )

  return (
      <div className="flex flex-col gap-2 w-full items-start">
        <PageHeader
            title="admins.title"
            description="admins.description"
            buttonIcon={Plus}
            buttonText="admins.createAdmin"
            onButtonClick={() => setEditingAdmin({})}
        />
        <Separator />
        <div className="px-4 w-full pt-2">
          <AdminsStatistics data={admins} />
          <AdminsTable
              data={admins}
              onEdit={setEditingAdmin}
              onDelete={handleDelete}
          />

          <AdminModal
              isDialogOpen={editingAdmin !== null}
              onOpenChange={(open) => !open && setEditingAdmin(null)}
              form={form}
              editingAdmin={!!editingAdmin}
              onSubmit={handleSubmit}
          />
        </div>
      </div>
  )
} 