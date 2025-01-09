import { FC, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";
import { User } from "@/types/User";
import QRCodeModal from "./dialogs/QRCodeModal";
import { CopyButton } from "./CopyButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type ActionButtonsProps = {
  user: User;
};

const ActionButtons: FC<ActionButtonsProps> = ({ user }) => {
  const [QRcodeLinks, setQRCodeLinks] = useState<string[] | null>(null);
  const [subscribeUrl, setSubscribeUrl] = useState<string>("");

  const onOpenModal = useCallback(() => {
    setQRCodeLinks(user.links);
    setSubscribeUrl(user.subscription_url);
  }, [user.links, user.subscription_url]);

  const onCloseModal = useCallback(() => {
    setQRCodeLinks(null);
    setSubscribeUrl("");
  }, []);

  const proxyLinks = user.links.join("\r\n");

  console.log(QRcodeLinks);
  

  return (
    <div>
      <div className="flex justify-end space-x-2 items-center">
        <TooltipProvider>
          <CopyButton
            value={
              user.subscription_url.startsWith("/")
                ? window.location.origin + user.subscription_url
                : user.subscription_url
            }
            copiedMessage="usersTable.copied"
            defaultMessage="usersTable.copyLink"
            icon="link"
          />
          <CopyButton
            value={proxyLinks}
            copiedMessage="usersTable.copied"
            defaultMessage="usersTable.copyConfigs"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                aria-label="qr code"
                size="sm"
                onClick={onOpenModal}
              >
                <QrCode />
              </Button>
            </TooltipTrigger>
            <TooltipContent>QR Code</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {QRcodeLinks && (
          <QRCodeModal
            QRcodeLinks={QRcodeLinks}
            subscribeUrl={subscribeUrl}
            onCloseModal={onCloseModal}
          />
        )}
      </div>
    </div>
  );
};

export default ActionButtons;
