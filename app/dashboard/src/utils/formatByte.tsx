export function formatBytes(bytes: number, decimals = 2, asArray = false) {
  if (!+bytes) return "0 B";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (!asArray)
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  else return [parseFloat((bytes / Math.pow(k, i)).toFixed(dm)), sizes[i]];
}

export const numberWithCommas = (x: number) => {
  if (x !== null) return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
