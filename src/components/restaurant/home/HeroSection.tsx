"use client";

import React from "react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { UtensilsCrossed, CalendarDays, Moon, ArrowRight, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RestaurantSettings } from "@/lib/store";
import type { Translations } from "./types";

interface HeroSectionProps {
	settings: RestaurantSettings | null;
	locale: string;
	isRTL: boolean;
	isOpen: boolean;
	t: Translations;
	restaurantNameChars: string[];
	heroContainer: Variants;
	heroChild: Variants;
	letterVariants: Variants;
	onNavigate: (section: string) => void;
	heroRef: React.RefObject<HTMLDivElement | null>;
}

export function HeroSection({
	settings, locale, isOpen, t,
	restaurantNameChars, heroContainer, heroChild, letterVariants,
	onNavigate, heroRef,
}: HeroSectionProps) {
	const { scrollY } = useScroll();
	const heroImgY = useTransform(scrollY as any, [0, 400], [0, 80]);

	return (
		<section className="relative overflow-hidden" ref={heroRef}>
			{/* ── Full-width cinematic hero ── */}
			<div className="relative min-h-[85dvh] md:min-h-[90dvh] flex items-end text-white">
				{/* Food photography background */}
				<motion.img
					src={settings?.heroImageUrl || "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1600&h=900&fit=crop"}
					alt=""
					className="absolute inset-0 w-full h-[115%] object-cover"
					aria-hidden="true"
					style={{ y: heroImgY }}
				/>
				{/* Cinematic gradient overlay — bottom-heavy for text legibility */}
				<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
				<div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />

				{/* ── Editorial content — asymmetric layout ── */}
				<motion.div
					variants={heroContainer}
					initial="hidden"
					animate="show"
					className="relative z-10 w-full max-w-6xl mx-auto px-6 md:px-12 pb-16 md:pb-24"
				>
					<div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
						{/* Left: Main content spanning 8 columns */}
						<div className="md:col-span-8 lg:col-span-7">
							{/* Open/Closed pill */}
							<motion.div variants={heroChild} className="mb-6">
								<Badge className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border backdrop-blur-md ${
									isOpen
										? "bg-white/15 border-white/25 text-white"
										: "bg-white/10 border-white/20 text-white/80"
								}`}>
									{isOpen ? (
										<span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
									) : (
										<Moon className="size-3.5" />
									)}
									{isOpen ? t.home.openNow : t.home.closed}
								</Badge>
							</motion.div>

							{/* Restaurant name — serif, editorial sizing */}
							<motion.h1
								className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight mb-4"
								variants={heroContainer}
								initial="hidden"
								animate="show"
								aria-label={settings ? (locale === "ar" ? settings.nameAr : settings.nameEn) : t.app.name}
							>
								{restaurantNameChars.map((char, i) => (
									<motion.span
										key={i}
										variants={letterVariants}
										custom={i}
										className="inline-block"
										style={{ whiteSpace: char === " " ? "pre" : undefined }}
									>
										{char === " " ? "\u00A0" : char}
									</motion.span>
								))}
							</motion.h1>

							{/* Tagline — refined, restrained */}
							<motion.p
								variants={heroChild}
								className="text-white/70 text-lg md:text-xl font-light max-w-lg mb-8 leading-relaxed"
							>
								{settings
									? locale === "ar" ? settings.taglineAr : settings.taglineEn
									: t.home.subtitle}
							</motion.p>

							{/* Primary CTAs */}
							<motion.div variants={heroChild} className="flex flex-wrap gap-3">
								{isOpen ? (
									<Button
										size="lg"
										className="bg-white text-[#1a1a1a] hover:bg-white/90 gap-2.5 px-7 py-6 text-base font-semibold rounded-full"
										onClick={() => onNavigate("menu")}
									>
										<UtensilsCrossed className="size-4.5" />
										{t.home.orderNow}
										<ArrowRight className="size-4.5 ms-1" />
									</Button>
								) : (
									<Button
										size="lg"
										className="bg-white/15 text-white hover:bg-white/25 gap-2.5 px-7 py-6 text-base font-medium backdrop-blur-sm border border-white/20 rounded-full"
										onClick={() => onNavigate("menu")}
									>
										<UtensilsCrossed className="size-4.5" />
										{t.home.viewMenu}
									</Button>
								)}
								<Button
									size="lg"
									variant="ghost"
									className="text-white hover:bg-white/15 gap-2.5 px-7 py-6 text-base font-medium rounded-full border border-white/20 backdrop-blur-sm"
									onClick={() => onNavigate("reservations")}
								>
									<CalendarDays className="size-4.5" />
									{t.home.reserveTable}
								</Button>
							</motion.div>
						</div>

						{/* Right: Info sidebar — 4 columns, bottom-aligned */}
						<motion.div
							variants={heroChild}
							className="md:col-span-4 lg:col-span-5 flex flex-col gap-4 items-start md:items-end text-left md:text-right pb-2"
						>
							{/* Restaurant info cards */}
							<div className="flex flex-col gap-3 md:items-end">
								<div className="flex items-center gap-2.5 text-white/70 text-sm">
									<MapPin className="size-3.5 text-[#c75b39]" />
									<span>{settings?.addressEn || "123 Gourmet Avenue, Food District"}</span>
								</div>
								<div className="flex items-center gap-2.5 text-white/70 text-sm">
									<Clock className="size-3.5 text-[#c75b39]" />
									<span>{settings?.openTime || "10:00"} — {settings?.closeTime || "23:00"}</span>
								</div>
								<div className="flex items-center gap-2.5 text-white/70 text-sm">
									<span className="w-3.5 h-3.5 rounded-full bg-[#7a8b6f] flex items-center justify-center">
										<span className="w-1.5 h-1.5 rounded-full bg-white" />
									</span>
									<span>{t.home.freeDelivery || "Free delivery over $15"}</span>
								</div>
							</div>
						</motion.div>
					</div>
				</motion.div>

				{/* Decorative editorial element — thin amber line */}
				<div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#c75b39]/50 to-transparent" />
			</div>

			{/* Curved transition to content */}
			<div className="bg-background h-8 -mt-1 rounded-t-[2rem]" />
		</section>
	);
}
