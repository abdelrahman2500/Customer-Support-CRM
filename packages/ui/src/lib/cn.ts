import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Standard shadcn/ui helper: merges conditional class names, letting a later
 * Tailwind class win over an earlier conflicting one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
