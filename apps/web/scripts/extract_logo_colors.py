#!/usr/bin/env python3
"""Extract green colors from the logo image."""

import sys
from collections import Counter

try:
    from PIL import Image
except ImportError:
    print("PIL/Pillow not available, using fallback colors", file=sys.stderr)
    print('["#65d405", "#c7ff82"]')
    sys.exit(0)

def rgb_to_hex(r, g, b):
    return f"#{r:02x}{g:02x}{b:02x}"

def is_green(r, g, b, threshold=20):
    """Check if a color is greenish."""
    return g > r + threshold and g > b + threshold and g > 100

def extract_colors(image_path):
    """Extract dominant green colors from the logo."""
    try:
        img = Image.open(image_path)
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Sample pixels (every 5th pixel for performance)
        colors = Counter()
        width, height = img.size
        
        for y in range(0, height, 5):
            for x in range(0, width, 5):
                r, g, b = img.getpixel((x, y))
                if is_green(r, g, b):
                    hex_color = rgb_to_hex(r, g, b)
                    colors[hex_color] += 1
        
        # Get top 10 most common greens
        top_greens = [color for color, count in colors.most_common(10)]
        
        if not top_greens:
            # Fallback to existing brand colors
            return ['#65d405', '#c7ff82']
        
        return top_greens
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return ['#65d405', '#c7ff82']

if __name__ == '__main__':
    import json
    import os
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    logo_path = os.path.join(script_dir, '..', 'public', 'assets', 'dynamicpurchaselogo.png')
    
    if not os.path.exists(logo_path):
        print('["#65d405", "#c7ff82"]')
        sys.exit(0)
    
    colors = extract_colors(logo_path)
    print(json.dumps(colors, indent=2))
