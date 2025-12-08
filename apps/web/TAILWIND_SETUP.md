# Tailwind CSS v4.1 Setup Documentation

## Version Information

This project uses **Tailwind CSS v4.1.17** with a CSS-first configuration approach.

## Configuration Approach

Tailwind CSS v4.1 has moved to a **CSS-first configuration** model, where most configuration is done directly in CSS files rather than a separate config file.

### Key Files

1. **`src/app/globals.css`** - Primary configuration file
   - Contains `@import "tailwindcss"` to import Tailwind
   - Uses `@theme` directive for custom properties and theme values
   - Uses `@plugin` directive for plugins (e.g., `tailwindcss-animate`)
   - Uses `@custom-variant` for dark mode variant

2. **`tailwind.config.ts`** - Minimal config for tooling compatibility
   - Kept for compatibility with shadcn/ui and other tooling
   - Contains minimal settings (content paths, darkMode reference)
   - Most configuration is in CSS, not here

3. **`postcss.config.js`** - PostCSS configuration
   - Uses `@tailwindcss/postcss` plugin for Tailwind v4

## Configuration Details

### CSS Configuration (`globals.css`)

```css
@import "tailwindcss";

/* Plugin loading */
@plugin "tailwindcss-animate";

/* Dark mode variant */
@custom-variant dark (&:is(.dark *));

/* Theme configuration */
@theme {
  /* Custom colors, spacing, etc. */
  --color-primary-500: #65d405;
  /* ... */
}
```

### TypeScript Config (`tailwind.config.ts`)

The config file is minimal and primarily for:
- TypeScript type checking
- Tooling compatibility (shadcn/ui)
- Explicit content path specification (though v4 auto-detects)

**Important**: Do not add plugins to the `plugins` array in the config file. Plugins are loaded via `@plugin` directive in CSS.

## Plugins

Plugins are loaded in CSS, not in the config file:

```css
@plugin "tailwindcss-animate";
```

Currently installed plugins:
- `tailwindcss-animate` (v1.0.7) - Animation utilities for shadcn/ui

## Dark Mode

Dark mode is configured via CSS custom variant:

```css
@custom-variant dark (&:is(.dark *));
```

This allows using `dark:` prefix in class names. The `.dark` class should be applied to the root element (typically `<html>` or a container).

## Theme Customization

All theme customization is done in the `@theme` directive in `globals.css`:

- Colors (primary, accent, error, success, etc.)
- Semantic tokens (background, text, border)
- Custom properties that can be referenced in components

## Content Paths

Tailwind v4 auto-detects content files, but we explicitly specify paths in `tailwind.config.ts` for:
- Better performance
- Explicit control over what files are scanned
- Tooling compatibility

Current paths:
- `./src/**/*.{js,ts,jsx,tsx,mdx}`
- `./components/**/*.{js,ts,jsx,tsx,mdx}`

## shadcn/ui Integration

shadcn/ui is configured to work with Tailwind v4:

- Components use CSS variables defined in `@theme`
- Animation utilities from `tailwindcss-animate` plugin
- Dark mode support via `dark:` variant

The `components.json` file references `tailwind.config.ts` for tooling purposes, but the actual configuration is in CSS.

## Migration Notes

If migrating from Tailwind v3:
1. Remove `plugins` array from config (use `@plugin` in CSS instead)
2. Move theme configuration to `@theme` directive in CSS
3. Use `@custom-variant` for custom variants instead of config
4. Keep minimal config file only for tooling compatibility

## Resources

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4)
- [Tailwind CSS v4 Migration Guide](https://tailwindcss.com/docs/upgrade-guide)

