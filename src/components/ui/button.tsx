import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
	{
		variants: {
			variant: {
				default:
					"bg-blue-600 text-white hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400",
				secondary:
					"bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
				outline:
					"border border-slate-300 bg-transparent text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800",
				ghost:
					"text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
				destructive:
					"bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-9 rounded-md px-3",
				lg: "h-11 rounded-md px-8",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
	return (
		<button
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	);
}
