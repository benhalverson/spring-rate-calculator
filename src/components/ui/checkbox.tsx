import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export interface CheckboxProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
	({ className, ...props }, ref) => {
		return (
			<div className="relative inline-flex items-center">
				<input
					ref={ref}
					type="checkbox"
					className={cn(
						"peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-slate-300 bg-white ring-offset-white transition-colors hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:border-blue-600 checked:bg-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:ring-offset-slate-950 dark:hover:border-slate-600 dark:checked:border-blue-500 dark:checked:bg-blue-500",
						className,
					)}
					{...props}
				/>
				<Check className="pointer-events-none absolute left-0 h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
			</div>
		);
	},
);

Checkbox.displayName = "Checkbox";
