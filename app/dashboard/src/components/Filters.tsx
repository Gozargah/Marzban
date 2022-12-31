import {
  BoxProps,
  chakra,
  Grid,
  GridItem,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Spinner,
} from "@chakra-ui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "../contexts/DashboardContext";
import React, { FC } from "react";

const SearchIcon = chakra(MagnifyingGlassIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});

export type FilterProps = {} & BoxProps;

export const Filters: FC<FilterProps> = ({ ...props }) => {
  const { loading, filters, onFilterChange } = useDashboard();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      search: e.target.value,
    });
  };
  return (
    <Grid
      templateColumns={{
        lg: "repeat(3, 1fr)",
        base: "repeat(1, 1fr)",
      }}
      gap={4}
      {...props}
    >
      <GridItem colSpan={1}>
        <InputGroup>
          <InputLeftElement pointerEvents="none" children={<SearchIcon />} />
          <Input
            type="tel"
            placeholder="Search"
            defaultValue={filters.search || ""}
            borderColor="light-border"
            onChange={onChange}
          />
          {loading && (
            <InputRightElement>
              <Spinner size="xs" />
            </InputRightElement>
          )}
        </InputGroup>
      </GridItem>
      {/* <GridItem colSpan={2}>
        <HStack justifyContent="flex-end"> */}
      {/* <Select placeholder="Filter by status" w="auto">
            <option value="option1">Active</option>
            <option value="option2">Expired</option>
            <option value="option3">Limited</option>
          </Select> */}
      {/* </HStack>
      </GridItem> */}
    </Grid>
  );
};
