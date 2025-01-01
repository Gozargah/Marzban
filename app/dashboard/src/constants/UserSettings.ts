import { ForwardRefExoticComponent, SVGProps } from "react";
import { Wifi, Ban , AlertCircle, Clock } from "lucide-react";
import { DataLimitResetStrategy } from "@/types/User";

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
    sliderColor: string;
    icon: ForwardRefExoticComponent<SVGProps<SVGSVGElement>>;
  };
} = {
  active: {
    statusColor: "dark:bg-emerald-900 dark:text-emerald-200 bg-emerald-100 text-emerald-900",
    bandWidthColor: "bg-primary-500",
    icon: Wifi,
    sliderColor: "bg-emerald-600"
  },
  connected: {
    statusColor: "bg-green-500 text-white",
    bandWidthColor: "bg-primary-500",
    icon: Wifi,
    sliderColor: "bg-primary-500"
  },
  disabled: {
    statusColor: "dark:bg-zinc-800 dark:text-zinc-300 bg-zinc-300 text-zinc-800",
    bandWidthColor: "bg-zinc-400",
    icon: Ban,
    sliderColor: "bg-neutral-600"
  },
  expired: {
    statusColor: "dark:bg-amber-600 dark:text-amber-100 bg-amber-100 text-amber-600",
    bandWidthColor: "bg-amber-500",
    icon: Clock,
    sliderColor: "bg-amber-600"
  },
  on_hold: {
    statusColor: "dark:bg-violet-900 dark:text-violet-200 bg-violet-200 text-violet-900",
    bandWidthColor: "bg-violet-500",
    icon: Clock,
    sliderColor: "bg-violet-800"
  },
  connecting: {
    statusColor: "bg-orange-500 text-white",
    bandWidthColor: "bg-orange-500",
    icon: Clock,
    sliderColor: "bg-primary-500"
  },
  limited: {
    statusColor: "dark:bg-red-900 dark:text-red-100 bg-red-100 text-red-900",
    bandWidthColor: "bg-red-500",
    icon: AlertCircle,
    sliderColor: "bg-red-600"
  },
  error: {
    statusColor: "bg-red-500 text-white",
    bandWidthColor: "bg-red-500",
    icon: AlertCircle,
    sliderColor: "bg-red-900"
  },
};
