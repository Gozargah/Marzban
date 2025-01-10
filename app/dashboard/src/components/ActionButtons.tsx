import { FC, useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, QrCode } from "lucide-react";
import { User } from "@/types/User";
import QRCodeModal from "./dialogs/QRCodeModal";
import { CopyButton } from "./CopyButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import CopyToClipboard from "react-copy-to-clipboard";

type ActionButtonsProps = {
  user: User;
};

export interface SubscribeLink {
  protocol: string;
  link: string;
};

const ActionButtons: FC<ActionButtonsProps> = ({ user }) => {
  const [subscribeUrl, setSubscribeUrl] = useState<string>("");
  const [subscribeLinks, setSubscribeLinks] = useState<SubscribeLink[]>([]);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const onOpenModal = useCallback(() => {
    setSubscribeUrl(user.subscription_url);
  }, [user.subscription_url]);

  const onCloseModal = useCallback(() => {
    setSubscribeUrl("");
  }, []);

  const { t } = useTranslation();

  useEffect(() => {
    if (user.subscription_url) {
      const subURL = user.subscription_url.startsWith("/")
        ? window.location.origin + user.subscription_url
        : user.subscription_url

      const links = [
        { protocol: "v2ray", link: `${subURL}/v2ray` },
        { protocol: "v2ray-json", link: `${subURL}/v2ray-json` },
        { protocol: "clash", link: `${subURL}/clash` },
        { protocol: "clash-meta", link: `${subURL}/clash-meta` },
        { protocol: "outline", link: `${subURL}/outline` },
        { protocol: "sing-box", link: `${subURL}/sing-box` },
      ];
      setSubscribeLinks(links);
    }
  }, [subscribeUrl]);

  const handleCopy = async () => {

    setCopied(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);


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
          <Tooltip open={copied ? true : undefined}>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <TooltipTrigger>
                  <Button
                    size="icon"
                    variant="ghost"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {subscribeLinks.map(subLink => (
                  <DropdownMenuItem className="p-0 justify-start" key={subLink.link}>
                    <CopyToClipboard onCopy={handleCopy} text={subLink.link}>
                      <Button variant="ghost"
                        className="w-full h-full px-2 justify-start"
                        aria-label="Copy">

                        <span>
                          {subLink.protocol}
                        </span>
                      </Button>
                    </CopyToClipboard>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>{copied ? t("usersTable.copied") : t("usersTable.copyConfigs")}</TooltipContent>
          </Tooltip>

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
        {subscribeUrl && (
          <QRCodeModal
            subscribeLinks={subscribeLinks}
            subscribeUrl={subscribeUrl}
            onCloseModal={onCloseModal}
          />
        )}
      </div>
    </div>
  );
};

export default ActionButtons;
