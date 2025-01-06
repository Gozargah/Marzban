import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const useDirDetection = () => {
  const { i18n } = useTranslation();
  const [direction, setDirection] = useState<string>(i18n.dir());

  useEffect(() => {
    setDirection(i18n.dir());
  }, [i18n.language]);

  return direction; // Returns "rtl" or "ltr"
};

export default useDirDetection;
