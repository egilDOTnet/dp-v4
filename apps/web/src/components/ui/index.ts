// UI Component Library
// Consistent, reusable components for the Dynamic Purchase application

// Dialog Components
export { Dialog, DialogHeader, DialogFooter, ConfirmDialog } from "./Dialog";
export type { DialogVariant, DialogSize } from "./Dialog";

// SlideOver Components
export { SlideOver, FormSlideOver } from "./SlideOver";

// Form Components (from FormField.tsx - canonical versions)
export { FormField, Input, Textarea, Select, Checkbox, Button } from "./FormField";

// Card Components
export { Card, CardHeader, CardBody, CardFooter } from "./Card";
export type { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps } from "./Card";

// Search Components
export { SearchBar } from "./SearchBar";
export type { SearchBarProps } from "./SearchBar";
export { SearchInput } from "./SearchInput";

// Display Components
export { Badge } from "./Badge";
export type { BadgeProps } from "./Badge";

export { Avatar } from "./Avatar";
export type { AvatarProps } from "./Avatar";

// Loading Components
export { LoadingSpinner, LoadingScreen } from "./LoadingSpinner";
export type { LoadingSpinnerProps } from "./LoadingSpinner";

// Empty State
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

// Page Layout Components
export { PageHeader } from "./PageHeader";
export type { PageHeaderProps } from "./PageHeader";

export { Container } from "./Container";

export { Breadcrumbs } from "./Breadcrumbs";

// Collapsible Components
export {
  Collapsible,
  CollapsibleTrigger,
  DismissibleBanner,
  useCollapsible,
} from "./Collapsible";

// Inline Edit Components
export { InlineEditWrapper } from "./InlineEditWrapper";

// Entity Form (unified New/Edit pattern)
export { EntityForm } from "./EntityForm";
export type { EntityFormProps } from "./EntityForm";

// Table Components
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./Table";

// Searchable List
export { SearchableList } from "./SearchableList";
