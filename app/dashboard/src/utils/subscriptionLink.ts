export const getSubLink = (subToken: string) => {
  let base = location.protocol + "//" + location.host;
  if (
    import.meta.env.VITE_SUBSCRIBE_DOMAIN &&
    import.meta.env.VITE_SUBSCRIBE_DOMAIN.length
  ) {
    base = "http://" + import.meta.env.VITE_SUBSCRIBE_DOMAIN;
  }
  return `${base}/sub/${subToken}`;
};
