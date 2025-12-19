import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Try to use sharp if available, otherwise fall back to manual analysis
let colors = [];

try {
  const sharp = require('sharp');
  const imagePath = './public/assets/dynamicpurchaselogo.png';
  
  const image = sharp(imagePath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  const colorMap = new Map();
  
  // Sample pixels (every 10th pixel for performance)
  for (let i = 0; i < data.length; i += info.channels * 10) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = info.hasAlpha ? data[i + 3] : 255;
    
    // Only consider opaque pixels and greenish colors
    if (a > 128 && g > r && g > b && g > 100) {
      const hex = `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
      colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
    }
  }
  
  // Sort by frequency and get top greens
  colors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([hex]) => hex);
    
} catch (error) {
  console.error('Error extracting colors:', error.message);
  // Fallback: use the existing brand colors as a starting point
  colors = ['#65d405', '#c7ff82'];
}

console.log(JSON.stringify(colors, null, 2));
