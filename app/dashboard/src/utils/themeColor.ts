import { ColorMode } from "@chakra-ui/react";

export const updateThemeColor = (colorMode: ColorMode) => {
  const el = document.querySelector('meta[name="theme-color"]');
  el?.setAttribute('content', colorMode == "dark" ? "#1A202C" : "#3B81F6");
  document.body.classList.remove(colorMode == "dark" ? 'light' : 'dark')
  document.body.classList.add(colorMode == "dark" ? 'dark' : 'light')
};
