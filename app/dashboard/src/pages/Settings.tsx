/**
 * Settings hub.
 *
 * Everything that used to be its own burger-menu dialog now lives here on a
 * tab: the three subscription-side tabs share one saved object (see
 * settings/yukuSettings), the rest save themselves.
 */
import {
  Box,
  Button,
  HStack,
  Icon as ChakraIcon,
  Select,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  BoltIcon,
  CommandLineIcon,
  DevicePhoneMobileIcon,
  MegaphoneIcon,
  ScaleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { CoreSettingsModal } from "components/CoreSettingsModal";
import { PageMode } from "components/PageOrModal";
import { AutoSelectSettings } from "components/settings/AutoSelectSettings";
import { DeviceSettings } from "components/settings/DeviceSettings";
import { Maintenance } from "components/settings/Maintenance";
import { SubscriptionSettings } from "components/settings/SubscriptionSettings";
import { TrafficGroups } from "components/settings/TrafficGroups";
import {
  YukuSettingsProvider,
  useYukuSettings,
} from "components/settings/yukuSettings";
import { PageHeader, Panel, Section } from "components/ui";
import { useDashboard } from "contexts/DashboardContext";
import { FC, ReactNode, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Tab = {
  key: string;
  label: string;
  icon: any;
  element: ReactNode;
  /** part of the shared settings object, so it gets the common save bar */
  shared?: boolean;
};

/** The Xray editor still reads its open flag from the dashboard store. */
const CoreSettingsPanel: FC = () => {
  useEffect(() => {
    useDashboard.setState({ isEditingCore: true });
    return () => useDashboard.setState({ isEditingCore: false });
  }, []);
  return (
    <Section icon={CommandLineIcon} title="Ядро Xray" bodyProps={{ p: "0" }}>
      <PageMode>
        <CoreSettingsModal />
      </PageMode>
    </Section>
  );
};

const TABS: Tab[] = [
  {
    key: "subscription",
    label: "Подписка",
    icon: MegaphoneIcon,
    element: <SubscriptionSettings />,
    shared: true,
  },
  {
    key: "auto-select",
    label: "Автовыбор",
    icon: BoltIcon,
    element: <AutoSelectSettings />,
    shared: true,
  },
  {
    key: "devices",
    label: "Устройства",
    icon: DevicePhoneMobileIcon,
    element: <DeviceSettings />,
    shared: true,
  },
  { key: "traffic", label: "Группы трафика", icon: ScaleIcon, element: <TrafficGroups /> },
  { key: "core", label: "Ядро Xray", icon: CommandLineIcon, element: <CoreSettingsPanel /> },
  {
    key: "maintenance",
    label: "Обслуживание",
    icon: WrenchScrewdriverIcon,
    element: <Maintenance />,
  },
];

/** Phone: one control instead of a rail that would eat half the screen. */
const TabSelect: FC<{ active: string; onSelect: (key: string) => void }> = ({
  active,
  onSelect,
}) => (
  <Box display={{ base: "block", lg: "none" }} mb="4">
    <Select value={active} onChange={(e) => onSelect(e.target.value)}>
      {TABS.map((tab) => (
        <option key={tab.key} value={tab.key}>
          {tab.label}
        </option>
      ))}
    </Select>
  </Box>
);

const TabRail: FC<{ active: string; onSelect: (key: string) => void }> = ({
  active,
  onSelect,
}) => (
    <Panel
      display={{ base: "none", lg: "block" }}
      p="2"
      w="230px"
      flexShrink={0}
      alignSelf="flex-start"
    >
      <VStack align="stretch" spacing="1">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <HStack
              key={tab.key}
              as="button"
              type="button"
              onClick={() => onSelect(tab.key)}
              spacing="3"
              px="3"
              py="2"
              borderRadius="lg"
              textAlign="left"
              bg={isActive ? "ui.accentSubtle" : "transparent"}
              color={isActive ? "ui.accent" : "ui.textMuted"}
              _hover={{ bg: isActive ? "ui.accentSubtle" : "ui.surfaceHover" }}
              transition="background .12s ease"
            >
              <ChakraIcon as={tab.icon} w="4" h="4" flexShrink={0} />
              <Text fontSize="sm" fontWeight={isActive ? "500" : "400"} noOfLines={1}>
                {tab.label}
              </Text>
            </HStack>
          );
        })}
      </VStack>
    </Panel>
);

/** Save bar for the tabs backed by the shared settings object. */
const SharedSaveBar: FC = () => {
  const { dirty, saving, save, reload } = useYukuSettings();
  return (
    <HStack
      mt="4"
      px="4"
      py="3"
      justify="flex-end"
      spacing="3"
      bg="ui.surface"
      borderWidth="1px"
      borderColor={dirty ? "primary.500" : "ui.border"}
      borderRadius="xl"
      boxShadow="raised"
      zIndex="2"
    >
      <Text fontSize="xs" color="ui.textMuted" mr="auto">
        {dirty ? "Есть несохранённые изменения" : "Всё сохранено"}
      </Text>
      <Button size="sm" variant="ghost" onClick={reload} isDisabled={!dirty || saving}>
        Отменить
      </Button>
      <Button size="sm" colorScheme="primary" onClick={save} isLoading={saving} isDisabled={!dirty}>
        Сохранить
      </Button>
    </HStack>
  );
};

const SharedTab: FC<{ children: ReactNode }> = ({ children }) => {
  const { loading } = useYukuSettings();
  if (loading)
    return (
      <Panel p="10" display="flex" justifyContent="center">
        <Spinner />
      </Panel>
    );
  return (
    <>
      {children}
      <SharedSaveBar />
    </>
  );
};

export const SettingsPage: FC = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : TABS[0].key;
  const current = TABS.find((t) => t.key === active)!;

  return (
    <Box w="full">
      <PageHeader
        title="Настройки"
        description="Подписка, автовыбор, ядро и обслуживание панели"
      />
      <TabSelect active={active} onSelect={(key) => navigate(`/settings/${key}`)} />
      <HStack align="flex-start" spacing="5" w="full">
        <TabRail active={active} onSelect={(key) => navigate(`/settings/${key}`)} />
        <Box flex="1" minW="0">
          {current.shared ? (
            <SharedTab>{current.element}</SharedTab>
          ) : (
            current.element
          )}
        </Box>
      </HStack>
    </Box>
  );
};

/** One provider for the whole hub, so switching tabs keeps unsaved edits. */
export const Settings: FC = () => (
  <YukuSettingsProvider>
    <SettingsPage />
  </YukuSettingsProvider>
);

export default Settings;
