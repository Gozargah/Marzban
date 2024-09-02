import dayjs from "dayjs";

export const relativeExpiryDate = (expiryDate: number | null | undefined) => {
  let dateInfo = { status: "", time: "" };
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
          " year" +
          (Math.abs(duration.years()) != 1 ? "s" : "")
      );
    }
    if (duration.months() != 0) {
      durationSlots.push(
        Math.abs(duration.months()) +
          " month" +
          (Math.abs(duration.months()) != 1 ? "s" : "")
      );
    }
    if (duration.days() != 0) {
      durationSlots.push(
        Math.abs(duration.days()) +
          " day" +
          (Math.abs(duration.days()) != 1 ? "s" : "")
      );
    }
    if (durationSlots.length === 0) {
      if (duration.hours() != 0) {
        durationSlots.push(
          Math.abs(duration.hours()) +
            " hour" +
            (Math.abs(duration.hours()) != 1 ? "s" : "")
        );
      }
      if (duration.minutes() != 0) {
        durationSlots.push(
          Math.abs(duration.minutes()) +
            " min" +
            (Math.abs(duration.minutes()) != 1 ? "s" : "")
        );
      }
    }
    dateInfo.time = durationSlots.join(", ");
  }
  return dateInfo;
};
