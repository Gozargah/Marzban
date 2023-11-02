import { chakra, ChakraComponent} from "@chakra-ui/react";
import {
  ClockIcon,
  ExclamationCircleIcon,
  NoSymbolIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";
import { ForwardRefExoticComponent, SVGProps } from "react";
import { DataLimitResetStrategy } from "types/User";

const iconProps = {
  baseStyle: {
    strokeWidth: "2px",
    w: 4,
    h: 4,
  },
};
const ActiveStatusIcon = chakra(WifiIcon, iconProps);
const DisabledStatusIcon = chakra(NoSymbolIcon, iconProps);
const LimitedStatusIcon = chakra(ExclamationCircleIcon, iconProps);
const ExpiredStatusIcon = chakra(ClockIcon, iconProps);
const On_holdStatusIcon = chakra(ClockIcon, iconProps);

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
    icon: ChakraComponent<ForwardRefExoticComponent<SVGProps<SVGSVGElement>>>;
  };
} = {
  active: {
    statusColor: "green",
    bandWidthColor: "primary",
    icon: ActiveStatusIcon,
  },
  connected: {
    statusColor: "green",
    bandWidthColor: "primary",
    icon: ActiveStatusIcon,
  },
  disabled: {
    statusColor: "gray",
    bandWidthColor: "gray",
    icon: DisabledStatusIcon,
  },
  expired: {
    statusColor: "orange",
    bandWidthColor: "orange",
    icon: ExpiredStatusIcon,
  },
  on_hold: {
    statusColor: "purple",
    bandWidthColor: "purple",
    icon: On_holdStatusIcon,
  },
  connecting: {
    statusColor: "orange",
    bandWidthColor: "orange",
    icon: ExpiredStatusIcon,
  },
  limited: {
    statusColor: "red",
    bandWidthColor: "red",
    icon: LimitedStatusIcon,
  },
  error: {
    statusColor: "red",
    bandWidthColor: "red",
    icon: LimitedStatusIcon,
  },
};
