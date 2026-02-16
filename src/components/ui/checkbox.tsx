import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export interface CheckboxProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	label?: string;
}

export function Checkbox({ className, label, ...props }: CheckboxProps) {
	return (
		<label className="inline-flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				className={cn(
					"size-4 cursor-pointer rounded border-slate-300 bg-white text-blue-600 transition-colors",
					"focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
					"dark:border-slate-600 dark:bg-slate-800 dark:focus:ring-offset-slate-900",
					className,
				)}
				{...props}
			/>
			{label ? (
				<span className="text-sm text-slate-700 dark:text-slate-300">
					{label}
				</span>
			) : null}
		</label>
	);
}
