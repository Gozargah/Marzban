import { chakra, IconButton, Menu, MenuButton, MenuItem, MenuList, Tooltip } from "@chakra-ui/react";
import { LanguageIcon } from "@heroicons/react/24/outline";
import { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";

type HeaderProps = {
  actions?: ReactNode;
};

const LangIcon = chakra(LanguageIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});

export const Language: FC<HeaderProps> = ({ actions }) => {
  const { i18n, t } = useTranslation();

  var changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <Menu placement="bottom-end">
      <Tooltip label={t("localization.toggleButton")} placement="top">
        <MenuButton as={IconButton} size="sm" variant="outline" icon={<LangIcon />} position="relative" />
      </Tooltip>
      <MenuList minW="100px" zIndex={1399}>
        <MenuItem maxW="100px" fontSize="sm" onClick={() => changeLanguage("en")}>
          English
        </MenuItem>
        <MenuItem maxW="100px" fontSize="sm" onClick={() => changeLanguage("fa")}>
          فارسی
        </MenuItem>
        <MenuItem maxW="100px" fontSize="sm" onClick={() => changeLanguage("zh-cn")}>
          简体中文
        </MenuItem>
        <MenuItem maxW="100px" fontSize="sm" onClick={() => changeLanguage("ru")}>
          Русский
        </MenuItem>
      </MenuList>
    </Menu>
  );
};
