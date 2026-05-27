import { Check, Minus } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, useEffect, useRef } from "react";

import { cn } from "../../lib/utils";

export interface CheckboxProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
	({ className, indeterminate = false, ...props }, forwardedRef) => {
		const inputRef = useRef<HTMLInputElement | null>(null);

		useEffect(() => {
			if (!inputRef.current) {
				return;
			}
			inputRef.current.indeterminate = Boolean(indeterminate);
		}, [indeterminate]);

		return (
			<div className="relative inline-flex items-center">
				<input
					ref={(element) => {
						inputRef.current = element;
						if (typeof forwardedRef === "function") {
							forwardedRef(element);
							return;
						}
						if (forwardedRef) {
							forwardedRef.current = element;
						}
					}}
					type="checkbox"
					className={cn(
						"peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-slate-300 bg-white ring-offset-white transition-colors hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:ring-offset-slate-950 dark:hover:border-slate-600 dark:checked:border-blue-500 dark:checked:bg-blue-500 dark:indeterminate:border-blue-500 dark:indeterminate:bg-blue-500",
						className,
					)}
					aria-checked={indeterminate ? "mixed" : props.checked}
					{...props}
				/>
				<Check className="pointer-events-none absolute left-0 h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100 peer-indeterminate:opacity-0" />
				<Minus className="pointer-events-none absolute left-0 h-4 w-4 text-white opacity-0 transition-opacity peer-indeterminate:opacity-100" />
			</div>
		);
	},
);

Checkbox.displayName = "Checkbox";
