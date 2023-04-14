import {
  Box,
  Button,
  chakra,
  HStack,
  IconButton,
  Select,
  Slider,
  SliderFilledTrack,
  SliderProps,
  SliderTrack,
  Table,
  TableContainer,
  TableProps,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useBreakpointValue,
} from "@chakra-ui/react";
import {
  CheckIcon,
  ClipboardIcon,
  LinkIcon,
  QrCodeIcon,
  ArrowPathIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { FC, useCallback, useEffect, useState } from "react";
import { ReactComponent as AddFileIcon } from "assets/add_file.svg";
import { formatBytes } from "utils/formatByte";
import { useDashboard } from "contexts/DashboardContext";
import CopyToClipboard from "react-copy-to-clipboard";
import { UserBadge } from "./UserBadge";
import { Pagination } from "./Pagination";
import classNames from "classnames";
import { statusColors, resetStrategy } from "constants/UserSettings";
import { DataLimitResetStrategy } from "types/User";
import { useTranslation } from "react-i18next";
import { t } from "i18next";

const EmptySectionIcon = chakra(AddFileIcon);

const iconProps = {
  baseStyle: {
    w: 5,
    h: 5,
  },
};
const CopyIcon = chakra(ClipboardIcon, iconProps);
const CopiedIcon = chakra(CheckIcon, iconProps);
const SubscriptionLinkIcon = chakra(LinkIcon, iconProps);
const QRIcon = chakra(QrCodeIcon, iconProps);
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

const UsageSlider: FC<UsageSliderProps> = (props) => {
  const {
    used,
    total,
    dataLimitResetStrategy,
    totalUsedTraffic,
    ...restOfProps
  } = props;
  const isUnlimited = total === 0 || total === null;
  const isReached = !isUnlimited && (used / total) * 100 >= 100;
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
        <Text>Total: {formatBytes(totalUsedTraffic)}</Text>
      </HStack>
    </>
  );
};
export type SortType = {
  sort: string;
  column: string;
};
export const Sort: FC<SortType> = ({ sort, column }) => {
  if (sort.includes(column))
    return (
      <SortIcon
        transform={sort.startsWith("-") ? "rotate(180deg)" : undefined}
      />
    );
  return null;
};
type UsersTableProps = {} & TableProps;
export const UsersTable: FC<UsersTableProps> = (props) => {
  const {
    filters,
    users: { users },
    users: totalUsers,
    onEditingUser,
    setQRCode,
    setSubLink,
    onFilterChange,
  } = useDashboard();
  const marginTop =
    useBreakpointValue({
      base: 120,
      lg: 72,
    }) || 72;

  const isFiltered = users.length !== totalUsers.total;
  const [copied, setCopied] = useState([-1, -1, false]);

  useEffect(() => {
    if (copied[2]) {
      setTimeout(() => {
        setCopied([-1, -1, false]);
      }, 1000);
    }
  }, [copied]);

  const tableFixHead = useCallback(() => {
    const el = document.querySelectorAll("#users-table")[0] as HTMLElement;
    const sT = window.scrollY;

    document.querySelectorAll("#users-table thead th").forEach((th: any) => {
      const transformY =
        el.offsetTop - marginTop <= sT ? sT - el.offsetTop + marginTop : 0;
      th.style.transform = `translateY(${transformY}px)`;
    });
  }, [marginTop, users]);

  useEffect(() => {
    window.addEventListener("scroll", tableFixHead);
    window.addEventListener("resize", tableFixHead);
    return () => {
      window.removeEventListener("scroll", tableFixHead);
      window.removeEventListener("resize", tableFixHead);
    };
  }, [tableFixHead]);
  const handleSort = (column: string) => {
    let newSort = filters.sort;
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
  const { t } = useTranslation();
  return (
    <Box id="users-table" overflowX="auto">
      <Table {...props}>
        <Thead zIndex="docked" position="relative">
          <Tr>
            <Th
              minW="150px"
              cursor={"pointer"}
              onClick={handleSort.bind(null, "username")}
            >
              <HStack>
                <span>{t("username")}</span>
                <Sort sort={filters.sort} column="username" />
              </HStack>
            </Th>
            <Th width="400px" minW="180px" cursor={"pointer"}>
              <HStack spacing={0} position="relative">
                <Text
                  position="absolute"
                  _dark={{
                    bg: "gray.750",
                  }}
                  _light={{
                    bg: "#F9FAFB",
                  }}
                  userSelect="none"
                  pointerEvents="none"
                  zIndex={1}
                  w="100%"
                >
                  {t("usersTable.status")}{filters.status ? ": " + filters.status : ""}
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
              width="350px"
              minW="250px"
              cursor={"pointer"}
              onClick={handleSort.bind(null, "used_traffic")}
            >
              <HStack>
                <span>{t("usersTable.dataUsage")}</span>
                <Sort sort={filters.sort} column="used_traffic" />
              </HStack>
            </Th>
            <Th width="200px"></Th>
          </Tr>
        </Thead>
        <Tbody>
          {users?.map((user, i) => {
            const proxyLinks = user.links.join("\r\n");
            return (
              <Tr
                key={user.username}
                className={classNames("interactive", {
                  "last-row": i === users.length - 1,
                })}
                onClick={() => onEditingUser(user)}
              >
                <Td minW="150px">{user.username}</Td>
                <Td width="400px" minW="180px">
                  <UserBadge expiryDate={user.expire} status={user.status} />
                </Td>
                <Td width="350px" minW="250px">
                  <UsageSlider
                    totalUsedTraffic={user.lifetime_used_traffic}
                    dataLimitResetStrategy={user.data_limit_reset_strategy}
                    used={user.used_traffic}
                    total={user.data_limit}
                    colorScheme={statusColors[user.status].bandWidthColor}
                  />
                </Td>
                <Td width="200px">
                  <HStack
                    justifyContent="flex-end"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <CopyToClipboard
                      text={
                        user.subscription_url.startsWith("/")
                          ? window.location.origin + user.subscription_url
                          : user.subscription_url
                      }
                      onCopy={() => {
                        setCopied([i, 0, true]);
                      }}
                    >
                      <div>
                        <Tooltip
                          label={
                            copied[0] === i && copied[1] == 0 && copied[2]
                              ? t("usersTable.copied")
                              : t("usersTable.copyLink")
                          }
                          placement="top"
                        >
                          <IconButton
                            aria-label="copy subscription link"
                            bg="transparent"
                            _dark={{
                              _hover: {
                                bg: "gray.700",
                              },
                            }}
                          >
                            {copied[0] === i && copied[1] == 0 && copied[2] ? (
                              <CopiedIcon />
                            ) : (
                              <SubscriptionLinkIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                      </div>
                    </CopyToClipboard>
                    <CopyToClipboard
                      text={proxyLinks}
                      onCopy={() => {
                        setCopied([i, 1, true]);
                      }}
                    >
                      <div>
                        <Tooltip
                          label={
                            copied[0] === i && copied[1] == 1 && copied[2]
                              ? t("usersTable.copied")
                              : t("usersTable.copyConfigs")
                          }
                          placement="top"
                        >
                          <IconButton
                            aria-label="copy configs"
                            bg="transparent"
                            _dark={{
                              _hover: {
                                bg: "gray.700",
                              },
                            }}
                          >
                            {copied[0] === i && copied[1] == 1 && copied[2] ? (
                              <CopiedIcon />
                            ) : (
                              <CopyIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                      </div>
                    </CopyToClipboard>
                    <Tooltip label="QR Code" placement="top">
                      <IconButton
                        aria-label="qr code"
                        bg="transparent"
                        _dark={{
                          _hover: {
                            bg: "gray.700",
                          },
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

          <Tr p="0">
            <Td colSpan={4} p={0} border="0 !important">
              <Pagination />
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </Box>
  );
};

type EmptySectionProps = {
  isFiltered: boolean;
};

const EmptySection: FC<EmptySectionProps> = ({ isFiltered }) => {
  const { onCreateUser } = useDashboard();
  return (
    <Box
      padding="5"
      py="8"
      display="flex"
      alignItems="center"
      flexDirection="column"
      gap={4}
      w="full"
    >
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
        {isFiltered
          ? t('usersTable.noUserMatched')
          : t('usersTable.noUser')}
      </Text>
      {!isFiltered && (
        <Button
          size="sm"
          colorScheme="primary"
          onClick={() => onCreateUser(true)}
        >
          {t("createUser")}
        </Button>
      )}
    </Box>
  );
};
