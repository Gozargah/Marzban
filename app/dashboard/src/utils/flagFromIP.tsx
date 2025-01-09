import React, { useState, useEffect } from "react";
import axios from "axios";

interface FlagFromIPProps {
  ip: string;
}

const FlagFromIP: React.FC<FlagFromIPProps> = ({ ip }) => {
  const [flag, setFlag] = useState<string | null>(null);

  const generateFlagEmoji = (countryCode: string): string => {
    const baseCodePoint = 127397; // Base code point for flags
    return (
      String.fromCodePoint(baseCodePoint + countryCode.charCodeAt(0)) +
      String.fromCodePoint(baseCodePoint + countryCode.charCodeAt(1))
    );
  };

  const fetchFlag = async (ip: string) => {
    try {
      const { data } = await axios.get(`https://freeipapi.com/api/json/${ip}`);

      if (data && data.countryCode) {
        const countryCode = data.countryCode.toUpperCase();
        const flagEmoji = generateFlagEmoji(countryCode);

        setFlag(flagEmoji);
      } else {
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (ip) {
      fetchFlag(ip);
    }
  }, [ip]);

  if (flag) return <span>{flag}</span>;
};

export default FlagFromIP;
