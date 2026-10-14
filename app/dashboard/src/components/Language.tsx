import { useLocale } from "@/hooks/use-locale";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Languages } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages = [
  { value: "en", label: "English", triggerLabel: "Change language", direction: "ltr" },
  { value: "fa", label: "فارسی", triggerLabel: "تغییر زبان", direction: "rtl" },
  { value: "zh-cn", label: "简体中文", triggerLabel: "切换语言", direction: "ltr" },
  { value: "ru", label: "Русский", triggerLabel: "Изменить язык", direction: "ltr" },
] as const;

export function Language({ showLabel = false }: { showLabel?: boolean }) {
  const { i18n, t } = useTranslation();
  const [hasError, setHasError] = useState(false);
  const { direction, language } = useLocale();
  const languageCode = language.toLowerCase();
  const selectedLanguage =
    languages.find(({ value }) => value.split("-")[0] === languageCode.split("-")[0]) ||
    languages[0];

  async function changeLanguage(value: string) {
    if (!languages.some((language) => language.value === value)) return;
    setHasError(false);
    try {
      await i18n.changeLanguage(value);
    } catch {
      setHasError(true);
    }
  }

  return (
    <DirectionProvider direction={direction}>
      <div dir={direction} className="flex flex-col items-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size={showLabel ? "sm" : "icon-sm"} />}
            type="button"
            aria-label={selectedLanguage.triggerLabel}
            title={selectedLanguage.triggerLabel}
            className={"border!"}
          >
            <Languages aria-hidden="true" />
            {showLabel && <span>{selectedLanguage.label}</span>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" dir={direction} className="min-w-36">
            <DropdownMenuRadioGroup
              value={selectedLanguage.value}
              onValueChange={changeLanguage}
              aria-label={selectedLanguage.triggerLabel}
            >
              {languages.map((language) => (
                <DropdownMenuRadioItem key={language.value} value={language.value} closeOnClick>
                  <span lang={language.value} dir={language.direction}>
                    {language.label}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {hasError && (
          <p role="alert" className="max-w-48 text-sm text-destructive">
            {t("language.changeError", {
              defaultValue: "Unable to change language. Please try again.",
            })}
          </p>
        )}
      </div>
    </DirectionProvider>
  );
}
