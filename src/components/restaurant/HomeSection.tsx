"use client";

import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
} from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
	UtensilsCrossed,
	CalendarDays,
	Clock,
	Gift,
	ChevronRight,
	Truck,
	Timer,
	DollarSign,
	Flame,
	Package,
	ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import {
	useRestaurantStore,
	type CartItem,
	type RestaurantSettings,
} from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";

import { HeroSection } from "./home/HeroSection";
import { CategoryGrid } from "./home/CategoryGrid";
import { SpecialsSection } from "./home/SpecialsSection";
import { PopularItems } from "./home/PopularItems";
import { StatsSection } from "./home/StatsSection";
import { TestimonialsSection } from "./home/TestimonialsSection";
import { HowItWorks } from "./home/HowItWorks";
import { NewsletterSignup } from "./home/NewsletterSignup";
import type {
	MenuItem,
	MenuCategory,
	SpecialOffer,
	Testimonial,
	Translations,
} from "./home/types";

/* ─── Animation Variants ─── */

const heroContainer: Variants = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: { staggerChildren: 0.15, delayChildren: 0.3 },
	},
};

const heroChild: Variants = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const letterVariants: Variants = {
	hidden: { opacity: 0, y: 30, scale: 0.8 },
	show: (i: number) => ({
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { delay: i * 0.04, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] },
	}),
};

/* ─── Main Component ─── */

export function HomeSection() {
	const { t: i18nResult, locale, isRTL } = useI18n();
	// Cast translations to our shared type
	const t = i18nResult as unknown as Translations;
	const setActiveSection = useRestaurantStore((s) => s.setActiveSection);
	const addToCart = useRestaurantStore((s) => s.addToCart);
	const favorites = useRestaurantStore((s) => s.favorites);
	const toggleFavorite = useRestaurantStore((s) => s.toggleFavorite);
	const customerPhone = useRestaurantStore((s) => s.customerPhone);
	const settings = useRestaurantStore(
		(s) => s.settings,
	) as RestaurantSettings | null;
	const fetchSettings = useRestaurantStore((s) => s.fetchSettings);
	const notifications = useNotifications();

	const [categories, setCategories] = useState<MenuCategory[]>([]);
	const [offers, setOffers] = useState<SpecialOffer[]>([]);
	const [loading, setLoading] = useState(true);
	const [offersLoaded, setOffersLoaded] = useState(false);
	const [addedItemId, setAddedItemId] = useState<string | null>(null);
	const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
	const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

	const specialsScrollRef = useRef<HTMLDivElement>(null);
	const heroRef = useRef<HTMLDivElement>(null);

	// Staggered restaurant name letters
	const restaurantName = useMemo(() => {
		const name = settings
			? locale === "ar"
				? settings.nameAr
				: settings.nameEn
			: t.app.name;
		return name.split("");
	}, [settings, locale, t.app.name]);

	// Fetch data (settings now from store)
	useEffect(() => {
		fetchSettings();
		async function fetchData() {
			setLoading(true);
			try {
				const [menuRes, offersRes, testimonialsRes] = await Promise.all([
					fetch("/api/menu"),
					fetch("/api/offers"),
					fetch("/api/testimonials"),
				]);
				const menuData = await menuRes.json();
				const offersData = await offersRes.json();
				const testimonialsData = await testimonialsRes.json();

				if (menuData.categories) setCategories(menuData.categories);
				if (offersData.offers) setOffers(offersData.offers);
				if (testimonialsData.testimonials)
					setTestimonials(testimonialsData.testimonials);
			} catch (err) {
				console.error("Error fetching home data:", err);
			} finally {
				setLoading(false);
				setOffersLoaded(true);
			}
		}
		fetchData();
	}, [fetchSettings]);

	// Fetch recent orders
	useEffect(() => {
		if (!customerPhone) return;
		async function fetchRecentOrders() {
			try {
				const res = await fetch(
					`/api/orders?phone=${encodeURIComponent(customerPhone.trim())}`,
				);
				if (!res.ok) return;
				const data = await res.json();
				if (data.orders) {
					setRecentOrders(data.orders.slice(0, 3));
				}
			} catch {
				// ignore
			}
		}
		fetchRecentOrders();
	}, [customerPhone]);

	// Check if open
	const isOpen = useCallback(() => {
		if (!settings) return true;
		const now = new Date();
		const hours = now.getHours();
		const minutes = now.getMinutes();
		const currentTime = hours * 60 + minutes;
		const [openH, openM] = settings.openTime.split(":").map(Number);
		const [closeH, closeM] = settings.closeTime.split(":").map(Number);
		const openTime = openH * 60 + openM;
		const closeTime = closeH * 60 + closeM;
		return currentTime >= openTime && currentTime <= closeTime;
	}, [settings]);

	// Get popular items
	const popularItems = categories
		.flatMap((cat) => cat.items)
		.filter((item) => item.isPopular)
		.slice(0, 8);

	// Add to cart handler
	const handleQuickAdd = useCallback(
		(item: MenuItem) => {
			const cartItem: CartItem = {
				id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				menuItemId: item.id,
				nameEn: item.nameEn,
				nameAr: item.nameAr,
				price: item.price,
				quantity: 1,
				image: item.image,
				modifiers: [],
				notes: "",
				totalPrice: item.price,
			};
			addToCart(cartItem);
			notifications.cartAdded(locale === "ar" ? item.nameAr : item.nameEn);
			setAddedItemId(item.id);
			setTimeout(() => setAddedItemId(null), 600);
		},
		[addToCart, notifications, locale],
	);

	// Scroll specials
	const scrollSpecials = (direction: "start" | "end") => {
		if (!specialsScrollRef.current) return;
		const scrollAmount = 280;
		specialsScrollRef.current.scrollBy({
			left:
				direction === "end"
					? isRTL
						? -scrollAmount
						: scrollAmount
					: isRTL
						? scrollAmount
						: -scrollAmount,
			behavior: "smooth",
		});
	};

	// Format hour for display
	const formatHour = (time: string) => {
		const [h, m] = time.split(":").map(Number);
		const ampm = h >= 12 ? "PM" : "AM";
		const hour12 = h % 12 || 12;
		return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
	};

	const currency = settings?.currencySymbol ?? "";

	// Time ago helper
	const timeAgo = (dateStr: string) => {
		const now = new Date();
		const date = new Date(dateStr);
		const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
		if (seconds < 60) return t.home.justNow;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes} ${t.common.minute}`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} ${t.home.hour}`;
		const days = Math.floor(hours / 24);
		return `${days} ${t.home.day}`;
	};

	// Status badge color for recent orders
	const getRecentOrderStatusColor = (status: string) => {
		switch (status) {
			case "pending":
				return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
			case "confirmed":
				return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
			case "preparing":
				return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
			case "ready":
				return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
			case "completed":
				return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
			case "cancelled":
				return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
			default:
				return "bg-muted text-muted-foreground";
		}
	};

	const handleNavigate = useCallback(
		(section: string) => {
			setActiveSection(section as Parameters<typeof setActiveSection>[0]);
		},
		[setActiveSection],
	);

	const openState = isOpen();

	return (
		<div className="pb-4 space-y-6">
			{/* ─── Hero Section ─── */}
			<HeroSection
				settings={settings}
				locale={locale}
				isRTL={isRTL}
				isOpen={openState}
				t={t}
				restaurantNameChars={restaurantName}
				heroContainer={heroContainer}
				heroChild={heroChild}
				letterVariants={letterVariants}
				onNavigate={handleNavigate}
				heroRef={heroRef}
			/>

			{/* ─── Quick Actions Row ─── */}
			<section className="px-4 -mt-2">
				<div className="flex items-center justify-center gap-4 sm:gap-6">
					{[
						{
							icon: UtensilsCrossed,
							label: t.home.orderNow,
							section: "menu" as const,
							color:
								"bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
						},
						{
							icon: CalendarDays,
							label: t.home.reserveTable,
							section: "reservations" as const,
							color:
								"bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
						},
						{
							icon: Clock,
							label: t.home.joinWaitlist,
							section: "waitlist" as const,
							color:
								"bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
						},
						{
							icon: Gift,
							label: t.nav.rewards,
							section: "rewards" as const,
							color:
								"bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
						},
					].map((action) => (
						<motion.button
							key={action.section}
							whileHover={{ scale: 1.08 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => handleNavigate(action.section)}
							className="flex flex-col items-center gap-1.5 group"
							aria-label={action.label}
						>
							<div
								className={`size-14 sm:size-16 rounded-full flex items-center justify-center shadow-sm transition-shadow group-hover:shadow-md ${action.color}`}
							>
								<action.icon className="size-6" />
							</div>
							<span className="text-[11px] sm:text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight max-w-[64px]">
								{action.label}
							</span>
						</motion.button>
					))}
				</div>
			</section>

			{/* ─── Categories Section ─── */}
			<CategoryGrid
				categories={categories}
				loading={loading}
				locale={locale}
				isRTL={isRTL}
				t={t}
				onNavigate={handleNavigate}
			/>

			{/* ─── Today's Specials Carousel ─── */}
			<SpecialsSection
				offers={offers}
				loading={loading}
				offersLoaded={offersLoaded}
				locale={locale}
				isRTL={isRTL}
				t={t}
				specialsScrollRef={specialsScrollRef}
				scrollSpecials={scrollSpecials}
			/>

			{/* ─── Popular Items Grid ─── */}
			<PopularItems
				popularItems={popularItems}
				categories={categories}
				loading={loading}
				locale={locale}
				isRTL={isRTL}
				t={t}
				currency={currency}
				addedItemId={addedItemId}
				favorites={favorites}
				onQuickAdd={handleQuickAdd}
				onToggleFavorite={toggleFavorite}
				onNavigate={handleNavigate}
			/>

			{/* ─── Animated Stats Counter ─── */}
			<StatsSection
				settings={settings}
				categories={categories}
				t={t}
			/>

			{/* ─── Chef's Recommendation Banner ─── */}
			<NewsletterSignup t={t} onNavigate={handleNavigate} />

			{/* ─── Recent Orders Section ─── */}
			{recentOrders.length > 0 && (
				<section className="space-y-3">
					<div className="flex items-center justify-between px-4">
						<div className="flex items-center gap-2">
							<Package className="size-5 text-amber-500" />
							<h2 className="text-lg font-bold">{t.home.recentOrders}</h2>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="text-primary gap-1"
							onClick={() => handleNavigate("orders")}
						>
							{t.home.viewAllOrders}
							<ChevronRight className={`size-4 ${isRTL ? "rotate-180" : ""}`} />
						</Button>
					</div>

					<div className="space-y-2 px-4">
						{recentOrders.map((order, idx) => (
							<motion.div
								key={order.id}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: idx * 0.08 }}
							>
								<Card
									className="border border-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
									onClick={() => handleNavigate("orders")}
								>
									<CardContent className="p-3">
										<div className="flex items-center justify-between gap-2">
											<div className="flex items-center gap-3 min-w-0">
												<div className="size-9 rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
													<Package className="size-4 text-amber-600 dark:text-amber-400" />
												</div>
												<div className="min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-bold text-sm">
															#{order.orderNumber}
														</span>
														<Badge
															className={`text-[9px] px-1.5 py-0 h-5 ${getRecentOrderStatusColor(order.status)}`}
														>
															{t.orders.status[
																order.status as keyof typeof t.orders.status
															] || order.status}
														</Badge>
													</div>
													<p className="text-xs text-muted-foreground truncate">
														{order.items.length} {t.orders.items} · {currency}
														{order.total.toFixed(2)} ·{" "}
														{t.home.orderPlacedAgo.replace(
															"{{time}}",
															timeAgo(order.createdAt),
														)}
													</p>
												</div>
											</div>
											<ChevronDown
												className={`size-4 text-muted-foreground -rotate-90 ${isRTL ? "rotate-90" : ""}`}
											/>
										</div>
									</CardContent>
								</Card>
							</motion.div>
						))}
					</div>
				</section>
			)}

			{/* ─── How It Works Section ─── */}
			<HowItWorks t={t} />

			{/* ─── Delivery Info Bar ─── */}
			{settings && (
				<section className="px-4">
					<Card className="border border-border/50 shadow-sm bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
						<CardContent className="p-3 sm:p-4">
							<div className="flex items-center justify-around gap-2 sm:gap-3 text-center">
								<div className="flex flex-col items-center gap-1">
									<div className="size-8 sm:size-10 rounded-full bg-amber-500/15 dark:bg-amber-500/25 flex items-center justify-center">
										<Timer className="size-4 sm:size-5 text-amber-600 dark:text-amber-400" />
									</div>
									<span className="text-[10px] sm:text-xs font-semibold text-foreground">
										{settings.avgPrepTime} {t.common.minute}
									</span>
									<span className="text-[9px] sm:text-[10px] text-muted-foreground">
										{t.home.deliveryTime}
									</span>
								</div>

								<div className="w-px h-8 sm:h-12 bg-amber-200/60 dark:bg-amber-800/30" />

								<div className="flex flex-col items-center gap-1">
									<div className="size-8 sm:size-10 rounded-full bg-teal-500/15 dark:bg-teal-500/25 flex items-center justify-center">
										<Truck className="size-4 sm:size-5 text-teal-600 dark:text-teal-400" />
									</div>
									<span className="text-[10px] sm:text-xs font-semibold text-foreground">
										{currency}
										{settings.deliveryFee.toFixed(2)}
									</span>
									<span className="text-[9px] sm:text-[10px] text-muted-foreground">
										{t.cart.deliveryFee}
									</span>
								</div>

								<div className="w-px h-8 sm:h-12 bg-amber-200/60 dark:bg-amber-800/30" />

								<div className="flex flex-col items-center gap-1">
									<div className="size-8 sm:size-10 rounded-full bg-green-500/15 dark:bg-green-500/25 flex items-center justify-center">
										<DollarSign className="size-4 sm:size-5 text-green-600 dark:text-green-400" />
									</div>
									<span className="text-[10px] sm:text-xs font-semibold text-foreground">
										{currency}
										{settings.minDeliveryOrder.toFixed(0)}
									</span>
									<span className="text-[9px] sm:text-[10px] text-muted-foreground">
										{t.home.freeDelivery}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</section>
			)}

			{/* ─── Restaurant Hours ─── */}
			{settings && (
				<section className="px-4">
					<Card className="border border-border/50 shadow-sm overflow-hidden">
						<div
							className={`h-1.5 ${openState ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gradient-to-r from-gray-400 to-gray-500"}`}
						/>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div
										className={`size-10 rounded-full flex items-center justify-center ${openState ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-gray-100 dark:bg-gray-900/30"}`}
									>
										<Clock
											className={`size-5 ${openState ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}
										/>
									</div>
									<div>
										<h3 className="font-semibold text-sm">
											{t.home.restaurantHours}
										</h3>
										<p className="text-xs text-muted-foreground">
											{openState
												? `${t.home.openUntil} ${formatHour(settings.closeTime)}`
												: `${t.home.closedUntil} ${formatHour(settings.openTime)}`}
										</p>
									</div>
								</div>
								<Badge
									className={
										openState
											? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
											: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300 border-0"
									}
								>
									{openState ? t.home.openNow : t.home.closed}
								</Badge>
							</div>
						</CardContent>
					</Card>
				</section>
			)}

			{/* ─── Happy Hour Banner ─── */}
			<AnimatePresence>
				{offers.length > 0 && (
					<motion.section
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						transition={{ delay: 0.3 }}
						className="px-4"
					>
						<Card
							className="border-0 shadow-md overflow-hidden cursor-pointer"
							onClick={() => handleNavigate("menu")}
						>
							<div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-4 sm:p-5 text-white relative overflow-hidden">
								{/* Decorative elements */}
								<div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.15),transparent_50%)]" />
								<div className="absolute top-0 end-0 w-32 h-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4" />

								<div className="relative z-10 flex items-center gap-3">
									<div className="size-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
										<Flame className="size-6" />
									</div>
									<div className="flex-1 min-w-0">
										<h3 className="font-bold text-base sm:text-lg">
											{t.home.happyHour}
										</h3>
										<p className="text-white/80 text-sm truncate">
											{locale === "ar"
												? offers[0].descriptionAr
												: offers[0].descriptionEn}
										</p>
									</div>
									<Badge className="bg-white/20 text-white border-0 shrink-0 font-bold">
										{offers[0].discountPercent}% OFF
									</Badge>
								</div>
							</div>
						</Card>
					</motion.section>
				)}
			</AnimatePresence>

			{/* ─── Testimonials / Reviews Section ─── */}
			<TestimonialsSection
				testimonials={testimonials}
				locale={locale}
				t={t}
			/>
		</div>
	);
}

/* ─── Recent Order Type (local to orchestrator) ─── */
interface RecentOrder {
	id: string;
	orderNumber: string;
	status: string;
	total: number;
	createdAt: string;
	items: { menuItem: { nameEn: string; nameAr: string } }[];
}
