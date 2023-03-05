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
