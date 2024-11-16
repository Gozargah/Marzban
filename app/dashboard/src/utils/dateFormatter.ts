import dayjs from "dayjs";
import i18n from "i18next";

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
    if (i18n.language.toLocaleLowerCase() === "zh-cn") {
      dateInfo.time = dateInfo.time.replace(/year[s]?/, "年");
      dateInfo.time = dateInfo.time.replace(/month[s]?/, "个月");
      dateInfo.time = dateInfo.time.replace(/day[s]?/, "天");
      dateInfo.time = dateInfo.time.replace(/hour[s]?/, "小时");
      dateInfo.time = dateInfo.time.replace(/min[s]?/, "分钟");
      dateInfo.time = dateInfo.time.replace(/,/g, "");
      if (dateInfo.status == "expires") {
        dateInfo.time += "内";
      } else {
        dateInfo.time += "前";
      }
    }
  }
  return dateInfo;
};
