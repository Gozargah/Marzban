import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, Check, Link } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { useTranslation } from "react-i18next";

interface CopyButtonProps {
  value: string;
  className?: string;
  copiedMessage?: string;
  defaultMessage?: string;
  icon?: "copy" | "link";
}

export function CopyButton({
  value,
  className,
  copiedMessage = "Copied!",
  defaultMessage = "Click to copy",
  icon = "copy",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const { t } = useTranslation();

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
    <Tooltip open={copied ? true : undefined}>
      <TooltipTrigger asChild>
        <div>
          <CopyToClipboard text={value} onCopy={handleCopy}>
            <Button
              size="icon"
              variant="ghost"
              className={className}
              aria-label="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : icon === "copy" ? (
                <Copy className="h-4 w-4" />
              ) : (
                <Link className="h-4 w-4" />
              )}
            </Button>
          </CopyToClipboard>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{copied ? t(copiedMessage) : t(defaultMessage)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
