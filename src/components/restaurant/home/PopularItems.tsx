"use client";

import React from "react";
import { motion } from "framer-motion";
import { Flame, Plus, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuItem, MenuCategory, Translations } from "./types";

const dietaryColors: Record<string, string> = {
	vegetarian: "bg-[#7a8b6f]/10 text-[#7a8b6f]",
	vegan: "bg-emerald-50 text-emerald-700",
	"gluten-free": "bg-amber-50 text-amber-700",
	halal: "bg-teal-50 text-teal-700",
	spicy: "bg-[#c75b39]/10 text-[#c75b39]",
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

/* ── Unique Unsplash food images per item ── */
const itemImages: Record<string, string> = {
	"Hummus Platter": "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=600&h=400&fit=crop",
	"Falafel Bites": "https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=600&h=400&fit=crop",
	"Stuffed Grape Leaves": "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=600&h=400&fit=crop",
	"Crispy Samosas": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=400&fit=crop",
	"Chicken Wings": "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&h=400&fit=crop",
	"Lentil Soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop",
	"Chicken Soup": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=400&fit=crop",
	"Seafood Chowder": "https://images.unsplash.com/photo-1594756202469-9ff9799b2e4e?w=600&h=400&fit=crop",
	"Mixed Grill Platter": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop",
	"Lamb Kebab": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=400&fit=crop",
	"Chicken Shawarma": "https://images.unsplash.com/photo-1567121938596-3d6802e57f43?w=600&h=400&fit=crop",
	"Beef Burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop",
	"Lamb Chops": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop",
	"Grilled Salmon": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=400&fit=crop",
	"Shrimp Scampi": "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=400&fit=crop",
	"Fish Tacos": "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&h=400&fit=crop",
	"Truffle Mushroom Pasta": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop",
	"Chicken Alfredo": "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&h=400&fit=crop",
	"Spaghetti Bolognese": "https://images.unsplash.com/photo-1622973536968-3ead9e780960?w=600&h=400&fit=crop",
	"Margherita Pizza": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop",
	"Meat Lovers Pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=400&fit=crop",
	"Vegetable Supreme": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&h=400&fit=crop",
	"Caesar Salad": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop",
	"Fattoush": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=400&fit=crop",
	"Tabbouleh": "https://images.unsplash.com/photo-1534483509719-8127d8931b93?w=600&h=400&fit=crop",
	"Baklava": "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&h=400&fit=crop",
	"Kunafa": "https://images.unsplash.com/photo-1579888944880-d98341245702?w=600&h=400&fit=crop",
	"Tiramisu": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&h=400&fit=crop",
	"Chocolate Lava Cake": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&h=400&fit=crop",
	"Fresh Lemonade": "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&h=400&fit=crop",
	"Mint Tea": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=400&fit=crop",
	"Turkish Coffee": "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&h=400&fit=crop",
	"Mango Smoothie": "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=600&h=400&fit=crop",
	"French Fries": "https://images.unsplash.com/photo-1576107232684-1279f390b2d0?w=600&h=400&fit=crop",
	"Rice Pilaf": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop",
	"Garlic Bread": "https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=600&h=400&fit=crop",
	"Grilled Vegetables": "https://images.unsplash.com/photo-1506354666786-959d6d497f1a?w=600&h=400&fit=crop",
};

function getItemImage(item: MenuItem): string {
	return itemImages[item.nameEn] || item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop";
}

function getDietaryBadges(dietary: string) {
	if (!dietary) return [];
	return dietary.split(",").filter(Boolean);
}

export function PopularItems({
	popularItems, categories, loading, locale, isRTL, t,
	currency, addedItemId, favorites, onQuickAdd, onToggleFavorite, onNavigate,
}: PopularItemsProps) {
	const getCategoryForItem = (categoryId: string) => categories.find((c) => c.id === categoryId);

	return (
		<section className="py-8 md:py-12">
			{/* Section header — editorial style */}
			<div className="px-6 md:px-12 mb-8">
				<div className="flex items-end justify-between">
					<div>
						<p className="text-[#c75b39] text-sm font-medium tracking-wide uppercase mb-2">Chef's Selection</p>
						<h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{t.home.popularItems}</h2>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="text-[#c75b39] hover:text-[#c75b39]/80 hover:bg-[#c75b39]/5 gap-1.5 rounded-full"
						onClick={() => onNavigate("menu")}
					>
						{t.home.viewAll}
						<span className={`text-sm ${isRTL ? "rotate-180" : ""}`}>→</span>
					</Button>
				</div>
			</div>

			{/* ── Bento grid — asymmetric editorial layout ── */}
			<div className="px-6 md:px-12">
				{loading ? (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
						{Array.from({ length: 8 }).map((_, i) => (
							<div key={i} className="rounded-2xl overflow-hidden">
								<Skeleton className="h-48 md:h-56" />
								<div className="p-3 space-y-2">
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-3 w-1/2" />
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
						{popularItems.slice(0, 8).map((item, itemIdx) => {
							const cat = getCategoryForItem(item.categoryId);
							const dietaryList = getDietaryBadges(item.dietary);
							const isAdded = addedItemId === item.id;
							const isFav = favorites.includes(item.id);
							const isLarge = itemIdx === 0 || itemIdx === 5;

							return (
								<motion.div
									key={item.id}
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: itemIdx * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
									className={isLarge ? "col-span-2 row-span-1" : ""}
								>
									<Card className="group overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 h-full flex flex-col rounded-2xl bg-card">
										{/* Food image — large, editorial */}
										<div className={`relative overflow-hidden ${isLarge ? "h-56 md:h-72" : "h-44 md:h-52"}`}>
											<img
												src={getItemImage(item)}
												alt={locale === "ar" ? item.nameAr : item.nameEn}
												className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
											/>
											{/* Gradient overlay */}
											<div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

											{/* Badges */}
											<div className="absolute top-3 left-3 flex gap-1.5">
												{item.isSpecial && (
													<Badge className="bg-white/90 text-[#c75b39] border-0 text-[10px] font-semibold gap-1 rounded-full px-2.5 py-1">
														<Sparkles className="size-3" />
														{t.menu.new}
													</Badge>
												)}
												{item.isPopular && !item.isSpecial && (
													<Badge className="bg-white/90 text-[#c75b39] border-0 text-[10px] font-semibold gap-1 rounded-full px-2.5 py-1">
														<Flame className="size-3" />
														{t.menu.popular}
													</Badge>
												)}
											</div>

											{/* Favorite */}
											<button
												onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
												className="absolute top-3 right-3 size-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-black/50"
												aria-label={isFav ? t.menu.removedFromFavorites : t.menu.addedToFavorites}
											>
												<Heart className={`size-4 transition-all ${isFav ? "text-red-400 fill-red-400" : "text-white/80"}`} />
											</button>

											{/* Calorie badge */}
											{item.calories > 0 && (
												<Badge className="absolute bottom-3 left-3 bg-black/40 text-white border-0 text-[10px] backdrop-blur-sm rounded-full px-2 py-0.5">
													{item.calories} cal
												</Badge>
											)}

											{/* Category icon */}
											{cat && (
												<div className="absolute bottom-3 right-3 size-8 rounded-full bg-white/90 flex items-center justify-center text-sm shadow-sm">
													{cat.icon}
												</div>
											)}
										</div>

										{/* Content */}
										<CardContent className="p-4 flex flex-col flex-1">
											<h3 className="font-semibold text-sm md:text-base leading-tight mb-1 group-hover:text-[#c75b39] transition-colors">
												{locale === "ar" ? item.nameAr : item.nameEn}
											</h3>
											<p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
												{locale === "ar" ? item.descriptionAr : item.descriptionEn}
											</p>

											{/* Dietary badges */}
											{dietaryList.length > 0 && (
												<div className="flex flex-wrap gap-1 mb-3">
													{dietaryList.slice(0, 2).map((d) => (
														<span key={d} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${dietaryColors[d] || "bg-muted text-muted-foreground"}`}>
															{t.menu[d] || d}
														</span>
													))}
												</div>
											)}

											{/* Price & Add */}
											<div className="mt-auto flex items-center justify-between gap-2">
												<span className="font-bold text-lg text-foreground">
													{currency}{item.price.toFixed(2)}
												</span>
												<Button
													size="sm"
													variant={isAdded ? "default" : "outline"}
													className={`h-9 w-9 p-0 rounded-full transition-all ${isAdded ? "bg-[#c75b39] hover:bg-[#c75b39]/90 text-white" : "border-[#c75b39]/30 text-[#c75b39] hover:bg-[#c75b39]/5"}`}
													onClick={(e) => { e.stopPropagation(); onQuickAdd(item); }}
												>
													<Plus className="size-4" />
												</Button>
											</div>
										</CardContent>
									</Card>
								</motion.div>
							);
						})}
					</div>
				)}
			</div>
		</section>
	);
}
