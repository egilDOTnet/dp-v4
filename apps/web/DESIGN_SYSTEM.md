# Design System Documentation

## Overview

This document describes the comprehensive design system implemented for Dynamic Purchase, featuring unified components, dark/light theme support, and consistent patterns across the application.

## Design Philosophy

- **Speed-first**: Minimize clicks, auto-focus inputs, keyboard shortcuts
- **Minimalist**: Clean interfaces, hide complexity until needed
- **Consistent**: Same patterns everywhere - learn once, use everywhere
- **Accessible**: WCAG compliant, keyboard navigable, clear focus states

## Keyboard Shortcuts

### Text Selection (Select All)

**All text input fields and textareas must support Ctrl-A/Command-A to select all text.**

This is a standard browser behavior that users expect. All `<input>` and `<textarea>` elements should include this handler:

```tsx
onKeyDown={(e) => {
  // Handle Ctrl-A/Command-A to select all text
  if ((e.metaKey || e.ctrlKey) && e.key === "a") {
    e.preventDefault();
    e.currentTarget.select();
    return;
  }
  // ... other key handlers
}}
```

**Important Notes:**
- This must be implemented for **all** text inputs, including:
  - `<input type="text">`
  - `<input type="email">`
  - `<input type="tel">`
  - `<input type="url">`
  - `<input type="number">`
  - `<textarea>`
- The UI components (`Input` and `Textarea` from `FormField.tsx` and `input.tsx`) already include this functionality
- When using native HTML inputs, always add this handler
- Place the Ctrl-A check **before** other key handlers to ensure it takes precedence

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
  // Handle Ctrl-A/Command-A first
  if ((e.metaKey || e.ctrlKey) && e.key === "a") {
    e.preventDefault();
    e.currentTarget.select();
    return;
  }
  // Then handle other shortcuts
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

**Selection/Highlight Color**: 
- Used for selected/hovered interactive elements (like avatar borders)
- **Light mode**: `border-selection` (Gray-900 - #111827, dark/black)
- **Dark mode**: `border-selection` (Gray-50 - #f9fafb, light/white)
- Defined in `apps/web/src/app/globals.css` as CSS custom property `--color-selection`
- Accessible via Tailwind class `border-selection` or `focus:ring-selection`

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

### Selection/Highlight Colors

For selected or hovered interactive elements (like avatar borders, selection states), use the `selection` color:
- **Light mode**: `border-selection` (Gray-900 - #111827, dark/black)
- **Dark mode**: `border-selection` (Gray-50 - #f9fafb, light/white)

This color is distinct from primary actions (green) and provides clear visual feedback for selection states.

### Usage in Components

Use semantic color classes:
```tsx
<div className="bg-background-primary text-text-primary border-border-primary">
  <!-- Content -->
</div>

<!-- For selection/highlight states -->
<button className="border-selection hover:border-selection">
  <!-- Selected element -->
</button>
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
**Important**: CardHeader and CardBody should always be within the same Card component, not in separate Cards. This creates a unified section with proper visual hierarchy:
- **CardHeader**: Contains the section title and action buttons
- **CardBody**: Contains the section content (list items, empty states, etc.)

**Correct Pattern**:
```tsx
<Card>
  <CardHeader>
    <h2>Section Title</h2>
  </CardHeader>
  <CardBody>
    {/* Content or EmptyState */}
  </CardBody>
</Card>
```

**Incorrect Pattern** (separate Cards):
```tsx
<Card>
  <CardHeader>Title</CardHeader>
</Card>
<Card>
  <CardBody>Content</CardBody>
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

#### Searchable Dropdown/Selector
For dropdowns that allow users to select from a list of options, use searchable dropdown components instead of native `<select>` elements. These provide a better user experience with search functionality and visual display of options.

**ContactPersonSelector** (example implementation):
```tsx
import { ContactPersonSelector, ContactPerson } from '@/components/ui';

const options: ContactPerson[] = [
  {
    id: "1",
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    name: "John Doe",
  },
  // ... more options
];

<ContactPersonSelector
  value={selectedPerson}
  options={options}
  onChange={(person) => setSelectedPerson(person)}
  placeholder="Select contact person"
  label="Contact Person"
/>
```

**Features**:
- Search field at the top for filtering options
- Displays avatars/initials and names in the dropdown
- Keyboard navigation (Escape to close, Ctrl-A/Command-A to select all in search)
- Auto-focuses search input when dropdown opens
- Clear selection option
- Visual indication of selected item
- Accessible ARIA attributes

**When to Use**:
- Selecting users, contacts, or people (use ContactPersonSelector or similar)
- Selecting from lists with 5+ items
- When search/filtering would improve usability
- When displaying additional information (avatars, descriptions) is helpful

**When NOT to Use**:
- Simple binary choices (use toggle/checkbox instead)
- Very short lists (2-4 items) where a native select is sufficient
- When space is extremely constrained

**Creating Custom Searchable Selectors**:
When creating new searchable selector components, follow the ContactPersonSelector pattern:
1. Use Radix UI DropdownMenu for accessibility
2. Include a search input at the top of the dropdown
3. Filter options based on search query
4. Display options with relevant visual information (avatars, icons, etc.)
5. Support keyboard navigation
6. Show selected state clearly

#### Other Components
- **Badge**: Status indicators with color variants
- **Avatar**: User avatars with initials
- **LoadingSpinner**: Consistent loading indicators
- **EmptyState**: Empty state messages with actions
- **Container**: Responsive page container
- **PageHeader**: Standard page header with title, description, actions
- **Breadcrumbs**: Navigation breadcrumbs (see Breadcrumbs section below)
- **Select**: Styled select dropdowns (use only for simple, short lists; prefer searchable dropdowns for longer lists)
- **Textarea**: Auto-growing text areas
- **FormField**: Wrapper for form inputs with labels and errors

#### Breadcrumbs

**⚠️ IMPORTANT**: All pages must use the `Breadcrumbs` component from `@/components/ui`. Do not create manual breadcrumb navigation with raw HTML/JSX.

The `Breadcrumbs` component provides consistent navigation breadcrumbs across all pages with standardized styling and separator formatting.

**Component**:
```tsx
import { Breadcrumbs } from '@/components/ui';

const breadcrumbItems = [
  { label: "Home", href: "/dashboard?noAutoRedirect=true" },
  { label: "Projects", href: "/projects" },
  { label: project?.name || "Project", href: `/projects/${projectId}` },
  { label: "Current Page" }, // Last item has no href (current page)
];

<Breadcrumbs items={breadcrumbItems} />
```

**Features**:
- Consistent "/" separator between items
- Automatic styling: links use `hover:text-primary-600`, current page uses `text-text-primary`
- Standard spacing: `mb-4 text-sm text-text-secondary` for the container
- Accessible: Includes `aria-label="Breadcrumb"` for screen readers

**Usage Pattern**:
1. Create a `breadcrumbItems` array at the top of your component (after state declarations)
2. Include all navigation levels from Home → Section → Subsection → Current Page
3. The last item (current page) should **not** have an `href` property
4. Use `?noAutoRedirect=true` for Home links to prevent auto-redirect when there's only one project
5. Place the `<Breadcrumbs>` component at the top of your return statement, before other content

**Example for Project Pages**:
```tsx
export default function TasksPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  
  // ... other state and effects ...

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard?noAutoRedirect=true" },
    { label: "Projects", href: "/projects" },
    { label: project?.name || "Project", href: `/projects/${projectId}` },
    { label: "Tasks" }, // Current page - no href
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        {/* Loading state */}
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={breadcrumbItems} />
      {/* Page content */}
    </div>
  );
}
```

**Important Notes**:
- **Always use the component**: Never create manual breadcrumb navigation with `<nav>`, `<Link>`, and `<span>` elements
- **Consistent structure**: All project pages follow: Home → Projects → Project Name → Current Section
- **Home link parameter**: Always include `?noAutoRedirect=true` in Home links to prevent unwanted redirects when users explicitly navigate to Home
- **Reuse in all states**: Include breadcrumbs in loading, error, and main render states for consistency
- **Last item**: The current page should always be the last item and should not have an `href` property

#### File Input (Drag-and-Drop)
For file uploads, use a drag-and-drop container instead of a standard file input:

```tsx
<div
  className="relative border-2 border-dashed border-border-primary rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer"
  onMouseDown={(e) => {
    // Prevent blur on other inputs when clicking file container
    // This is important when used in inline forms that auto-save on blur
    e.preventDefault();
  }}
  onDragOver={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
  onDragLeave={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
  onDrop={(e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Handle file
    }
  }}
  onClick={() => {
    fileInputRef.current?.click();
  }}
>
  <input
    ref={fileInputRef}
    type="file"
    accept=".pdf,.zip"
    onChange={(e) => {
      const file = e.target.files?.[0] || null;
      // Handle file
    }}
    className="hidden"
  />
  {file ? (
    <div className="space-y-2">
      {/* Show file info */}
      <div className="text-sm text-text-primary">
        <span className="font-medium">{file.name}</span>
      </div>
      <p className="text-xs text-text-secondary">
        {formatFileSize(file.size)}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // Remove file
        }}
        className="text-xs text-text-tertiary hover:text-text-primary mt-2"
      >
        Remove file
      </button>
    </div>
  ) : (
    <div className="space-y-2">
      <svg
        className="mx-auto h-12 w-12 text-text-tertiary"
        stroke="currentColor"
        fill="none"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <path
          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="text-sm text-text-primary">
        <span className="font-medium">Drag and drop a file here, or click to choose a file</span>
      </div>
      <p className="text-xs text-text-secondary">
        PDF or ZIP files only
      </p>
    </div>
  )}
</div>
```

**Features**:
- Drag-and-drop support with visual feedback
- Click to browse files
- Shows file info when selected (name, size)
- "Remove file" option to clear selection
- Consistent placeholder text: "Drag and drop a file here, or click to choose a file"
- File type restrictions shown below placeholder
- Hidden file input with ref for programmatic access

**Important for Inline Forms**: When using the drag-and-drop file input in inline forms that auto-save on blur (like new item forms), add `onMouseDown={(e) => e.preventDefault()}` to the container div. This prevents the blur event from firing on other inputs when clicking the file container, which would otherwise cancel or save the form prematurely.

**Blur Handler Pattern**: In your blur handler for inline forms, check if focus is still within the form container before canceling:
```tsx
const handleBlur = () => {
  setTimeout(() => {
    const activeElement = document.activeElement;
    // Check if focus moved to another element within the form
    if (formRef.current && activeElement && formRef.current.contains(activeElement)) {
      return; // Focus is still within the form, don't cancel
    }
    // ... rest of blur logic (save or cancel)
  }, 150);
};
```

This pattern ensures that clicking on interactive elements within the form (like file inputs, toggles, buttons) doesn't trigger unwanted form cancellation or saving.

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

**Note**: The hook is exported as `useKeyboardShortcut` (singular) from the file `useKeyboardShortcuts.ts` (plural).

## Patterns

### Inline Editing
All forms use a consistent inline editing pattern:
1. Forms appear inline within the list/table
2. Smooth animations on show/hide
3. Auto-focus first input field
4. Escape to cancel, Enter to save (where appropriate)
5. Show loading states during save

**Title Click to Edit Mode**: Clicking on a title/heading puts all related fields into edit mode simultaneously. This allows users to quickly edit multiple fields at once (e.g., title, description, owner, dates for tasks).

**Click-to-Edit Pattern**: For simpler list items (like documents, links, changelog entries), clicking directly on the field content (e.g., description, URL) puts that field into edit mode. The field becomes an input that auto-saves on blur.

### Inline New Item Forms
When adding new items to a list, use an inline form pattern instead of modals:

**Pattern**:
1. **Add Button**: Located in the CardHeader, next to the section title
2. **Inline Form**: When "Add" is clicked, show a form inline at the top of the list (before existing items)
3. **Form Structure**: The new item form should match the structure of existing items, using the same Card component
4. **Visual Distinction**: Use `border-2 border-primary-600` to highlight the new item form
5. **Keyboard Support**: 
   - Enter to submit (when form is valid)
   - Escape to cancel
   - Auto-focus first input field
6. **State Management**: 
   - Use `isCreatingNew` state to control form visibility
   - Hide the "Add" button when form is visible
   - Reset form state on cancel or successful creation

**Implementation Example**:
```tsx
const [isCreatingNew, setIsCreatingNew] = useState(false);
const [newItemData, setNewItemData] = useState({ /* form fields */ });

// In render:
{isCreatingNew && (
  <Card className="border-2 border-primary-600">
    <CardBody>
      {/* Form fields */}
      <div className="flex gap-2 justify-end">
        <Button onClick={handleCancel} variant="secondary">Cancel</Button>
        <Button onClick={handleCreate} variant="primary">Add</Button>
      </div>
    </CardBody>
  </Card>
)}

{documents.map((doc) => (
  <Card key={doc.id}>
    {/* Existing item content */}
  </Card>
))}
```

**Benefits**:
- Keeps context visible (user can see existing items)
- Faster workflow (no modal to open/close)
- Consistent with inline editing pattern
- Better for keyboard navigation

### Search Everywhere
All list views include instant search:
- Search bar at the top
- Results update as you type
- Shows count of filtered items
- Cmd+K / Ctrl+K to focus search
- Clear button to reset

### Filtering Pattern
When filtering is needed in addition to search, use a filter component with searchable dropdowns:

- **Placement**: Right-aligned next to action buttons (e.g., "Check all")
- **Default State**: Gray background (`bg-background-secondary`) with border
- **Active State**: Blue background (`bg-accent-600`) when any filter is selected
- **Structure**: Filter icon, "Filter by" text, and searchable dropdown selectors
- **Sizing**: 
  - Container padding: `px-3 py-1` (compact to match button height)
  - Dropdown selectors: Match height of adjacent buttons
  - This ensures the filter bar matches the height of adjacent buttons
- **Behavior**: 
  - Filters combine with search (both apply simultaneously)
  - Filtered results expand hierarchies to show matching items
  - "Check all" button changes to "Check result" when filtering is active
  - Shows "X of Y items" count when filtering
- **Dropdown Type**: Use searchable dropdown components (like ContactPersonSelector pattern) for filter dropdowns with 5+ options. For very short lists (2-4 items), native `<select>` may be acceptable.

**Implementation Example** (with searchable dropdown):
```tsx
<div className={`flex items-center gap-2 px-3 py-1 rounded-md border border-border-primary ${
  isFiltering ? 'bg-accent-600' : 'bg-background-secondary'
}`}>
  <FilterIcon className="h-4 w-4" />
  <span className="text-sm">Filter by</span>
  <StatusSelector
    value={filterStatus}
    options={statusOptions}
    onChange={setFilterStatus}
    placeholder="Status"
  />
</div>
```

**Note**: For filter dropdowns with many options, prefer searchable dropdown components over native `<select>` elements to improve usability.

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

**For dropdowns with 5+ options**, use searchable dropdown components:
```tsx
<ContactPersonSelector
  value={selectedPerson}
  options={personOptions}
  onChange={setSelectedPerson}
  placeholder="Don't change"
/>
```

**For very short lists (2-4 options)**, native select may be acceptable:
```tsx
<Select value={type} onChange={(e) => setType(e.target.value)}>
  <option value="">Don't change</option>
  <option value="Option1">Option 1</option>
  <option value="Option2">Option 2</option>
</Select>
```

Only fields that are not "Don't change" (empty string or null) should be included in the update payload.

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

- **Placement**: Appears in the lower right corner during edit mode (or appropriate position based on context)
- **Visibility**: Only shown when the item is in edit mode
- **Styling**: 
  - Red background: `bg-red-600`
  - White text: `text-white`
  - Hover state: `hover:bg-red-700`
  - Small padding: `px-2 py-1`
  - Small text: `text-xs`
  - Rounded corners: `rounded`
  - Disabled state: `disabled:opacity-50`
  - Flex shrink: `flex-shrink-0` (for inline contexts)
- **Behavior**:
  - Shows confirmation dialog before deleting (where appropriate)
  - Fade-out animation (300ms) before actual deletion
  - Uses opacity and scale transforms for smooth animation
- **Implementation**: 
  - Positioned below the main edit field (description, etc.) or in appropriate location
  - Uses appropriate spacing from the field above
  - Right-aligned or positioned based on context

```tsx
{/* Delete button in lower right corner during edit mode */}
<button
  onClick={() => handleDelete(item.id)}
  disabled={loading || deletingItemIds.has(item.id)}
  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
>
  Delete
</button>
```

**Note**: For form contexts and dialogs, use the `Button` component from `@/components/ui/FormField` with `variant="danger"` for consistency.

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

Use the `HeroBanner` component from `@/components/ui` (exported from `@/components/HeroBanner.tsx`):

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
- Implementation: Use `formatDateTimeISO(dateString)` from `@/lib/date-utils`

**Without Timestamp (Date Only)**:
- Format: `YYYY-MM-DD`
- Example: `2024-12-10`
- Used for: Date inputs, date-only displays, calendar views
- Implementation: Use `formatDate(dateString)` from `@/lib/date-utils`

**Short Display Format** (for compact views):
- Format: `MMM DD` (e.g., "Dec 10")
- Used for: Task lists, compact cards, when space is limited
- Implementation: Use `formatDateDisplay(dateString)` from `@/lib/date-utils`

**Usage Example**:
```tsx
import { formatDate, formatDateDisplay, formatDateTimeISO } from '@/lib/date-utils';

// For date inputs
<input type="date" value={formatDate(task.startDate)} />

// For compact displays
<span>{formatDateDisplay(task.startDate)}</span>

// For timestamps
<span>{formatDateTimeISO(comment.createdAt)}</span>
```

**Note**: These utility functions are available in `apps/web/src/lib/date-utils.ts`. Components should use these shared utilities instead of defining inline formatting functions.

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

The `ImportWizard` component (located at `apps/web/src/components/ImportWizard.tsx`) provides a multi-step process for importing data:

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
