"use client";

import React from "react";
import { motion } from "framer-motion";
import { Flame, Plus, Heart, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuItem, MenuCategory, Translations } from "./types";
import type { CartItem } from "@/lib/store";

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

const cardHover = {
	scale: 1.02,
	transition: { type: "spring" as const, stiffness: 300, damping: 20 },
};

const cardTap = {
	scale: 0.98,
};

interface PopularItemsProps {
	popularItems: MenuItem[];
	categories: MenuCategory[];
	loading: boolean;
	locale: string;
	isRTL: boolean;
	t: Translations;
	currency: string;
	addedItemId: string | null;
	favorites: string[];
	onQuickAdd: (item: MenuItem) => void;
	onToggleFavorite: (id: string) => void;
	onNavigate: (section: string) => void;
}

export function PopularItems({
	popularItems,
	categories,
	loading,
	locale,
	isRTL,
	t,
	currency,
	addedItemId,
	favorites,
	onQuickAdd,
	onToggleFavorite,
	onNavigate,
}: PopularItemsProps) {
	const getCategoryForItem = (categoryId: string) => {
		return categories.find((c) => c.id === categoryId);
	};

	return (
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
					onClick={() => onNavigate("menu")}
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
													onToggleFavorite(item.id);
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
															{t.menu[d] || d}
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
															onQuickAdd(item);
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
	);
}

