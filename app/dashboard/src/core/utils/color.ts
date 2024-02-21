export function generateDistinctColors(numColors: number) {
  const hueStep = 360 / numColors;
  const saturation = 90;
  const lightness = 47;
  const colors = [];

  for (let i = 0; i < numColors; i++) {
    const hue = ((i * hueStep) % 360) + 140;
    const color = hslToHex(hue, saturation, lightness);
    colors.push(color);
  }

  return colors;
}

function hslToHex(h: number, s: number, l: number) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hueToRgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
    g = Math.round(hueToRgb(p, q, h) * 255);
    b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);
  }

  const toHex = (c: number) => {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
