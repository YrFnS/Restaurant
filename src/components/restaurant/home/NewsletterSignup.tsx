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
		<section className="py-6 md:py-8 px-6 md:px-12">
			<motion.div
				initial={{ opacity: 0, scale: 0.97 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5, delay: 0.2 }}
				className="relative overflow-hidden rounded-2xl bg-[#1a1a1a] p-6 sm:p-8 text-white"
			>
				<div className="absolute top-0 end-0 w-40 h-40 rounded-full bg-[#c75b39]/20 -translate-y-1/2 translate-x-1/4" />
				<div className="absolute bottom-0 start-0 w-24 h-24 rounded-full bg-[#7a8b6f]/10 translate-y-1/2 -translate-x-1/4" />
				<div className="relative z-10 flex items-center gap-5">
					<div className="size-14 sm:size-16 rounded-2xl bg-[#c75b39]/20 flex items-center justify-center shrink-0">
						<Sparkles className="size-7 sm:size-8 text-[#c75b39]" />
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-serif font-bold text-xl sm:text-2xl">{t.home.chefsRecommendation}</h3>
						<p className="text-white/60 text-sm mt-1 line-clamp-2">{t.home.chefsRecommendationDesc}</p>
					</div>
					<Button
						className="bg-[#c75b39] hover:bg-[#c75b39]/90 text-white font-semibold shrink-0 gap-2 rounded-full px-5"
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
