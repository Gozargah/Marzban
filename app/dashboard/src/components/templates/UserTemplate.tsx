import { useState } from "react";
import { Card, CardDescription, CardTitle } from "../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Copy, EllipsisVertical, Pen, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import useDirDetection from "@/hooks/use-dir-detection";
import { NodeType } from "@/contexts/NodesContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { UserTemplateType } from "@/types/User";
import { formatBytes } from "@/utils/formatByte";

const DeleteAlertDialog = ({
  node,
  isOpen,
  onClose,
  onConfirm,
}: {
  node: NodeType;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  const { t } = useTranslation();
  const dir = useDirDetection();

  return (
    <div>
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent>
          <AlertDialogHeader className={cn(dir === "rtl" && "sm:text-right")}>
            <AlertDialogTitle>{t("deleteNode.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              <span dir={dir} dangerouslySetInnerHTML={{ __html: t("deleteNode.prompt", { name: node.name }) }} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(dir === "rtl" && "sm:gap-x-2 sm:flex-row-reverse")}>
            <AlertDialogCancel onClick={onClose}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirm}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const UserTemplate = ({ template }: { template: UserTemplateType }) => {
  const { t } = useTranslation();
  const dir = useDirDetection();
  const { toast } = useToast()
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };

  //   const handleConfirmDelete = () => {
  //     toast({
  //       dir,
  //       description: t("deleteNode.deleteSuccess",{name:node.name}),
  //     })
  //     setDeleteDialogOpen(false);
  //   };

  return (
    <Card className="px-5 py-6 rounded-lg">
      <CardTitle className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <span>{template.name}</span>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <EllipsisVertical />
              <span className="sr-only">Template Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={dir === "rtl" ? "end" : "start"}>
            <DropdownMenuItem dir={dir} className="flex items-center">
              <Pen className="h-4 w-4" />
              <span>{t("edit")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem dir={dir} className="flex items-center">
              <Copy className="h-4 w-4" />
              <span>{t("duplicate")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              dir={dir}
              className="flex items-center !text-red-500"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
              <span>{t("delete")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardTitle>
      <CardDescription>
        <div className="flex flex-col gap-y-1 mt-2">
          <p>
            {t("userDialog.dataLimit")}: <span>{formatBytes(template.data_limit)}</span>
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
