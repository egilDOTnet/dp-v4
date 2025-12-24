# Background Color Hierarchy Guide

## Design System Specification

**Light Mode**: White → Gray-50 → Gray-100  
**Dark Mode**: Gray-950 → Gray-900 → Gray-800

The arrow indicates progression from **lightest to darkest** (light mode) or **darkest to lightest** (dark mode).

## Current CSS Variable Mapping

**Light Mode:**
- `--color-bg-primary`: #ffffff (white - lightest)
- `--color-bg-secondary`: #f9fafb (gray-50 - medium)  
- `--color-bg-tertiary`: #f3f4f6 (gray-100 - darkest)

**Dark Mode:**
- `--color-bg-primary`: #0f172a (gray-950 - darkest)
- `--color-bg-secondary`: #1e293b (gray-900 - medium)
- `--color-bg-tertiary`: #334155 (gray-800 - lightest)

## Correct Hierarchy for Visual Depth

### Dark Mode (Darkest → Lightest)
1. **Page Background** (darkest at back): `bg-background-primary` (gray-950)
2. **Cards/Content** (medium, elevated): `bg-background-secondary` (gray-900)
3. **Sidebar/Nested** (lightest, most elevated): `bg-background-tertiary` (gray-800)

### Light Mode (Darkest → Lightest)
1. **Page Background** (darkest shade): `bg-background-tertiary` (gray-100)
2. **Cards/Content** (medium): `bg-background-secondary` (gray-50)
3. **Sidebar/Elevated** (lightest): `bg-background-primary` (white)

## Current Usage (TO BE FIXED)

Currently all components are using:
- Page: `bg-background-secondary` 
- Cards: `bg-background-primary`
- Sidebar: `bg-background-primary`

This is WRONG because:
- In dark mode: page should be darkest (primary), but we're using secondary
- In light mode: page should be gray-100 (tertiary), cards should be white (primary), sidebar should be white (primary)

## Required Fix

Update components to use:
- **Page background**: `bg-background-primary` in dark mode, `bg-background-tertiary` in light mode
- **Cards**: `bg-background-secondary` in both modes
- **Sidebar**: `bg-background-tertiary` in dark mode, `bg-background-primary` in light mode

However, since we can't use conditional classes, we need to choose a consistent mapping that works visually for both modes.

### Option: Use Consistent Semantic Meaning
- Primary = Base/Page layer
- Secondary = Elevated/Content layer  
- Tertiary = Most elevated/Nested layer

This requires updating the CSS variable values to match this semantic meaning across both themes.
