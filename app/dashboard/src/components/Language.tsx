import {
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  chakra,
} from "@chakra-ui/react";
import {
  LanguageIcon,
} from "@heroicons/react/24/outline";
import { FC, ReactNode, useState } from "react";
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
  const { i18n } = useTranslation();

  var changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  };

  return (
    <Menu>
      <MenuButton
        as={IconButton}
        size="sm"
        variant="outline"
        icon={<LangIcon />}
        position="relative"
      />
      <MenuList minW="100px">
        <MenuItem
          maxW="100px"
          fontSize="sm"
          onClick={() => changeLanguage("en")}
        >
          English
        </MenuItem>
        <MenuItem
            maxW="100px"
            fontSize="sm"
            onClick={() => changeLanguage("zh-cn")}
        >
          简体中文
        </MenuItem>
      </MenuList>
    </Menu>
  );
};
