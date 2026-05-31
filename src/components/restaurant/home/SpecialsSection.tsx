"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SpecialOffer, Translations } from "./types";

const specialGradients = [
	"bg-gradient-to-br from-[#c75b39] to-[#a8482e]",
	"bg-gradient-to-br from-[#1a1a1a] to-[#333333]",
	"bg-gradient-to-br from-[#7a8b6f] to-[#5f6f56]",
];

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
	offers, loading, offersLoaded, locale, isRTL, t,
	specialsScrollRef, scrollSpecials,
}: SpecialsSectionProps) {
	return (
		<section className="py-6 md:py-8">
			<div className="flex items-center justify-between px-6 md:px-12 mb-5">
				<div>
					<p className="text-[#c75b39] text-sm font-medium tracking-wide uppercase mb-1">Limited Time</p>
					<h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{t.home.todaysSpecials}</h2>
				</div>
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => scrollSpecials("start")} aria-label="Scroll left">
						<ChevronLeft className="size-4" />
					</Button>
					<Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => scrollSpecials("end")} aria-label="Scroll right">
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>

			<div
				ref={specialsScrollRef}
				className="flex gap-4 overflow-x-auto px-6 md:px-12 scroll-smooth snap-x snap-mandatory"
				style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
			>
				{loading || !offersLoaded ? (
					Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="snap-start shrink-0 w-72">
							<Card className="overflow-hidden border-0 shadow-sm rounded-2xl">
								<div className="p-6 min-h-[160px] flex flex-col justify-between gap-3">
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
							transition={{ delay: idx * 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
							className="snap-start shrink-0 w-72 sm:w-80"
						>
							<Card className="overflow-hidden border-0 shadow-lg rounded-2xl">
								<div className={`relative p-6 text-white min-h-[160px] flex flex-col justify-between ${specialGradients[idx % 3]}`}>
									<div className="absolute top-0 end-0 w-28 h-28 rounded-full bg-white/10 -translate-y-10 translate-x-10" />
									<div className="absolute bottom-0 start-0 w-16 h-16 rounded-full bg-white/5 translate-y-6 -translate-x-6" />

									<div className="relative z-10">
										<Badge className="bg-white/20 text-white border-0 text-xs font-bold mb-3 rounded-full px-3 py-1">
											{offer.discountPercent}% OFF
										</Badge>
										<h3 className="font-serif font-bold text-xl leading-tight">
											{locale === "ar" ? offer.titleAr : offer.titleEn}
										</h3>
									</div>
									<p className="relative z-10 text-white/80 text-sm line-clamp-2 mt-2 leading-relaxed">
										{locale === "ar" ? offer.descriptionAr : offer.descriptionEn}
									</p>
								</div>
							</Card>
						</motion.div>
					))
				) : (
					<div className="w-full flex flex-col items-center justify-center py-10 px-6 text-center">
						<div className="size-14 rounded-full bg-[#c75b39]/10 flex items-center justify-center mb-3">
							<Sparkles className="size-6 text-[#c75b39]" />
						</div>
						<p className="text-sm font-medium text-muted-foreground mb-1">{t.home.noSpecials}</p>
						<p className="text-xs text-muted-foreground/70">{t.home.checkBackLater}</p>
					</div>
				)}
			</div>
		</section>
	);
}
