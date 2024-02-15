import { Grid, GridItem } from "@chakra-ui/react";
import { Sidebar } from "components/Sidebar";
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
      templateRows="repeat(24, 1fr)"
      gap={{
        base: 0,
        md: 4,
      }}
      minH="100vh"
    >
      <GridItem colSpan={{ md: 5 }} minW={{ md: "300px" }}>
        <Sidebar />
      </GridItem>
      <GridItem colSpan={{ md: 19 }} flexGrow={1}>
        <Suspense>
          <Outlet />
        </Suspense>
      </GridItem>
    </Grid>
  );
};

export default ConsoleLayout;
