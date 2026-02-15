import type { TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export interface TextareaProps
	extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
	return (
		<textarea
			className={cn(
				"flex min-h-[80px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-offset-slate-950",
				className,
			)}
			{...props}
		/>
	);
}
