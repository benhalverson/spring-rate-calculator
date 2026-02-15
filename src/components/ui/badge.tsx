import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
	{
		variants: {
			variant: {
				default: "border-transparent bg-blue-600 text-white hover:bg-blue-500",
				secondary:
					"border-transparent bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
				outline:
					"border-slate-300 text-slate-900 dark:border-slate-700 dark:text-slate-100",
				success:
					"border-transparent bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-300",
				warning:
					"border-transparent bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-300",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}
