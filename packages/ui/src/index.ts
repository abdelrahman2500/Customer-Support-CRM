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

// --- Feedback state --------------------------------------------------------
export { useToastStore, showSuccessToast } from "./lib/toast-store";
export type { SuccessToast } from "./lib/toast-store";

// --- Primitives ------------------------------------------------------------
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/card";
export type { CardProps } from "./components/card";

export { Alert } from "./components/alert";
export type { AlertProps } from "./components/alert";

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

export { Skeleton } from "./components/skeleton";

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

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./components/table";

export { Textarea } from "./components/textarea";
export type { TextareaProps } from "./components/textarea";

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "./components/tooltip";
