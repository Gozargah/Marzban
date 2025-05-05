import {Card, CardDescription, CardTitle} from "../ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {Button} from "../ui/button";
import {Copy, EllipsisVertical, Pen, Trash2} from "lucide-react";
import {useTranslation} from "react-i18next";
import useDirDetection from "@/hooks/use-dir-detection";
import {formatBytes} from "@/utils/formatByte";
import {UserTemplateResponse} from "@/service/api";


const UserTemplate = ({template, onEdit}: {
    template: UserTemplateResponse,
    onEdit: (userTemplate: UserTemplateResponse) => void
}) => {
    const {t} = useTranslation();
    const dir = useDirDetection();


    return (
        <Card className="px-5 py-6 rounded-lg">
            <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-x-2">
                    <span>{template.name}</span>
                </div>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <EllipsisVertical/>
                            <span className="sr-only">Template Actions</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={dir === "rtl" ? "end" : "start"}>
                        <DropdownMenuItem dir={dir} className="flex items-center" onSelect={()=>onEdit(template)}>
                            <Pen className="h-4 w-4"/>
                            <span>{t("edit")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem dir={dir} className="flex items-center">
                            <Copy className="h-4 w-4"/>
                            <span>{t("duplicate")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            dir={dir}
                            className="flex items-center !text-red-500"
                            onClick={()=>{}}
                        >
                            <Trash2 className="h-4 w-4 text-red-500"/>
                            <span>{t("delete")}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardTitle>
            <CardDescription>
                <div className="flex flex-col gap-y-1 mt-2">
                    <p>
                        {t("userDialog.dataLimit")}: <span>{formatBytes(template.data_limit ? template.data_limit : 0)}</span>
                    </p>
                    <p>
                        {t("Expire")}: <span>{template.expire_duration}</span>
                    </p>
                </div>
            </CardDescription>

            {/* Include the Delete AlertDialog component */}
            <div>
                {/* <DeleteAlertDialog
          node={node}
          isOpen={isDeleteDialogOpen}
          onClose={handleCloseDeleteDialog}
          onConfirm={handleConfirmDelete}
        /> */}
            </div>
        </Card>
    );
};

export default UserTemplate;
