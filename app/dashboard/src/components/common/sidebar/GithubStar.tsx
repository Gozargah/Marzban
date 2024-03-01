import { useColorMode } from "@chakra-ui/react";
import { REPO_URL } from "config/project";
import GitHubButton from "react-github-btn";

export const GithubStar = () => {
  const { colorMode } = useColorMode();
  const gBtnColor = colorMode === "dark" ? "dark_dimmed" : colorMode;
  return (
    <GitHubButton
      href={REPO_URL}
      data-color-scheme={`no-preference: ${gBtnColor}; light: ${gBtnColor}; dark: ${gBtnColor};`}
      data-size="large"
      data-show-count="true"
      aria-label="Star Marzban on GitHub"
    >
      Star
    </GitHubButton>
  );
};
