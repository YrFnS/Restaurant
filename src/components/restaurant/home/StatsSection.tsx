"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
	BarChart3,
	ShoppingCart,
	UtensilsCrossed,
	Heart,
	Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MenuCategory, RestaurantSettings, Translations } from "./types";

interface AnimatedStatCardProps {
	icon: React.ReactNode;
	value: number;
	suffix: string;
	label: string;
	gradient: string;
	delay: number;
}

function AnimatedStatCard({
	icon,
	value,
	suffix,
	label,
	gradient,
	delay,
}: AnimatedStatCardProps) {
	const [count, setCount] = useState(0);
	const [isVisible, setIsVisible] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
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
			if (current >= value) {
				setCount(value);
				clearInterval(timer);
			} else setCount(Math.floor(current));
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
			<Card className="border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden rounded-xl">
				<CardContent className="p-4 sm:p-5">
					<div
						className={`size-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-3 shadow-sm`}
					>
						{icon}
					</div>
					<div className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
						{count.toLocaleString()}
						{suffix}
					</div>
					<div className="text-xs sm:text-sm text-muted-foreground mt-1">
						{label}
					</div>
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
		<section className="px-4">
			<div className="flex items-center gap-2 mb-3">
				<BarChart3 className="size-5 text-amber-500" />
				<h2 className="text-lg font-bold">{t.home.statsTitle}</h2>
			</div>
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				{[
					{
						icon: <ShoppingCart className="size-5" />,
						value: settings?.statsOrdersServed || 0,
						suffix: "+",
						label: t.home.statsOrders,
						gradient: "from-amber-500 to-orange-600",
					},
					{
						icon: <UtensilsCrossed className="size-5" />,
						value: categories.reduce((sum, c) => sum + c.items.length, 0),
						suffix: "+",
						label: t.home.statsMenuItems,
						gradient: "from-orange-500 to-rose-600",
					},
					{
						icon: <Heart className="size-5" />,
						value: settings?.statsHappyCustomers || 0,
						suffix: "+",
						label: t.home.statsHappyCustomers,
						gradient: "from-rose-500 to-pink-600",
					},
					{
						icon: <Clock className="size-5" />,
						value: settings?.statsYearsService || 0,
						suffix: "+",
						label: t.home.statsYears,
						gradient: "from-teal-500 to-emerald-600",
					},
				].map((stat, idx) => (
					<AnimatedStatCard
						key={idx}
						icon={stat.icon}
						value={stat.value}
						suffix={stat.suffix}
						label={stat.label}
						gradient={stat.gradient}
						delay={idx * 0.1}
					/>
				))}
			</div>
		</section>
	);
}
