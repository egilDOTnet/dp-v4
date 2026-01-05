/**
 * Banner Generator Utility
 * 
 * Generates random abstract banners using SVG-based vector graphics
 * with flowing curves and organic shapes.
 */

/**
 * Generates a random color in hex format
 */
function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 60 + Math.random() * 40; // 60-100%
  const lightness = 40 + Math.random() * 30; // 40-70%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Converts hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Handle hsl colors
  if (hex.startsWith('hsl')) {
    const match = hex.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const h = parseInt(match[1]) / 360;
      const s = parseInt(match[2]) / 100;
      const l = parseInt(match[3]) / 100;
      
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs((h * 6) % 2 - 1));
      const m = l - c / 2;
      
      let r = 0, g = 0, b = 0;
      if (h < 1/6) { r = c; g = x; }
      else if (h < 2/6) { r = x; g = c; }
      else if (h < 3/6) { g = c; b = x; }
      else if (h < 4/6) { g = x; b = c; }
      else if (h < 5/6) { r = x; b = c; }
      else { r = c; b = x; }
      
      return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
      };
    }
  }
  
  // Handle hex colors
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Generates a smooth bezier curve path
 */
function generateBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number,
  height: number
): string {
  // Create control points for smooth curves
  const cp1x = startX + (endX - startX) * 0.3 + (Math.random() - 0.5) * width * 0.2;
  const cp1y = startY + (endY - startY) * 0.3 + (Math.random() - 0.5) * height * 0.2;
  const cp2x = startX + (endX - startX) * 0.7 + (Math.random() - 0.5) * width * 0.2;
  const cp2y = startY + (endY - startY) * 0.7 + (Math.random() - 0.5) * height * 0.2;
  
  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}

/**
 * Generates an organic blob shape using bezier curves
 */
function generateBlobPath(
  centerX: number,
  centerY: number,
  radius: number,
  points: number = 8
): string {
  const angleStep = (Math.PI * 2) / points;
  const path: string[] = [];
  
  for (let i = 0; i < points; i++) {
    const angle = i * angleStep;
    const variation = 0.7 + Math.random() * 0.6; // 0.7-1.3x radius variation
    const r = radius * variation;
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    
    if (i === 0) {
      path.push(`M ${x} ${y}`);
    } else {
      // Use smooth bezier curves between points
      const prevAngle = (i - 1) * angleStep;
      const prevVariation = 0.7 + Math.random() * 0.6;
      const prevR = radius * prevVariation;
      const prevX = centerX + Math.cos(prevAngle) * prevR;
      const prevY = centerY + Math.sin(prevAngle) * prevR;
      
      const cp1x = prevX + (x - prevX) * 0.5;
      const cp1y = prevY + (y - prevY) * 0.5;
      const cp2x = x - (x - prevX) * 0.5;
      const cp2y = y - (y - prevY) * 0.5;
      
      path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y}`);
    }
  }
  
  path.push('Z');
  return path.join(' ');
}

/**
 * Generates a flowing wave path
 */
function generateWavePath(
  startY: number,
  width: number,
  height: number,
  amplitude: number,
  frequency: number
): string {
  const segments = 20;
  const segmentWidth = width / segments;
  const path: string[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const x = i * segmentWidth;
    const wave = Math.sin((i / segments) * frequency * Math.PI * 2) * amplitude;
    const y = startY + wave;
    
    if (i === 0) {
      path.push(`M ${x} ${y}`);
    } else {
      // Smooth curves between points
      const prevX = (i - 1) * segmentWidth;
      const prevWave = Math.sin(((i - 1) / segments) * frequency * Math.PI * 2) * amplitude;
      const prevY = startY + prevWave;
      
      const cpX = prevX + segmentWidth / 2;
      const cpY = (prevY + y) / 2;
      
      path.push(`Q ${cpX} ${cpY}, ${x} ${y}`);
    }
  }
  
  // Close the path to create a filled shape
  path.push(`L ${width} ${height}`);
  path.push(`L 0 ${height}`);
  path.push('Z');
  
  return path.join(' ');
}

/**
 * Generates an abstract banner SVG
 */
function generateBannerSVG(color1: string, color2: string, color3: string | null = null, width: number = 2000, height: number = 2000): string {
  // Create gradient
  const gradientId = `gradient-${Math.random().toString(36).substring(2, 11)}`;
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const rgb3 = color3 ? hexToRgb(color3) : null;
  
  // Generate multiple organic shapes
  const shapes: string[] = [];
  
  // Background gradient - use 3 colors if provided, otherwise 2
  let gradientStops = `
        <stop offset="0%" style="stop-color:rgb(${rgb1.r},${rgb1.g},${rgb1.b});stop-opacity:1" />
        <stop offset="100%" style="stop-color:rgb(${rgb2.r},${rgb2.g},${rgb2.b});stop-opacity:1" />
  `;
  
  if (rgb3) {
    gradientStops = `
        <stop offset="0%" style="stop-color:rgb(${rgb1.r},${rgb1.g},${rgb1.b});stop-opacity:1" />
        <stop offset="50%" style="stop-color:rgb(${rgb3.r},${rgb3.g},${rgb3.b});stop-opacity:1" />
        <stop offset="100%" style="stop-color:rgb(${rgb2.r},${rgb2.g},${rgb2.b});stop-opacity:1" />
    `;
  }
  
  // Create filter for soft blur/blending
  const filterId = `blur-${Math.random().toString(36).substring(2, 11)}`;
  
  // Collect all gradient definitions
  const gradientDefs: string[] = [];
  gradientDefs.push(`
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      ${gradientStops}
    </linearGradient>
    <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur" />
      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.3 0" result="goo" />
      <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
    </filter>
  `);
  
  // Add 3-6 organic blob shapes with radial gradients for smooth transitions
  const numBlobs = 3 + Math.floor(Math.random() * 4);
  const colors = rgb3 ? [color1, color2, color3] : [color1, color2];
  const blobPaths: string[] = [];
  
  for (let i = 0; i < numBlobs; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const radius = 200 + Math.random() * 400;
    const baseOpacity = 0.3 + Math.random() * 0.5;
    const colorIndex = Math.floor(Math.random() * colors.length);
    const color = colors[colorIndex];
    const rgb = hexToRgb(color);
    const radialGradientId = `radial-${i}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create radial gradient that fades from center to transparent
    gradientDefs.push(`
      <radialGradient id="${radialGradientId}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:${baseOpacity}" />
        <stop offset="50%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:${baseOpacity * 0.6}" />
        <stop offset="100%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:0" />
      </radialGradient>
    `);
    
    blobPaths.push(`
      <path
        d="${generateBlobPath(cx, cy, radius, 6 + Math.floor(Math.random() * 6))}"
        fill="url(#${radialGradientId})"
        filter="url(#${filterId})"
      />
    `);
  }
  
  // Add 2-4 flowing wave shapes with linear gradients
  const numWaves = 2 + Math.floor(Math.random() * 3);
  const wavePaths: string[] = [];
  
  for (let i = 0; i < numWaves; i++) {
    const startY = Math.random() * height;
    const amplitude = 100 + Math.random() * 200;
    const frequency = 0.5 + Math.random() * 2;
    const baseOpacity = 0.2 + Math.random() * 0.3;
    const colorIndex = Math.floor(Math.random() * colors.length);
    const color = colors[colorIndex];
    const rgb = hexToRgb(color);
    const waveGradientId = `wave-${i}-${Math.random().toString(36).substring(2, 9)}`;
    const gradientDirection = Math.random() > 0.5 ? "vertical" : "horizontal";
    
    // Create linear gradient that fades from center to edges
    if (gradientDirection === "vertical") {
      gradientDefs.push(`
        <linearGradient id="${waveGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:0" />
          <stop offset="30%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:${baseOpacity}" />
          <stop offset="70%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:${baseOpacity}" />
          <stop offset="100%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:0" />
        </linearGradient>
      `);
    } else {
      gradientDefs.push(`
        <linearGradient id="${waveGradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:0" />
          <stop offset="30%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:${baseOpacity}" />
          <stop offset="70%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:${baseOpacity}" />
          <stop offset="100%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:0" />
        </linearGradient>
      `);
    }
    
    wavePaths.push(`
      <path
        d="${generateWavePath(startY, width, height, amplitude, frequency)}"
        fill="url(#${waveGradientId})"
        filter="url(#${filterId})"
      />
    `);
  }
  
  // Add 4-8 flowing curves with gradient strokes
  const numCurves = 4 + Math.floor(Math.random() * 5);
  const curvePaths: string[] = [];
  
  for (let i = 0; i < numCurves; i++) {
    const startX = Math.random() * width;
    const startY = Math.random() * height;
    const endX = Math.random() * width;
    const endY = Math.random() * height;
    const strokeWidth = 30 + Math.random() * 50;
    const baseOpacity = 0.15 + Math.random() * 0.25;
    const colorIndex = Math.floor(Math.random() * colors.length);
    const color = colors[colorIndex];
    const rgb = hexToRgb(color);
    const curveGradientId = `curve-${i}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create gradient along the curve path
    gradientDefs.push(`
      <linearGradient id="${curveGradientId}" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
        <stop offset="0%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:0" />
        <stop offset="20%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:${baseOpacity}" />
        <stop offset="80%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:${baseOpacity}" />
        <stop offset="100%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:0" />
      </linearGradient>
    `);
    
    curvePaths.push(`
      <path
        d="${generateBezierPath(startX, startY, endX, endY, width, height)}"
        stroke="url(#${curveGradientId})"
        stroke-width="${strokeWidth}"
        fill="none"
        stroke-linecap="round"
        filter="url(#${filterId})"
      />
    `);
  }
  
  // Build the final SVG with all defs and shapes
  shapes.push(`
    <defs>
      ${gradientDefs.join('')}
    </defs>
    <rect width="${width}" height="${height}" fill="url(#${gradientId})" />
    ${blobPaths.join('')}
    ${wavePaths.join('')}
    ${curvePaths.join('')}
  `);
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${shapes.join('')}
    </svg>
  `;
}

/**
 * Converts SVG string to data URL
 */
function svgToDataUrl(svgString: string): string {
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(svgBlob);
}

/**
 * Converts SVG string to data URL (base64 encoded)
 */
function svgToBase64DataUrl(svgString: string): string {
  const encoded = encodeURIComponent(svgString);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/**
 * Converts SVG string to PNG data URL
 */
function svgToPng(svgString: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Draw the image to canvas
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to PNG data URL
      const dataUrl = canvas.toDataURL('image/png');
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };
    
    img.src = url;
  });
}

/**
 * Generates a random abstract banner
 * 
 * @param color1 - First color (hex or hsl format). If null, generates random color.
 * @param color2 - Second color (hex or hsl format). If null, generates random color.
 * @param color3 - Third color (hex or hsl format). If null, only uses 2 colors.
 * @param width - Banner width in pixels (default: 2000)
 * @param height - Banner height in pixels (default: 2000)
 * @param format - Output format: 'svg' or 'png' (default: 'svg')
 * @returns Promise resolving to data URL (SVG or PNG)
 */
export async function generateRandomBanner(
  color1: string | null = null,
  color2: string | null = null,
  color3: string | null = null,
  width: number = 2000,
  height: number = 2000,
  format: 'svg' | 'png' = 'svg'
): Promise<string> {
  const finalColor1 = color1 || randomColor();
  const finalColor2 = color2 || randomColor();
  const finalColor3 = color3 || null;
  
  const svg = generateBannerSVG(finalColor1, finalColor2, finalColor3, width, height);
  
  if (format === 'svg') {
    return svgToBase64DataUrl(svg);
  } else {
    return svgToPng(svg, width, height);
  }
}

/**
 * Generates a random abstract banner SVG string (for direct use)
 * 
 * @param color1 - First color (hex or hsl format). If null, generates random color.
 * @param color2 - Second color (hex or hsl format). If null, generates random color.
 * @param color3 - Third color (hex or hsl format). If null, only uses 2 colors.
 * @param width - Banner width in pixels (default: 2000)
 * @param height - Banner height in pixels (default: 2000)
 * @returns SVG string
 */
export function generateRandomBannerSVG(
  color1: string | null = null,
  color2: string | null = null,
  color3: string | null = null,
  width: number = 2000,
  height: number = 2000
): string {
  const finalColor1 = color1 || randomColor();
  const finalColor2 = color2 || randomColor();
  const finalColor3 = color3 || null;
  return generateBannerSVG(finalColor1, finalColor2, finalColor3, width, height);
}

/**
 * Converts hex color to HSL format for display
 */
export function hexToHsl(hex: string): string {
  if (hex.startsWith('hsl')) {
    return hex;
  }
  
  const rgb = hexToRgb(hex);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

