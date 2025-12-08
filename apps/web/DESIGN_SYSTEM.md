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

### Light Mode
- **Primary**: #0066CC → #004C99 (Blue)
- **Background**: White → Gray-50 → Gray-100
- **Text**: Gray-900 → Gray-700 → Gray-500
- **Success**: #10B981 (Green)
- **Warning**: #F59E0B (Amber)
- **Error**: #EF4444 (Red)

### Dark Mode
- **Primary**: #3B82F6 → #60A5FA (Lighter Blue)
- **Background**: Gray-950 → Gray-900 → Gray-800
- **Text**: Gray-50 → Gray-300 → Gray-400
- **Success**: #34D399 (Lighter Green)
- **Warning**: #FCD34D (Lighter Amber)
- **Error**: #F87171 (Lighter Red)

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

## Future Enhancements

- Toast notification system (component exists, needs integration)
- Command palette for global search and actions
- Keyboard shortcuts help modal
- Advanced form validation with Zod
- Skeleton loaders for page loads
- Virtual scrolling for large lists
- More animation presets

## Support

For questions or issues with the design system, please refer to:
- This documentation
- Component source code in `apps/web/src/components/ui/`
- Hook implementations in `apps/web/src/hooks/`
- Theme configuration in `apps/web/src/styles/themes.ts`
