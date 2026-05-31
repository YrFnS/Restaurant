"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuCategory, Translations } from "./types";

const categoryColors: Record<string, string> = {
	"🥗": "bg-[#7a8b6f]/10 text-[#7a8b6f] border-[#7a8b6f]/20",
	"🍲": "bg-[#c75b39]/10 text-[#c75b39] border-[#c75b39]/20",
	"🥩": "bg-red-50 text-red-700 border-red-200",
	"🦐": "bg-cyan-50 text-cyan-700 border-cyan-200",
	"🍝": "bg-amber-50 text-amber-700 border-amber-200",
	"🍕": "bg-orange-50 text-orange-700 border-orange-200",
	"🥬": "bg-emerald-50 text-emerald-700 border-emerald-200",
	"🍰": "bg-pink-50 text-pink-700 border-pink-200",
	"🥤": "bg-sky-50 text-sky-700 border-sky-200",
	"🍟": "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const defaultColor = "bg-[#c75b39]/10 text-[#c75b39] border-[#c75b39]/20";

interface CategoryGridProps {
	categories: MenuCategory[];
	loading: boolean;
	locale: string;
	isRTL: boolean;
	t: Translations;
	onNavigate: (section: string) => void;
}

export function CategoryGrid({
	categories, loading, locale, isRTL, t, onNavigate,
}: CategoryGridProps) {
	return (
		<section className="py-6 md:py-8">
			<div className="flex items-center justify-between px-6 md:px-12 mb-5">
				<div>
					<p className="text-[#c75b39] text-sm font-medium tracking-wide uppercase mb-1">Explore</p>
					<h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{t.home.categories}</h2>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="text-[#c75b39] hover:text-[#c75b39]/80 hover:bg-[#c75b39]/5 gap-1.5 rounded-full"
					onClick={() => onNavigate("menu")}
				>
					{t.home.viewAll}
					<ChevronRight className={`size-4 ${isRTL ? "rotate-180" : ""}`} />
				</Button>
			</div>

			<div
				className="flex gap-3 overflow-x-auto px-6 md:px-12 scroll-smooth snap-x snap-mandatory pb-2"
				style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
			>
				{loading
					? Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="snap-start shrink-0">
								<Skeleton className="size-20 rounded-2xl" />
								<Skeleton className="h-3 w-16 mx-auto mt-2" />
							</div>
						))
					: categories.map((cat, idx) => (
							<motion.button
								key={cat.id}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: idx * 0.04, duration: 0.3 }}
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => onNavigate("menu")}
								className="snap-start shrink-0 flex flex-col items-center gap-2 group"
								aria-label={locale === "ar" ? cat.nameAr : cat.nameEn}
							>
								<div className={`size-[72px] sm:size-20 rounded-2xl border flex items-center justify-center transition-all group-hover:shadow-md ${categoryColors[cat.icon] || defaultColor}`}>
									<span className="text-2xl sm:text-3xl">{cat.icon}</span>
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
