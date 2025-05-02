import UserTemplate from '../components/templates/UserTemplate'
import {useGetUserTemplates, UserTemplateResponse} from "@/service/api";
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
    status: 'active',
    username_prefix: '',
    username_suffix: '',
    data_limit: 0,
    expire_duration: 0,
    method: undefined,
    flow: undefined,
    on_hold_timeout: undefined,
    groups: [1]
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
                        <UserTemplate template={template} key={template.id}/>
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
