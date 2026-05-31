"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, UtensilsCrossed, Heart, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MenuCategory, RestaurantSettings, Translations } from "./types";

interface AnimatedStatCardProps {
	icon: React.ReactNode;
	value: number;
	suffix: string;
	label: string;
	delay: number;
}

function AnimatedStatCard({ icon, value, suffix, label, delay }: AnimatedStatCardProps) {
	const [count, setCount] = useState(0);
	const [isVisible, setIsVisible] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
			{ threshold: 0.3 },
		);
		if (ref.current) observer.observe(ref.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!isVisible) return;
		const duration = 2000;
		const steps = 60;
		const increment = value / steps;
		let current = 0;
		const timer = setInterval(() => {
			current += increment;
			if (current >= value) { setCount(value); clearInterval(timer); }
			else setCount(Math.floor(current));
		}, duration / steps);
		return () => clearInterval(timer);
	}, [isVisible, value]);

	return (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, y: 20 }}
			animate={isVisible ? { opacity: 1, y: 0 } : {}}
			transition={{ delay, duration: 0.5 }}
		>
			<Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden rounded-2xl bg-card">
				<CardContent className="p-5">
					<div className="size-10 rounded-xl bg-[#c75b39]/10 flex items-center justify-center text-[#c75b39] mb-3">
						{icon}
					</div>
					<div className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
						{count.toLocaleString()}{suffix}
					</div>
					<div className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

interface StatsSectionProps {
	settings: RestaurantSettings | null;
	categories: MenuCategory[];
	t: Translations;
}

export function StatsSection({ settings, categories, t }: StatsSectionProps) {
	return (
		<section className="py-8 md:py-12 px-6 md:px-12">
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{[
					{ icon: <ShoppingCart className="size-5" />, value: settings?.statsOrdersServed || 0, suffix: "+", label: t.home.statsOrders },
					{ icon: <UtensilsCrossed className="size-5" />, value: categories.reduce((sum, c) => sum + c.items.length, 0), suffix: "+", label: t.home.statsMenuItems },
					{ icon: <Heart className="size-5" />, value: settings?.statsHappyCustomers || 0, suffix: "+", label: t.home.statsHappyCustomers },
					{ icon: <Clock className="size-5" />, value: settings?.statsYearsService || 0, suffix: "+", label: t.home.statsYears },
				].map((stat, idx) => (
					<AnimatedStatCard key={idx} {...stat} delay={idx * 0.1} />
				))}
			</div>
		</section>
	);
}
