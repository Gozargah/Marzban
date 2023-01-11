import {
  Badge,
  Box,
  Button,
  chakra,
  HStack,
  IconButton,
  Slider,
  SliderFilledTrack,
  SliderProps,
  SliderThumb,
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
} from "@chakra-ui/react";
import {
  CheckIcon,
  ClipboardIcon,
  ExclamationCircleIcon,
  LinkIcon,
  NoSymbolIcon,
  QrCodeIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";
import { FC, useEffect, useState } from "react";
import { ReactComponent as AddFileIcon } from "assets/add_file.svg";
import { formatBytes } from "utils/formatByte";
import { UserStatus as UserStatusType } from "types/User";
import { useDashboard } from "contexts/DashboardContext";
import { relativeExpiryDate } from "utils/dateFormatter";
import CopyToClipboard from "react-copy-to-clipboard";

const EmptySectionIcon = chakra(AddFileIcon);

const CopyIcon = chakra(ClipboardIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const CopiedIcon = chakra(CheckIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const SubscriptionLinkIcon = chakra(LinkIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const QRIcon = chakra(QrCodeIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const ActiveStatusIcon = chakra(WifiIcon, {
  baseStyle: {
    strokeWidth: "2px",
    w: 4,
    h: 4,
  },
});
const LimitedIcon = chakra(NoSymbolIcon, {
  baseStyle: {
    strokeWidth: "2px",
    w: 4,
    h: 4,
  },
});

const ExpiredIcon = chakra(ExclamationCircleIcon, {
  baseStyle: {
    strokeWidth: "2px",
    w: 4,
    h: 4,
  },
});
const status: {
  [key: string]: {
    statusColor: string;
    bandWidthColor: string;
  };
} = {
  active: {
    statusColor: "green",
    bandWidthColor: "green",
  },
  expired: {
    statusColor: "gray",
    bandWidthColor: "gray",
  },
  limited: {
    statusColor: "red",
    bandWidthColor: "red",
  },
};
type UserStatusProps = {
  expiryDate?: number | null;
  status: UserStatusType;
};
const UserStatus: FC<UserStatusProps> = ({
  expiryDate,
  status: userStatus,
}) => {
  let date = relativeExpiryDate(expiryDate);
  return (
    <>
      <Badge
        colorScheme={status[userStatus].statusColor}
        rounded="full"
        display="inline-flex"
        px={3}
        py={1}
        experimental_spaceX={2}
        alignItems="center"
      >
        {userStatus === "active" && <ActiveStatusIcon />}
        {userStatus === "limited" && <LimitedIcon />}
        {userStatus === "expired" && <ExpiredIcon />}
        <Text
          textTransform="capitalize"
          fontSize=".875rem"
          lineHeight="1.25rem"
          fontWeight="medium"
          letterSpacing="tighter"
        >
          {userStatus}
        </Text>
      </Badge>
      {expiryDate && (
        <Text
          display="inline-block"
          fontSize="xs"
          fontWeight="medium"
          ml="2"
          color="gray.600"
          _dark={{
            color: "gray.400",
          }}
        >
          {date}
        </Text>
      )}
    </>
  );
};

type UsageSliderProps = {
  used: number;
  total: number | null;
} & SliderProps;
const UsageSlider: FC<UsageSliderProps> = (props) => {
  const { used, total, ...restOfProps } = props;
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
      <Text
        fontSize="xs"
        fontWeight="medium"
        color="gray.600"
        _dark={{
          color: "gray.400",
        }}
      >
        {formatBytes(used)} /{" "}
        {isUnlimited ? (
          <Text as="span" fontFamily="system-ui">
            ∞
          </Text>
        ) : (
          formatBytes(total)
        )}
      </Text>
    </>
  );
};

type UsersTableProps = {} & TableProps;
export const UsersTable: FC<UsersTableProps> = (props) => {
  const {
    filteredUsers: users,
    users: totalUsers,
    onEditingUser,
    setQRCode,
  } = useDashboard();
  const isFiltered = users.length !== totalUsers.length;
  const [copied, setCopied] = useState([-1, -1, false]);

  useEffect(() => {
    if (copied[2]) {
      setTimeout(() => {
        setCopied([-1, -1, false]);
      }, 1000);
    }
  }, [copied]);
  return (
    <Box overflowX="auto" maxW="100vw">
      <Table {...props}>
        <Thead>
          <Tr>
            <Th>Username</Th>
            <Th>status</Th>
            <Th>banding usage</Th>
            <Th></Th>
          </Tr>
        </Thead>
        <Tbody>
          {users?.map((user, i) => {
            const proxyLinks = user.links.join("\r\n");
            return (
              <Tr
                key={user.username}
                className="interactive"
                onClick={() => onEditingUser(user)}
              >
                <Td minW="150px">{user.username}</Td>
                <Td width="350px">
                  <UserStatus expiryDate={user.expire} status={user.status} />
                </Td>
                <Td width="300px" minW="200px">
                  <UsageSlider
                    used={user.used_traffic}
                    total={user.data_limit}
                    colorScheme={user.status === "limited" ? "red" : "primary"}
                  />
                </Td>
                <Td width="150px">
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
        </Tbody>
      </Table>
      {users.length == 0 && <EmptySection isFiltered={isFiltered} />}
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
      borderWidth="1px"
      borderStyle="solid"
      borderTop={0}
      borderBottomRadius="8px"
      padding="5"
      _dark={{
        borderColor: "gray.600",
      }}
      py="8"
      display="flex"
      alignItems="center"
      flexDirection="column"
      experimental_spaceY={4}
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
          Create user
        </Button>
      )}
    </Box>
  );
};
