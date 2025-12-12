# Design System Documentation

## Overview

This document describes the comprehensive design system implemented for Dynamic Purchase, featuring unified components, dark/light theme support, and consistent patterns across the application.

## Design Philosophy

- **Speed-first**: Minimize clicks, auto-focus inputs, keyboard shortcuts
- **Minimalist**: Clean interfaces, hide complexity until needed
- **Consistent**: Same patterns everywhere - learn once, use everywhere
- **Accessible**: WCAG compliant, keyboard navigable, clear focus states

## Keyboard Shortcuts

### Form Submission

All input forms throughout the application support the following keyboard shortcut for submission:

- **Mac**: `Cmd + Enter` (⌘ + ⏎)
- **Windows/Linux**: `Ctrl + Enter` (Ctrl + ⏎)

This shortcut should be implemented for:
- Comment forms
- Message/compose forms
- Any multi-line text input with a submit action

The shortcut should only trigger when:
- The form is focused
- No dropdown menus (like @-mention autocomplete) are open
- The form has valid content to submit

Implementation example:
```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    if (onSubmit && !isDropdownOpen) {
      e.preventDefault();
      onSubmit();
    }
  }
};
```

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
**Features**: 
- Auto-focus with Cmd+K / Ctrl+K
- Clear button when text is entered
- Keyboard shortcuts indicator (⌘K)
- **White background** (`bg-background-tertiary`) when input is focused or contains text
- **Cmd-A / Ctrl-A** keyboard shortcut to select all text in the input
- Smooth transitions between background states

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

#### Tabs
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content for tab 1</TabsContent>
  <TabsContent value="tab2">Content for tab 2</TabsContent>
</Tabs>
```
**Features**: 
- Active state styling with primary color border and text
- No focus ring on click (matches RFI tab pattern)
- Keyboard navigation support (Enter/Space to activate)
- Accessible ARIA attributes
- Smooth transitions between states

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

**Title Click to Edit Mode**: Clicking on a title/heading puts all related fields into edit mode simultaneously. This allows users to quickly edit multiple fields at once (e.g., title, description, owner, dates for tasks).

### Search Everywhere
All list views include instant search:
- Search bar at the top
- Results update as you type
- Shows count of filtered items
- Cmd+K / Ctrl+K to focus search
- Clear button to reset

### Filtering Pattern
When filtering is needed in addition to search, use a filter component with dropdowns:

- **Placement**: Right-aligned next to action buttons (e.g., "Check all")
- **Default State**: Gray background (`bg-background-secondary`) with border
- **Active State**: Blue background (`bg-accent-600`) when any filter is selected
- **Structure**: Filter icon, "Filter by" text, and dropdown selects
- **Sizing**: 
  - Container padding: `px-3 py-1` (compact to match button height)
  - Select dropdowns: `h-7` (28px height) with `px-1.5 py-0.5` padding
  - This ensures the filter bar matches the height of adjacent buttons
- **Behavior**: 
  - Filters combine with search (both apply simultaneously)
  - Filtered results expand hierarchies to show matching items
  - "Check all" button changes to "Check result" when filtering is active
  - Shows "X of Y items" count when filtering

**Implementation Example**:
```tsx
<div className={`flex items-center gap-2 px-3 py-1 rounded-md border border-border-primary ${
  isFiltering ? 'bg-accent-600' : 'bg-background-secondary'
}`}>
  <FilterIcon className="h-4 w-4" />
  <span className="text-sm">Filter by</span>
  <select 
    value={filterStatus || ""} 
    onChange={...}
    className="text-sm rounded px-1.5 py-0.5 border border-border-primary h-7 bg-background-tertiary text-text-primary"
  >
    <option value="">Status</option>
    {/* options */}
  </select>
</div>
```

### List Element Backgrounds
List items should use the lightest background shade (`background-tertiary`) to create visual separation from their container:

- **Container**: Uses `bg-background-secondary` (cards, panels, list containers)
- **List Items**: Use `bg-background-tertiary` for the content area of individual items
- **Purpose**: Creates visual hierarchy and makes list items stand out from their container

**Implementation:**
```tsx
// List container
<div className="bg-background-secondary rounded-lg p-6">
  {/* List items */}
  {items.map((item) => (
    <div className="border-2 border-primary-500 rounded-lg bg-background-secondary">
      {/* Item content area - uses tertiary for elevation */}
      <div className="flex-1 px-4 py-3 bg-background-tertiary">
        {/* Item content */}
      </div>
    </div>
  ))}
</div>
```

This pattern ensures list items are visually distinct in both light and dark modes:
- **Light Mode**: White (`background-tertiary`) items on light gray (`background-secondary`) container
- **Dark Mode**: Gray-800 (`background-tertiary`) items on Gray-900 (`background-secondary`) container

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

### Search
- **Cmd+A / Ctrl+A**: Select all text in search bar (when search bar is focused)

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

### Description Icon/Symbol Pattern

The description icon/symbol is used to toggle visibility of description content. This pattern is used consistently across tasks, requirements, and questions:

- **Placement**: Appears immediately after the title/heading text
- **Visibility**: Only shown when a description exists
- **Icon**: Hamburger/lines icon (three horizontal lines) matching the date/action icon style
- **Behavior**: 
  - Click toggles description visibility in non-edit mode
  - When expanded, description appears below the title, left-aligned with the title
  - Click again to hide the description
- **Implementation**: Uses a toggle state (Set<string>) to track expanded items

```tsx
{task.description && (
  <button
    onClick={() => toggleDescription(task.id)}
    title="Toggle description"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </button>
)}
```

### Comments System

Tasks support a comments system with @-mentions and notifications:

- **Comment Icon**: Chat bubble icon positioned before date fields (right-aligned section)
- **Visual Indicator**: Shows comment count badge when comments exist (count > 0)
- **Expansion**: Clicking the icon expands a comments section below the task
- **Features**:
  - List of existing comments with creator name, date, and HTML-rendered content
  - WYSIWYG editor with @-mention support for creating new comments
  - Notification options: task owner, task owner + @-mentions, all project members, or none (default: task owner + @-mentions)

### Notifications

The notification system provides real-time updates for @-mentions and comments:

- **Bell Icon**: Located in the header between "Create Project" button and user menu
- **Visual States**:
  - Grey/dim when no unread notifications
  - Red when unread notifications exist
  - Jiggle animation (1 second) when new notifications appear
- **Dropdown**:
  - "Clear all notifications" button at the top
  - List of notifications (most recent first)
  - Unread notifications highlighted with primary color accent
  - Clicking a notification navigates to the related task page
- **Polling**: Automatically refreshes every 30 seconds

### @-Mention Support

The WYSIWYG editor supports @-mentions of project team members:

- **Trigger**: Type `@` to show mention dropdown
- **Filtering**: Dropdown filters members as you type (searches firstName, lastName, name, email)
- **Display in Dropdown**: Shows first and last name in **bold** (font-semibold), with email below in smaller text
- **Selection**: 
  - Tab or Enter to select from dropdown
  - Mouse click to select
  - Escape to close dropdown
- **Rendering**: Mentions are stored as HTML spans with `data-mention="true"` and `data-user-id` attributes
- **Display Name Logic**: 
  - If first name is unique among project members: displays first name only
  - If first name is not unique: displays full name (first + last)
- **Styling**: Mentions appear in primary green color with medium font weight
- **Insertion**: Automatically adds a space after the mention to prevent styling from affecting subsequent text

### Delete Button in List Items

Delete buttons in list items (tasks, requirements, etc.) follow a consistent pattern:

- **Placement**: Appears in the lower left corner during edit mode
- **Visibility**: Only shown when the item is in edit mode
- **Styling**: 
  - Red text color: `text-red-600`
  - Hover state: `hover:text-red-800`
  - Underline: `underline`
  - Small text: `text-sm`
  - Disabled state: `disabled:opacity-50`
- **Behavior**:
  - Shows confirmation dialog before deleting
  - Fade-out animation (300ms) before actual deletion
  - Uses opacity and scale transforms for smooth animation
- **Implementation**: 
  - Positioned below the main edit field (description, etc.)
  - Uses `mt-2` for spacing from the field above
  - Left-aligned within the edit container

```tsx
{/* Delete button in lower left corner during edit mode */}
<div className="mt-2 flex items-center">
  <button
    onClick={() => handleDelete(item.id)}
    disabled={loading || deletingItemIds.has(item.id)}
    className="text-red-600 hover:text-red-800 disabled:opacity-50 underline text-sm"
  >
    Delete
  </button>
</div>
```

## Hero Banners

Hero banners are informational banners that introduce users to different sections of the application. They provide context about the section's purpose and guide users on what they can accomplish there.

### Color Scheme

All hero banners use **blue (accent) colors** to distinguish them from primary green actions:
- **Background**: `from-accent-50 to-accent-100` gradient (light mode), `from-accent-900/20 to-accent-800/20` (dark mode)
- **Border**: `accent-200` (light mode), `accent-700` (dark mode)
- **Icon circle**: `bg-accent-600`
- **Tip box background**: `bg-white` (light mode, almost white with blue border accent), `bg-gray-800` (dark mode)
- **Tip box border**: `accent-300` (light mode), `accent-700` (dark mode)
- **Button**: `bg-accent-600 hover:bg-accent-700`

### Component

Use the `HeroBanner` component from `@/components/ui`:

```tsx
import { HeroBanner } from "@/components/ui";

<HeroBanner
  storageKey="section-hero-banner"
  title="Welcome to Section Name"
  description={
    <>
      Main description text with <strong>bold</strong> emphasis.
    </>
  }
  features={[
    {
      label: "Feature name",
      description: "Feature description",
    },
    // ... more features
  ]}
  tip={
    <>
      <div className="font-bold not-italic mb-1">Tip:</div>
      <div>Tip content here.</div>
    </>
  }
/>
```

### Structure

Hero banners include:
1. **Icon**: Blue circular icon with information symbol
2. **Title**: Section welcome message
3. **Description**: Main explanation text (supports JSX/strong tags)
4. **Features**: Bulleted list of key capabilities (optional)
5. **Tip box**: Highlighted tip section (optional)
6. **Dismiss button**: "Understood" button that persists dismissal to localStorage

### Dismissal

Hero banners are dismissible and persist their state to localStorage:
- Storage key format: `{section}-hero-banner-dismissed`
- Example keys: `dashboard-hero-banner-dismissed`, `tasks-hero-banner-dismissed`, etc.
- Once dismissed, the banner does not reappear unless localStorage is cleared

### Usage Example

```tsx
<HeroBanner
  storageKey="dashboard-hero-banner"
  title="Welcome to Your Project Dashboard"
  description={
    <>
      This is your <strong>central hub</strong> for monitoring project progress.
    </>
  }
  features={[
    {
      label: "Phase Timeline",
      description: "Track progress through procurement phases",
    },
    {
      label: "Vendor Overview",
      description: "Quick access to vendor management",
    },
  ]}
  tip={
    <>
      <div className="font-bold not-italic mb-1">Tip:</div>
      <div>Use the dashboard widgets to quickly identify areas that need attention.</div>
    </>
  }
/>
```

## Date Display Patterns

### Standard Date Formatting

All dates displayed in the application follow these standards:

**With Timestamp (DateTime)**:
- Format: `YYYY-MM-DD HH:MM`
- Example: `2024-12-10 14:30`
- Used for: Comments, activity logs, timestamps with time information
- Implementation: Use `formatDateTimeISO(dateString)` utility function

**Without Timestamp (Date Only)**:
- Format: `YYYY-MM-DD`
- Example: `2024-12-10`
- Used for: Date inputs, date-only displays, calendar views
- Implementation: Use `formatDate(dateString)` utility function

**Short Display Format** (for compact views):
- Format: `MMM DD` (e.g., "Dec 10")
- Used for: Task lists, compact cards, when space is limited
- Implementation: Use `formatDateDisplay(dateString)` utility function

### Comment Date Display

Comment dates specifically use the ISO format with timestamp:
- User name: `text-sm font-semibold text-text-primary` (prominent)
- Date: `text-xs text-text-secondary` (less prominent, visually distinct from content)
- Format: `YYYY-MM-DD HH:MM`

## Future Enhancements

- Toast notification system (component exists, needs integration)
- Command palette for global search and actions
- Keyboard shortcuts help modal
- Advanced form validation with Zod
- Skeleton loaders for page loads
- Virtual scrolling for large lists
- More animation presets
- High-quality SVG logo version

#### Tabs
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content for tab 1</TabsContent>
  <TabsContent value="tab2">Content for tab 2</TabsContent>
</Tabs>
```
**Features**: Active state styling, keyboard navigation, accessible ARIA attributes

## Import/Export Pattern

The application supports importing data from CSV files for Tasks, RFI Questionnaires, and Requirements + Hierarchy.

### Import Wizard

The `ImportWizard` component provides a multi-step process for importing data:

1. **Data Type Selection**: Choose what type of data to import
2. **File Selection**: Upload and validate CSV file
3. **Phase Selection** (Tasks only): Select target phase
4. **Column Mapping**: Map CSV columns to data fields with preview
5. **Review**: Confirm import settings
6. **Success**: View results and navigate to imported data

### CSV Format Requirements

#### Tasks
- **Required**: `name` (task name)
- Imported tasks are added to the selected phase in order

#### RFI Questionnaires
- **Required**: `title` (question title)
- Defaults: `required=false`, `type=SingleText`
- Questions are added to the project's RFI in order

#### Requirements + Hierarchy
- **Required**: `level1` (hierarchy title), `requirement` (requirement description)
- **Optional**: `level2` (sub-hierarchy title)
- Status is automatically set to `Imported`
- Hierarchies are created/found as needed, requirements are added in order

### CSV Parser

The CSV parser utility (`apps/web/src/lib/csv-parser.ts`) provides:
- Automatic delimiter detection (comma, semicolon, tab)
- Unicode support (UTF-8, UTF-8 BOM)
- Quoted field handling
- Structure validation

### Help Dialogs

Each import type has a help dialog (`ImportHelpDialog`) showing:
- Required vs optional fields
- Column header suggestions
- Example CSV format
- Import-specific notes

## Support

For questions or issues with the design system, please refer to:
- This documentation
- Component source code in `apps/web/src/components/ui/`
- Hook implementations in `apps/web/src/hooks/`
- Theme configuration in `apps/web/src/styles/themes.ts`
