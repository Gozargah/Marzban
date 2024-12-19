import { useEffect } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { useTranslation } from "react-i18next";
import { setupColumns } from "@/components/users-table/columns";
import { Filters } from "@/components/users-table/filters";
import { DataTable } from "@/components/users-table/data-table";

const UsersTable = () => {
  const { t } = useTranslation();
  const {
    filters,
    users: { users },
    users: totalUsers,
    onEditingUser,
    onFilterChange,
  } = useDashboard();

  useEffect(() => {
    useDashboard.getState().refetchUsers();
  }, [filters]); 

  const columns = setupColumns(t);

  return (
    <div>
      {/* Filter Section */}
      <Filters />

      {/* Data Table */}
      <DataTable columns={columns} data={users} />
    </div>
  );
};

export default UsersTable;
