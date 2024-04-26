import {
  BoxProps,
  Button,
  chakra,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Spinner,
} from "@chakra-ui/react";
import { ArrowPathIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import classNames from "classnames";
import { useDashboard, useUsers } from "contexts/DashboardContext";
import { debounce } from "lodash-es";
import React, { FC, useState } from "react";
import { useTranslation } from "react-i18next";

const iconProps = {
  baseStyle: {
    w: 4,
    h: 4,
  },
};

const SearchIcon = chakra(MagnifyingGlassIcon, iconProps);
const ClearIcon = chakra(XMarkIcon, iconProps);
export const ReloadIcon = chakra(ArrowPathIcon, iconProps);

export type FilterProps = {} & BoxProps;
const setSearchField = debounce((username: string) => {
  useDashboard.getState().onFilterChange({
    ...useDashboard.getState().filters,
    offset: 0,
    username: [username],
  });
}, 300);

export const Filters: FC<FilterProps> = ({ ...props }) => {
  const { filters, onFilterChange, refetchUsers, onCreateUser } = useDashboard();
  const { isFetching: loading } = useUsers();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setSearchField(e.target.value);
  };
  const clear = () => {
    setSearch("");
    onFilterChange({
      ...filters,
      offset: 0,
      username: [""],
    });
  };
  return (
    <Grid
      id="filters"
      templateColumns={{
        lg: "repeat(3, 1fr)",
        md: "repeat(4, 1fr)",
        base: "repeat(1, 1fr)",
      }}
      position="sticky"
      top={0}
      // mx="-6"
      // px="6"
      rowGap={4}
      gap={{
        lg: 4,
        base: 0,
      }}
      bg="var(--chakra-colors-chakra-body-bg)"
      py={4}
      zIndex="docked"
      {...props}
    >
      <GridItem colSpan={{ base: 1, md: 2, lg: 1 }} order={{ base: 2, md: 1 }}>
        <InputGroup>
          <InputLeftElement pointerEvents="none" children={<SearchIcon />} />
          <Input placeholder={t("search")} value={search} onChange={onChange} />

          <InputRightElement
            display="flex"
            gap={1}
            px={loading || filters.username[0].length > 0 ? 2 : 0}
            maxW="60px"
            w="fit-content"
          >
            {loading && <Spinner size="xs" />}
            {filters.username && filters.username[0].length > 0 && (
              <IconButton onClick={clear} aria-label="clear" size="xs" variant="ghost">
                <ClearIcon />
              </IconButton>
            )}
          </InputRightElement>
        </InputGroup>
      </GridItem>
      <GridItem colSpan={2} order={{ base: 1, md: 2 }}>
        <HStack justifyContent="flex-end" alignItems="center" h="full">
          <IconButton aria-label="refresh users" disabled={loading} onClick={refetchUsers} size="sm" variant="outline">
            <ReloadIcon
              className={classNames({
                "animate-spin": loading,
              })}
            />
          </IconButton>
          <Button
            display={{
              base: "flex",
              md: "none",
            }}
            colorScheme="primary"
            size="sm"
            onClick={() => onCreateUser(true)}
            px={5}
          >
            {t("createUser")}
          </Button>
        </HStack>
      </GridItem>
    </Grid>
  );
};
