import {
  Badge,
  Box,
  Button,
  chakra,
  HStack,
  IconButton,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
} from "@chakra-ui/react";
import {
  ChartBarIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  CogIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";

import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import Timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { FC, useEffect, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Skeleton from "react-loading-skeleton";
import QRCode from "react-qr-code";
import useSWR from "swr";
import { ReactComponent as AddFileIcon } from "../../assets/add_file.svg";
import { formatBytes } from "../../utils/formatByte";
import { Dialog } from "../Dialog";
import { Input } from "../Input";
import { UserDialog } from "./UserDialog";

dayjs.extend(Timezone);
dayjs.extend(LocalizedFormat);
dayjs.extend(utc);

const BandWidthIcon = chakra(ChartBarIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});

const ActiveStatusIcon = chakra(WifiIcon, {
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

export type User = {
  username: string;
  proxy_type: string;
  data_limit: number;
  expire: number;
  status: string;
  used_traffic: number;
  links: string[];
};

export type StatusButtons = {
  user: User;
  onUserSelected: (user: User) => void;
};

const StatusButtons: FC<StatusButtons> = ({ user, onUserSelected }) => {
  const proxyStr = user.links.join("\n");
  const [copied, setCopied] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  useEffect(() => {
    if (copied) {
      setTimeout(() => {
        setCopied(false);
      }, 1000);
    }
  }, [copied]);

  return (
    <HStack>
      <CopyToClipboard text={proxyStr} onCopy={() => setCopied(true)}>
        <div>
          <Tooltip label="Copy config">
            <IconButton
              size="sm"
              p={1.5}
              colorScheme="blue"
              aria-label="copy"
              icon={copied ? <CheckIcon /> : <ClipboardDocumentIcon />}
            />
          </Tooltip>
        </div>
      </CopyToClipboard>
      <Tooltip label="QR code">
        <IconButton
          size="sm"
          p={1.5}
          colorScheme="blue"
          onClick={() => setQrCodeOpen(true)}
          aria-label="qr code"
          icon={<QrCodeIcon />}
        />
      </Tooltip>
      <Tooltip label="Manage">
        <IconButton
          size="sm"
          p={1.5}
          colorScheme="facebook"
          onClick={() => onUserSelected(user)}
          aria-label="manage user"
          icon={<CogIcon />}
        />
      </Tooltip>
      <Dialog
        widthFitContent
        open={qrCodeOpen}
        onClose={() => setQrCodeOpen(false)}
        title="QR Code"
      >
        <HStack gap={3} flexWrap="wrap" justifyContent="center" py={4}>
          {user.links.map((link) => {
            return <QRCode value={link} key={link} />;
          })}
        </HStack>
      </Dialog>
    </HStack>
  );
};
const SearchIcon = chakra(MagnifyingGlassIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});
export const UserTable = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  let { data: users, isValidating } = useSWR("users");

  const usersList = (users || []).filter((user: any) =>
    user.username.includes(search)
  );

  const handleEditingUser = (user: User) => setEditingUser(user);
  const closeUserEditDialog = setEditingUser.bind(null, null);
  const closeUserAddDialog = setOpen.bind(null, false);
  return (
    <Box>
      <UserDialog user={null} open={open} onClose={closeUserAddDialog} />
      <HStack
        justifyContent="space-between"
        alignItems="center"
        display={{
          base: "block",
          md: "flex",
        }}
        experimental_spaceX={{
          base: 0,
          md: 1,
        }}
        px={5}
      >
        <Text fontSize="xl" fontWeight="medium">
          Users
        </Text>
        <HStack
          marginTop={{
            base: "2 !important",
            md: 0,
          }}
        >
          <Input
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            startAdornment={<SearchIcon />}
          />
          <Button colorScheme="blue" onClick={setOpen.bind(null, true)} px={6}>
            Add User
          </Button>
        </HStack>
      </HStack>
      {(isValidating || (!isValidating && users && users.length > 0)) && (
        <Table marginTop={5}>
          <Thead>
            <Tr>
              <Th>Username</Th>
              <Th>Protocol</Th>
              <Th>Bandwidth</Th>
              <Th>Status</Th>
              <Th textAlign="center">Actions</Th>
            </Tr>
          </Thead>
          {users && (
            <Tbody>
              {users &&
                usersList.map((user: any) => {
                  return (
                    <Tr key={user.username}>
                      <Td>{user.username}</Td>
                      <Td>
                        <Text as="span" textTransform="capitalize">
                          <Text>{user.proxy_type}</Text>
                        </Text>
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={status[user.status].bandWidthColor}
                          rounded="full"
                          display="inline-flex"
                          px={3}
                          py={1}
                          experimental_spaceX={1}
                          alignItems="center"
                        >
                          <BandWidthIcon />
                          <Text
                            fontSize=".875rem"
                            lineHeight="1.25rem"
                            fontWeight="normal"
                            letterSpacing="tighter"
                          >
                            {formatBytes(user.used_traffic) +
                              " / " +
                              (!user.data_limit
                                ? "∞"
                                : formatBytes(user.data_limit))}
                          </Text>
                        </Badge>
                      </Td>
                      <Td>
                        <div className="status">
                          <Badge
                            colorScheme={status[user.status].statusColor}
                            rounded="full"
                            display="inline-flex"
                            px={3}
                            py={1}
                            experimental_spaceX={2}
                            alignItems="center"
                          >
                            <ActiveStatusIcon />
                            <Text
                              textTransform="capitalize"
                              fontSize=".875rem"
                              lineHeight="1.25rem"
                              fontWeight="normal"
                              letterSpacing="tighter"
                            >
                              {user.status}
                            </Text>
                          </Badge>
                          {user.expire > 0 ? (
                            <Text
                              marginTop="mt-2"
                              color="gray.400"
                              fontWeight="medium"
                            >
                              {user.status == "expired" ? "Expired" : "Expires"}{" "}
                              on{" "}
                              <Text fontWeight={"bold"} as="span">
                                {dayjs(user.expire * 1000)
                                  .utc()
                                  .format("LL")}
                              </Text>
                            </Text>
                          ) : null}
                        </div>
                      </Td>
                      <Td>
                        <StatusButtons
                          user={user}
                          onUserSelected={handleEditingUser}
                        />
                      </Td>
                    </Tr>
                  );
                })}
            </Tbody>
          )}
          {isValidating && !users && (
            <Tbody>
              {[1, 2, 3, 4].map((i) => {
                return (
                  <Tr key={i}>
                    <Td>
                      <Skeleton inline />
                    </Td>
                    <Td>
                      <Skeleton inline />
                    </Td>
                    <Td>
                      <Skeleton inline />
                    </Td>
                    <Td>
                      <Skeleton inline />
                    </Td>
                    <Td>
                      <Skeleton inline />
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          )}
        </Table>
      )}
      {!isValidating && usersList.length == 0 && (
        <EmptySection
          onAddUser={() => setOpen(true)}
          showAdd={search.length === 0}
        />
      )}
      <UserDialog
        user={editingUser}
        open={!!editingUser}
        onClose={closeUserEditDialog}
      />
    </Box>
  );
};

const EmptySection: FC<{ onAddUser: () => void; showAdd: boolean }> = ({
  onAddUser,
  showAdd,
}) => {
  return (
    <VStack
      mt={4}
      __css={{
        _dark: {
          '& > svg path[fill="#fff"]': {
            fill: "#1A202C",
          },
          '& > svg path[fill="#f2f2f2"], & > svg path[fill="#e6e6e6"], & > svg path[fill="#ccc"], & > svg path[fill="#3B82F6"]':
            {
              fill: "#46526b",
            },
          '& > svg circle[fill="#3182CE"]': {
            fill: "blue.200",
          },
        },
      }}
    >
      <AddFileIcon
        onClick={onAddUser}
        cursor="pointer"
        width="200px"
        height="200px"
      />
      {showAdd && (
        <>
          <Box textAlign="center">
            <Text colorScheme="gray" _dark={{ color: "gray.400" }}>
              It seems that the user has not been added.
            </Text>
            <Text colorScheme="gray" mt={0} _dark={{ color: "gray.400" }}>
              Use the button bellow to add a user
            </Text>
          </Box>
          <Button onClick={onAddUser} colorScheme="blue" px={6} mt="4">
            Add User
          </Button>
        </>
      )}
      {!showAdd && (
        <>
          <Text>No user found</Text>
        </>
      )}
    </VStack>
  );
};
