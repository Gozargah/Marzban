import { Grid, GridItem } from "@chakra-ui/react";
import { Sidebar } from "components/common/sidebar/Sidebar";
import { Outlet } from "react-router-dom";

export const ConsoleLayout = () => {
  return (
    <Grid
      templateColumns="270px 1fr"
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
      <GridItem minW={{ md: "270px" }}>
        <Sidebar />
      </GridItem>
      <GridItem p="4" pt={{ md: 5 }}>
        <Outlet />
      </GridItem>
    </Grid>
  );
};

export default ConsoleLayout;
