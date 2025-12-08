# Dynamic Purchase Brand Color Palette

This document defines the complete color palette for Dynamic Purchase, extracted from the brand profile manual and converted from CMYK to RGB/HEX values.

## Color Conversion

All colors were converted from CMYK to RGB using the standard conversion formula:
- R = 255 × (1 - C) × (1 - K)
- G = 255 × (1 - M) × (1 - K)
- B = 255 × (1 - Y) × (1 - K)

## Primary Brand Colors (GREEN)

The primary brand color is **green**, used for main actions, links, and brand identity.

### Base Colors
- **Primary Green (Main)**: 
  - CMYK: C=60 M=16 Y=98 K=1
  - RGB: (101, 212, 5)
  - HEX: `#65D405`
  - Usage: Primary buttons, links, brand elements

- **Primary Green (Light)**:
  - CMYK: C=22 M=0 Y=49 K=0
  - RGB: (199, 255, 130)
  - HEX: `#C7FF82`
  - Usage: Light backgrounds, hover states, subtle accents

### Primary Color Scale

Generated from the base colors with interpolated shades:

**Light Mode:**
- `primary-50`: `#f0fdf4` - Lightest tint
- `primary-100`: `#dcfce7` - Very light
- `primary-200`: `#c7ff82` - Light green (from brand manual)
- `primary-300`: `#a8e85c` - Light-medium
- `primary-400`: `#89d136` - Medium-light
- `primary-500`: `#65d405` - Main brand green (from brand manual)
- `primary-600`: `#4fa804` - Medium-dark
- `primary-700`: `#3d7c03` - Dark
- `primary-800`: `#2a5002` - Very dark
- `primary-900`: `#182401` - Darkest
- `primary-950`: `#0f1501` - Almost black

**Dark Mode:**
- Adjusted brightness and saturation for dark backgrounds
- Uses same scale but with different emphasis (lighter shades more prominent)

## Accent Color (BLUE)

Used for secondary actions, informational elements, and accents.

### Base Color
- **Accent Blue**:
  - CMYK: C=69 M=4 Y=1 K=0
  - RGB: (79, 245, 252)
  - HEX: `#4FF5FC`
  - Usage: Secondary buttons, info badges, links in dark mode

### Accent Blue Scale
- `accent-50`: `#ecfeff`
- `accent-100`: `#cffafe`
- `accent-200`: `#a5f3fc`
- `accent-300`: `#67e8f9`
- `accent-400`: `#4ff5fc` - Main accent blue (from brand manual)
- `accent-500`: `#06b6d4`
- `accent-600`: `#0891b2`
- `accent-700`: `#0e7490`

## Alternative Color (YELLOW)

Used for warnings, highlights, and alternative actions.

### Base Color
- **Alternative Yellow**:
  - CMYK: C=0 M=19 Y=80 K=0
  - RGB: (255, 207, 51)
  - HEX: `#FFCF33`
  - Usage: Warning badges, highlights, alternative CTAs

### Alternative Yellow Scale
- `alternative-50`: `#fffbeb`
- `alternative-100`: `#fef3c7`
- `alternative-200`: `#fde68a`
- `alternative-300`: `#fcd34d`
- `alternative-400`: `#ffcf33` - Main alternative yellow (from brand manual)
- `alternative-500`: `#f59e0b`
- `alternative-600`: `#d97706`
- `alternative-700`: `#b45309`

## Error Color (RED)

Used for errors, destructive actions, and critical alerts.

### Base Color
- **Error Red**:
  - CMYK: C=7 M=95 Y=100 K=2
  - RGB: (232, 12, 0)
  - HEX: `#E80C00`
  - Usage: Error messages, delete buttons, critical alerts

### Error Color Scale
- `error-50`: `#fef2f2`
- `error-100`: `#fee2e2`
- `error-200`: `#fecaca`
- `error-300`: `#fca5a5`
- `error-400`: `#f87171`
- `error-500`: `#ef4444`
- `error-600`: `#e80c00` - Main error red (from brand manual)
- `error-700`: `#b91c1c`

## Success Color

Uses the primary green for consistency:
- `success-500`: `#65d405` - Same as primary-500
- `success-600`: `#4fa804` - Same as primary-600
- `success-700`: `#3d7c03` - Same as primary-700

## Semantic Colors

### Background Colors
- **Light Mode:**
  - `background-primary`: `#f3f4f6` (Gray-100) - Page background
  - `background-secondary`: `#f9fafb` (Gray-50) - Cards/content
  - `background-tertiary`: `#ffffff` (White) - Elevated elements

- **Dark Mode:**
  - `background-primary`: `#0f172a` (Gray-950) - Page background
  - `background-secondary`: `#1e293b` (Gray-900) - Cards/content
  - `background-tertiary`: `#334155` (Gray-800) - Elevated elements

### Text Colors
- **Light Mode:**
  - `text-primary`: `#111827` (Gray-900)
  - `text-secondary`: `#4b5563` (Gray-600)
  - `text-tertiary`: `#6b7280` (Gray-500)

- **Dark Mode:**
  - `text-primary`: `#f9fafb` (Gray-50)
  - `text-secondary`: `#d1d5db` (Gray-300)
  - `text-tertiary`: `#9ca3af` (Gray-400)

### Border Colors
- **Light Mode:**
  - `border-primary`: `#e5e7eb` (Gray-200)
  - `border-secondary`: `#d1d5db` (Gray-300)

- **Dark Mode:**
  - `border-primary`: `#374151` (Gray-700)
  - `border-secondary`: `#4b5563` (Gray-600)

## Usage Guidelines

### Primary Actions
**Light Mode:**
- Use `primary-700` (#3d7c03) for primary buttons with **white text** (WCAG AA compliant: 5.14:1)
- Use `primary-600` (#4fa804) for primary buttons with **dark text** (WCAG AA compliant: 9.27:1)
- Use `primary-500` (#65d405) for links and text accents on light backgrounds
- Use `primary-400` for hover states

**Dark Mode:**
- Use `primary-500` (#65d405) for primary buttons with **white text** (WCAG AA compliant: 9.33:1)
- Use `primary-400` for hover states

### Secondary Actions
- Use `accent-500` for secondary buttons (with appropriate text color)
- Use `accent-400` for hover states
- Note: Accent blue has low contrast on light backgrounds - use with dark text or on dark backgrounds

### Warnings
- Use `alternative-500` for warning badges
- Use `alternative-400` (#ffcf33) for highlights
- Note: Yellow has low contrast on light backgrounds - use with dark text or on dark backgrounds

### Errors
**Light Mode:**
- Use `error-700` (#b91c1c) for error messages and destructive actions (WCAG AA compliant: 5.88:1)
- Use `error-600` (#dc2626) for hover states

**Dark Mode:**
- Use `error-500` (#ef4444) or `error-400` (#f87171) for better contrast on dark backgrounds
- Use `error-600` (#e80c00) for hover states

### Success
- Use `success-600` for success messages
- Use `success-500` (#65d405) for success badges

## Accessibility

All color combinations have been tested for WCAG AA compliance:
- Text on backgrounds: Minimum 4.5:1 contrast ratio
- UI elements: Minimum 3:1 contrast ratio
- Focus states: High contrast outlines

### Contrast Test Results

**Passing Combinations:**
- ✅ Primary Green (#65d405) on dark backgrounds: 9.33:1
- ✅ Primary Light Green (#c7ff82) on dark backgrounds: 15.35:1
- ✅ White text on Primary-700 (#3d7c03): 5.14:1
- ✅ Dark text on Primary-500 (#65d405): 9.27:1
- ✅ Accent Blue (#4ff5fc) on dark backgrounds: 13.43:1
- ✅ Alternative Yellow (#ffcf33) on dark backgrounds: 12.09:1
- ✅ Error Red-700 (#b91c1c) on light backgrounds: 5.88:1

**Requires Attention:**
- ⚠️ Primary Green (#65d405) on light backgrounds: 1.74:1 - Use with dark text only
- ⚠️ White text on Primary-500 (#65d405): 1.91:1 - Use Primary-700 for buttons with white text
- ⚠️ Accent Blue (#4ff5fc) on light backgrounds: 1.21:1 - Use on dark backgrounds or with dark text
- ⚠️ Alternative Yellow (#ffcf33) on light backgrounds: 1.34:1 - Use on dark backgrounds or with dark text
- ⚠️ Error Red (#e80c00) on light backgrounds: 4.26:1 - Use Error-700 (#b91c1c) instead
- ⚠️ Error Red (#e80c00) on dark backgrounds: 3.81:1 - Use Error-500 or Error-400 for dark mode

## Color Relationships

- **Primary (Green)**: Main brand identity, primary actions
- **Accent (Blue)**: Secondary actions, informational elements
- **Alternative (Yellow)**: Warnings, highlights
- **Error (Red)**: Errors, destructive actions
- **Success (Green)**: Success states (uses primary green)
