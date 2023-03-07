import { DataLimitResetStrategy } from "types/User";

export const resetStrategy: { title: string; value: DataLimitResetStrategy }[] =
  [
    {
      title: "No",
      value: "no_reset",
    },
    {
      title: "Daily",
      value: "day",
    },
    {
      title: "Weekly",
      value: "week",
    },
    {
      title: "Monthly",
      value: "month",
    },
    {
      title: "Annually",
      value: "year",
    },
  ];

export const statusColors: {
  [key: string]: {
    statusColor: string;
    bandWidthColor: string;
  };
} = {
  active: {
    statusColor: "green",
    bandWidthColor: "primary",
  },
  disabled: {
    statusColor: "gray",
    bandWidthColor: "gray",
  },
  expired: {
    statusColor: "orange",
    bandWidthColor: "orange",
  },
  limited: {
    statusColor: "red",
    bandWidthColor: "red",
  },
};
