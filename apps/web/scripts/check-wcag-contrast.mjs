/**
 * Check WCAG contrast ratios for the new green palette
 */

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(color1, color2) {
  const lum1 = getLuminance(...color1);
  const lum2 = getLuminance(...color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
}

// New green palette
const primaryColors = {
  50: '#f7ffec',
  100: '#eeffda',
  200: '#c7ff82',
  300: '#aaf25d',
  400: '#8ce537',
  500: '#65d405',
  600: '#56b404',
  700: '#428a03',
  800: '#2d5f02',
  900: '#193501',
  950: '#0a1500',
};

const white = [255, 255, 255];
const black = [0, 0, 0];
const lightBg = [243, 244, 246]; // Gray-100
const darkBg = [15, 23, 42]; // Gray-950

console.log('WCAG Contrast Check Results\n');
console.log('='.repeat(60));

// Check white text on primary colors
console.log('\nWhite Text on Primary Colors:');
Object.entries(primaryColors).forEach(([shade, hex]) => {
  const rgb = hexToRgb(hex);
  const ratio = getContrastRatio(white, rgb);
  const pass = ratio >= 4.5 ? '✅' : ratio >= 3 ? '⚠️' : '❌';
  console.log(
    `  ${pass} primary-${shade} (${hex}): ${ratio.toFixed(2)}:1 ${
      ratio >= 4.5 ? '(AA)' : ratio >= 3 ? '(AA Large)' : '(Fail)'
    }`
  );
});

// Check primary colors on light background
console.log('\nPrimary Colors on Light Background (Gray-100):');
Object.entries(primaryColors).forEach(([shade, hex]) => {
  const rgb = hexToRgb(hex);
  const ratio = getContrastRatio(rgb, lightBg);
  const pass = ratio >= 4.5 ? '✅' : ratio >= 3 ? '⚠️' : '❌';
  console.log(
    `  ${pass} primary-${shade} (${hex}): ${ratio.toFixed(2)}:1 ${
      ratio >= 4.5 ? '(AA)' : ratio >= 3 ? '(AA Large)' : '(Fail)'
    }`
  );
});

// Check primary colors on dark background
console.log('\nPrimary Colors on Dark Background (Gray-950):');
Object.entries(primaryColors).forEach(([shade, hex]) => {
  const rgb = hexToRgb(hex);
  const ratio = getContrastRatio(rgb, darkBg);
  const pass = ratio >= 4.5 ? '✅' : ratio >= 3 ? '⚠️' : '❌';
  console.log(
    `  ${pass} primary-${shade} (${hex}): ${ratio.toFixed(2)}:1 ${
      ratio >= 4.5 ? '(AA)' : ratio >= 3 ? '(AA Large)' : '(Fail)'
    }`
  );
});

// Check dark text on light primary colors
console.log('\nDark Text (Black) on Light Primary Colors:');
Object.entries(primaryColors)
  .filter(([shade]) => parseInt(shade) <= 200)
  .forEach(([shade, hex]) => {
    const rgb = hexToRgb(hex);
    const ratio = getContrastRatio(black, rgb);
    const pass = ratio >= 4.5 ? '✅' : ratio >= 3 ? '⚠️' : '❌';
    console.log(
      `  ${pass} primary-${shade} (${hex}): ${ratio.toFixed(2)}:1 ${
        ratio >= 4.5 ? '(AA)' : ratio >= 3 ? '(AA Large)' : '(Fail)'
      }`
    );
  });

console.log('\n' + '='.repeat(60));
console.log('\nSummary:');
console.log('✅ = WCAG AA compliant (4.5:1 for normal text, 3:1 for large text)');
console.log('⚠️ = WCAG AA Large text only (3:1)');
console.log('❌ = Does not meet WCAG AA standards');
