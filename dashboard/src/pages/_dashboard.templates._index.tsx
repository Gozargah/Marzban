import UserTemplate from '../components/templates/UserTemplate'
import {useGetUserTemplates, UserTemplateResponse} from "@/service/api";
import PageHeader from "@/components/page-header.tsx";
import {Plus} from "lucide-react";
import {Separator} from "@/components/ui/separator.tsx";

export default function UserTemplates() {
    const {data: userTemplates} = useGetUserTemplates(
        undefined,
        {
            query: {
                refetchInterval: 5000,
                refetchIntervalInBackground: true,
            }
        }
    )

    return (
        <div className="flex flex-col gap-2 w-full items-start">
            <PageHeader
                title="templates.title"
                description="templates.description"
                buttonIcon={Plus}
                buttonText="templates.addTemplate"
                onButtonClick={() => {
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
        </div>
    )
}
