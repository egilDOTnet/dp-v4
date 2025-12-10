# Design System Documentation

## Overview

This document describes the comprehensive design system implemented for Dynamic Purchase, featuring unified components, dark/light theme support, and consistent patterns across the application.

## Design Philosophy

- **Speed-first**: Minimize clicks, auto-focus inputs, keyboard shortcuts
- **Minimalist**: Clean interfaces, hide complexity until needed
- **Consistent**: Same patterns everywhere - learn once, use everywhere
- **Accessible**: WCAG compliant, keyboard navigable, clear focus states

## Theme System

### User-Selectable Themes

Users can choose between light and dark modes via their profile page. The theme preference is:
- Stored in the database per user
- Synced across devices
- Falls back to system preference for new users

### Theme Implementation

**Context**: `apps/web/src/contexts/ThemeContext.tsx`
```typescript
import { useTheme } from '@/contexts/ThemeContext';

// In component
const { theme, setTheme, toggleTheme } = useTheme();
```

**Tokens**: `apps/web/src/styles/themes.ts`
- Centralized color definitions
- Separate palettes for light and dark modes

**CSS Variables**: `apps/web/src/app/globals.css`
- Theme-aware custom properties
- Smooth transitions between themes

## Color System

The color system is based on the green palette extracted from the Dynamic Purchase logo, ensuring brand consistency throughout the application.

### Light Mode
- **Primary**: #65D405 → #428a03 (Green from logo)
  - Main brand green: `#65d405` (primary-500)
  - Light green: `#c7ff82` (primary-200)
  - Full scale: primary-50 through primary-950
- **Background**: White → Gray-50 → Gray-100
- **Text**: Gray-900 → Gray-700 → Gray-500
- **Success**: #65D405 (Primary green from logo)
- **Warning**: #FFCF33 (Alternative yellow) / #FFCF33 (Yellow-600: #FFCF33)
- **Error**: #B91C1C (Error red)
- **Accent**: Primary green (#65D405 / primary-600) for primary actions

### Dark Mode
- **Primary**: #65D405 → #c7ff82 (Green from logo, reversed scale)
  - Main brand green: `#65d405` (primary-500, same as light mode)
  - Light green: `#c7ff82` (primary-800 in dark mode)
  - Scale reversed for optimal contrast on dark backgrounds
- **Background**: Gray-950 → Gray-900 → Gray-800
- **Text**: Gray-50 → Gray-300 → Gray-400
- **Success**: #65D405 (Primary green from logo)
- **Warning**: #FFCF33 (Alternative yellow)
- **Error**: #F87171 (Lighter red for dark mode)

### Usage in Components

Use semantic color classes:
```tsx
<div className="bg-background-primary text-text-primary border-border-primary">
  <!-- Content -->
</div>
```

## Component Library

### Location
All UI components are in `apps/web/src/components/ui/`

### Core Components

#### Button
```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" loading={false}>
  Click Me
</Button>
```
**Variants**: primary, secondary, ghost, danger
**Sizes**: sm, md, lg

#### Input
```tsx
import { Input } from '@/components/ui';

<Input
  label="Email"
  type="email"
  error="Invalid email"
  hint="We'll never share your email"
  autoFocus
/>
```

#### Card
```tsx
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui';

<Card variant="interactive">
  <CardHeader>Title</CardHeader>
  <CardBody>Content</CardBody>
  <CardFooter>Actions</CardFooter>
</Card>
```

#### SearchBar
```tsx
import { SearchBar } from '@/components/ui';

<SearchBar
  value={query}
  onChange={setQuery}
  onClear={clearSearch}
  placeholder="Search..."
/>
```
**Features**: Auto-focus with Cmd+K / Ctrl+K, clear button, keyboard shortcuts indicator

#### Table
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Value</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

#### Other Components
- **Badge**: Status indicators with color variants
- **Avatar**: User avatars with initials
- **LoadingSpinner**: Consistent loading indicators
- **EmptyState**: Empty state messages with actions
- **Container**: Responsive page container
- **PageHeader**: Standard page header with title, description, actions
- **Breadcrumbs**: Navigation breadcrumbs
- **Select**: Styled select dropdowns
- **Textarea**: Auto-growing text areas
- **FormField**: Wrapper for form inputs with labels and errors

## Hooks

### useSearch
Instant client-side search with filtering:
```tsx
import { useSearch } from '@/hooks/useSearch';

const { query, setQuery, filteredItems, clearSearch } = useSearch({
  items: data,
  searchFields: ['name', 'email', (item) => item.custom],
  caseSensitive: false,
});
```

### useInlineEdit
Manage inline edit state with animations:
```tsx
import { useInlineEdit } from '@/hooks/useInlineEdit';

const {
  isEditing,
  isAnimating,
  isSaving,
  error,
  startEditing,
  cancelEditing,
  save,
} = useInlineEdit({
  onSave: async (data) => { /* save logic */ },
  onCancel: () => { /* cancel logic */ },
});
```

### useKeyboardShortcut
Add custom keyboard shortcuts:
```tsx
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

useKeyboardShortcut('s', handleSave, { ctrlOrMeta: true });
```

## Patterns

### Inline Editing
All forms use a consistent inline editing pattern:
1. Forms appear inline within the list/table
2. Smooth animations on show/hide
3. Auto-focus first input field
4. Escape to cancel, Enter to save (where appropriate)
5. Show loading states during save

### Search Everywhere
All list views include instant search:
- Search bar at the top
- Results update as you type
- Shows count of filtered items
- Cmd+K / Ctrl+K to focus search
- Clear button to reset

### Responsive Design
All components are mobile-first responsive:
- Single column on mobile
- Multiple columns on tablet (md:)
- Optimized layout on desktop (lg:, xl:)
- Touch-friendly tap targets (min 44x44px)
- Responsive navigation and menus

### Create/Add Actions
All buttons that create or add new items use **primary green** color (from logo) for visual consistency:
- **Light mode**: `bg-primary-600 hover:bg-primary-700` (#56b404 → #428a03)
- **Dark mode**: `bg-primary-600 hover:bg-primary-700` (same colors, excellent contrast on dark backgrounds)

This applies to:
- "Add Vendor" buttons
- "New Task" buttons
- "Add Requirement" links
- Any other create/new/add action

**Placement & Alignment**: 
- Create buttons should be placed next to the SearchBar (if present) rather than in the page header
- **Create buttons should always be right-aligned** within their container using `ml-auto`
- Search result counts (e.g., "5 of 10 vendors") appear between the search bar and the right-aligned button

```tsx
// Correct pattern - search left, button right-aligned
<div className="flex items-center gap-4">
  <div className="flex-1 max-w-md">
    <SearchBar ... />
  </div>
  {isSearching && (
    <span className="text-sm text-gray-500">
      {filteredItems.length} of {items.length} items
    </span>
  )}
  <button className="ml-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
    Add Item
  </button>
</div>
```

For sections with title + actions (no search bar), use `justify-between`:
```tsx
<div className="flex items-center justify-between">
  <h2 className="text-xl font-semibold">Section Title</h2>
  <button className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
    New Item
  </button>
</div>
```

### Multi-Edit Operations
All buttons that perform bulk edit operations on multiple selected items use **accent blue** color for visual distinction:
- **Light mode**: `bg-accent-600 hover:bg-accent-700` (#0891b2 → #0e7490)
- **Dark mode**: `bg-accent-600 hover:bg-accent-700` (same colors, excellent contrast on dark backgrounds)

This applies to:
- "Multi edit" buttons
- "Bulk update" actions
- Any other operation that modifies multiple selected items

**Color Rationale**: 
- Accent blue is used for secondary actions (as defined in the color system)
- Distinct from primary green (create actions) and error red (delete actions)
- Provides clear visual hierarchy: Green = Create, Blue = Edit, Red = Delete

```tsx
<button className="px-4 py-2 bg-accent-600 text-white rounded-md hover:bg-accent-700">
  Multi edit
</button>
```

### Selection Indicators (Checkboxes)
All checkboxes used for selecting items (requirements, hierarchies, etc.) use **accent blue** (`accent-600`, #0891b2) for the checked state to maintain visual consistency with multi-edit operations.

**Implementation**:
- Checkboxes use the CSS `accent-color` property set to `var(--color-accent-600)`
- This is defined globally in `globals.css` for all `input[type="checkbox"]` elements
- Matches the color used for multi-edit buttons, creating a cohesive selection experience

**Color Rationale**:
- Consistent with multi-edit operations (both involve selection/editing)
- Distinct from primary green (create actions) and error red (delete actions)
- Provides clear visual feedback that items are selected for editing operations

## Keyboard Shortcuts

### Global
- **Cmd+K / Ctrl+K**: Focus search bar (where available)
- **Escape**: Close modals, menus, cancel edits

### Forms
- **Enter**: Submit form (single-line inputs)
- **Escape**: Cancel inline edit
- **Tab**: Navigate between fields

### Navigation
- **Cmd+/ / Ctrl+/**: Show keyboard shortcuts help (future feature)

## Accessibility

### WCAG Compliance
- All interactive elements have proper ARIA labels
- Focus visible states on all focusable elements
- Keyboard navigation fully supported
- Screen reader announcements for dynamic content
- Proper heading hierarchy
- Color contrast ratios meet AA standards

### Features
- Skip to content links (future feature)
- Descriptive link text
- Form labels properly associated
- Error messages linked to inputs
- Loading and success states announced
- VisuallyHidden component for screen reader-only content

## Typography

### Font Family
- **Primary**: Inter (sans-serif)
- **Monospace**: JetBrains Mono (for code/data)

### Scale
- **H1**: 2rem (32px) / 2.5rem mobile
- **H2**: 1.5rem (24px) / 1.75rem mobile
- **H3**: 1.25rem (20px) / 1.5rem mobile
- **Body**: 0.875rem (14px)
- **Small**: 0.75rem (12px)

## Spacing

Base unit: 0.25rem (4px)

Common spacings:
- **0.5rem** (8px): Tight spacing
- **0.75rem** (12px): Compact spacing
- **1rem** (16px): Default spacing
- **1.5rem** (24px): Relaxed spacing
- **2rem** (32px): Loose spacing

## Transitions

Consistent durations:
- **150ms**: Quick interactions (hover, focus)
- **200ms**: Theme transitions
- **300ms**: Animations (show/hide, slide)

All transitions use `cubic-bezier(0.4, 0, 0.2, 1)` timing function.

## Layout

### Container Sizes
- **sm**: max-width 640px
- **md**: max-width 768px
- **lg**: max-width 1024px
- **xl**: max-width 1280px
- **full**: no max-width

### Responsive Breakpoints
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px

## Best Practices

### Component Usage
1. Always use semantic color classes (bg-background-primary vs bg-white)
2. Use the component library instead of raw HTML elements
3. Leverage hooks for common patterns (search, inline edit)
4. Follow the established patterns for consistency

### Performance
1. Components use React.forwardRef where appropriate
2. Memoization for expensive computations
3. Lazy loading for large lists (future enhancement)
4. Optimistic updates where possible

### Maintenance
1. All colors defined in theme files
2. Consistent naming conventions
3. TypeScript for type safety
4. Comprehensive prop interfaces

## Migration Guide

### Updating Existing Components

1. **Replace raw inputs with UI components**:
```tsx
// Before
<input className="..." />

// After
<Input label="Name" />
```

2. **Use semantic colors**:
```tsx
// Before
<div className="bg-white text-gray-900 border-gray-300">

// After
<div className="bg-background-primary text-text-primary border-border-primary">
```

3. **Add search to lists**:
```tsx
import { useSearch } from '@/hooks/useSearch';
import { SearchBar } from '@/components/ui';

const { query, setQuery, filteredItems } = useSearch({
  items: data,
  searchFields: ['name', 'email'],
});

<SearchBar value={query} onChange={setQuery} />
```

## Logo

The application logo is currently using the PNG version from `assets/dynamicpurchaselogo.png`. The logo is displayed in:
- Header component (main navigation)
- Login page
- Other authentication pages

**Future Enhancement**: The current PNG logo should be replaced with a high-quality SVG version that better matches the original design. This will improve scalability and visual quality across different screen sizes and resolutions.

## Modal Overlay Pattern

All modals use a consistent overlay pattern with a dimmed background:

- **Overlay**: `bg-black/80` (80% opacity black background)
- **Behavior**: Clicking outside the modal closes it (acts as cancel)
- **Keyboard**: Escape key closes the modal
- **Animation**: Fade in/out with zoom effect for smooth transitions

### Implementation

Modals use the Dialog component from `@/components/ui/Dialog.tsx` which automatically provides:
- Dimmed background overlay
- Click-outside-to-close behavior
- Escape key handling
- Smooth animations

### Multi-Edit Forms

When editing multiple items, use "Don't change" as the default option for all fields. This allows users to selectively update only the fields they want to change:

```tsx
<Select value={type} onChange={(e) => setType(e.target.value)}>
  <option value="">Don't change</option>
  <option value="Option1">Option 1</option>
  <option value="Option2">Option 2</option>
</Select>
```

Only fields that are not "Don't change" (empty string) should be included in the update payload.

## Future Enhancements

- Toast notification system (component exists, needs integration)
- Command palette for global search and actions
- Keyboard shortcuts help modal
- Advanced form validation with Zod
- Skeleton loaders for page loads
- Virtual scrolling for large lists
- More animation presets
- High-quality SVG logo version

## Support

For questions or issues with the design system, please refer to:
- This documentation
- Component source code in `apps/web/src/components/ui/`
- Hook implementations in `apps/web/src/hooks/`
- Theme configuration in `apps/web/src/styles/themes.ts`
