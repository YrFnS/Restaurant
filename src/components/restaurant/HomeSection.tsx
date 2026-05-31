"use client";

import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
} from "react";
import {
	motion,
	AnimatePresence,
	useScroll,
	useTransform,
} from "framer-motion";
import {
	UtensilsCrossed,
	CalendarDays,
	Clock,
	Gift,
	Plus,
	ChevronLeft,
	ChevronRight,
	Truck,
	Timer,
	DollarSign,
	Flame,
	Sparkles,
	Star,
	ArrowRight,
	Heart,
	Quote,
	Moon,
	Search,
	ShoppingCart,
	PartyPopper,
	Package,
	ChevronDown,
	BarChart3,
	TrendingUp,
	Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import {
	useRestaurantStore,
	type CartItem,
	type RestaurantSettings,
} from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";

/* ─── Type Definitions ─── */

interface MenuItemModifier {
	id: string;
	nameEn: string;
	nameAr: string;
	type: string;
	price: number;
}

interface MenuItem {
	id: string;
	nameEn: string;
	nameAr: string;
	descriptionEn: string;
	descriptionAr: string;
	price: number;
	image: string;
	isAvailable: boolean;
	isPopular: boolean;
	isSpecial: boolean;
	preparationTime: number;
	calories: number;
	allergens: string;
	dietary: string;
	sortOrder: number;
	categoryId: string;
	modifiers: MenuItemModifier[];
}

interface MenuCategory {
	id: string;
	nameEn: string;
	nameAr: string;
	icon: string;
	sortOrder: number;
	isAvailable: boolean;
	items: MenuItem[];
}

interface SpecialOffer {
	id: string;
	titleEn: string;
	titleAr: string;
	descriptionEn: string;
	descriptionAr: string;
	discountPercent: number;
	image: string;
	isActive: boolean;
	validFrom: string | null;
	validUntil: string | null;
}

interface RecentOrder {
	id: string;
	orderNumber: string;
	status: string;
	total: number;
	createdAt: string;
	items: { menuItem: { nameEn: string; nameAr: string } }[];
}

/* ─── Helper: Category emoji gradients ─── */
const categoryGradients: Record<string, string> = {
	"🥗": "from-green-400/80 to-emerald-500/80",
	"🍲": "from-amber-400/80 to-orange-500/80",
	"🥩": "from-red-400/80 to-rose-500/80",
	"🦐": "from-cyan-400/80 to-teal-500/80",
	"🍝": "from-yellow-400/80 to-amber-500/80",
	"🍕": "from-orange-400/80 to-red-500/80",
	"🥬": "from-lime-400/80 to-green-500/80",
	"🍰": "from-pink-400/80 to-rose-500/80",
	"🥤": "from-sky-400/80 to-blue-500/80",
	"🍟": "from-amber-300/80 to-yellow-500/80",
};

const defaultGradient = "from-amber-400/80 to-orange-500/80";

/* ─── Helper: Get dietary badges ─── */
function getDietaryBadges(dietary: string) {
	if (!dietary) return [];
	return dietary.split(",").filter(Boolean);
}

const dietaryColors: Record<string, string> = {
	vegetarian:
		"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	vegan:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
	"gluten-free":
		"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
	halal: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
	spicy: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

/* ─── Testimonial type ─── */
interface Testimonial {
	id: string;
	nameEn: string;
	nameAr: string;
	commentEn: string;
	commentAr: string;
	avatar: string;
	stars: number;
	sortOrder: number;
}

/* ─── Animation Variants ─── */

const heroContainer = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: { staggerChildren: 0.15, delayChildren: 0.3 },
	},
};

const heroChild = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const letterVariants = {
	hidden: { opacity: 0, y: 30, scale: 0.8 },
	show: (i: number) => ({
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { delay: i * 0.04, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] },
	}),
};

const cardHover = {
	scale: 1.02,
	transition: { type: "spring" as const, stiffness: 300, damping: 20 },
};

const cardTap = {
	scale: 0.98,
};

/* ─── Animated Stat Card Component ─── */
function AnimatedStatCard({
	icon,
	value,
	suffix,
	label,
	gradient,
	delay,
}: {
	icon: React.ReactNode;
	value: number;
	suffix: string;
	label: string;
	gradient: string;
	delay: number;
}) {
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

/* ─── Main Component ─── */

export function HomeSection() {
	const { t, locale, isRTL } = useI18n();
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
	const { scrollY } = useScroll();
	const heroImgY = useTransform(scrollY, [0, 400], [0, 80]);

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

	// Get category icon for an item
	const getCategoryForItem = useCallback(
		(categoryId: string) => {
			return categories.find((c) => c.id === categoryId);
		},
		[categories],
	);

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

	return (
		<div className="pb-4 space-y-6">
			{/* ─── Hero Section ─── */}
			<section className="relative overflow-hidden" ref={heroRef}>
				<div className="relative px-5 pt-8 pb-10 text-white">
					{/* Background image with parallax scroll effect */}
					<motion.img
						src={
							settings?.heroImageUrl ||
							"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop"
						}
						alt=""
						className="absolute inset-0 w-full h-[120%] object-cover"
						aria-hidden="true"
						style={{ y: heroImgY }}
					/>
					{/* Gradient overlay on top of image */}
					<div className="absolute inset-0 bg-gradient-to-br from-amber-700/90 via-orange-700/85 to-rose-700/90" />

					{/* Animated decorative circles with floating animation */}
					<motion.div
						animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }}
						transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
						className="absolute top-0 end-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4"
					/>
					<motion.div
						animate={{ y: [0, 8, 0], scale: [1, 1.03, 1] }}
						transition={{
							repeat: Infinity,
							duration: 4.5,
							ease: "easeInOut",
							delay: 0.5,
						}}
						className="absolute bottom-0 start-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4"
					/>
					<motion.div
						animate={{ y: [0, -6, 0], x: [0, 3, 0] }}
						transition={{
							repeat: Infinity,
							duration: 6,
							ease: "easeInOut",
							delay: 1,
						}}
						className="absolute top-1/2 start-1/4 w-20 h-20 rounded-full bg-white/5"
					/>
					<motion.div
						animate={{ y: [0, 7, 0], x: [0, -4, 0] }}
						transition={{
							repeat: Infinity,
							duration: 5.5,
							ease: "easeInOut",
							delay: 0.8,
						}}
						className="absolute top-1/3 end-1/4 w-14 h-14 rounded-full bg-white/5"
					/>

					<motion.div
						variants={heroContainer}
						initial="hidden"
						animate="show"
						className="relative z-10 max-w-2xl mx-auto text-center"
					>
						{/* Open/Closed Badge - prominent with glow effect */}
						<motion.div
							variants={heroChild}
							className="flex justify-center mb-4"
						>
							<Badge
								className={`gap-2 px-4 py-1.5 text-sm font-semibold border backdrop-blur-sm ${
									isOpen()
										? "bg-green-500/25 text-green-100 border-green-400/30 glow-green"
										: "bg-gray-800/80 text-white border-gray-500/30"
								}`}
							>
								{isOpen() ? (
									<span className="size-2.5 rounded-full bg-green-400 pulse-dot" />
								) : (
									<Moon className="size-3.5" />
								)}
								{isOpen() ? t.home.openNow : t.home.closed}
							</Badge>
						</motion.div>

						{/* Restaurant Name - Letter-by-letter animation */}
						<motion.h1
							className="text-3xl sm:text-4xl font-bold mb-2 tracking-tight"
							variants={heroContainer}
							initial="hidden"
							animate="show"
							aria-label={
								settings
									? locale === "ar"
										? settings.nameAr
										: settings.nameEn
									: t.app.name
							}
						>
							{restaurantName.map((char, i) => (
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

						{/* Tagline */}
						<motion.p
							variants={heroChild}
							className="text-white/80 text-base sm:text-lg mb-6"
						>
							{settings
								? locale === "ar"
									? settings.taglineAr
									: settings.taglineEn
								: t.home.subtitle}
						</motion.p>

						{/* CTA Buttons */}
						<motion.div
							variants={heroChild}
							className="flex items-center justify-center gap-3 flex-wrap"
						>
							{isOpen() ? (
								<Button
									size="lg"
									className="bg-white text-amber-700 hover:bg-white/90 gap-2 font-semibold shadow-lg shadow-black/10 animate-pulse-subtle btn-shimmer"
									onClick={() => setActiveSection("menu")}
								>
									<UtensilsCrossed className="size-4" />
									{t.home.orderNow}
									<ArrowRight className="size-4 ms-1" />
								</Button>
							) : (
								<Button
									size="lg"
									className="bg-white/20 text-white hover:bg-white/30 gap-2 font-semibold backdrop-blur-sm"
									onClick={() => setActiveSection("menu")}
								>
									<UtensilsCrossed className="size-4" />
									{t.home.viewMenu}
								</Button>
							)}
							<Button
								size="lg"
								variant="outline"
								className="border-white/30 text-white hover:bg-white/15 gap-2 font-semibold bg-white/10 backdrop-blur-sm"
								onClick={() => setActiveSection("reservations")}
							>
								<CalendarDays className="size-4" />
								{t.home.reserveTable}
							</Button>
						</motion.div>
					</motion.div>
				</div>

				{/* Curved bottom */}
				<div className="bg-background h-5 -mt-1 rounded-t-[1.5rem]" />
			</section>

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
							onClick={() => setActiveSection(action.section)}
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
			<section className="space-y-3">
				<div className="flex items-center justify-between px-4">
					<div className="flex items-center gap-2">
						<UtensilsCrossed className="size-5 text-amber-500" />
						<h2 className="text-lg font-bold">{t.home.categories}</h2>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="text-primary gap-1"
						onClick={() => setActiveSection("menu")}
					>
						{t.home.viewAll}
						<ChevronRight className={`size-4 ${isRTL ? "rotate-180" : ""}`} />
					</Button>
				</div>

				<div
					className="flex gap-3 overflow-x-auto px-4 scroll-smooth snap-x snap-mandatory pb-2"
					style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
				>
					{loading
						? Array.from({ length: 6 }).map((_, i) => (
								<div key={i} className="snap-start shrink-0">
									<Skeleton className="size-20 rounded-2xl" />
									<Skeleton className="h-3 w-16 mx-auto mt-1.5" />
								</div>
							))
						: categories.map((cat, idx) => (
								<motion.button
									key={cat.id}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: idx * 0.05 }}
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={() => setActiveSection("menu")}
									className="snap-start shrink-0 flex flex-col items-center gap-1.5 group"
									aria-label={locale === "ar" ? cat.nameAr : cat.nameEn}
								>
									<div
										className={`size-16 sm:size-20 rounded-2xl bg-gradient-to-br ${categoryGradients[cat.icon] || defaultGradient} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}
									>
										<span className="text-2xl sm:text-3xl drop-shadow-md">
											{cat.icon}
										</span>
									</div>
									<span className="text-[11px] sm:text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight max-w-[72px] line-clamp-2">
										{locale === "ar" ? cat.nameAr : cat.nameEn}
									</span>
								</motion.button>
							))}
				</div>
			</section>

			{/* ─── Today's Specials Carousel ─── */}
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

			{/* ─── Popular Items Grid ─── */}
			<section className="space-y-3">
				<div className="flex items-center justify-between px-4">
					<div className="flex items-center gap-2">
						<motion.div
							animate={{ scale: [1, 1.2, 1] }}
							transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
						>
							<Flame className="size-5 text-amber-500" />
						</motion.div>
						<h2 className="text-lg font-bold">{t.home.popularItems}</h2>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="text-primary gap-1"
						onClick={() => setActiveSection("menu")}
					>
						{t.home.viewAll}
						<ChevronRight className={`size-4 ${isRTL ? "rotate-180" : ""}`} />
					</Button>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4">
					{loading
						? Array.from({ length: 6 }).map((_, i) => (
								<Card
									key={i}
									className="overflow-hidden border border-border/50 shadow-sm rounded-xl"
								>
									<Skeleton className="h-36" />
									<CardContent className="p-3 space-y-2">
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
										<Skeleton className="h-8 w-full" />
									</CardContent>
								</Card>
							))
						: popularItems.map((item, itemIdx) => {
								const cat = getCategoryForItem(item.categoryId);
								const gradient =
									categoryGradients[cat?.icon || ""] || defaultGradient;
								const dietaryList = getDietaryBadges(item.dietary);
								const isAdded = addedItemId === item.id;
								const isFav = favorites.includes(item.id);

								return (
									<motion.div
										key={item.id}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{
											delay: itemIdx * 0.06,
											duration: 0.4,
											ease: "easeOut",
										}}
										whileHover={cardHover}
										whileTap={cardTap}
									>
										<Card className="overflow-hidden border border-border/50 shadow-sm hover:shadow-lg transition-all duration-200 h-full flex flex-col rounded-xl menu-card-lift">
											{/* Food image */}
											<div className="relative h-36 overflow-hidden">
												{item.image ? (
													<img
														src={item.image}
														alt={locale === "ar" ? item.nameAr : item.nameEn}
														className="w-full h-full object-cover"
													/>
												) : (
													<div
														className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
													>
														<span className="text-4xl drop-shadow-md">
															{cat?.icon || "🍽️"}
														</span>
													</div>
												)}
												{/* Gradient overlay for text contrast */}
												<div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
												{item.isSpecial && (
													<Badge className="absolute top-2 start-2 bg-white/90 text-amber-700 border-0 text-[10px] font-bold gap-1 z-10">
														<Sparkles className="size-3" />
														{t.menu.new}
													</Badge>
												)}
												{item.isPopular && (
													<Badge className="absolute top-2 end-2 bg-white/90 text-amber-700 border-0 text-[10px] font-bold gap-1 z-10">
														<motion.span
															animate={{ scale: [1, 1.3, 1] }}
															transition={{
																repeat: Infinity,
																duration: 1.5,
																ease: "easeInOut",
															}}
															className="inline-flex"
														>
															<Flame className="size-3" />
														</motion.span>
														{t.menu.popular}
													</Badge>
												)}
												{/* Favorite heart button */}
												<button
													onClick={(e) => {
														e.stopPropagation();
														toggleFavorite(item.id);
													}}
													className="absolute bottom-2 end-2 z-10 size-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-black/60"
													aria-label={
														isFav
															? t.menu.removedFromFavorites
															: t.menu.addedToFavorites
													}
												>
													<Heart
														className={`size-3.5 transition-all ${
															isFav
																? "text-red-400 fill-red-400 scale-110"
																: "text-white/80"
														}`}
													/>
												</button>
												{/* Calorie badge */}
												{item.calories > 0 && (
													<Badge className="absolute bottom-2 start-2 bg-black/40 text-white border-0 text-[9px] gap-0.5 backdrop-blur-sm z-10">
														{item.calories} {t.menu.calories}
													</Badge>
												)}
											</div>

											<CardContent className="p-3 flex flex-col flex-1">
												<h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-0.5">
													{locale === "ar" ? item.nameAr : item.nameEn}
												</h3>
												<p className="text-xs text-muted-foreground line-clamp-2 mb-2">
													{locale === "ar"
														? item.descriptionAr
														: item.descriptionEn}
												</p>

												{/* Dietary badges */}
												{dietaryList.length > 0 && (
													<div className="flex flex-wrap gap-1 mb-2">
														{dietaryList.slice(0, 3).map((d) => (
															<span
																key={d}
																className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
																	dietaryColors[d] ||
																	"bg-muted text-muted-foreground"
																}`}
															>
																{t.menu[d as keyof typeof t.menu] || d}
															</span>
														))}
													</div>
												)}

												{/* Price & Add */}
												<div className="mt-auto flex items-center justify-between gap-1">
													<span className="font-bold text-primary text-base whitespace-nowrap shrink-0">
														{currency}
														{item.price.toFixed(2)}
													</span>
													<motion.div
														animate={
															isAdded ? { scale: [1, 1.3, 1] } : { scale: 1 }
														}
														transition={{ duration: 0.3 }}
													>
														<Button
															size="sm"
															variant={isAdded ? "default" : "outline"}
															className="h-7 w-7 p-0 rounded-full shrink-0"
															onClick={(e) => {
																e.stopPropagation();
																handleQuickAdd(item);
															}}
															aria-label={`${t.menu.addToCart} ${locale === "ar" ? item.nameAr : item.nameEn}`}
														>
															<Plus className="size-3.5" />
														</Button>
													</motion.div>
												</div>
											</CardContent>
										</Card>
									</motion.div>
								);
							})}
				</div>
			</section>

			{/* ─── Animated Stats Counter ─── */}
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

			{/* ─── Chef's Recommendation Banner ─── */}
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
							onClick={() => setActiveSection("menu")}
						>
							{t.home.viewMenu}
							<ArrowRight className="size-4" />
						</Button>
					</div>
				</motion.div>
			</section>

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
							onClick={() => setActiveSection("orders")}
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
									onClick={() => setActiveSection("orders")}
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
			<section className="px-4 space-y-4">
				<div className="flex items-center gap-2">
					<PartyPopper className="size-5 text-amber-500" />
					<h2 className="text-lg font-bold">{t.home.howItWorks}</h2>
				</div>

				<div className="relative grid grid-cols-3 gap-3 sm:gap-4">
					{/* Connecting line between steps */}
					<div className="absolute top-6 sm:top-7 start-[16%] end-[16%] h-0.5 bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 dark:from-amber-700 dark:via-orange-700 dark:to-rose-700 hidden sm:block" />

					{[
						{
							icon: Search,
							label: t.home.step1,
							desc: t.home.step1Desc,
							gradient: "from-amber-400 to-amber-600",
							bgLight: "bg-amber-50 dark:bg-amber-950/20",
							number: "1",
						},
						{
							icon: ShoppingCart,
							label: t.home.step2,
							desc: t.home.step2Desc,
							gradient: "from-orange-400 to-orange-600",
							bgLight: "bg-orange-50 dark:bg-orange-950/20",
							number: "2",
						},
						{
							icon: PartyPopper,
							label: t.home.step3,
							desc: t.home.step3Desc,
							gradient: "from-rose-400 to-rose-600",
							bgLight: "bg-rose-50 dark:bg-rose-950/20",
							number: "3",
						},
					].map((step, idx) => (
						<motion.div
							key={idx}
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 + idx * 0.1 }}
							className={`relative flex flex-col items-center text-center gap-2 p-3 sm:p-4 rounded-xl ${step.bgLight} border border-border/30`}
						>
							<div className="relative">
								<div
									className={`size-10 sm:size-12 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-sm`}
								>
									<step.icon className="size-5 sm:size-6 text-white" />
								</div>
								<div className="absolute -top-1.5 -end-1.5 size-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
									{step.number}
								</div>
							</div>
							<span className="text-xs sm:text-sm font-bold text-foreground">
								{step.label}
							</span>
							<span className="text-[10px] sm:text-xs text-muted-foreground leading-tight line-clamp-2">
								{step.desc}
							</span>
						</motion.div>
					))}
				</div>
			</section>

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
							className={`h-1.5 ${isOpen() ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gradient-to-r from-gray-400 to-gray-500"}`}
						/>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div
										className={`size-10 rounded-full flex items-center justify-center ${isOpen() ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-gray-100 dark:bg-gray-900/30"}`}
									>
										<Clock
											className={`size-5 ${isOpen() ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}
										/>
									</div>
									<div>
										<h3 className="font-semibold text-sm">
											{t.home.restaurantHours}
										</h3>
										<p className="text-xs text-muted-foreground">
											{isOpen()
												? `${t.home.openUntil} ${formatHour(settings.closeTime)}`
												: `${t.home.closedUntil} ${formatHour(settings.openTime)}`}
										</p>
									</div>
								</div>
								<Badge
									className={
										isOpen()
											? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
											: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300 border-0"
									}
								>
									{isOpen() ? t.home.openNow : t.home.closed}
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
							onClick={() => setActiveSection("menu")}
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
			{testimonials.length > 0 && (
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
			)}
		</div>
	);
}
