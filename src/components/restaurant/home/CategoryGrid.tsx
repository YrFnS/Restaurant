"use client";

import React from "react";
import { motion } from "framer-motion";
import { UtensilsCrossed, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuCategory, Translations } from "./types";

const categoryGradients: Record<string, string> = {
	"🥗": "from-green-400/80 to-emerald-500/80",
	"🍲": "from-amber-400/80 to-orange-500/80",
	"🥩": "from-red-400/80 to-rose-500/80",
	"🦐": "from-cyan-400/80 to-teal-500/80",
	"🍝": "from-yellow-400/80 to-amber-500/80",
	"🍕": "from-orange-400/80 to-red-500/80",
	"🥬": "from-lime-400/80 to-green-500/80",
	"🍰": "from-pink-400/80 to-rose-500/80",
	"🥤": "from-sky-400/80 to-blue-500/80",
	"🍟": "from-amber-300/80 to-yellow-500/80",
};

const defaultGradient = "from-amber-400/80 to-orange-500/80";

interface CategoryGridProps {
	categories: MenuCategory[];
	loading: boolean;
	locale: string;
	isRTL: boolean;
	t: Translations;
	onNavigate: (section: string) => void;
}

export function CategoryGrid({
	categories,
	loading,
	locale,
	isRTL,
	t,
	onNavigate,
}: CategoryGridProps) {
	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between px-4">
				<div className="flex items-center gap-2">
					<UtensilsCrossed className="size-5 text-amber-500" />
					<h2 className="text-lg font-bold">{t.home.categories}</h2>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="text-primary gap-1"
					onClick={() => onNavigate("menu")}
				>
					{t.home.viewAll}
					<ChevronRight className={`size-4 ${isRTL ? "rotate-180" : ""}`} />
				</Button>
			</div>

			<div
				className="flex gap-3 overflow-x-auto px-4 scroll-smooth snap-x snap-mandatory pb-2"
				style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
			>
				{loading
					? Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="snap-start shrink-0">
								<Skeleton className="size-20 rounded-2xl" />
								<Skeleton className="h-3 w-16 mx-auto mt-1.5" />
							</div>
						))
					: categories.map((cat, idx) => (
							<motion.button
								key={cat.id}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: idx * 0.05 }}
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => onNavigate("menu")}
								className="snap-start shrink-0 flex flex-col items-center gap-1.5 group"
								aria-label={locale === "ar" ? cat.nameAr : cat.nameEn}
							>
								<div
									className={`size-16 sm:size-20 rounded-2xl bg-gradient-to-br ${categoryGradients[cat.icon] || defaultGradient} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}
								>
									<span className="text-2xl sm:text-3xl drop-shadow-md">
										{cat.icon}
									</span>
								</div>
								<span className="text-[11px] sm:text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight max-w-[72px] line-clamp-2">
									{locale === "ar" ? cat.nameAr : cat.nameEn}
								</span>
							</motion.button>
						))}
			</div>
		</section>
	);
}
