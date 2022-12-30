import dayjs from "dayjs";

export const relativeExpiryDate = (expiryDate: number | null | undefined) => {
  let date = "";
  if (expiryDate) {
    if (
      dayjs(expiryDate * 1000)
        .utc()
        .isAfter(dayjs().utc())
    ) {
      date = "Expires " + dayjs().to(dayjs(expiryDate * 1000).utc());
    } else {
      date = "Expired " + dayjs().from(dayjs(expiryDate * 1000).utc());
    }
  }
  return date;
};
