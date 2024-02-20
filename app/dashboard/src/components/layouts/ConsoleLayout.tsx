import { Grid, GridItem } from "@chakra-ui/react";
import { Sidebar } from "@/components/common/sidebar/Sidebar";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";

export const ConsoleLayout = () => {
  return (
    <Grid
      templateColumns="repeat(24, 1fr)"
      display={{
        base: "flex",
        md: "grid",
      }}
      flexDirection="column"
      gap={{
        base: 0,
        md: 4,
      }}
      h="full"
    >
      <GridItem colSpan={{ md: 5 }} minW={{ md: "280px" }}>
        <Sidebar />
      </GridItem>
      <GridItem colSpan={{ md: 19 }} flexGrow={1} p="4" pt={{ md: 5 }}>
        <Suspense>
          <Outlet />
        </Suspense>
      </GridItem>
    </Grid>
  );
};

export default ConsoleLayout;
