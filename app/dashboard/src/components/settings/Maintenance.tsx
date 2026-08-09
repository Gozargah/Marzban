/**
 * Maintenance tab: the destructive one-off actions. Each keeps its confirmation
 * dialog — this page only surfaces them in one place with the warning attached.
 */
import { Button, HStack, Text, VStack } from "@chakra-ui/react";
import { ExclamationTriangleIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { ResetAllUsageModal } from "../ResetAllUsageModal";
import { Section, SettingRow } from "../ui";

export const Maintenance: FC = () => {
  const { onResetAllUsage } = useDashboard();
  const { t } = useTranslation();

  return (
    <>
      <Section
        icon={WrenchScrewdriverIcon}
        title="Обслуживание"
        description="Действия, которые нельзя отменить"
      >
        <VStack align="stretch" spacing="4">
          <SettingRow
            label={t("resetAllUsage")}
            description={t("resetAllUsage.prompt")}
          >
            <Button size="sm" colorScheme="red" variant="outline" onClick={() => onResetAllUsage(true)}>
              {t("reset")}
            </Button>
          </SettingRow>

          <HStack
            align="flex-start"
            spacing="2"
            bg="red.50"
            _dark={{ bg: "rgba(229,62,62,.12)" }}
            borderRadius="lg"
            p="3"
          >
            <ExclamationTriangleIcon width="18" style={{ flexShrink: 0 }} />
            <Text fontSize="xs" color="ui.textMuted">
              Счётчики обнуляются у всех пользователей сразу, история использования
              при этом сохраняется в отчётах по нодам.
            </Text>
          </HStack>
        </VStack>
      </Section>

      <ResetAllUsageModal />
    </>
  );
};
