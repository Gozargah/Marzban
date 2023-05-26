import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

export const relativeExpiryDate = (expiryDate: number | null | undefined) => {
  let dateInfo = { status: "", time: "" };
  const { t } = useTranslation();
  if (expiryDate) {
    if (
      dayjs(expiryDate * 1000)
        .utc()
        .isAfter(dayjs().utc())
    ) {
      dateInfo.status = "expires";
    } else {
      dateInfo.status = "expired";
    }
    const durationSlots: string[] = [];
    const duration = dayjs.duration(
      dayjs(expiryDate * 1000)
        .utc()
        .diff(dayjs())
    );
    if (duration.years() != 0) {
      durationSlots.push(
        Math.abs(duration.years()) +
          t("dateInfo.year") +
          (Math.abs(duration.years()) != 1 ? t("dateInfo.suffix") : "")
      );
    }
    if (duration.months() != 0) {
      durationSlots.push(
        Math.abs(duration.months()) +
          t("dateInfo.month") +
          (Math.abs(duration.months()) != 1 ? t("dateInfo.suffix") : "")
      );
    }
    if (duration.days() != 0) {
      durationSlots.push(
        Math.abs(duration.days()) +
          t("dateInfo.day") +
          (Math.abs(duration.days()) != 1 ? t("dateInfo.suffix") : "")
      );
    }
    if (durationSlots.length === 0) {
      if (duration.hours() != 0) {
        durationSlots.push(
          Math.abs(duration.hours()) +
            t("dateInfo.hour") +
            (Math.abs(duration.hours()) != 1 ? t("dateInfo.suffix") : "")
        );
      }
      if (duration.minutes() != 0) {
        durationSlots.push(
          Math.abs(duration.minutes()) +
            t("dateInfo.min") +
            (Math.abs(duration.minutes()) != 1 ? t("dateInfo.suffix") : "")
        );
      }
    }
    dateInfo.time = durationSlots.join(", ");
  }
  return dateInfo;
};
