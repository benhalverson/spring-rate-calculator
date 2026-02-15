import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import type { Units } from "../types/spring";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface SpringVizProps {
	k?: number;
	d?: number;
	D?: number;
	n?: number;
	units: Units;
}

const clamp = (value: number, min: number, max: number): number => {
	return Math.min(max, Math.max(min, value));
};

const lerp = (start: number, end: number, amount: number): number => {
	return start + (end - start) * amount;
};

const format = (value: number | undefined, digits = 4): string => {
	if (value === undefined || !Number.isFinite(value)) {
		return "—";
	}
	return value.toFixed(digits);
};

/**
 * Animated spring visualizer that maps spring-rate values to perceived stiffness.
 */
export function SpringViz({ k, d, D, n, units }: SpringVizProps) {
	const [loadPct, setLoadPct] = useState(42);
	const controls = useAnimationControls();

	const turns = useMemo(() => {
		if (n === undefined || !Number.isFinite(n)) {
			return 8;
		}
		return clamp(Math.round(n), 4, 12);
	}, [n]);

	const { kNorm, stiffness, damping, maxCompression } = useMemo(() => {
		if (k === undefined || !Number.isFinite(k)) {
			return {
				kNorm: 0.5,
				stiffness: 240,
				damping: 22,
				maxCompression: 0.2,
			};
		}

		const kSafe = Math.max(k, 1e-12);
		const kLog = Math.log10(kSafe);
		const normalized = clamp((kLog - -6) / (6 - -6), 0, 1);

		return {
			kNorm: normalized,
			stiffness: lerp(80, 600, normalized),
			damping: lerp(10, 40, normalized),
			maxCompression: lerp(0.35, 0.08, normalized),
		};
	}, [k]);

	const baseScaleY = 1 - (loadPct / 100) * maxCompression;

	const coilPath = useMemo(() => {
		const centerX = 160;
		const topY = 42;
		const bottomY = 256;
		const points = turns * 56;
		const amplitude = 38;
		const height = bottomY - topY;

		let path = `M ${centerX} ${topY}`;
		for (let index = 1; index <= points; index += 1) {
			const progress = index / points;
			const y = topY + height * progress;
			const wave = Math.sin(progress * turns * Math.PI * 2);
			const x = centerX + wave * amplitude;
			path += ` L ${x} ${y}`;
		}
		return path;
	}, [turns]);

	useEffect(() => {
		void controls.start({
			scaleY: baseScaleY,
			transition: {
				type: "spring",
				stiffness,
				damping,
			},
		});
	}, [baseScaleY, controls, damping, stiffness]);

	useEffect(() => {
		if (k === undefined || !Number.isFinite(k)) {
			return;
		}

		const target = Math.max(0.45, baseScaleY - maxCompression * 0.28);

		void (async () => {
			await controls.start({
				scaleY: target,
				transition: { duration: 0.12, ease: "easeOut" },
			});
			await controls.start({
				scaleY: baseScaleY,
				transition: {
					type: "spring",
					stiffness,
					damping,
				},
			});
		})();
	}, [baseScaleY, controls, damping, k, maxCompression, stiffness]);

	return (
		<Card aria-label="Spring visualizer">
			<CardHeader className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
				<CardTitle className="text-[1.05rem] text-slate-700 dark:text-slate-100">
					Spring Visualizer
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 px-4 pt-4">
				<div className="rounded-md border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-2 shadow-inner dark:border-slate-800 dark:from-slate-900 dark:to-slate-800">
					<svg viewBox="0 0 320 300" role="img" aria-label="Animated spring">
						<title>Animated spring</title>
						<rect
							x="34"
							y="10"
							width="252"
							height="16"
							rx="3"
							className="fill-slate-500 dark:fill-slate-400"
						/>
						<rect
							x="34"
							y="266"
							width="252"
							height="16"
							rx="3"
							className="fill-slate-500 dark:fill-slate-400"
						/>
						<motion.g
							animate={controls}
							style={{ transformOrigin: "50% 14%" }}
							initial={{ scaleY: baseScaleY }}
						>
							<path
								d={coilPath}
								className="fill-none stroke-slate-700 stroke-[5] [stroke-linecap:round] [stroke-linejoin:round] dark:stroke-slate-200"
								vectorEffect="non-scaling-stroke"
							/>
						</motion.g>
					</svg>
				</div>

				<div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
					<p>
						Stiffness profile:{" "}
						<strong className="rounded bg-slate-700 px-2 py-0.5 text-slate-100 dark:bg-slate-600">
							{kNorm < 0.34 ? "Soft" : kNorm > 0.67 ? "Stiff" : "Medium"}
						</strong>
					</p>
					<p>
						d: {format(d, 2)} {units} · D: {format(D, 2)} {units} · n:{" "}
						{format(n, 2)}
					</p>
				</div>

				<div
					className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-900"
					data-testid="load-control"
				>
					<label htmlFor="load-slider">Load</label>
					<input
						className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500 dark:bg-slate-700"
						id="load-slider"
						type="range"
						min={0}
						max={100}
						value={loadPct}
						onChange={(event) => setLoadPct(Number(event.currentTarget.value))}
					/>
					<output htmlFor="load-slider">{loadPct}%</output>
				</div>
				<p className="text-xs text-slate-600 dark:text-slate-300">
					{loadPct}% is the simulated visual load level. It affects spring
					compression only and does not change the `k` calculation.
				</p>
			</CardContent>
		</Card>
	);
}
