import { useEffect, useState } from "react";
import { Card, CardDescription, CardTitle } from "../ui/card";
import FlagFromIP from "@/utils/flagFromIP";
import { NodeStatusBadge } from "./NodeStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { EllipsisVertical, Pen, Trash2, WifiOff } from "lucide-react";
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

// Separate Delete AlertDialog component
const DeleteAlertDialog = ({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  const { t } = useTranslation();

  return (

    <div>
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("areYouSure")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirmation")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("continue")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
};

// Separate Disable AlertDialog component
const DisableAlertDialog = ({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("areYouSure")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("disableConfirmation")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("continue")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const Node = ({ node }: { node: NodeType }) => {
  const { t } = useTranslation();
  const dir = useDirDetection();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDisableDialogOpen, setDisableDialogOpen] = useState(false);

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDisableClick = () => {
    setDisableDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };

  const handleCloseDisableDialog = () => {
    setDisableDialogOpen(false);
    console.log(isDisableDialogOpen);
  };

  const handleConfirmDelete = () => {
    // Add your delete logic here
    console.log("Node deleted");
    setDeleteDialogOpen(false);
  };

  const handleConfirmDisable = () => {
    // Add your disable logic here
    console.log("Node disabled");
    setDisableDialogOpen(false);
  };
  useEffect(() =>{
    console.log(isDeleteDialogOpen);
    

  },[isDeleteDialogOpen,isDisableDialogOpen])

  return (
    <Card className="px-5 py-6 rounded-lg">
      <CardTitle className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <div className="mr-1.5">
            <NodeStatusBadge status={node.status} />
          </div>
          <FlagFromIP ip={node.address} />
          <span>{node.name}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <EllipsisVertical />
              <span className="sr-only">Nodes Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={dir === "rtl" ? "end" : "start"}>
            <DropdownMenuItem dir={dir} className="flex items-center">
              <Pen className="h-4 w-4" />
              <span>{t("edit")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              dir={dir}
              className="flex items-center"
              onClick={handleDisableClick}
            >
              <WifiOff className="h-4 w-4" />
              <span>{t("disable")}</span>
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
            {t("ip")}: <span>{node.address}</span>
          </p>
          <p>
            {t("nodes.nodePort")}: <span>{node.port}</span>
          </p>
          <p>
            {t("nodes.nodeAPIPort")}: <span>{node.api_port}</span>
          </p>
        </div>
      </CardDescription>

      {/* Include the Delete and Disable AlertDialog components */}
      <div>
        <DeleteAlertDialog
          isOpen={isDeleteDialogOpen}
          onClose={handleCloseDeleteDialog}
          onConfirm={handleConfirmDelete}
        />
        <DisableAlertDialog
          isOpen={isDisableDialogOpen}
          onClose={handleCloseDisableDialog}
          onConfirm={handleConfirmDisable}
        />
      </div>
    </Card>
  );
};

export default Node;
