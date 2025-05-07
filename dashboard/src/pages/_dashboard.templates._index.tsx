import UserTemplate from '../components/templates/UserTemplate'
import {
    useGetUserTemplates,
    UserTemplateResponse,
} from "@/service/api";
import PageHeader from "@/components/page-header.tsx";
import {Plus} from "lucide-react";
import {Separator} from "@/components/ui/separator.tsx";

import UserTemplateModal, {
    userTemplateFormSchema,
    UserTemplatesFromValue
} from "@/components/dialogs/UserTemplateModal.tsx";
import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";

const initialDefaultValues: Partial<UserTemplatesFromValue> = {
    name: '',
    status: "active",
    username_prefix: "",
    username_suffix: "",
    data_limit: 0,
    expire_duration: 0,
    method: "chacha20-ietf-poly1305",
    flow: "",
    on_hold_timeout: 0,
    groups: []
}

export default function UserTemplates() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingUserTemplate, setEditingUserTemplate] = useState<UserTemplateResponse | null>(null)
    const {data: userTemplates} = useGetUserTemplates(
        undefined,
        {
            query: {
                refetchInterval: 5000,
                refetchIntervalInBackground: true,
            }
        }
    )
    const form = useForm<UserTemplatesFromValue>({
        resolver: zodResolver(userTemplateFormSchema),
    })
    const handleEdit = (userTemplate: UserTemplateResponse) => {
        setEditingUserTemplate(userTemplate)
            form.reset({
                name: userTemplate.name || undefined,
                status: userTemplate.status || undefined,
                data_limit: userTemplate.data_limit || undefined,
                expire_duration: userTemplate.expire_duration || undefined,
                method: userTemplate.extra_settings?.method || undefined,
                flow: userTemplate.extra_settings?.flow || undefined,
                groups: userTemplate.group_ids || undefined,
                username_prefix: userTemplate.username_prefix || undefined,
                username_suffix: userTemplate.username_suffix || undefined,
                resetUsages: userTemplate.reset_usages || undefined,
                on_hold_timeout:
                    typeof userTemplate.on_hold_timeout === "number"
                        ? userTemplate.on_hold_timeout
                        : undefined,
                data_limit_reset_strategy: userTemplate.data_limit_reset_strategy || undefined,
            })

        setIsDialogOpen(true)
    }

    return (
        <div className="flex flex-col gap-2 w-full items-start">
            <PageHeader
                title="templates.title"
                description="templates.description"
                buttonIcon={Plus}
                buttonText="templates.addTemplate"
                onButtonClick={() => {
                    setIsDialogOpen(true)
                }}
            />
            <Separator/>
            <div className="flex-1 space-y-4 p-4 pt-6 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                    {userTemplates?.map((template: UserTemplateResponse) => (
                        <UserTemplate onEdit={handleEdit} template={template} key={template.id}/>
                    ))}
                </div>
            </div>

            <UserTemplateModal
                isDialogOpen={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingUserTemplate(null)
                        form.reset(initialDefaultValues)
                    }
                    setIsDialogOpen(open)
                }}
                form={form}
                editingUserTemplate={!!editingUserTemplate}
                editingUserTemplateId={editingUserTemplate?.id}
            />
        </div>
    )
}
