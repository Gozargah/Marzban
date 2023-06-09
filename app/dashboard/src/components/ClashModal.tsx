import {
  chakra,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Box,
  useColorMode,
  VStack,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  StackProps,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Spinner,
  IconButton,
  Input,
  Tooltip,
  Button,
  Select,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  BoxProps,
  useToast,
} from "@chakra-ui/react";
import { CheckIcon, LinkIcon } from '@chakra-ui/icons'
import {
  RssIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  InformationCircleIcon,
  PlusIcon,
  PencilIcon,
  ArrowPathRoundedSquareIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import React, { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon as TitleIcon } from "./Icon";
import classNames from "classnames";
import { Sort } from "./UsersTable";
import { Ruleset, User, useClash } from "contexts/ClashContext";
import { Pagination } from "./Pagination";
import debounce from "lodash.debounce";
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { StreamLanguage } from '@codemirror/language';
import CopyToClipboard from "react-copy-to-clipboard";

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
export const SubscriptionIcon = chakra(RssIcon, iconProps);
export const GroupSetting = chakra(Cog6ToothIcon, iconProps);
export const ReloadIcon = chakra(ArrowPathIcon, iconProps);
export const RefreshIcon = chakra(ArrowPathRoundedSquareIcon, iconProps);
export const DuplicateIcon = chakra(DocumentDuplicateIcon, {
  baseStyle: {
    w: 6, 
    h: 6,
  }
});
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
  const {
    isEditingSubscription,
    onEditingSubscription,
  } = useDashboard();
  const {
    isEditing,
    onShouldFetch,
  } = useClash();
  const { t } = useTranslation();

  const onClose = () => {
    onEditingSubscription(false);
    onShouldFetch(true);
  };

  return (
    <Tabs isLazy lazyBehavior="keepMounted">
      <Modal
        isOpen={isEditingSubscription && !isEditing()}
        onClose={onClose}
        size="5xl"
      >
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent mx="3" w="full">
          <ModalHeader pt={6}>
            <HStack gap={2}>
              <TitleIcon color="primary">
                  <SubscriptionIcon color="white" />
              </TitleIcon>
              <TabList>
                <Tab fontSize="lg">{t("clash.users")}</Tab>
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
                <Users />
              </TabPanel>
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
          </ModalBody>
          <ModalFooter mt="3">
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Tabs>
  );
};

const Setting: FC<BoxProps> = () => {
  const {
    loading,
    settings,
    fetchSetting,
    editSetting,
    shouldFetch
  } = useClash();
  const { isEditingSubscription } = useDashboard();
  const { colorMode } = useColorMode();
  const { t } = useTranslation();
  const toast = useToast();
  const [value, setValue] = useState(settings.clash?.content);
  useEffect(() => {
    if (isEditingSubscription) {
      if (shouldFetch.settings) {
        fetchSetting({name: "clash"});
      }
    }
  }, [isEditingSubscription]);

  const save = () => {
    editSetting({name: "clash", content: value})
      .then(() => {
        toast({
          title: t("clash.setting.savedSuccess"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      });
  };

  return (
    <VStack w="full">
      <CodeMirror
        value={settings.clash?.content}
        height="500px"
        theme={colorMode}
        extensions={[StreamLanguage.define(yaml)]}
        onChange={(v) => setValue(v)}
      />
      <HStack w="full" justifyContent="flex-end">
        <Button
          colorScheme="primary"
          size="sm"
          isDisabled={loading}
          onClick={save}
          px={5}
        >
          {t("clash.save")}
        </Button>
      </HStack>
    </VStack>
    
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
    loading,
    shouldFetch,
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
        newSort = "-created_at";
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
      if (shouldFetch.proxies) {
        fetchProxies();
      }
      if (shouldFetch.proxyInbounds) {
        fetchProxyInbounds();
      }
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
            aria-label="refresh users"
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
                  <span>{t("clash.tag")}</span>
                  <Sort sort={proxyFilter.sort} column="tag" />
                </HStack>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {proxies.data?.map((proxy, i) => {
              return (
                <Tr
                  key={proxy.id}
                  className={classNames("interactive", {
                    "last-row": i === proxies.data.length - 1,
                  })}
                  onClick={() => onEditingProxy(proxy)}
                >
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >
                    {proxy.id}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >
                    {proxy.name}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >
                    {proxy.server}:{proxy.port}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >
                    {proxy.inbound}
                  </Td>
                  <Td pt="2.5" pb="2.5" fontSize="sm" >
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
              offset: page * limit
            })
          }}
          total={proxies.total}
          limit={proxyFilter.limit}
          offset={proxyFilter.offset}/>
      </Box>
    </VStack>
  )
}

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
    proxyGroups,
    loading,
    onEditingProxyGroup,
    onCreateProxyGroup,
    shouldFetch,
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
        newSort = "-created_at";
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
    if (isEditingSubscription && shouldFetch.proxyGroups) {
      fetchProxyGroups();
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
            aria-label="refresh users"
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
                  <span>{t("clash.tag")}</span>
                  <Sort sort={proxyGroupFilter.sort} column="tag" />
                </HStack>
              </Th>
              <Th
                minW="140px"
                cursor={"pointer"}
              >
                <HStack>
                  <span>{t("clash.proxies")}</span>
                </HStack>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {proxyGroups.data?.map((group, i) => {
              return (
                <Tr
                  key={group.id}
                  className={classNames("interactive", {
                    "last-row": i === proxyGroups.data.length - 1,
                  })}
                  onClick={() => onEditingProxyGroup(group)}
                >
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >
                    {group.id}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >
                    {group.name}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >
                    {group.type}
                  </Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >
                    {group.tag}</Td>
                  <Td pt="2.5" pb="2.5" fontSize="sm" >
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
              offset: page * limit
            })
          }}
          total={proxyGroups.total}
          limit={proxyGroupFilter.limit}
          offset={proxyGroupFilter.offset}/>
      </Box>
    </VStack>
  )
}

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
    rulesets,
    loading,
    shouldFetch,
  } = useClash();

  const [search, setSearch] = useState("");
  const rulesetsByName: { [key: string]: Ruleset } = rulesets.data.reduce((ac, a) => ({...ac, [a.name]: a}), {});

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
    const arr = rulesets.data.filter((value) => value.name === name);
    return arr.length ? arr[0] : null; 
  }

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
  useEffect(() => {
    if (!findRuleset(ruleFilter.ruleset) && shouldFetch.rulesets) {
      onRuleFilterChange({
        ruleset: "",
        offset: 0,
      });
    }
  }, [rulesets]);

  const handleEditRuleset = () => {
    onEditingRuleset(findRuleset(ruleFilter.ruleset));
  };

  const handleSort = (column: string) => {
    let newSort = ruleFilter.sort;
    if (newSort.includes(column)) {
      if (newSort.startsWith("-")) {
        newSort = "-created_at";
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
    if (isEditingSubscription && shouldFetch.rules) {
      fetchRules();
      fetchRulesets();
    }
  }, [isEditingSubscription]);

  return (
    <VStack w="full">
      <HStack w="full" justifyContent="space-between">
        <HStack>
          <Tooltip
            label={ruleFilter.ruleset ? t("clash.ruleset.edit") : ""}
            placement="top"
          >
            <IconButton
              aria-label="usage"
              size="sm"
              isDisabled={!ruleFilter.ruleset}
              onClick={handleEditRuleset}
            >
              <GroupSetting />
            </IconButton>
          </Tooltip>
          <Select
            size="sm"
            maxW="160px"
            value={ruleFilter.ruleset || "All"}
            onChange={(e) => onRulesetChange(e.target.value)}
          >
            <option key="All" value="All">All</option>
            {rulesets.data.map((entry) => {
              return (
                <option key={entry.name} value={entry.name}>
                  {entry.name}
                </option>
              )
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
          <Button
            colorScheme="primary"
            size="sm"
            onClick={() => onCreateRule(true)}
            px={5}
          >
            {t("clash.rule.add")}
          </Button>
          <Button
            colorScheme="primary"
            size="sm"
            onClick={() => onCreateRuleset(true)}
            px={5}
          >
            {t("clash.ruleset.add")}
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
              <Th
                minW="140px"
              >
                <HStack>
                  <span>{t("clash.ruleset")}</span>
                </HStack>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rules.data?.map((rule, i) => {
              return (
                <Tr
                  key={rule.content}
                  className={classNames("interactive", {
                    "last-row": i === rules.data.length - 1,
                  })}
                  onClick={() => onEditingRule(rule)}
                >
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >{rule.type}</Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >{rule.content}</Td>
                  <Td pt="2.5" pb="2.5" pr="0" fontSize="sm" >{rule.option}</Td>
                  <Td pt="2.5" pb="2.5" fontSize="sm" >
                    {rule.ruleset} ({rulesetsByName[rule.ruleset]?.preferred_proxy})
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
              offset: page * limit
            })
          }}
          total={rules.total}
          limit={ruleFilter.limit}
          offset={ruleFilter.offset}/>
      </Box>
    </VStack>
  )
}

const setUserSearchField = debounce((search: string) => {
  useClash.getState().onUserFilterChange({
    ...useClash.getState().userFilter,
    offset: 0,
    search,
  });
}, 300);

const Users: FC<StackProps> = () => {
  const { isEditingSubscription } = useDashboard();
  const { t } = useTranslation();
  const {
    userFilter,
    onUserFilterChange,
    onEditingUser,
    fetchUsers,
    fetchProxyTags,
    users,
    loading,
    shouldFetch,
  } = useClash();

  const [search, setSearch] = useState("");

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setUserSearchField(e.target.value);
  };
  const clear = () => {
    setSearch("");
    onUserFilterChange({
      ...userFilter,
      offset: 0,
      search: "",
    });
  };

  const handleSort = (column: string) => {
    let newSort = userFilter.sort;
    if (newSort.includes(column)) {
      if (newSort.startsWith("-")) {
        newSort = "-created_at";
      } else {
        newSort = "-" + column;
      }
    } else {
      newSort = column;
    }
    onUserFilterChange({
      sort: newSort,
      offset: 0,
    });
  };

  useEffect(() => {
    if (isEditingSubscription) {
      if (shouldFetch.users) {
        fetchUsers();
      }
      if (shouldFetch.proxyTags) {
        fetchProxyTags();
      }
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
      </HStack>
      <Box overflowX="auto" w="full">
        <Table orientation="vertical">
          <Thead zIndex="docked" position="relative">
            <Tr>
              <Th
                minW="140px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "username")}
              >
                <HStack>
                  <span>{t("username")}</span>
                  <Sort sort={userFilter.sort} column="username" />
                </HStack>
              </Th>
              <Th
                minW="140px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "domain")}
              >
                <HStack>
                  <span>{t("clash.domain")}</span>
                  <Sort sort={userFilter.sort} column="domain" />
                </HStack>
              </Th>
              <Th
                minW="140px"
                cursor={"pointer"}
                onClick={handleSort.bind(null, "tags")}
              >
                <HStack>
                  <span>{t("clash.tags")}</span>
                  <Sort sort={userFilter.sort} column="tags" />
                </HStack>
              </Th>
              <Th
                w="10px"
              />
            </Tr>
          </Thead>
          <Tbody>
            {users.data?.map((user, i) => {
              return (
                <Tr
                  key={user.username}
                  className={classNames("interactive", {
                    "last-row": i === users.data.length - 1,
                  })}
                  onClick={() => onEditingUser(user)}
                >
                  <Td pt="5px" pb="5px" pr="0" fontSize="sm" >
                    {user.username}
                  </Td>
                  <Td pt="5px" pb="5px" pr="0" fontSize="sm" >
                      {user.domain}
                  </Td>
                  <Td pt="5px" pb="5px" pr="0" fontSize="sm" maxW="300px">
                    <Text noOfLines={1}>
                      {user.tags?.split(",").join(", ")}
                    </Text>
                  </Td>
                  <Td pt="5px" pb="5px" fontSize="sm" >
                    <ActionButtons user={user} />
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <Pagination
          onChange={(page, limit) => {
            onUserFilterChange({
              ...userFilter,
              limit,
              offset: page * limit
            })
          }}
          total={users.total}
          limit={userFilter.limit}
          offset={userFilter.offset}/>
      </Box>
    </VStack>
  )
};

type ActionButtonsProps = {
  user: User;
};

const ActionButtons: FC<ActionButtonsProps> = ({ user }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState([-1, false]);
  useEffect(() => {
    if (copied[1]) {
      setTimeout(() => {
        setCopied([-1, false]);
      }, 1000);
    }
  }, [copied]);
  return (
    <HStack
      justifyContent="flex-end"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {user.sublink && (
        <CopyToClipboard
          text={user.sublink}
          onCopy={() => {
            setCopied([0, true]);
          }}
        >
          <div>
            <Tooltip
              label={
                copied[0] == 0 && copied[1]
                  ? t("clash.copied")
                  : t("clash.copyLink")
              }
              placement="top"
            >
              <IconButton
                disabled={true}
                minW="30px"
                minH="30px"
                height="30px"
                p="0 !important"
                aria-label="copy subscription link"
                bg="transparent"
                _dark={{
                  _hover: {
                    bg: "gray.700",
                  },
                }}
              >
                {copied[0] == 0 && copied[1] ? (
                  <CheckIcon />
                ) : (
                  <LinkIcon />
                )}
              </IconButton>
            </Tooltip>
          </div>
        </CopyToClipboard>
      )}
      {!user.sublink && (
        <Box height="30px" />
      )}
    </HStack>
  );
};