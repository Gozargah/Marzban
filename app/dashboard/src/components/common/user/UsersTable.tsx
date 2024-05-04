import {
  Accordion,
  AccordionButton,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  ExpandedIndex,
  HStack,
  IconButton,
  Select,
  Slider,
  SliderFilledTrack,
  SliderProps,
  SliderTrack,
  Table,
  TableProps,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  chakra,
  useBreakpointValue,
} from "@chakra-ui/react";
import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  LinkIcon,
  PencilIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import AddFileIcon from "assets/add_file.svg?react";
import classNames from "classnames";
import { Pagination } from "components/elements/Pagination";
import { StatusBadge } from "components/shared/StatusBadge";
import { resetStrategy, statusColors } from "config/user-settings";
import { useDashboard, useUsers } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { FC, Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserResponse } from "services/api";
import { formatBytes } from "utils/formatByte";
import { OnlineBadge, getRelativeLastOnlineAt, humanizeRelativeLastOnline } from "./OnlineBadge";

const EmptySectionIcon = chakra(AddFileIcon);

const iconProps = {
  baseStyle: {
    w: {
      base: 4,
      md: 5,
    },
    h: {
      base: 4,
      md: 5,
    },
  },
};
const CopyIcon = chakra(ClipboardIcon, iconProps);
const AccordionArrowIcon = chakra(ChevronDownIcon, iconProps);
const CopiedIcon = chakra(CheckIcon, iconProps);
const SubscriptionLinkIcon = chakra(LinkIcon, iconProps);
const QRIcon = chakra(QrCodeIcon, iconProps);
const EditIcon = chakra(PencilIcon, iconProps);
const SortIcon = chakra(ChevronDownIcon, {
  baseStyle: {
    width: "15px",
    height: "15px",
  },
});
type UsageSliderProps = {
  used: number;
  total: number | null;
  dataLimitResetStrategy: string | null;
  totalUsedTraffic: number;
} & SliderProps;

const getResetStrategy = (strategy: string): string => {
  for (var i = 0; i < resetStrategy.length; i++) {
    const entry = resetStrategy[i];
    if (entry.value == strategy) {
      return entry.title;
    }
  }
  return "No";
};
const UsageSliderCompact: FC<UsageSliderProps> = (props) => {
  const { used, total, dataLimitResetStrategy, totalUsedTraffic } = props;
  const isUnlimited = total === 0 || total === null;
  return (
    <HStack
      justifyContent="space-between"
      fontSize="xs"
      fontWeight="medium"
      color="gray.600"
      _dark={{
        color: "gray.400",
      }}
    >
      <Text>
        {formatBytes(used)} /{" "}
        {isUnlimited ? (
          <Text as="span" fontFamily="system-ui">
            ∞
          </Text>
        ) : (
          formatBytes(total)
        )}
      </Text>
    </HStack>
  );
};
const UsageSlider: FC<UsageSliderProps> = (props) => {
  const { used, total, dataLimitResetStrategy, totalUsedTraffic, ...restOfProps } = props;
  const isUnlimited = total === 0 || total === null;
  const isReached = !isUnlimited && (used / total) * 100 >= 100;
  const { t } = useTranslation();
  return (
    <>
      <Slider
        orientation="horizontal"
        value={isUnlimited ? 100 : Math.min((used / total) * 100, 100)}
        colorScheme={isReached ? "red" : "primary"}
        {...restOfProps}
      >
        <SliderTrack h="6px" borderRadius="full">
          <SliderFilledTrack borderRadius="full" />
        </SliderTrack>
      </Slider>
      <HStack
        justifyContent="space-between"
        fontSize="xs"
        fontWeight="medium"
        color="gray.600"
        _dark={{
          color: "gray.400",
        }}
      >
        <Text>
          {formatBytes(used)} /{" "}
          {isUnlimited ? (
            <Text as="span" fontFamily="system-ui">
              ∞
            </Text>
          ) : (
            formatBytes(total) +
            (dataLimitResetStrategy && dataLimitResetStrategy !== "no_reset"
              ? " " + t("userDialog.resetStrategy" + getResetStrategy(dataLimitResetStrategy))
              : "")
          )}
        </Text>
        <Text>
          {t("usersTable.total")}: {formatBytes(totalUsedTraffic)}
        </Text>
      </HStack>
    </>
  );
};
export type SortType = {
  sort?: string;
  column: string;
};
export const Sort: FC<SortType> = ({ sort = "", column }) => {
  if (sort.includes(column)) return <SortIcon transform={sort.startsWith("-") ? undefined : "rotate(180deg)"} />;
  return null;
};
type UsersTableProps = {} & TableProps;
export const UsersTable: FC<UsersTableProps> = (props) => {
  const { filters, onEditingUser, onFilterChange } = useDashboard();
  const { data: { users } = { users: [] }, data: totalUsers = { users: [], total: 0 } } = useUsers();
  const { t } = useTranslation();
  const [selectedRow, setSelectedRow] = useState<ExpandedIndex | undefined>(undefined);
  const marginTop = useBreakpointValue({ base: 120, lg: 72 }) || 72;
  const [top, setTop] = useState(`${marginTop}px`);
  const useTable = useBreakpointValue({ base: false, lg: true });

  useEffect(() => {
    const calcTop = () => {
      const el = document.querySelectorAll("#filters")[0] as HTMLElement;
      setTop(`${el.offsetHeight}px`);
    };
    window.addEventListener("scroll", calcTop);
    () => window.removeEventListener("scroll", calcTop);
  }, []);

  const isFiltered = users.length !== totalUsers.total;

  const handleSort = (column: string) => {
    let newSort = filters.sort || "";
    if (newSort.includes(column)) {
      if (newSort.startsWith("-")) {
        newSort = "-created_at";
      } else {
        newSort = "-" + column;
      }
    } else {
      newSort = column;
    }
    onFilterChange({
      sort: newSort,
    });
  };
  const handleStatusFilter = (e: any) => {
    onFilterChange({
      status: e.target.value.length > 0 ? e.target.value : undefined,
    });
  };

  const toggleAccordion = (index: number) => {
    setSelectedRow(index === selectedRow ? undefined : index);
  };

  return (
    <Box id="users-table">
      <Accordion allowMultiple display={{ base: "block", lg: "none" }} index={selectedRow}>
        <Table orientation="vertical" zIndex="docked" {...props}>
          <Thead zIndex="docked" position="relative">
            <Tr>
              <Th
                position="sticky"
                top={top}
                minW="120px"
                pl={4}
                pr={4}
                cursor={"pointer"}
                onClick={handleSort.bind(null, "username")}
              >
                <HStack>
                  <span>{t("users")}</span>
                  <Sort sort={filters.sort} column="username" />
                </HStack>
              </Th>
              <Th
                position="sticky"
                top={top}
                minW={!!filters.status ? "140px" : "55px"}
                pl={0}
                pr={0}
                w="140px"
                cursor={"pointer"}
              >
                <HStack spacing={0} position="relative">
                  <Text position="absolute" bg="th-bg" userSelect="none" pointerEvents="none" zIndex={1} w="100%">
                    {t("usersTable.status")}
                    {filters.status ? ": " + filters.status : ""}
                  </Text>
                  <Select
                    fontSize="xs"
                    fontWeight="extrabold"
                    textTransform="uppercase"
                    cursor="pointer"
                    p={0}
                    border={0}
                    h="auto"
                    w="auto"
                    icon={<></>}
                    _focusVisible={{
                      border: "0 !important",
                    }}
                    onChange={handleStatusFilter}
                  >
                    <option></option>
                    <option>active</option>
                    <option>disabled</option>
                    <option>limited</option>
                    <option>expired</option>
                  </Select>
                </HStack>
              </Th>
              <Th
                position="sticky"
                top={top}
                minW="110px"
                cursor={"pointer"}
                pr={0}
                onClick={handleSort.bind(null, "used_traffic")}
              >
                <HStack>
                  <span>{t("usersTable.dataUsage")}</span>
                  <Sort sort={filters.sort} column="used_traffic" />
                </HStack>
              </Th>
              <Th position="sticky" top={top} minW="32px" w="32px" p={0} cursor={"pointer"}></Th>
            </Tr>
          </Thead>
          <Tbody>
            {!useTable &&
              users?.map((user, i) => {
                return (
                  <Fragment key={user.username}>
                    <Tr onClick={toggleAccordion.bind(null, i)} cursor="pointer">
                      <Td
                        borderBottom={0}
                        minW="100px"
                        maxW={{
                          base: "calc(100vw - 110px - 55px - 32px - 48px)",
                          md: "calc(100vw - 110px - 55px - 32px - 48px - 295px)",
                        }}
                        pl={4}
                        pr={4}
                      >
                        <Box display="flex" justifyContent="start" alignItems="center" gap={2}>
                          <OnlineBadge lastOnline={user.online_at} />
                          <Text isTruncated>{user.username}</Text>
                        </Box>
                      </Td>
                      <Td borderBottom={0} minW="50px" pl={0} pr={0}>
                        <StatusBadge compact showDetail={false} expiryDate={user.expire} status={user.status} />
                      </Td>
                      <Td borderBottom={0} minW="110px" pr={0}>
                        <UsageSliderCompact
                          totalUsedTraffic={user.lifetime_used_traffic}
                          dataLimitResetStrategy={user.data_limit_reset_strategy}
                          used={user.used_traffic}
                          total={user.data_limit}
                          colorScheme={statusColors[user.status].bandWidthColor}
                        />
                      </Td>
                      <Td p={0} borderBottom={0} w="32px" minW="32px">
                        <AccordionArrowIcon
                          color="gray.600"
                          _dark={{
                            color: "gray.400",
                          }}
                          transition="transform .2s ease-out"
                          transform={selectedRow === i ? "rotate(180deg)" : "0deg"}
                        />
                      </Td>
                    </Tr>
                    <Tr className="collapsible" onClick={toggleAccordion.bind(null, i)}>
                      <Td p={0} colSpan={4}>
                        <AccordionItem border={0}>
                          <AccordionButton display="none"></AccordionButton>
                          <AccordionPanel border={0} cursor="pointer" px={6} py={3}>
                            <VStack justifyContent="space-between">
                              <VStack alignItems="flex-start" w="full" spacing={-1}>
                                <Text
                                  textTransform="capitalize"
                                  fontSize="xs"
                                  fontWeight="bold"
                                  color="gray.600"
                                  _dark={{
                                    color: "gray.400",
                                  }}
                                >
                                  {t("usersTable.dataUsage")}
                                </Text>
                                <Box width="full" minW="230px">
                                  <UsageSlider
                                    totalUsedTraffic={user.lifetime_used_traffic}
                                    dataLimitResetStrategy={user.data_limit_reset_strategy}
                                    used={user.used_traffic}
                                    total={user.data_limit}
                                    colorScheme={statusColors[user.status].bandWidthColor}
                                  />
                                </Box>
                              </VStack>
                              <HStack justifyContent="start" w="full">
                                <Text
                                  display="inline-block"
                                  fontSize="xs"
                                  fontWeight="medium"
                                  color="gray.600"
                                  _dark={{
                                    color: "gray.400",
                                  }}
                                >
                                  {humanizeRelativeLastOnline(
                                    getRelativeLastOnlineAt({
                                      lastOnline: user.online_at,
                                    })
                                  )}
                                </Text>
                              </HStack>
                              <HStack w="full" justifyContent="space-between">
                                <Box width="full">
                                  <StatusBadge expiryDate={user.expire} status={user.status} />
                                </Box>
                                <HStack>
                                  <ActionButtons user={user} />
                                  <Tooltip label={t("userDialog.editUser")} placement="top">
                                    <IconButton
                                      p="0 !important"
                                      aria-label="Edit user"
                                      bg="transparent"
                                      _dark={{
                                        _hover: {
                                          bg: "gray.700",
                                        },
                                      }}
                                      size={{
                                        base: "sm",
                                        md: "md",
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditingUser(user);
                                      }}
                                    >
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                </HStack>
                              </HStack>
                            </VStack>
                          </AccordionPanel>
                        </AccordionItem>
                      </Td>
                    </Tr>
                  </Fragment>
                );
              })}
          </Tbody>
        </Table>
      </Accordion>
      <Table orientation="vertical" display={{ base: "none", lg: "table" }} {...props}>
        <Thead zIndex="docked" position="relative">
          <Tr>
            <Th
              position="sticky"
              top={{ base: "unset", lg: top }}
              minW="140px"
              cursor={"pointer"}
              onClick={handleSort.bind(null, "username")}
            >
              <HStack>
                <span>{t("username")}</span>
                <Sort sort={filters.sort} column="username" />
              </HStack>
            </Th>
            <Th
              position="sticky"
              top={{ base: "unset", lg: top }}
              width="340px"
              maxW="340px"
              minW="120px"
              cursor={"pointer"}
              pl={1}
            >
              <HStack spacing={0} position="relative">
                <Text position="absolute" bg="th-bg" userSelect="none" pointerEvents="none" zIndex={1} w="100%">
                  {t("usersTable.status")}
                  {filters.status ? ": " + filters.status : ""}
                </Text>
                <Select
                  fontSize="xs"
                  fontWeight="extrabold"
                  textTransform="uppercase"
                  cursor="pointer"
                  p={0}
                  border={0}
                  h="auto"
                  w="full"
                  icon={<></>}
                  _focusVisible={{
                    border: "0 !important",
                  }}
                  onChange={handleStatusFilter}
                >
                  <option></option>
                  <option>active</option>
                  <option>disabled</option>
                  <option>limited</option>
                  <option>expired</option>
                </Select>
              </HStack>
            </Th>
            <Th
              position="sticky"
              top={{ base: "unset", lg: top }}
              width="350px"
              minW="200px"
              cursor={"pointer"}
              onClick={handleSort.bind(null, "used_traffic")}
            >
              <HStack>
                <span>{t("usersTable.dataUsage")}</span>
                <Sort sort={filters.sort} column="used_traffic" />
              </HStack>
            </Th>
            <Th position="sticky" top={{ base: "unset", lg: top }} width="52px" minW="52px" />
          </Tr>
        </Thead>
        <Tbody>
          {useTable &&
            users?.map((user, i) => {
              return (
                <Tr
                  key={user.username}
                  className={classNames("interactive", {
                    "last-row": i === users.length - 1,
                  })}
                  onClick={() => onEditingUser(user)}
                >
                  <Td minW="140px" maxW="calc(100vw - 270px - 120px - 200px - 185px - 48px)">
                    <VStack gap="0" align="start">
                      <Box display="flex" isTruncated justifyContent="start" alignItems="center" gap={2}>
                        <OnlineBadge lastOnline={user.online_at} />
                        <Text isTruncated>{user.username}</Text>
                      </Box>
                      <Text color="text-inactive" fontSize="xs">
                        Created {dayjs().to(dayjs(user.created_at).utc().local())}
                      </Text>
                    </VStack>
                  </Td>
                  <Td width="340px" maxW="340px" minW="120px" pr="1" pl="1">
                    <StatusBadge expiryDate={user.expire} status={user.status} />
                  </Td>
                  <Td width="350px" minW="200px">
                    <UsageSlider
                      totalUsedTraffic={user.lifetime_used_traffic}
                      dataLimitResetStrategy={user.data_limit_reset_strategy}
                      used={user.used_traffic}
                      total={user.data_limit}
                      colorScheme={statusColors[user.status].bandWidthColor}
                    />
                  </Td>
                  <Td width="52px" minW="52px">
                    <ActionButtons user={user} />
                  </Td>
                </Tr>
              );
            })}
          {users.length == 0 && (
            <Tr>
              <Td colSpan={4}>
                <EmptySection isFiltered={isFiltered} />
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>
      <Pagination />
    </Box>
  );
};

type ActionButtonsProps = {
  user: Required<UserResponse>;
};

const ActionButtons: FC<ActionButtonsProps> = ({ user }) => {
  const { setQRCode, setSubLink } = useDashboard();

  const proxyLinks = user.links.join("\r\n");

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
      {/* <CopyToClipboard
        text={
          user.subscription_url.startsWith("/") ? window.location.origin + user.subscription_url : user.subscription_url
        }
        onCopy={() => {
          setCopied([0, true]);
        }}
      >
        <div>
          <Tooltip
            label={copied[0] == 0 && copied[1] ? t("usersTable.copied") : t("usersTable.copyLink")}
            placement="top"
          >
            <IconButton
              p="0 !important"
              aria-label="copy subscription link"
              bg="transparent"
              _dark={{
                _hover: {
                  bg: "gray.700",
                },
              }}
              size={{
                base: "sm",
                md: "md",
              }}
            >
              {copied[0] == 0 && copied[1] ? <CopiedIcon /> : <SubscriptionLinkIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </CopyToClipboard> */}
      {/* <CopyToClipboard
        text={proxyLinks}
        onCopy={() => {
          setCopied([1, true]);
        }}
      >
        <div>
          <Tooltip
            label={copied[0] == 1 && copied[1] ? t("usersTable.copied") : t("usersTable.copyConfigs")}
            placement="top"
          >
            <IconButton
              p="0 !important"
              aria-label="copy configs"
              bg="transparent"
              _dark={{
                _hover: {
                  bg: "gray.700",
                },
              }}
              size={{
                base: "sm",
                md: "md",
              }}
            >
              {copied[0] == 1 && copied[1] ? <CopiedIcon /> : <CopyIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </CopyToClipboard> */}
      <Tooltip label="QR Code" placement="top">
        <IconButton
          p="0 !important"
          aria-label="qr code"
          bg="transparent"
          _dark={{
            _hover: {
              bg: "gray.700",
            },
          }}
          size={{
            base: "sm",
            md: "md",
          }}
          onClick={() => {
            setQRCode(user.links);
            setSubLink(user.subscription_url);
          }}
        >
          <QRIcon />
        </IconButton>
      </Tooltip>
    </HStack>
  );
};

type EmptySectionProps = {
  isFiltered: boolean;
};

const EmptySection: FC<EmptySectionProps> = ({ isFiltered }) => {
  const { onCreateUser } = useDashboard();
  const { t } = useTranslation();
  return (
    <Box padding="5" py="8" display="flex" alignItems="center" flexDirection="column" gap={4} w="full">
      <EmptySectionIcon
        maxHeight="200px"
        maxWidth="200px"
        _dark={{
          'path[fill="#fff"]': {
            fill: "gray.800",
          },
          'path[fill="#f2f2f2"], path[fill="#e6e6e6"], path[fill="#ccc"]': {
            fill: "gray.700",
          },
          'circle[fill="#3182CE"]': {
            fill: "primary.300",
          },
        }}
        _light={{
          'path[fill="#f2f2f2"], path[fill="#e6e6e6"], path[fill="#ccc"]': {
            fill: "gray.300",
          },
          'circle[fill="#3182CE"]': {
            fill: "primary.500",
          },
        }}
      />
      <Text fontWeight="medium" color="gray.600" _dark={{ color: "gray.400" }}>
        {isFiltered ? t("usersTable.noUserMatched") : t("usersTable.noUser")}
      </Text>
      {!isFiltered && (
        <Button size="sm" colorScheme="primary" onClick={() => onCreateUser(true)}>
          {t("createUser")}
        </Button>
      )}
    </Box>
  );
};
