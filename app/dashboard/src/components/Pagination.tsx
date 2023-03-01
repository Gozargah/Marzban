import {
  Box,
  Button,
  ButtonGroup,
  chakra,
  HStack,
  Select,
  Text,
} from "@chakra-ui/react";
import {
  ArrowLongLeftIcon,
  ArrowLongRightIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { ChangeEvent, FC } from "react";

const PrevIcon = chakra(ArrowLongLeftIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});
const NextIcon = chakra(ArrowLongRightIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});

export type PaginationType = {
  count: number;
  perPage: number;
  page: number;
  onChange?: (page: number) => void;
};

const MINIMAL_PAGE_ITEM_COUNT = 5;

/**
 * Generate numeric page items around current page.
 *   - Always include first and last page
 *   - Add ellipsis if needed
 */
function generatePageItems(total: number, current: number, width: number) {
  if (width < MINIMAL_PAGE_ITEM_COUNT) {
    throw new Error(
      `Must allow at least ${MINIMAL_PAGE_ITEM_COUNT} page items`
    );
  }
  if (width % 2 === 0) {
    throw new Error(`Must allow odd number of page items`);
  }
  if (total < width) {
    return [...new Array(total).keys()];
  }
  const left = Math.max(
    0,
    Math.min(total - width, current - Math.floor(width / 2))
  );
  const items: (string | number)[] = new Array(width);
  for (let i = 0; i < width; i += 1) {
    items[i] = i + left;
  }
  // replace non-ending items with placeholders
  if (items[0] > 0) {
    items[0] = 0;
    items[1] = "prev-more";
  }
  if (items[items.length - 1] < total - 1) {
    items[items.length - 1] = total - 1;
    items[items.length - 2] = "next-more";
  }
  return items;
}

export const Pagination: FC = () => {
  const {
    filters,
    onFilterChange,
    users: { total },
  } = useDashboard();
  const { limit: perPage, offset } = filters;

  const page = (offset || 0) / (perPage || 1);
  const noPages = Math.ceil(total / (perPage || 1));
  const pages = generatePageItems(noPages, page, 7);

  const changePage = (page: number) => {
    onFilterChange({
      ...filters,
      offset: page * (perPage as number),
    });
  };

  const handlePageSizeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      limit: parseInt(e.target.value),
    });
  };

  return (
    <HStack justifyContent="space-between" mt={4} overflow="auto" w="full">
      <Box>
        <HStack>
          <Select
            minW="60px"
            value={perPage}
            onChange={handlePageSizeChange}
            size="sm"
            rounded="md"
          >
            <option>15</option>
            <option>30</option>
            <option>60</option>
          </Select>
          <Text whiteSpace={"nowrap"} fontSize="sm">
            Items per page
          </Text>
        </HStack>
      </Box>

      <ButtonGroup size="sm" isAttached variant="outline">
        <Button
          leftIcon={<PrevIcon />}
          onClick={changePage.bind(null, page - 1)}
          isDisabled={page === 0 || noPages === 0}
        >
          Previous
        </Button>
        {pages.map((pageIndex) => {
          if (typeof pageIndex === "string")
            return <Button key={pageIndex}>...</Button>;
          return (
            <Button
              key={pageIndex}
              variant={(pageIndex as number) === page ? "solid" : "outline"}
              onClick={changePage.bind(null, pageIndex)}
            >
              {(pageIndex as number) + 1}
            </Button>
          );
        })}

        <Button
          rightIcon={<NextIcon />}
          onClick={changePage.bind(null, page + 1)}
          isDisabled={page + 1 === noPages || noPages === 0}
        >
          Next
        </Button>
      </ButtonGroup>
    </HStack>
  );
};
