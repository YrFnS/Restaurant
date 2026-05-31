"use client";

import React from "react";
import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Testimonial, Translations } from "./types";

interface TestimonialsSectionProps {
	testimonials: Testimonial[];
	locale: string;
	t: Translations;
}

export function TestimonialsSection({
	testimonials,
	locale,
	t,
}: TestimonialsSectionProps) {
	if (testimonials.length === 0) return null;

	return (
		<section className="space-y-3">
			<div className="flex items-center gap-2 px-4">
				<Quote className="size-5 text-amber-500" />
				<h2 className="text-lg font-bold">{t.home.testimonials}</h2>
			</div>

			<div
				className="flex gap-3 overflow-x-auto px-4 scroll-smooth snap-x snap-mandatory pb-2"
				style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
			>
				{testimonials.map((review, idx) => (
					<motion.div
						key={review.id}
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: idx * 0.1 }}
						whileHover={{
							scale: 1.03,
							boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
						}}
						className="snap-start shrink-0 w-72 sm:w-80"
					>
						<Card className="border border-border/50 shadow-sm h-full rounded-xl hover:shadow-lg transition-shadow relative overflow-hidden">
							{/* Decorative quote mark */}
							<div className="absolute top-2 start-3 text-5xl font-serif leading-none bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent opacity-30 select-none pointer-events-none">
								&ldquo;
							</div>
							<CardContent className="p-5 relative z-10">
								{/* Stars */}
								<div className="flex items-center gap-0.5 mb-3">
									{Array.from({ length: 5 }).map((_, s) => (
										<Star
											key={s}
											className={`size-4 ${s < review.stars ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`}
										/>
									))}
									<span className="text-xs font-semibold text-muted-foreground ms-1.5">
										{review.stars}.0
									</span>
								</div>

								{/* Comment */}
								<p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3 italic">
									{locale === "ar" ? review.commentAr : review.commentEn}
								</p>

								{/* Author */}
								<div className="flex items-center gap-3">
									<div className="size-11 rounded-full p-[2.5px] bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 ring-2 ring-amber-200 dark:ring-amber-800/50">
										<div className="size-full rounded-full bg-card flex items-center justify-center text-lg">
											{review.avatar || "👤"}
										</div>
									</div>
									<div>
										<p className="text-sm font-semibold">
											{locale === "ar" ? review.nameAr : review.nameEn}
										</p>
										<p className="text-xs text-muted-foreground flex items-center gap-1">
											<span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
											{t.home.verifiedGuest}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</motion.div>
				))}
			</div>
		</section>
	);
}
