import { FC } from "react";

type NodeStatusBadgeProps = {
  status?: "connected" | "connecting" | "error" | "disabled" | null;
};

export const NodeStatusBadge: FC<NodeStatusBadgeProps> = ({ status }) => {
  if (status === "disabled") {
    return (
      <div className="min-h-[10px] min-w-[10px] rounded-full border border-gray-400 dark:border-gray-600 shadow-sm" />
    );
  }

  if (status === "connecting" || status === "error") {
    return (
      <div className="min-h-[10px] min-w-[10px] rounded-full bg-red-300 dark:bg-red-500 shadow-sm animate-redPulse" />
    );
  }

  if (status === "connected") {
    return (
      <div className="min-h-[10px] min-w-[10px] rounded-full bg-green-300 dark:bg-green-500 shadow-sm animate-greenPulse" />
    );
  }

  return (
    <div className="min-h-[10px] min-w-[10px] rounded-full bg-gray-400 dark:bg-gray-600 shadow-sm" />
  );
};
