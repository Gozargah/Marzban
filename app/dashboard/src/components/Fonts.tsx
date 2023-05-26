import { Global } from "@emotion/react"

export const Fonts = () => (
  <Global
    styles={`
      @font-face {
        font-family: 'vazir';
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: url(https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn/fonts/webfonts/Vazirmatn-Regular.woff2) format('woff2');
        unicode-range: U+20-21, U+24-25, U+27-3A, U+3C-3E, U+5B-5F, U+7C, U+A0, U+A9, U+AB, U+BB, U+609, U+60C, U+61B, U+61F, U+621-624, U+626-63A, U+641-642, U+644-648, U+64B-64D, U+651, U+654, U+66A-66C, U+67E, U+686, U+698, U+6A9, U+6AF, U+6CC, U+6F0-6F9, U+200E, U+2010-2011, U+2026, U+2030, U+2039-203A, U+20AC, U+2212;
      }
      `}
  />
)
