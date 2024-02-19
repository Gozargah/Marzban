import { VStack, Text } from "@chakra-ui/react";
import { FC } from "react";
import { useTranslation } from "react-i18next";

type HeaderProps = {
  pageName: String;
};

export const Header: FC<HeaderProps> = ({ pageName }) => {
  const { t } = useTranslation();

  return (
    <VStack
      align="start"
      __css={{
        "& .menuList": {
          direction: "ltr",
        },
      }}
      position="relative"
    >
      <Text as="h1" fontWeight="semibold" fontSize="2xl">
        {t(pageName + ".title")}
      </Text>
      <Text color="GrayText">{t(pageName + ".description")}</Text>
    </VStack>
  );
};
