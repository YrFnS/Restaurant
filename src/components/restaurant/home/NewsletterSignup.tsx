"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Translations } from "./types";

interface NewsletterSignupProps {
	t: Translations;
	onNavigate: (section: string) => void;
}

export function NewsletterSignup({ t, onNavigate }: NewsletterSignupProps) {
	return (
		<section className="px-4">
			<motion.div
				initial={{ opacity: 0, scale: 0.97 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5, delay: 0.2 }}
				className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 p-5 sm:p-6 text-white"
			>
				{/* Decorative elements */}
				<div className="absolute top-0 end-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4" />
				<div className="absolute bottom-0 start-0 w-24 h-24 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4" />
				<div className="relative z-10 flex items-center gap-4">
					<div className="size-14 sm:size-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
						<Sparkles className="size-7 sm:size-8 text-white" />
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-bold text-lg sm:text-xl">
							{t.home.chefsRecommendation}
						</h3>
						<p className="text-white/80 text-sm mt-0.5 line-clamp-2">
							{t.home.chefsRecommendationDesc}
						</p>
					</div>
					<Button
						className="bg-white text-amber-700 hover:bg-white/90 font-semibold shrink-0 gap-2"
						onClick={() => onNavigate("menu")}
					>
						{t.home.viewMenu}
						<ArrowRight className="size-4" />
					</Button>
				</div>
			</motion.div>
		</section>
	);
}
