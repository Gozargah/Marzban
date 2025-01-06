import { useEffect } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { useTranslation } from "react-i18next";
import { setupColumns } from "@/components/users-table/columns";
import { Filters } from "@/components/users-table/filters";
import { DataTable } from "@/components/users-table/data-table";
import useDirDetection from "@/hooks/use-dir-detection";

const UsersTable = () => {
  const { t } = useTranslation();
  const dir = useDirDetection()
  const {
    filters,
    onFilterChange,
    users: { users },
    users: totalUsers,
  } = useDashboard();

  useEffect(() => {
    useDashboard.getState().refetchUsers();
  }, [filters]);

  const handleSort = (column: string) => {
    let newSort: string;

    if (filters.sort === column) {
      newSort = "-" + column;
    } else if (filters.sort === "-" + column) {
      newSort = "-created_at";
    } else {
      newSort = column;
    }

    onFilterChange({ sort: newSort });
  };

  const handleStatusFilter = (value: any) => {
    const newValue = value === "0" ? "" : value;

    onFilterChange({
      status: value.length > 0 ? newValue : undefined,
    });
  };

  const columns = setupColumns({ t,dir, handleSort, filters, handleStatusFilter });

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
