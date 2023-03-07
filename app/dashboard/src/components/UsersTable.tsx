import {
  Box,
  Button,
  chakra,
  HStack,
  IconButton,
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
} from "@heroicons/react/24/outline";
import { FC, useCallback, useEffect, useState } from "react";
import { ReactComponent as AddFileIcon } from "assets/add_file.svg";
import { formatBytes } from "utils/formatByte";
import { useDashboard } from "contexts/DashboardContext";
import CopyToClipboard from "react-copy-to-clipboard";
import { UserBadge } from "./UserBadge";
import { Pagination } from "./Pagination";
import classNames from "classnames";
import { statusColors } from "constants/UserSettings";

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

type UsageSliderProps = {
  used: number;
  total: number | null;
  dataLimitResetStrategy: string | null;
  totalUsedTraffic: number;
} & SliderProps;

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
              ? " per " + dataLimitResetStrategy
              : "")
          )}
        </Text>
        <Text>Total: {formatBytes(totalUsedTraffic)}</Text>
      </HStack>
    </>
  );
};

type UsersTableProps = {} & TableProps;
export const UsersTable: FC<UsersTableProps> = (props) => {
  const {
    users: { users },
    users: totalUsers,
    onEditingUser,
    setQRCode,
    setSubLink,
    refetchUsers,
  } = useDashboard();
  const marginTop =
    useBreakpointValue({
      base: 120,
      lg: 72,
    }) || 72;

  const isFiltered = users.length !== totalUsers.total;
  const [copied, setCopied] = useState([-1, -1, false]);

  // Fetch users on first load
  useEffect(() => {
    refetchUsers();
  }, [refetchUsers]);

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

  return (
    <Box id="users-table" overflowX="auto">
      <Table {...props}>
        <Thead zIndex="docked" position="relative">
          <Tr>
            <Th>username</Th>
            <Th>status</Th>
            <Th>data usage</Th>
            <Th></Th>
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
                              ? "Copied"
                              : "Copy Subscription Link"
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
                              ? "Copied"
                              : "Copy Configs"
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
          ? "It seems there is no user matched with what you are looking for"
          : "There is no user added to the system"}
      </Text>
      {!isFiltered && (
        <Button
          size="sm"
          colorScheme="primary"
          onClick={() => onCreateUser(true)}
        >
          Create User
        </Button>
      )}
    </Box>
  );
};
