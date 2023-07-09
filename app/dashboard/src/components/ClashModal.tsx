import {
  Box,
  BoxProps,
  Button,
  Card,
  HStack,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  StackProps,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  chakra,
} from "@chakra-ui/react";
import {
  ArrowPathIcon,
  ArrowPathRoundedSquareIcon,
  Bars3Icon,
  CheckIcon,
  Cog6ToothIcon,
  DocumentDuplicateIcon,
  InformationCircleIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  QrCodeIcon,
  RssIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { joinPaths } from "@remix-run/router";
import classNames from "classnames";
import { Ruleset, useClash } from "contexts/ClashContext";
import { useDashboard } from "contexts/DashboardContext";
import debounce from "lodash.debounce";
import React, { FC, useEffect, useState } from "react";
import { Droppable as DroppableBug, DroppableProps } from "react-beautiful-dnd";
import { useTranslation } from "react-i18next";
import { ClashProxyDialog } from "./ClashProxyDialog";
import { ClashProxyGroupDialog } from "./ClashProxyGroupDialog";
import { ClashRuleDialog } from "./ClashRuleDialog";
import { ClashRulesetDialog } from "./ClashRulesetDialog";
import { ClashSetting } from "./ClashSetting";
import { Icon as TitleIcon } from "./Icon";
import { Pagination } from "./Pagination";
import { Sort } from "./UsersTable";

const iconProps = {
  baseStyle: {
    w: 5,
    h: 5,
  },
};
export const EditIcon = chakra(PencilIcon, iconProps);
export const AddIcon = chakra(PlusIcon, iconProps);
export const SearchIcon = chakra(MagnifyingGlassIcon, iconProps);
export const ClearIcon = chakra(XMarkIcon, iconProps);
export const CopiedIcon = chakra(CheckIcon, iconProps);
export const CopyIcon = chakra(LinkIcon, iconProps);
export const SubscriptionIcon = chakra(RssIcon, iconProps);
export const SettingIcon = chakra(Cog6ToothIcon, iconProps);
export const QRIcon = chakra(QrCodeIcon, iconProps);
export const ReloadIcon = chakra(ArrowPathIcon, iconProps);
export const RefreshIcon = chakra(ArrowPathRoundedSquareIcon, iconProps);
export const DuplicateIcon = chakra(DocumentDuplicateIcon, iconProps);
export const RankIcon = chakra(Bars3Icon, iconProps);
export const InfoIcon = chakra(InformationCircleIcon, {
  baseStyle: {
    w: 4,
    h: 4,
    color: "gray.400",
    cursor: "pointer",
  },
});

export type ClashModalProps = {};

export const ClashModal: FC<ClashModalProps> = () => {
  const { isEditingSubscription, onEditingSubscription } = useDashboard();
  const { t } = useTranslation();

  const onClose = () => {
    onEditingSubscription(false);
  };

  return (
    <Tabs isLazy colorScheme="primary" lazyBehavior="keepMounted">
      <Modal isOpen={isEditingSubscription} onClose={onClose} size="5xl">
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent mx="3" w="full">
          <ModalHeader pt={6}>
            <HStack gap={2}>
              <TitleIcon color="primary">
                <SubscriptionIcon color="white" />
              </TitleIcon>
              <TabList>
                <Tab fontSize="lg">{t("clash.proxies")}</Tab>
                <Tab fontSize="lg">{t("clash.proxyGroups")}</Tab>
                <Tab fontSize="lg">{t("clash.rules")}</Tab>
                <Tab fontSize="lg">{t("clash.setting")}</Tab>
              </TabList>
            </HStack>
          </ModalHeader>
          <ModalCloseButton mt={3} />
          <ModalBody>
            <TabPanels>
              <TabPanel>
                <Proxies />
              </TabPanel>
              <TabPanel>
                <ProxyGroups />
              </TabPanel>
              <TabPanel>
                <Rules />
              </TabPanel>
              <TabPanel>
                <Setting />
              </TabPanel>
            </TabPanels>
            <ClashRuleDialog />
            <ClashRulesetDialog />
            <ClashProxyGroupDialog />
            <ClashProxyDialog />
            <ClashSetting />
          </ModalBody>
          <ModalFooter mt="3"></ModalFooter>
        </ModalContent>
      </Modal>
    </Tabs>
  );
};

const Setting: FC<BoxProps> = () => {
  const { fetchSettings, settings, onEditingSetting } = useClash();
  const { isEditingSubscription } = useDashboard();
  useEffect(() => {
    if (isEditingSubscription) {
      fetchSettings();
    }
  }, [isEditingSubscription]);

  const makeIcon = (name: string) => {
    return joinPaths([import.meta.env.BASE_URL, `images/${name}.png`]);
  };

  return (
    <HStack spacing={6} minH="sm" alignItems="baseline">
      {settings.map((setting) => (
        <Card
          key={setting.name}
          p={6}
          pl={10}
          pr={10}
          borderWidth="1px"
          borderColor="light-border"
          bg="#F9FAFB"
          _dark={{ borderColor: "gray.600", bg: "gray.750" }}
          borderStyle="solid"
          boxShadow="none"
          borderRadius="12px"
          width="full"
          display="flex"
          justifyContent="space-between"
          flexDirection="row"
          onClick={() => onEditingSetting(setting)}
        >
          <Box w="48px">
            <Image src={makeIcon(setting.name)} alt={setting.name} />
          </Box>
          <Box fontSize="3xl" fontWeight="semibold" mt="2">
            {setting.name}
          </Box>
        </Card>
      ))}
    </HStack>
  );
};

const setProxySearchField = debounce((search: string) => {
  useClash.getState().onProxyFilterChange({
    ...useClash.getState().proxyFilter,
    offset: 0,
    search,
  });
}, 300);

const Proxies: FC<StackProps> = () => {
  const { isEditingSubscription } = useDashboard();
  const { t } = useTranslation();
  const {
    proxyFilter,
    onProxyFilterChange,
    onCreateProxy,
    onEditingProxy,
    fetchProxies,
    fetchProxyInbounds,
    proxies,
    totalProxies,
    loading,
  } = useClash();

  const [search, setSearch] = useState("");

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setProxySearchField(e.target.value);
  };
  const clear = () => {
    setSearch("");
    onProxyFilterChange({
      ...proxyFilter,
      offset: 0,
      search: "",
    });
  };

  const handleSort = (column: string) => {
    let newSort = proxyFilter.sort;
    if (newSort.includes(column)) {
      if (newSort.startsWith("-")) {
        newSort = "-modified_at";
      } else {
        newSort = "-" + column;
      }
    } else {
      newSort = column;
    }
    onProxyFilterChange({
      sort: newSort,
      offset: 0,
    });
  };

  useEffect(() => {
    if (isEditingSubscription) {
      proxyFilter.search = "";
      fetchProxies();
      fetchProxyInbounds();
    }
  }, [isEditingSubscription]);

  return (
    <VStack w="full">
      <HStack w="full" justifyContent="space-between">
        <HStack>
          <InputGroup>
            <InputLeftElement
              height="8"
              pointerEvents="none"
              children={<SearchIcon />}
            />
            <Input
              size="sm"
              borderRadius="md"
              placeholder={t("search")}
              value={search}
              borderColor="light-border"
              onChange={onChange}
            />

            <InputRightElement height="8">
              {loading && <Spinner size="xs" />}
              {search.length > 0 && (
                <IconButton
                  onClick={clear}
                  aria-label="clear"
                  size="xs"
                  variant="ghost"
                >
                  <ClearIcon />
                </IconButton>
              )}
            </InputRightElement>
          </InputGroup>
        </HStack>
        <HStack>
          <IconButton
            aria-label="refresh proxies"
            disabled={loading}
            onClick={fetchProxies}
            size="sm"
            variant="outline"
          >
            <ReloadIcon
              className={classNames({
                "animate-spin": loading,
              })}
            />
          </IconButton>
          <Button
            colorScheme="primary"
            size="sm"
            onClick={() => onCreateProxy(true)}
            px={5}
          >
            {t("clash.proxy.add")}
          </Button>
        </HStack>
      </HStack>
      <Box overflowX="auto" w="full">
        <Table orientation="vertical">
          <Thead zIndex="docked" position="relative">
            <Tr>
              <Th
                minW="30px"
                pr="0"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "id")}
              >
                <HStack>
                  <span>id</span>
                  <Sort sort={proxyFilter.sort} column="id" />
                </HStack>
              </Th>
              <Th
                minW="140px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "name")}
              >
                <HStack>
                  <span>{t("clash.name")}</span>
                  <Sort sort={proxyFilter.sort} column="name" />
                </HStack>
              </Th>
              <Th
                minW="140px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "server")}
              >
                <HStack>
                  <span>{t("clash.server")}</span>
                  <Sort sort={proxyFilter.sort} column="server" />
                </HStack>
              </Th>
              <Th
                minW="100px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "inbound")}
              >
                <HStack>
                  <span>{t("clash.inbound")}</span>
                  <Sort sort={proxyFilter.sort} column="inbound" />
                </HStack>
              </Th>
              <Th
                minW="100px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "tag")}
              >
                <HStack>
                  <span>{t("tag")}</span>
                  <Sort sort={proxyFilter.sort} column="tag" />
                </HStack>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {proxies?.map((proxy, i) => {
              return (
                <Tr
                  key={proxy.id}
                  className={classNames("interactive", {
                    "last-row": i === proxies.length - 1,
                  })}
                  onClick={() => onEditingProxy(proxy)}
                >
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {proxy.id}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {proxy.name}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {proxy.server}:{proxy.port}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {proxy.inbound}
                  </Td>
                  <Td pt="2.5" pb="2.5" fontSize="sm">
                    {proxy.tag}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <Pagination
          onChange={(page, limit) => {
            onProxyFilterChange({
              ...proxyFilter,
              limit,
              offset: page * limit,
            });
          }}
          total={totalProxies}
          limit={proxyFilter.limit}
          offset={proxyFilter.offset}
        />
      </Box>
    </VStack>
  );
};

const setProxyGroupSearchField = debounce((search: string) => {
  useClash.getState().onProxyGroupFilterChange({
    ...useClash.getState().proxyGroupFilter,
    offset: 0,
    search,
  });
}, 300);

const ProxyGroups: FC<StackProps> = () => {
  const { isEditingSubscription } = useDashboard();
  const { t } = useTranslation();
  const {
    proxyGroupFilter,
    onProxyGroupFilterChange,
    fetchProxyGroups,
    fetchProxyBriefs,
    proxyGroups,
    totalProxyGroups,
    loading,
    onEditingProxyGroup,
    onCreateProxyGroup,
  } = useClash();

  const [search, setSearch] = useState("");

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setProxyGroupSearchField(e.target.value);
  };
  const clear = () => {
    setSearch("");
    onProxyGroupFilterChange({
      ...proxyGroupFilter,
      offset: 0,
      search: "",
    });
  };

  const handleSort = (column: string) => {
    let newSort = proxyGroupFilter.sort;
    if (newSort.includes(column)) {
      if (newSort.startsWith("-")) {
        newSort = "-modified_at";
      } else {
        newSort = "-" + column;
      }
    } else {
      newSort = column;
    }
    onProxyGroupFilterChange({
      sort: newSort,
      offset: 0,
    });
  };

  useEffect(() => {
    if (isEditingSubscription) {
      proxyGroupFilter.search = "";
      fetchProxyGroups();
      fetchProxyBriefs();
    }
  }, [isEditingSubscription]);

  return (
    <VStack w="full">
      <HStack w="full" justifyContent="space-between">
        <HStack>
          <InputGroup>
            <InputLeftElement
              height="8"
              pointerEvents="none"
              children={<SearchIcon />}
            />
            <Input
              size="sm"
              borderRadius="md"
              placeholder={t("search")}
              value={search}
              borderColor="light-border"
              onChange={onChange}
            />

            <InputRightElement height="8">
              {loading && <Spinner size="xs" />}
              {search.length > 0 && (
                <IconButton
                  onClick={clear}
                  aria-label="clear"
                  size="xs"
                  variant="ghost"
                >
                  <ClearIcon />
                </IconButton>
              )}
            </InputRightElement>
          </InputGroup>
        </HStack>
        <HStack>
          <IconButton
            aria-label="refresh proxy groups"
            disabled={loading}
            onClick={fetchProxyGroups}
            size="sm"
            variant="outline"
          >
            <ReloadIcon
              className={classNames({
                "animate-spin": loading,
              })}
            />
          </IconButton>
          <Button
            colorScheme="primary"
            size="sm"
            onClick={() => onCreateProxyGroup(true)}
            px={5}
          >
            {t("clash.proxyGroup.add")}
          </Button>
        </HStack>
      </HStack>
      <Box overflowX="auto" w="full">
        <Table orientation="vertical">
          <Thead zIndex="docked" position="relative">
            <Tr>
              <Th
                minW="30px"
                pr="0"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "id")}
              >
                <HStack>
                  <span>id</span>
                  <Sort sort={proxyGroupFilter.sort} column="id" />
                </HStack>
              </Th>
              <Th
                minW="140px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "name")}
              >
                <HStack>
                  <span>{t("clash.name")}</span>
                  <Sort sort={proxyGroupFilter.sort} column="name" />
                </HStack>
              </Th>
              <Th
                minW="100px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "type")}
              >
                <HStack>
                  <span>{t("clash.type")}</span>
                  <Sort sort={proxyGroupFilter.sort} column="type" />
                </HStack>
              </Th>
              <Th
                minW="140px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "tag")}
              >
                <HStack>
                  <span>{t("tag")}</span>
                  <Sort sort={proxyGroupFilter.sort} column="tag" />
                </HStack>
              </Th>
              <Th minW="140px" cursor={"pointer"}>
                <HStack>
                  <span>{t("clash.proxies")}</span>
                </HStack>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {proxyGroups?.map((group, i) => {
              return (
                <Tr
                  key={group.id}
                  className={classNames("interactive", {
                    "last-row": i === proxyGroups.length - 1,
                  })}
                  onClick={() => onEditingProxyGroup(group)}
                >
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {group.id}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {group.name}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {group.type}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {group.tag}
                  </Td>
                  <Td pt="2.5" pb="2.5" fontSize="sm">
                    {group.proxies}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <Pagination
          onChange={(page, limit) => {
            onProxyGroupFilterChange({
              ...proxyGroupFilter,
              limit,
              offset: page * limit,
            });
          }}
          total={totalProxyGroups}
          limit={proxyGroupFilter.limit}
          offset={proxyGroupFilter.offset}
        />
      </Box>
    </VStack>
  );
};

const setRuleSearchField = debounce((search: string) => {
  useClash.getState().onRuleFilterChange({
    ...useClash.getState().ruleFilter,
    offset: 0,
    search,
  });
}, 300);

const Rules: FC<StackProps> = () => {
  const { isEditingSubscription } = useDashboard();
  const { t } = useTranslation();
  const {
    ruleFilter,
    onRuleFilterChange,
    fetchRules,
    fetchRulesets,
    onEditingRule,
    onCreateRule,
    onEditingRuleset,
    onCreateRuleset,
    rules,
    totalRules,
    rulesets,
    loading,
  } = useClash();

  const [search, setSearch] = useState("");
  const rulesetsByName: { [key: string]: Ruleset } = rulesets.reduce(
    (ac, a) => ({ ...ac, [a.name]: a }),
    {}
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setRuleSearchField(e.target.value);
  };
  const clear = () => {
    setSearch("");
    onRuleFilterChange({
      ...ruleFilter,
      offset: 0,
      search: "",
    });
  };

  const findRuleset = (name: string | null | undefined) => {
    const arr = rulesets.filter((value) => value.name === name);
    return arr.length ? arr[0] : null;
  };

  const onRulesetChange = (name: string) => {
    if (name === "All") {
      onRuleFilterChange({
        ruleset: "",
        offset: 0,
      });
    } else {
      onRuleFilterChange({
        ruleset: name,
        offset: 0,
      });
    }
  };

  const handleEditRuleset = () => {
    onEditingRuleset(findRuleset(ruleFilter.ruleset));
  };

  const handleSort = (column: string) => {
    let newSort = ruleFilter.sort;
    if (newSort.includes(column)) {
      if (newSort.startsWith("-")) {
        newSort = "-modified_at";
      } else {
        newSort = "-" + column;
      }
    } else {
      newSort = column;
    }
    onRuleFilterChange({
      sort: newSort,
      offset: 0,
    });
  };

  useEffect(() => {
    if (ruleFilter.ruleset && !findRuleset(ruleFilter.ruleset)) {
      onRuleFilterChange({
        ruleset: "",
        offset: 0,
      });
    }
  }, [rulesets]);

  useEffect(() => {
    if (isEditingSubscription) {
      ruleFilter.search = "";
      fetchRules();
      fetchRulesets();
    }
  }, [isEditingSubscription]);

  return (
    <VStack w="full">
      <HStack w="full" justifyContent="space-between">
        <HStack>
          <Tooltip placement="top" label={t("clash.ruleset.add")}>
            <IconButton
              aria-label="Add ruleset"
              size="sm"
              onClick={() => onCreateRuleset(true)}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
          <Tooltip
            isDisabled={!ruleFilter.ruleset}
            label={t("clash.ruleset.edit")}
            placement="top"
          >
            <IconButton
              aria-label="Ruleset setting"
              size="sm"
              isDisabled={!ruleFilter.ruleset}
              onClick={handleEditRuleset}
            >
              <SettingIcon />
            </IconButton>
          </Tooltip>
          <Select
            size="sm"
            value={ruleFilter.ruleset || "All"}
            onChange={(e) => onRulesetChange(e.target.value)}
          >
            <option key="All" value="All">
              All
            </option>
            {rulesets.map((entry) => {
              return (
                <option key={entry.name} value={entry.name}>
                  {entry.name} ({entry.policy})
                </option>
              );
            })}
          </Select>
          <InputGroup>
            <InputLeftElement
              height="8"
              pointerEvents="none"
              children={<SearchIcon />}
            />
            <Input
              size="sm"
              borderRadius="md"
              placeholder={t("search")}
              value={search}
              borderColor="light-border"
              onChange={onChange}
            />

            <InputRightElement height="8">
              {loading && <Spinner size="xs" />}
              {search.length > 0 && (
                <IconButton
                  onClick={clear}
                  aria-label="clear"
                  size="xs"
                  variant="ghost"
                >
                  <ClearIcon />
                </IconButton>
              )}
            </InputRightElement>
          </InputGroup>
        </HStack>
        <HStack>
          <IconButton
            aria-label="refresh rules"
            disabled={loading}
            onClick={fetchRules}
            size="sm"
            variant="outline"
          >
            <ReloadIcon
              className={classNames({
                "animate-spin": loading,
              })}
            />
          </IconButton>
          <Button
            colorScheme="primary"
            size="sm"
            onClick={() => onCreateRule(true)}
            px={5}
          >
            {t("clash.rule.add")}
          </Button>
        </HStack>
      </HStack>
      <Box overflowX="auto" w="full">
        <Table orientation="vertical">
          <Thead zIndex="docked" position="relative">
            <Tr>
              <Th
                minW="170px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "type")}
              >
                <HStack>
                  <span>{t("clash.type")}</span>
                  <Sort sort={ruleFilter.sort} column="type" />
                </HStack>
              </Th>
              <Th
                minW="140px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "content")}
              >
                <HStack>
                  <span>{t("clash.content")}</span>
                  <Sort sort={ruleFilter.sort} column="content" />
                </HStack>
              </Th>
              <Th
                minW="140px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "option")}
              >
                <HStack>
                  <span>{t("clash.option")}</span>
                  <Sort sort={ruleFilter.sort} column="option" />
                </HStack>
              </Th>
              <Th minW="140px">
                <HStack>
                  <span>{t("clash.ruleset")}</span>
                </HStack>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rules?.map((rule, i) => {
              return (
                <Tr
                  key={rule.content}
                  className={classNames("interactive", {
                    "last-row": i === rules.length - 1,
                  })}
                  onClick={() => onEditingRule(rule)}
                >
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {rule.type}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    <Text noOfLines={1}>{rule.content}</Text>
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm">
                    {rule.option}
                  </Td>
                  <Td pt="2.5" pb="2.5" fontSize="sm">
                    <Text whiteSpace="nowrap">
                      {rule.ruleset} (
                      {rule.policy || rulesetsByName[rule.ruleset]?.policy})
                    </Text>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <Pagination
          onChange={(page, limit) => {
            onRuleFilterChange({
              ...ruleFilter,
              limit,
              offset: page * limit,
            });
          }}
          total={totalRules}
          limit={ruleFilter.limit}
          offset={ruleFilter.offset}
        />
      </Box>
    </VStack>
  );
};

export const Droppable = ({ children, ...props }: DroppableProps) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));

    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return <DroppableBug {...props}>{children}</DroppableBug>;
};
