/**
 * Generate a cohesive green color palette from base brand colors
 * Base colors: #65d405 (main) and #c7ff82 (light)
 */

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function interpolateColor(color1, color2, factor) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  return rgbToHex(
    rgb1.r + (rgb2.r - rgb1.r) * factor,
    rgb1.g + (rgb2.g - rgb1.g) * factor,
    rgb1.b + (rgb2.b - rgb1.b) * factor
  );
}

function darken(color, amount) {
  const rgb = hexToRgb(color);
  return rgbToHex(
    Math.max(0, rgb.r * (1 - amount)),
    Math.max(0, rgb.g * (1 - amount)),
    Math.max(0, rgb.b * (1 - amount))
  );
}

function lighten(color, amount) {
  const rgb = hexToRgb(color);
  return rgbToHex(
    Math.min(255, rgb.r + (255 - rgb.r) * amount),
    Math.min(255, rgb.g + (255 - rgb.g) * amount),
    Math.min(255, rgb.b + (255 - rgb.b) * amount)
  );
}

// Base colors from logo/brand
const mainGreen = "#65d405";  // Primary brand green
const lightGreen = "#c7ff82"; // Light brand green

// Generate palette
const palette = {
  // Lightest shades (from white towards light green)
  "50": lighten(lightGreen, 0.85),   // Very light tint
  "100": lighten(lightGreen, 0.70),  // Light tint
  "200": lightGreen,                 // Light green from brand
  "300": interpolateColor(lightGreen, mainGreen, 0.3), // Light-medium
  "400": interpolateColor(lightGreen, mainGreen, 0.6), // Medium-light
  "500": mainGreen,                  // Main brand green
  "600": darken(mainGreen, 0.15),    // Medium-dark
  "700": darken(mainGreen, 0.35),    // Dark
  "800": darken(mainGreen, 0.55),    // Very dark
  "900": darken(mainGreen, 0.75),    // Darkest
  "950": darken(mainGreen, 0.90),    // Almost black
};

console.log(JSON.stringify(palette, null, 2));
