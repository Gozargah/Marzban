import { Box, Button, chakra, HStack, Icon, Tooltip } from "@chakra-ui/react";
import {
  CalendarDaysIcon,
  CubeTransparentIcon,
  InformationCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { Subtitle, Text } from "@tremor/react";
import classNames from "classnames";
import dayjs from "dayjs";
import { FC, useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import { Controller, useForm } from "react-hook-form";
import { mutate } from "swr";
import { z } from "zod";
import { fetch } from "../../service/http";
import { Dialog } from "../Dialog";
import { Input } from "../Input";
import { RadioGroup } from "../RadioGroup";
import { User } from "./UsersTable";

const iconProps = {
  baseStyle: { w: 4, h: 4 },
};
const CalendarIcon = chakra(CalendarDaysIcon, iconProps);
const InfoIcon = chakra(InformationCircleIcon, iconProps);
const LoadingIcon = chakra(CubeTransparentIcon, iconProps);
const DeleteIcon = chakra(TrashIcon, iconProps);

const schema = z.object({
  username: z.string().min(1, { message: "Required" }),
  proxy_type: z.enum(["vmess", "vless", "trojan", "shadowsocks"]),
  data_limit: z.number().min(0, "The minimum number is 0").nullable(),
  expire: z.number().nullable(),
});
const formatUser = (user: User) => {
  return {
    ...user,
    data_limit:
      user.data_limit > 0 ? (user.data_limit / 1073741824).toFixed(3) : null,
    expire: user.expire ? user.expire * 1000 : null,
  };
};
export const UserDialog: FC<{
  user: User | null;
  open: boolean;
  onClose: () => void;
}> = ({ user, open, onClose }) => {
  const formRef = useRef<any>();
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const loading = deleting || submitting;
  const isEditing = !!user;
  const {
    formState: { errors },
    setError,
    ...form
  } = useForm({
    defaultValues: user
      ? formatUser(user)
      : {
          username: "",
          proxy_type: "vmess",
          expire: null,
          data_limit: null,
        },
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (user) form.reset(formatUser(user));
  }, [user]);

  const onDelete = () => {
    setDeleting(true);
    fetch(`/user/${user ? user.username : ""}`, {
      method: "DELETE",
    })
      .then(() => {
        mutate("/users");
        closeDialog();
      })
      .finally(setDeleting.bind(null, false));
  };

  const submitForm = (body: any) => {
    setSubmitting(true);
    for (const key in body) {
      if (!body[key]) delete body[key];
    }
    if (body.data_limit) {
      body.data_limit *= 1073741824;
    } else {
      body.data_limit = 0;
    }
    if (!body.expire) body.expire = 0;
    else body.expire /= 1000;

    fetch(isEditing ? `/user/${user.username}` : "/user", {
      method: isEditing ? "PUT" : "POST",
      body,
    })
      .then(() => {
        mutate("/users");
        closeDialog();
      })
      .catch((err) => {
        if (err.response._data.detail) {
          setError("username", { message: err.response._data.detail });
        }
      })
      .finally(setSubmitting.bind(null, false));
  };

  const closeDialog = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={closeDialog} title="Add new user">
      <div
        className={classNames({
          "form-disabled": loading,
        })}
      >
        <Box
          display="grid"
          gap={4}
          gridTemplateColumns={{ md: "repeat(2, minmax(0, 1fr))" }}
        >
          <div>
            <Box mb={1} className="mb-1">
              <Text>Username</Text>
            </Box>
            <form ref={formRef} onSubmit={form.handleSubmit(submitForm)}>
              <Input
                disabled={isEditing || loading}
                {...form.register("username")}
                error={errors?.username?.message}
                w="full"
              />
            </form>
          </div>
          <Box
            userSelect={isEditing || loading ? "none" : undefined}
            pointerEvents={isEditing || loading ? "none" : undefined}
            className={classNames("toggle", {
              disabled: isEditing || loading,
            })}
          >
            <HStack
              justifyContent="space-between"
              display="flex"
              mb={1}
              w="full"
              className="protocol"
            >
              <Text>Protocol</Text>
              {!isEditing && (
                <Tooltip label="Shadowsocks is not recommended because it is not that much performant in this specific implementation.">
                  <Icon>
                    <InfoIcon />
                  </Icon>
                </Tooltip>
              )}
            </HStack>
            <Controller
              name="proxy_type"
              control={form.control}
              render={({ field }) => {
                return (
                  <RadioGroup
                    disabled={isEditing || loading}
                    list={["vmess", "vless", "trojan", "shadowsocks"]}
                    {...field}
                  />
                );
              }}
            />
          </Box>
        </Box>
        <Box
          display="grid"
          gap={4}
          gridTemplateColumns={{ md: "repeat(2, minmax(0, 1fr))" }}
          mt={4}
        >
          <div>
            <Box mb={1}>
              <Text>Bandwidth Limit</Text>
            </Box>

            <form onSubmit={form.handleSubmit(submitForm)}>
              <Controller
                name="data_limit"
                control={form.control}
                render={({ field }) => {
                  return (
                    <Input
                      disabled={loading}
                      type="number"
                      step="0.001"
                      w="full"
                      min={0}
                      endAdornment={
                        <Box fontSize="sm">
                          <Subtitle>GB</Subtitle>
                        </Box>
                      }
                      error={errors?.data_limit?.message}
                      {...field}
                      onChange={(value) => {
                        field.onChange(
                          value && value.length
                            ? Number(parseFloat(value))
                            : null
                        );
                      }}
                      value={field.value ? field.value : undefined}
                    />
                  );
                }}
              />
            </form>
          </div>
          <div>
            <Box mb={1}>
              <Text>Expiry Date</Text>
            </Box>
            <form onSubmit={form.handleSubmit(submitForm)}>
              <Controller
                control={form.control}
                name="expire"
                render={({ field }) => {
                  function createDateAsUTC(num: number) {
                    return dayjs(
                      dayjs(num).utc().format("MMMM D, YYYY")
                    ).toDate();
                  }
                  return (
                    <DatePicker
                      dateFormat="MMMM d, yyy"
                      disabled={loading}
                      minDate={new Date()}
                      customInput={
                        <Input
                          onChange={(e) => {
                            if (e.target.value == "") {
                              field.onChange({
                                target: { value: "", name: "expire" },
                              });
                            }
                          }}
                          className="w-full"
                          startAdornment={
                            <Icon color={"slate"}>
                              <CalendarIcon />
                            </Icon>
                          }
                          error={errors?.expire?.message}
                        />
                      }
                      selected={
                        field.value ? createDateAsUTC(field.value) : undefined
                      }
                      onChange={(date: Date) =>
                        field.onChange({
                          target: {
                            value: date
                              ? dayjs(date)
                                  .utc(true)
                                  .set("hour", 23)
                                  .set("minute", 59)
                                  .set("second", 59)
                                  .valueOf()
                              : null,
                            name: "expire",
                          },
                        })
                      }
                    />
                  );
                }}
              />
            </form>
          </div>
        </Box>
        <HStack gap={2} justifyContent="space-between" mt={5}>
          {isEditing ? (
            <div
              onClick={() => !loading && onDelete()}
              className={classNames({
                "btn-loading": deleting,
              })}
            >
              <Button
                colorScheme="red"
                leftIcon={
                  deleting ? (
                    <LoadingIcon className="animate-spin w-5 h-5" />
                  ) : (
                    <DeleteIcon />
                  )
                }
              >
                Delete
              </Button>
            </div>
          ) : (
            <div />
          )}
          <HStack
            gap={2}
            className={classNames({
              "btn-loading": submitting,
            })}
          >
            <div onClick={() => !loading && closeDialog()}>
              <Button>Close</Button>
            </div>
            <Button
              colorScheme="blue"
              leftIcon={
                submitting ? (
                  <LoadingIcon className="animate-spin w-5 h-5" />
                ) : undefined
              }
              onClick={() => {
                !loading &&
                  formRef.current.dispatchEvent(
                    new Event("submit", { cancelable: true, bubbles: true })
                  );
              }}
            >
              {isEditing ? "Edit User" : "Create User"}
            </Button>
          </HStack>
        </HStack>
      </div>
    </Dialog>
  );
};
