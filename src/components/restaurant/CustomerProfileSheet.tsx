"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	User,
	Phone,
	Star,
	Heart,
	Package,
	Loader2,
	Search,
	X,
	ChefHat,
	Award,
	ShoppingBag,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";

/* ─── Types ─── */
interface CustomerData {
	id: string;
	name: string;
	phone: string;
	email: string | null;
	loyaltyPoints: number;
	totalSpent: number;
	visits: number;
	createdAt: string;
}

interface OrderSummary {
	id: string;
	orderNumber: string;
	status: string;
	total: number;
	createdAt: string;
	items: { menuItem: { nameEn: string; nameAr: string } }[];
}

/* ─── Animation variants ─── */
const fadeIn = {
	initial: { opacity: 0, y: 12 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -12 },
};

/* ─── Component ─── */
export function CustomerProfileSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t, locale, isRTL } = useI18n();
	const customerPhone = useRestaurantStore((s) => s.customerPhone);
	const customerName = useRestaurantStore((s) => s.customerName);
	const setCustomerPhone = useRestaurantStore((s) => s.setCustomerPhone);
	const setCustomerName = useRestaurantStore((s) => s.setCustomerName);
	const favorites = useRestaurantStore((s) => s.favorites);

	const [lookupPhone, setLookupPhone] = useState(customerPhone || "");
	const [isLookingUp, setIsLookingUp] = useState(false);
	const [customer, setCustomer] = useState<CustomerData | null>(null);
	const [lookupError, setLookupError] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [orders, setOrders] = useState<OrderSummary[]>([]);
	const [isLoadingOrders, setIsLoadingOrders] = useState(false);

	// Sync phone from store
	useEffect(() => {
		if (customerPhone && !lookupPhone) setLookupPhone(customerPhone);
	}, [customerPhone]);

	// Auto-lookup if phone is in store
	useEffect(() => {
		if (open && customerPhone && !customer && !hasSearched) {
			handleLookup(customerPhone);
		}
	}, [open]);

	const handleLookup = useCallback(
		async (phoneNum?: string) => {
			const num = phoneNum || lookupPhone;
			if (!num.trim()) return;
			setIsLookingUp(true);
			setLookupError(false);
			setHasSearched(true);
			try {
				const res = await fetch(
					`/api/customers?phone=${encodeURIComponent(num.trim())}`,
				);
				if (res.status === 404) {
					setCustomer(null);
					setLookupError(true);
					return;
				}
				if (!res.ok) throw new Error("Failed to fetch");
				const data = await res.json();
				setCustomer(data.customer);
				setLookupError(false);
				setCustomerPhone(num.trim());
				// Fetch orders
				fetchOrders(num.trim());
			} catch {
				setCustomer(null);
				setLookupError(true);
			} finally {
				setIsLookingUp(false);
			}
		},
		[lookupPhone, setCustomerPhone],
	);

	const fetchOrders = useCallback(async (phone: string) => {
		setIsLoadingOrders(true);
		try {
			const res = await fetch(`/api/orders?phone=${encodeURIComponent(phone)}`);
			if (!res.ok) throw new Error("Failed to fetch orders");
			const data = await res.json();
			setOrders(data.orders || []);
		} catch {
			setOrders([]);
		} finally {
			setIsLoadingOrders(false);
		}
	}, []);

	const handleLogout = () => {
		setCustomer(null);
		setCustomerPhone("");
		setCustomerName("");
		setLookupPhone("");
		setOrders([]);
		setHasSearched(false);
		setLookupError(false);
	};

	const settings = useRestaurantStore((s) => s.settings);
	const currency = settings?.currencySymbol ?? "";
	const completedOrders = orders.filter((o) => o.status === "completed");
	const totalOrders = orders.length;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side={isRTL ? "right" : "left"}
				className="w-full sm:max-w-md"
			>
				<SheetHeader className="space-y-0 pb-0">
					<SheetTitle className="text-start text-lg flex items-center gap-2">
						<div className="size-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
							<User className="size-4 text-white" />
						</div>
						{t.profile.title}
					</SheetTitle>
					<SheetDescription className="text-start text-sm">
						{t.profile.subtitle}
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto py-4 space-y-5">
					{!customer ? (
						<motion.div
							variants={fadeIn}
							initial="initial"
							animate="animate"
							className="space-y-4"
						>
							{/* Lookup */}
							<Card className="border-border/50 shadow-sm">
								<CardContent className="pt-6 space-y-4">
									<div className="text-center">
										<div className="size-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
											<User className="size-8 text-amber-600 dark:text-amber-400" />
										</div>
										<p className="font-medium text-sm">
											{t.profile.lookupPhone}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											{t.profile.lookupDesc}
										</p>
									</div>
									<div className="flex gap-2">
										<div className="relative flex-1">
											<Phone className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
											<Input
												placeholder={t.profile.phonePlaceholder}
												value={lookupPhone}
												onChange={(e) => setLookupPhone(e.target.value)}
												className="ps-9"
												type="tel"
												onKeyDown={(e) => {
													if (e.key === "Enter") handleLookup();
												}}
											/>
										</div>
										<Button
											onClick={() => handleLookup()}
											disabled={isLookingUp || !lookupPhone.trim()}
										>
											{isLookingUp ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												<Search className="size-4" />
											)}
										</Button>
									</div>
									{lookupError && hasSearched && (
										<div className="text-center p-3 rounded-lg bg-muted/50">
											<p className="text-sm text-muted-foreground">
												{t.profile.notFound}
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												{t.profile.notFoundDesc}
											</p>
										</div>
									)}
								</CardContent>
							</Card>
						</motion.div>
					) : (
						<motion.div
							variants={fadeIn}
							initial="initial"
							animate="animate"
							className="space-y-4"
						>
							{/* Profile Header */}
							<Card className="border-primary/20 shadow-sm overflow-hidden">
								<div className="h-16 bg-gradient-to-r from-amber-500 to-orange-600 relative">
									<div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3N2Zz4=')] opacity-50" />
								</div>
								<CardContent className="pt-0 pb-4 relative">
									<div className="flex items-end gap-3 -mt-6">
										<div className="size-14 rounded-xl bg-white dark:bg-card border-2 border-white dark:border-card flex items-center justify-center shadow-md shrink-0">
											<span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
												{customer.name.charAt(0).toUpperCase()}
											</span>
										</div>
										<div className="flex-1 min-w-0 pb-1">
											<h3 className="font-bold text-base truncate">
												{customer.name}
											</h3>
											<p className="text-xs text-muted-foreground">
												{customer.phone}
											</p>
										</div>
										<Button
											variant="ghost"
											size="sm"
											className="text-muted-foreground shrink-0"
											onClick={handleLogout}
										>
											<X className="size-3.5" />
										</Button>
									</div>
								</CardContent>
							</Card>

							{/* Stats Grid */}
							<div className="grid grid-cols-2 gap-3">
								<Card className="border-border/50 shadow-sm">
									<CardContent className="p-3 text-center">
										<div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-2">
											<Star className="size-5 text-amber-600 dark:text-amber-400" />
										</div>
										<p className="text-xl font-bold text-primary">
											{customer.loyaltyPoints}
										</p>
										<p className="text-[10px] text-muted-foreground font-medium">
											{t.profile.loyaltyPoints}
										</p>
									</CardContent>
								</Card>
								<Card className="border-border/50 shadow-sm">
									<CardContent className="p-3 text-center">
										<div className="size-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-2">
											<Heart className="size-5 text-rose-600 dark:text-rose-400" />
										</div>
										<p className="text-xl font-bold text-rose-600 dark:text-rose-400">
											{favorites.length}
										</p>
										<p className="text-[10px] text-muted-foreground font-medium">
											{t.profile.favoritesCount}
										</p>
									</CardContent>
								</Card>
								<Card className="border-border/50 shadow-sm">
									<CardContent className="p-3 text-center">
										<div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
											<Package className="size-5 text-emerald-600 dark:text-emerald-400" />
										</div>
										<p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
											{totalOrders}
										</p>
										<p className="text-[10px] text-muted-foreground font-medium">
											{t.profile.totalOrders}
										</p>
									</CardContent>
								</Card>
								<Card className="border-border/50 shadow-sm">
									<CardContent className="p-3 text-center">
										<div className="size-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
											<ShoppingBag className="size-5 text-teal-600 dark:text-teal-400" />
										</div>
										<p className="text-xl font-bold text-teal-600 dark:text-teal-400">
											{currency}
											{customer.totalSpent.toFixed(0)}
										</p>
										<p className="text-[10px] text-muted-foreground font-medium">
											{t.profile.totalSpent}
										</p>
									</CardContent>
								</Card>
							</div>

							{/* Loyalty Progress */}
							<Card className="border-border/50 shadow-sm">
								<CardContent className="p-4 space-y-3">
									<div className="flex items-center gap-2">
										<Award className="size-4 text-amber-500" />
										<h4 className="text-sm font-semibold">
											{t.profile.loyaltyProgress}
										</h4>
									</div>
									<div className="space-y-2">
										<div className="flex items-center justify-between text-xs">
											<span className="text-muted-foreground">
												{t.profile.nextReward}
											</span>
											<span className="font-medium">
												{Math.max(0, 100 - customer.loyaltyPoints)}{" "}
												{t.profile.pointsToNext}
											</span>
										</div>
										<Progress
											value={Math.min(
												(customer.loyaltyPoints / 100) * 100,
												100,
											)}
											className="h-2"
										/>
										<p className="text-[10px] text-muted-foreground">
											🥗 {t.profile.freeAppetizer} — 100{" "}
											{t.profile.pointsNeeded}
										</p>
									</div>
								</CardContent>
							</Card>

							{/* Recent Orders */}
							{orders.length > 0 && (
								<Card className="border-border/50 shadow-sm">
									<CardContent className="p-4 space-y-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Package className="size-4 text-amber-500" />
												<h4 className="text-sm font-semibold">
													{t.profile.recentOrders}
												</h4>
											</div>
											<Badge variant="secondary" className="text-[10px]">
												{totalOrders}
											</Badge>
										</div>
										<div className="space-y-2 max-h-48 overflow-y-auto">
											{orders.slice(0, 5).map((order) => (
												<div
													key={order.id}
													className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-xs"
												>
													<div className="flex items-center gap-2 min-w-0">
														<span className="font-semibold shrink-0">
															#{order.orderNumber}
														</span>
														<Badge
															className={`text-[8px] px-1.5 py-0 h-4 ${
																order.status === "completed"
																	? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
																	: order.status === "preparing"
																		? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
																		: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
															} border-0`}
														>
															{t.orders.status[
																order.status as keyof typeof t.orders.status
															] || order.status}
														</Badge>
													</div>
													<span className="font-medium shrink-0">
														{currency}
														{order.total.toFixed(2)}
													</span>
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							)}

							{/* Member Since */}
							<div className="text-center">
								<p className="text-xs text-muted-foreground">
									{t.profile.memberSince}{" "}
									{new Date(customer.createdAt).toLocaleDateString(
										locale === "ar" ? "ar-SA" : "en-US",
										{ month: "long", year: "numeric" },
									)}
								</p>
							</div>
						</motion.div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
