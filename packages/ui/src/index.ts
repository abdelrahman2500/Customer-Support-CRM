/**
 * Story S-2 — the single public surface of `@crm/ui`.
 *
 * This package holds the design-system primitives shared by `apps/web` and
 * `apps/portal`, and nothing else. Two rules keep that boundary real:
 *
 * 1. **No domain.** Nothing here knows what a ticket, customer, branch or
 *    SLA is. `TicketStatusBadge` would belong to an app (or, later, a
 *    domain package) — not here. What lives here is `Badge` plus the
 *    semantic variants a caller maps its own domain onto.
 *
 * 2. **No copy, and no i18n library.** Every user-visible string arrives as
 *    an already-translated prop. `ConfirmDialog` and `SuccessToaster` each
 *    previously called `useTranslations("common")` for a handful of labels;
 *    those became required props here, so this package has no dependency on
 *    `next-intl` and no assumption about either app's message namespaces.
 *    That is the convention the codebase already documented for translated
 *    text crossing a component boundary (see `lib/toast-store.ts`).
 *
 * Colours, focus and typography all come from the Story S-1 token layer,
 * which stays defined once per app in `src/app/globals.css`. This package
 * only ever *references* those tokens through Tailwind class names, so it
 * introduces no second colour system and no duplicated token definitions.
 * Both apps' `tailwind.config.ts` therefore include `packages/ui/src` in
 * their `content` globs — without that, classes used only in here would
 * never be generated.
 */

// --- Utilities -------------------------------------------------------------
export { cn } from "./lib/cn";
// Story 210 (PR-1.1) — the v2 surface recipes and elevation levels.
export { recipes } from "./lib/recipes";
export type { Recipe } from "./lib/recipes";
export { formatDate, formatDateTime, formatRelative, formatTime } from "./lib/format-date";
export type { DateInput } from "./lib/format-date";
export { contrastRatio, hexToRgb, parseChannels, relativeLuminance, toChannels } from "./lib/color";
export type { Rgb } from "./lib/color";
export {
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  THEME_PREFERENCES,
  applyThemePreference,
  isThemePreference,
  readThemePreference,
} from "./lib/theme";
export type { ThemePreference } from "./lib/theme";
export { ThemeScript } from "./components/theme-script";
export { ThemeSwitcher } from "./components/theme-switcher";
export { BrandScope } from "./components/brand-scope";
export {
  accentSetPasses,
  brandCssVariables,
  CORE_PREVIEW_PALETTE,
  deriveBrandTokens,
  NEUTRAL_CHROMA,
  RECOGNISABLE_SHIFT,
} from "./lib/brand";
export type { AccentSet, BrandAccentRejection, BrandTokens } from "./lib/brand";
export type { ThemeSwitcherProps } from "./components/theme-switcher";
export { NativeSelect } from "./components/native-select";
export type { NativeSelectOption, NativeSelectProps } from "./components/native-select";

// --- Icon vocabulary (Story S-5) -------------------------------------------
// Semantic role names over glyph names, so "delete" is one decision made
// once. See ./lib/icons.ts for the sizing and aria conventions.
export {
  SearchIcon,
  FilterIcon,
  SortIcon,
  SortAscIcon,
  SortDescIcon,
  EditIcon,
  DeleteIcon,
  AddIcon,
  RetryIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  MenuIcon,
  CloseIcon,
  SuccessIcon,
  WarningIcon,
  ErrorIcon,
  InfoIcon,
  DashboardIcon,
  TicketsIcon,
  CustomersIcon,
  KnowledgeBaseIcon,
  KbCategoriesIcon,
  NotificationsIcon,
  SlaPoliciesIcon,
  TicketCategoriesIcon,
  AutomationRulesIcon,
  QuickRepliesIcon,
  ReportsIcon,
  AuditLogsIcon,
  BranchesIcon,
  UsersIcon,
  RolesIcon,
  NotificationTemplatesIcon,
  WebhookSubscriptionsIcon,
  ApiKeysIcon,
  SettingsIcon,
  MySessionsIcon,
  SidebarToggleIcon,
  StatusOpenIcon,
  StatusInProgressIcon,
  StatusResolvedIcon,
  StatusClosedIcon,
  PriorityLowIcon,
  PriorityMediumIcon,
  PriorityHighIcon,
  PriorityUrgentIcon,
  InternalNoteIcon,
  HistoryEventIcon,
  AttachIcon,
  AiSummaryIcon,
} from "./lib/icons";
export type { LucideIcon } from "./lib/icons";

export { SortIndicator } from "./components/sort-indicator";
export type { SortIndicatorProps, SortDirection } from "./components/sort-indicator";

// --- Feedback state --------------------------------------------------------
export { useToastStore, showSuccessToast, showToast } from "./lib/toast-store";
export type { SuccessToast, Toast } from "./lib/toast-store";
export {
  toastRegionClassName,
  toastListClassName,
  toastCardClassName,
  toastToneClassName,
} from "./lib/toast";
export type { ToastTone } from "./lib/toast";

// --- Primitives ------------------------------------------------------------
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  SectionCard,
} from "./components/card";
export type {
  CardProps,
  CardTitleProps,
  CardTitleLevel,
  SectionCardProps,
} from "./components/card";

export { Alert } from "./components/alert";
export type { AlertProps } from "./components/alert";

// --- Query / loading / empty state (Story S-4) -----------------------------
export { EmptyState } from "./components/empty-state";
export type { EmptyStateProps } from "./components/empty-state";
export { ErrorState } from "./components/error-state";
export { Combobox } from "./components/combobox";
export type { ComboboxOption, ComboboxProps } from "./components/combobox";
export { MessageThread } from "./components/message-thread";
export type { MessageThreadItem, MessageThreadProps } from "./components/message-thread";
export { FileDropzone } from "./components/file-dropzone";
export type { FileDropzoneProps } from "./components/file-dropzone";
export { Composer } from "./components/composer";
export type { ComposerProps, ComposerSuggestion } from "./components/composer";
export { MessageBubble } from "./components/message-bubble";
export type { MessageBubbleProps } from "./components/message-bubble";
export type { ErrorStateProps } from "./components/error-state";

export { FetchingIndicator } from "./components/fetching-indicator";
export type { FetchingIndicatorProps } from "./components/fetching-indicator";

export { NavigationOverlay } from "./components/navigation-overlay";
export type { NavigationOverlayProps } from "./components/navigation-overlay";

// --- List filtering (Story 145) -------------------------------------------
// The responsive filter row above a list, plus the labelled dropdown filter
// that ticket-list-view and reports-view each had their own copy of.
export { FilterBar, FilterSelect } from "./components/filter-bar";
export type { FilterSelectProps } from "./components/filter-bar";

// --- Forms (Story 141) -----------------------------------------------------
// Label + control + hint + error, in one shape, with the error on the
// `--danger-*` tokens instead of a raw palette class.
export { FormField } from "./components/form-field";
export type { FormFieldProps } from "./components/form-field";

// --- Page identity (Story 140) --------------------------------------------
// One title/description/actions rhythm for every screen in both apps.
export { PageHeader } from "./components/page-header";
export type { PageHeaderProps } from "./components/page-header";

export { Pagination } from "./components/pagination";
export type { PaginationProps } from "./components/pagination";

export { LoadingStatus } from "./components/loading-status";
export type { LoadingStatusProps } from "./components/loading-status";
export { QueryStateCard } from "./components/query-state-card";
export type { QueryStateCardProps, QueryStateErrorProps } from "./components/query-state-card";

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "./components/alert-dialog";

export { Badge } from "./components/badge";
export type { BadgeProps } from "./components/badge";
// Story 189 (RD-1.12) — display primitives.
export { Avatar, getInitials } from "./components/avatar";
export type { AvatarPresence, AvatarProps, AvatarSize } from "./components/avatar";
export { Separator } from "./components/separator";
export type { SeparatorProps } from "./components/separator";
export { Kbd } from "./components/kbd";
export { DescriptionItem, DescriptionList } from "./components/description-list";
export type { DescriptionItemProps, DescriptionListProps } from "./components/description-list";
export { BackLink } from "./components/back-link";
export type { BackLinkProps } from "./components/back-link";

export { Button } from "./components/button";
export type { ButtonProps } from "./components/button";

export { ConfirmDialog } from "./components/confirm-dialog";

export { Input } from "./components/input";
export type { InputProps } from "./components/input";

export {
  Select,
  SelectValue,
  SelectGroup,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/select";

export { Skeleton, SkeletonText, SkeletonCard, RouteLoadingSkeleton } from "./components/skeleton";
export type { SkeletonTextProps, SkeletonCardProps } from "./components/skeleton";

export { SuccessToaster } from "./components/success-toaster";

export { Checkbox } from "./components/checkbox";

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./components/dialog";
export type { DialogContentProps } from "./components/dialog";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./components/dropdown-menu";
export type { DropdownMenuItemProps } from "./components/dropdown-menu";

export { Label } from "./components/label";

export {
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
} from "./components/popover";

export { Spinner } from "./components/spinner";
export type { SpinnerProps } from "./components/spinner";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableSortHead,
  TableCell,
} from "./components/table";
export type {
  TableCellProps,
  TableDensity,
  TableProps,
  TableRowProps,
  TableSortHeadProps,
} from "./components/table";

export { Textarea } from "./components/textarea";
export type { TextareaProps } from "./components/textarea";

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "./components/tooltip";

// --- Story 211 (PR-1.2) — primitive kit v2 ----------------------------------
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./components/sheet";
export type { SheetContentProps } from "./components/sheet";
export { Switch } from "./components/switch";
export type { SwitchProps } from "./components/switch";
export { SegmentedControl } from "./components/segmented-control";
export type { SegmentedControlProps, SegmentedOption } from "./components/segmented-control";
export { ListToolbar } from "./components/list-toolbar";
export type { ListToolbarProps, ListToolbarSearch } from "./components/list-toolbar";
export { StatCard } from "./components/stat-card";
export type { StatCardProps } from "./components/stat-card";
export { BarChart, DonutGauge, RatingBar, DistributionBar } from "./components/charts";
export type { BarChartRow, BarSegment, DistributionSegment } from "./components/charts";
export { Board, BoardColumn } from "./components/board";
export type { BoardColumnProps } from "./components/board";

// --- Story 212 (PR-1.3) — primitive restyle v2 ------------------------------
export { UnassignedIcon } from "./lib/icons";

// --- Story 214 (PR-2.2) — authentication v2 ---------------------------------
export { AuthLayout } from "./components/auth-layout";
export type { AuthFeature, AuthLayoutProps } from "./components/auth-layout";
export { PasswordInput, PasswordToggle } from "./components/password-input";
export type { PasswordInputProps, PasswordToggleProps } from "./components/password-input";
export { ShowPasswordIcon, HidePasswordIcon } from "./lib/icons";

// --- Story 217 (PR-3.2) — board card moves ----------------------------------
export { DragHandleIcon, MoreActionsIcon } from "./lib/icons";

// --- Story 225 (PR-4.4) — the form-section recipe -------------------------
export { FormActions, FormSection } from "./components/form-layout";

// --- Story 227 (PR-4.6) — admin lists ---------------------------------------
export { ActiveBadge } from "./components/active-badge";
