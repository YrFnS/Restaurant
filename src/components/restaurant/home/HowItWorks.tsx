"use client";

import React from "react";
import { motion } from "framer-motion";
import { PartyPopper, Search, ShoppingCart } from "lucide-react";
import type { Translations } from "./types";

interface HowItWorksProps {
	t: Translations;
}

export function HowItWorks({ t }: HowItWorksProps) {
	return (
		<section className="px-4 space-y-4">
			<div className="flex items-center gap-2">
				<PartyPopper className="size-5 text-amber-500" />
				<h2 className="text-lg font-bold">{t.home.howItWorks}</h2>
			</div>

			<div className="relative grid grid-cols-3 gap-3 sm:gap-4">
				{/* Connecting line between steps */}
				<div className="absolute top-6 sm:top-7 start-[16%] end-[16%] h-0.5 bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 dark:from-amber-700 dark:via-orange-700 dark:to-rose-700 hidden sm:block" />

				{[
					{
						icon: Search,
						label: t.home.step1,
						desc: t.home.step1Desc,
						gradient: "from-amber-400 to-amber-600",
						bgLight: "bg-amber-50 dark:bg-amber-950/20",
						number: "1",
					},
					{
						icon: ShoppingCart,
						label: t.home.step2,
						desc: t.home.step2Desc,
						gradient: "from-orange-400 to-orange-600",
						bgLight: "bg-orange-50 dark:bg-orange-950/20",
						number: "2",
					},
					{
						icon: PartyPopper,
						label: t.home.step3,
						desc: t.home.step3Desc,
						gradient: "from-rose-400 to-rose-600",
						bgLight: "bg-rose-50 dark:bg-rose-950/20",
						number: "3",
					},
				].map((step, idx) => (
					<motion.div
						key={idx}
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3 + idx * 0.1 }}
						className={`relative flex flex-col items-center text-center gap-2 p-3 sm:p-4 rounded-xl ${step.bgLight} border border-border/30`}
					>
						<div className="relative">
							<div
								className={`size-10 sm:size-12 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-sm`}
							>
								<step.icon className="size-5 sm:size-6 text-white" />
							</div>
							<div className="absolute -top-1.5 -end-1.5 size-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
								{step.number}
							</div>
						</div>
						<span className="text-xs sm:text-sm font-bold text-foreground">
							{step.label}
						</span>
						<span className="text-[10px] sm:text-xs text-muted-foreground leading-tight line-clamp-2">
							{step.desc}
						</span>
					</motion.div>
				))}
			</div>
		</section>
	);
}
