import {
  Badge,
  Box,
  Button,
  chakra,
  CircularProgress,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Text,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import { ArrowPathIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import classNames from "classnames";
import { useCoreSettings } from "contexts/CoreSettingsContext";
import { useDashboard } from "contexts/DashboardContext";
import { FC, lazy, Suspense, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation } from "react-query";
import { Icon } from "./Icon";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Loader2Icon, PanelRightCloseIcon, XIcon } from "lucide-react";
import { NodeLogs } from "@/components/NodeLogs";
import { cn } from "@/lib/utils";

const JsonEditor = lazy(() => import("./JsonEditor").then((mod) => ({ default: mod.JsonEditor })));

const JsonEditorLoader = () => {
  return (
    <div className="w-full h-full flex items-center justify-center dark:bg-[#1D2127] bg-[#FAFAFA] rounded-sm">
      <Loader2Icon className="animate-spin" />
    </div>
  );
};

window.has_unsaved_changes = false;

const UsageIcon = chakra(Cog6ToothIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});
export const ReloadIcon = chakra(ArrowPathIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});

const CoreSettingModalContent: FC = () => {
  const { isEditingCore } = useDashboard();
  const { fetchCoreSettings, updateConfig, isLoading, config, isPostLoading, version, restartCore } = useCoreSettings();

  const { t } = useTranslation();
  const toast = useToast();
  const form = useForm({
    defaultValues: { config: config || {} },
  });

  useEffect(() => {
    if (config) form.setValue("config", config);
  }, [config]);

  useEffect(() => {
    if (isEditingCore) fetchCoreSettings();
  }, [isEditingCore]);
  "".startsWith;

  const { mutate: handleRestartCore, isLoading: isRestarting } = useMutation(restartCore);

  const handleOnSave = ({ config }: any) => {
    updateConfig(config)
      .then(() => {
        window.has_unsaved_changes = false;
        toast({
          title: t("core.successMessage"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .catch((e) => {
        let message = t("core.generalErrorMessage");
        if (typeof e.response._data.detail === "object")
          message = e.response._data.detail[Object.keys(e.response._data.detail)[0]];
        if (typeof e.response._data.detail === "string") message = e.response._data.detail;

        toast({
          title: message,
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      });
  };
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFullHeightConfig, setIsFullHeightConfig] = useState(false);
  return (
    <form onSubmit={form.handleSubmit(handleOnSave)} className="contents h-full overflow-hidden">
      <div className="px-4 h-full flex flex-col gap-2 overflow-hidden">
        <FormControl
          className={cn("grow h-full overflow-hidden flex flex-col", {
            "max-h-2/3": !isFullHeightConfig,
            "max-h-full": isFullHeightConfig,
          })}
        >
          <HStack justifyContent="space-between" alignItems="flex-start" className="min-h-7">
            <FormLabel>
              {t("core.configuration")} {isLoading && <CircularProgress isIndeterminate size="15px" />}
            </FormLabel>
            <HStack gap={0}>
              <Tooltip label="Xray Version" placement="top">
                <Badge height="100%" textTransform="lowercase">
                  {version && `v${version}`}
                </Badge>
              </Tooltip>
            </HStack>
          </HStack>
          <Box
            position="relative"
            ref={editorRef}
            display="flex"
            flexDirection="column"
            className="grow"
            overflow="hidden"
          >
            <Box
              border="1px solid"
              borderColor="gray.300"
              _dark={{ borderColor: "gray.500" }}
              borderRadius={5}
              h="full"
              flexGrow="1"
              minH="full"
              display="flex"
              flexDirection="column"
              overflow="hidden"
              css={{ "& > div": { height: "100% !important", flexGrow: 1 } }}
            >
              <Controller
                control={form.control}
                name="config"
                render={({ field }) => (
                  <Suspense fallback={<JsonEditorLoader />}>
                    <JsonEditor
                      json={config}
                      onSave={() => {
                        const submitBtn = document.getElementById("save-core-settings-btn");
                        if (submitBtn) {
                          submitBtn.click();
                        }
                      }}
                      onChange={(...props) => {
                        field.onChange(...props);
                        const value = props[0];
                        try {
                          window.has_unsaved_changes =
                            JSON.stringify(JSON.parse(value), null, 2) !== JSON.stringify(config, null, 2);
                        } catch {
                          window.has_unsaved_changes = true;
                        }
                      }}
                    />
                  </Suspense>
                )}
              />
            </Box>
            <IconButton
              size="xs"
              aria-label="full screen"
              variant="ghost"
              position="absolute"
              top="2"
              right="4"
              onClick={() => setIsFullHeightConfig((v) => !v)}
            >
              <PanelRightCloseIcon
                className={cn("stroke-[1.5px]", { "rotate-90": !isFullHeightConfig, "-rotate-90": isFullHeightConfig })}
                size="18"
              />
            </IconButton>
          </Box>
        </FormControl>
        <FormControl
          className={cn("transition-all transform-gpu ease-in-out grow max-h-1/3 flex flex-col gap-2", {
            "h-0!": isFullHeightConfig,
            "h-full ": !isFullHeightConfig,
          })}
        >
          <NodeLogs />
        </FormControl>
      </div>
      <DrawerFooter>
        <HStack w="full" justifyContent="space-between">
          <HStack>
            <Box>
              <Button
                size="sm"
                leftIcon={
                  <ReloadIcon
                    className={classNames({
                      "animate-spin": isRestarting,
                    })}
                  />
                }
                onClick={() => handleRestartCore()}
              >
                {t(isRestarting ? "core.restarting" : "core.restartCore")}
              </Button>
            </Box>
          </HStack>

          <HStack>
            <Button
              size="sm"
              variant="solid"
              colorScheme="primary"
              px="5"
              type="submit"
              isDisabled={isLoading || isPostLoading}
              isLoading={isPostLoading}
              id="save-core-settings-btn"
            >
              {t("core.save")}
            </Button>
          </HStack>
        </HStack>
      </DrawerFooter>
    </form>
  );
};
export const CoreSettingsModal: FC = () => {
  const { isEditingCore } = useDashboard();
  const onClose = useDashboard.setState.bind(null, { isEditingCore: false });
  const { t } = useTranslation();

  const handleOnClose = () => {
    if (window.has_unsaved_changes) {
      if (confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        onClose();
      } else {
        const el = document.getElementById("core-settings-pane");
        if (el) {
          el.style.transform = "translate3d(0px, 0px, 0px)";
        }
      }
    } else {
      onClose();
    }
  };
  return (
    <Drawer open={isEditingCore} onClose={handleOnClose} direction="right">
      <DrawerContent
        id="core-settings-pane"
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="w-full sm:max-w-3xl! dark:before:bg-[#2D3748] before:bg-[#FFF]"
      >
        <DrawerHeader className="relative w-full">
          <HStack gap={4}>
            <Icon color="primary">
              <UsageIcon color="white" />
            </Icon>
            <DrawerTitle>
              <Text fontWeight="semibold" fontSize="lg">
                {t("core.title")}
              </Text>
            </DrawerTitle>
            <IconButton
              aria-label="Close core settings"
              size="sm"
              icon={<XIcon size="16" />}
              variant="ghost"
              className="absolute! right-3 top-4 w-fit"
              onClick={handleOnClose}
            />
          </HStack>
        </DrawerHeader>
        <CoreSettingModalContent />
      </DrawerContent>
    </Drawer>
  );
};
