"use client";

import React from "react";
import { motion } from "framer-motion";
import { Flame, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SpecialOffer, Translations } from "./types";

interface SpecialsSectionProps {
	offers: SpecialOffer[];
	loading: boolean;
	offersLoaded: boolean;
	locale: string;
	isRTL: boolean;
	t: Translations;
	specialsScrollRef: React.RefObject<HTMLDivElement | null>;
	scrollSpecials: (direction: "start" | "end") => void;
}

export function SpecialsSection({
	offers,
	loading,
	offersLoaded,
	locale,
	isRTL,
	t,
	specialsScrollRef,
	scrollSpecials,
}: SpecialsSectionProps) {
	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between px-4">
				<div className="flex items-center gap-2">
					<Flame className="size-5 text-amber-500" />
					<h2 className="text-lg font-bold">{t.home.todaysSpecials}</h2>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						onClick={() => scrollSpecials("start")}
						aria-label="Scroll left"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						onClick={() => scrollSpecials("end")}
						aria-label="Scroll right"
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>

			<div
				ref={specialsScrollRef}
				className="flex gap-3 overflow-x-auto custom-scrollbar px-4 scroll-smooth snap-x snap-mandatory"
				style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
			>
				{loading || !offersLoaded ? (
					Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="snap-start shrink-0 w-64">
							<Card className="overflow-hidden border-0 shadow-sm">
								<div className="p-5 min-h-[144px] flex flex-col justify-between gap-3">
									<Skeleton className="h-5 w-16 rounded-full" />
									<Skeleton className="h-5 w-3/4" />
									<Skeleton className="h-4 w-full" />
								</div>
							</Card>
						</div>
					))
				) : offers.length > 0 ? (
					offers.map((offer, idx) => (
						<motion.div
							key={offer.id}
							initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: idx * 0.1 }}
							className="snap-start shrink-0 w-64 sm:w-72"
						>
							<Card className="overflow-hidden border-0 shadow-md">
								<div
									className={`relative p-5 text-white min-h-[144px] flex flex-col justify-between ${
										idx % 3 === 0
											? "bg-gradient-to-br from-amber-500 to-orange-600"
											: idx % 3 === 1
												? "bg-gradient-to-br from-rose-500 to-pink-600"
												: "bg-gradient-to-br from-teal-500 to-emerald-600"
									}`}
								>
									{/* Decorative */}
									<div className="absolute top-0 end-0 w-24 h-24 rounded-full bg-white/10 -translate-y-8 translate-x-8" />

									<div className="relative z-10">
										<Badge className="bg-white/20 text-white border-0 text-xs font-bold mb-2">
											{offer.discountPercent}% OFF
										</Badge>
										<h3 className="font-bold text-lg leading-tight">
											{locale === "ar" ? offer.titleAr : offer.titleEn}
										</h3>
									</div>
									<p className="relative z-10 text-white/80 text-sm line-clamp-2 mt-1">
										{locale === "ar"
											? offer.descriptionAr
											: offer.descriptionEn}
									</p>
								</div>
							</Card>
						</motion.div>
					))
				) : (
					<div className="w-full flex flex-col items-center justify-center py-8 px-6 text-center">
						<div className="size-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
							<Sparkles className="size-6 text-amber-500" />
						</div>
						<p className="text-sm font-medium text-muted-foreground mb-1">
							{t.home.noSpecials}
						</p>
						<p className="text-xs text-muted-foreground/70">
							{t.home.checkBackLater}
						</p>
					</div>
				)}
			</div>
		</section>
	);
}
