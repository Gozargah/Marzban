import {
  Badge,
  Box,
  Button,
  chakra,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Switch,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from "@chakra-ui/react";
import {
  PaperAirplaneIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import { FC, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { Icon } from "./Icon";
import { Input } from "./Input";

const AddAdminIcon = chakra(PlusIcon, { baseStyle: { w: 5, h: 5 } });
const EditIcon = chakra(PencilIcon, { baseStyle: { w: 4, h: 4 } });
const DeleteIcon = chakra(TrashIcon, { baseStyle: { w: 4, h: 4 } });
const TelegramIcon = chakra(PaperAirplaneIcon, { baseStyle: { w: 4, h: 4 } });
const AdminsIcon = chakra(UsersIcon, { baseStyle: { w: 5, h: 5 } });

type AdminType = {
  username: string;
  is_sudo: boolean;
  telegram_id: number | null;
  discord_webhook: string | null;
  users_usage: number;
  users_usage_limit: number | null;
  max_users_data_limit: number | null;
  expire_date: string | null;
};

type AdminFormType = {
  username: string;
  password: string;
  is_sudo: boolean;
  telegram_id: string;
  users_usage_limit_gb: string;
  max_users_data_limit_gb: string;
  expire_date: string;
};

const emptyForm: AdminFormType = {
  username: "",
  password: "",
  is_sudo: false,
  telegram_id: "",
  users_usage_limit_gb: "",
  max_users_data_limit_gb: "",
  expire_date: "",
};

const GB = 1073741824;
const bytesToGB = (bytes: number | null) => (bytes ? String(bytes / GB) : "");
const gbToBytes = (gb: string): number | null =>
  gb ? Math.round(parseFloat(gb) * GB) : null;

export const AdminsModal: FC = () => {
  const { isEditingAdmins, onEditingAdmins } = useDashboard();
  const { userData: currentAdmin } = useGetUser();
  const { t } = useTranslation();
  const toast = useToast();

  const [admins, setAdmins] = useState<AdminType[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [deletingAdmin, setDeletingAdmin] = useState<AdminType | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<AdminFormType>({ defaultValues: emptyForm });

  const fetchAdmins = () => {
    setLoading(true);
    fetch("/admins")
      .then((data: AdminType[]) => setAdmins(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isEditingAdmins) {
      setMode("list");
      fetchAdmins();
    }
  }, [isEditingAdmins]);

  const onClose = () => onEditingAdmins(false);

  const openCreate = () => {
    form.reset(emptyForm);
    setMode("create");
  };

  const openEdit = (admin: AdminType) => {
    form.reset({
      username: admin.username,
      password: "",
      is_sudo: admin.is_sudo,
      telegram_id: admin.telegram_id ? String(admin.telegram_id) : "",
      users_usage_limit_gb: bytesToGB(admin.users_usage_limit),
      max_users_data_limit_gb: bytesToGB(admin.max_users_data_limit),
      expire_date: admin.expire_date ? admin.expire_date.slice(0, 10) : "",
    });
    setMode("edit");
  };

  const canManage = (admin: AdminType) =>
    admin.username === currentAdmin.username || !admin.is_sudo;

  const submit = (values: AdminFormType) => {
    setSaving(true);
    const limits = {
      users_usage_limit: gbToBytes(values.users_usage_limit_gb),
      max_users_data_limit: gbToBytes(values.max_users_data_limit_gb),
      expire_date: values.expire_date
        ? new Date(values.expire_date).toISOString()
        : null,
    };
    const body = {
      is_sudo: values.is_sudo,
      telegram_id: values.telegram_id ? Number(values.telegram_id) : null,
      ...limits,
      ...(values.password ? { password: values.password } : {}),
    };

    const request =
      mode === "create"
        ? fetch("/admin", {
            method: "POST",
            body: {
              username: values.username,
              password: values.password,
              is_sudo: values.is_sudo,
              telegram_id: body.telegram_id,
              ...limits,
            },
          })
        : fetch(`/admin/${values.username}`, { method: "PUT", body });

    request
      .then(() => {
        toast({
          title: t(mode === "create" ? "adminsModal.created" : "adminsModal.updated"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        setMode("list");
        fetchAdmins();
      })
      .catch((err) => {
        toast({
          title: err?.response?._data?.detail || t("adminsModal.saveFailed"),
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .finally(() => setSaving(false));
  };

  const confirmDelete = () => {
    if (!deletingAdmin) return;
    fetch(`/admin/${deletingAdmin.username}`, { method: "DELETE" })
      .then(() => {
        toast({
          title: t("adminsModal.deleted", { username: deletingAdmin.username }),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        setDeletingAdmin(null);
        fetchAdmins();
      })
      .catch((err) => {
        toast({
          title: err?.response?._data?.detail || t("adminsModal.saveFailed"),
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      });
  };

  return (
    <Modal isOpen={isEditingAdmins} onClose={onClose} size="xl">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3" w="full">
        <ModalHeader pt={6}>
          <HStack gap={2}>
            <Icon color="primary">
              <AdminsIcon color="white" />
            </Icon>
            <Text fontWeight="semibold" fontSize="lg">
              {t("adminsModal.title")}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} />

        {mode === "list" && (
          <>
            <ModalBody>
              {loading ? (
                <HStack justifyContent="center" py="8">
                  <Spinner size="sm" />
                </HStack>
              ) : (
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>{t("username")}</Th>
                      <Th>{t("adminsModal.sudo")}</Th>
                      <Th>{t("adminsModal.limits")}</Th>
                      <Th>{t("adminsModal.telegram")}</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {admins.map((admin) => {
                      const isExpired =
                        !!admin.expire_date && new Date(admin.expire_date) <= new Date();
                      return (
                      <Tr key={admin.username}>
                        <Td>{admin.username}</Td>
                        <Td>
                          {admin.is_sudo ? (
                            <Badge colorScheme="primary">{t("adminsModal.sudo")}</Badge>
                          ) : (
                            <Badge>{t("adminsModal.restricted")}</Badge>
                          )}
                        </Td>
                        <Td fontSize="xs">
                          <VStack align="start" spacing={0}>
                            {admin.users_usage_limit && (
                              <Text>
                                {bytesToGB(admin.users_usage)} / {bytesToGB(admin.users_usage_limit)} GB
                              </Text>
                            )}
                            {admin.max_users_data_limit && (
                              <Text color="gray.500">
                                {t("adminsModal.maxUserDataLimitShort")}: {bytesToGB(admin.max_users_data_limit)} GB
                              </Text>
                            )}
                            {admin.expire_date && (
                              <Badge colorScheme={isExpired ? "red" : "gray"}>
                                {admin.expire_date.slice(0, 10)}
                              </Badge>
                            )}
                          </VStack>
                        </Td>
                        <Td>
                          {admin.telegram_id ? (
                            <IconButton
                              as="a"
                              href={`tg://user?id=${admin.telegram_id}`}
                              target="_blank"
                              aria-label="telegram"
                              size="xs"
                              variant="outline"
                            >
                              <TelegramIcon />
                            </IconButton>
                          ) : (
                            "-"
                          )}
                        </Td>
                        <Td>
                          <HStack justifyContent="flex-end">
                            {canManage(admin) && (
                              <IconButton
                                aria-label="edit"
                                size="xs"
                                variant="outline"
                                onClick={() => openEdit(admin)}
                              >
                                <EditIcon />
                              </IconButton>
                            )}
                            {canManage(admin) && admin.username !== currentAdmin.username && (
                              <IconButton
                                aria-label="delete"
                                size="xs"
                                variant="outline"
                                colorScheme="red"
                                onClick={() => setDeletingAdmin(admin)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            )}
                          </HStack>
                        </Td>
                      </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              )}
              {!loading && admins.length === 0 && (
                <Text fontSize="sm" color="gray.500" textAlign="center" py="4">
                  {t("adminsModal.empty")}
                </Text>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                size="sm"
                variant="solid"
                colorScheme="primary"
                leftIcon={<AddAdminIcon />}
                onClick={openCreate}
              >
                {t("adminsModal.addAdmin")}
              </Button>
            </ModalFooter>
          </>
        )}

        {(mode === "create" || mode === "edit") && (
          <form onSubmit={form.handleSubmit(submit)}>
            <ModalBody>
              <VStack spacing="3" align="stretch">
                <FormControl>
                  <FormLabel fontSize="sm">{t("username")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <Input {...field} size="sm" disabled={mode === "edit"} />
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">
                    {mode === "edit" ? t("adminsModal.newPassword") : t("password")}
                  </FormLabel>
                  <Controller
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <Input {...field} type="password" size="sm" />
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("adminsModal.telegramId")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="telegram_id"
                    render={({ field }) => <Input {...field} size="sm" type="number" />}
                  />
                </FormControl>
                <FormControl display="flex" alignItems="center">
                  <FormLabel fontSize="sm" mb="0">
                    {t("adminsModal.sudo")}
                  </FormLabel>
                  <Controller
                    control={form.control}
                    name="is_sudo"
                    render={({ field }) => (
                      <Switch
                        isChecked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        colorScheme="primary"
                      />
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("adminsModal.usersUsageLimit")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="users_usage_limit_gb"
                    render={({ field }) => (
                      <Input {...field} size="sm" type="number" endAdornment="GB" />
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("adminsModal.maxUserDataLimit")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="max_users_data_limit_gb"
                    render={({ field }) => (
                      <Input {...field} size="sm" type="number" endAdornment="GB" />
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("adminsModal.expireDate")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="expire_date"
                    render={({ field }) => (
                      <Input {...field} size="sm" type="date" />
                    )}
                  />
                </FormControl>
                <Box>
                  <Text fontSize="xs" color="gray.500">
                    {t("adminsModal.permissionsHint")}
                  </Text>
                </Box>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <HStack w="full" justifyContent="space-between">
                <Button size="sm" variant="outline" onClick={() => setMode("list")}>
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  variant="solid"
                  colorScheme="primary"
                  type="submit"
                  isLoading={saving}
                >
                  {t("adminsModal.save")}
                </Button>
              </HStack>
            </ModalFooter>
          </form>
        )}

        {deletingAdmin && (
          <Modal isCentered isOpen onClose={() => setDeletingAdmin(null)} size="sm">
            <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
            <ModalContent mx="3">
              <ModalHeader pt={6}>
                <Icon color="red">
                  <DeleteIcon />
                </Icon>
              </ModalHeader>
              <ModalCloseButton mt={3} />
              <ModalBody>
                <Text fontWeight="semibold" fontSize="lg">
                  {t("adminsModal.deleteTitle")}
                </Text>
                <Text mt={1} fontSize="sm" color="gray.600" _dark={{ color: "gray.400" }}>
                  {t("adminsModal.deletePrompt", { username: deletingAdmin.username })}
                </Text>
              </ModalBody>
              <ModalFooter display="flex">
                <Button
                  size="sm"
                  onClick={() => setDeletingAdmin(null)}
                  mr={3}
                  w="full"
                  variant="outline"
                >
                  {t("cancel")}
                </Button>
                <Button size="sm" w="full" colorScheme="red" onClick={confirmDelete}>
                  {t("delete")}
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )}
      </ModalContent>
    </Modal>
  );
};
