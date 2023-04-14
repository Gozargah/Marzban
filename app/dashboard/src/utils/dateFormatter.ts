import dayjs from "dayjs";

export const relativeExpiryDate = (expiryDate: number | null | undefined) => {
  let dateInfo = {status: "", time: ""}
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
    dateInfo.time = dayjs().to(dayjs(expiryDate * 1000).utc());
  }
  return dateInfo;
};
