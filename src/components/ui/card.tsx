import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"rounded-xl border border-[#d7ddea] bg-white text-slate-900 shadow-[0_4px_18px_rgba(23,40,79,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
				className,
			)}
			{...props}
		/>
	);
}

export function CardHeader({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex flex-col space-y-1.5 p-6", className)}
			{...props}
		/>
	);
}

export function CardTitle({
	className,
	...props
}: HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h3
			className={cn("font-semibold leading-none tracking-tight", className)}
			{...props}
		/>
	);
}

export function CardContent({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-6 pt-0", className)} {...props} />;
}
