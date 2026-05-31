"use client";

import React from "react";
import { motion } from "framer-motion";
import {
	Search,
	X,
	UtensilsCrossed,
	Heart,
	AlertTriangle,
	QrCode,
	ArrowUpDown,
	FilterX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	dietaryFilterConfig,
	allergenFilterConfig,
	type SortOption,
} from "./constants";
import type { MenuCategory } from "./types";

interface MenuFiltersProps {
	t: Record<string, any>;
	locale: string;
	categories: MenuCategory[];
	activeCategoryId: string | null;
	localSearch: string;
	sortOption: SortOption;
	activeDietary: string[];
	allergenExclusions: string[];
	showFavoritesOnly: boolean;
	favoritesCount: number;
	totalFilteredItems: number;
	hasActiveFilters: boolean;
	recentSearches: string[];
	searchFocused: boolean;
	onCategoryClick: (categoryId: string | null) => void;
	onSearchChange: (value: string) => void;
	onSearchFocus: () => void;
	onSearchBlur: () => void;
	onSortChange: (value: SortOption) => void;
	onDietaryToggle: (key: string) => void;
	onAllergenToggle: (key: string) => void;
	onToggleFavorites: () => void;
	onClearFilters: () => void;
	onClearRecentSearches: () => void;
	onRemoveRecentSearch: (query: string) => void;
	onQrCodeOpen: () => void;
}

export function MenuFilters({
	t,
	locale,
	categories,
	activeCategoryId,
	localSearch,
	sortOption,
	activeDietary,
	allergenExclusions,
	showFavoritesOnly,
	favoritesCount,
	totalFilteredItems,
	hasActiveFilters,
	recentSearches,
	searchFocused,
	onCategoryClick,
	onSearchChange,
	onSearchFocus,
	onSearchBlur,
	onSortChange,
	onDietaryToggle,
	onAllergenToggle,
	onToggleFavorites,
	onClearFilters,
	onClearRecentSearches,
	onRemoveRecentSearch,
	onQrCodeOpen,
}: MenuFiltersProps) {
	return (
		<>
			{/* ─── Category Tabs ─── */}
			<div className="sticky top-14 md:top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
				<div className="bg-gradient-to-r from-amber-50/50 via-orange-50/30 to-rose-50/50 dark:from-amber-950/20 dark:via-orange-950/10 dark:to-rose-950/20">
					<div
						className="flex gap-1 overflow-x-auto custom-scrollbar px-4 py-2.5 scroll-smooth"
						style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
					>
						{/* "All" tab */}
						<button
							onClick={() => onCategoryClick(null)}
							className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
								!activeCategoryId
									? "bg-primary text-primary-foreground shadow-sm"
									: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
							}`}
							aria-current={!activeCategoryId ? "true" : undefined}
						>
							<UtensilsCrossed className="size-3.5" />
							{t.menu.all}
							<span
								className={`text-xs ${!activeCategoryId ? "text-primary-foreground/80" : "text-muted-foreground"}`}
							>
								{categories.reduce((sum, c) => sum + c.items.length, 0)}
							</span>
						</button>

						{/* Favorites tab */}
						<button
							onClick={onToggleFavorites}
							className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
								showFavoritesOnly
									? "bg-red-500 text-white shadow-sm"
									: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
							}`}
							aria-pressed={showFavoritesOnly}
						>
							<Heart
								className={`size-3.5 ${showFavoritesOnly ? "fill-white" : ""}`}
							/>
							{t.menu.favorites}
							{favoritesCount > 0 && (
								<span
									className={`text-xs ${showFavoritesOnly ? "text-white/80" : "text-muted-foreground"}`}
								>
									({favoritesCount})
								</span>
							)}
						</button>

						{categories.map((cat) => (
							<button
								key={cat.id}
								onClick={() => onCategoryClick(cat.id)}
								className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
									activeCategoryId === cat.id
										? "bg-primary text-primary-foreground shadow-sm"
										: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
								}`}
								aria-current={activeCategoryId === cat.id ? "true" : undefined}
							>
								<span className="text-base">{cat.icon}</span>
								{locale === "ar" ? cat.nameAr : cat.nameEn}
								<span
									className={`text-xs ${activeCategoryId === cat.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}
								>
									{cat.items.length}
								</span>
							</button>
						))}
					</div>
				</div>
			</div>

			{/* ─── Search Bar, QR Share & Sort ─── */}
			<div className="px-4 flex gap-2">
				<Button
					variant="outline"
					size="icon"
					className="size-10 shrink-0 bg-muted/30 border-0"
					onClick={onQrCodeOpen}
					aria-label={t.menu.shareMenu}
				>
					<QrCode className="size-4" />
				</Button>
				<div className="relative flex-1">
					<Search className="absolute start-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
					<Input
						value={localSearch}
						onChange={(e) => onSearchChange(e.target.value)}
						onFocus={onSearchFocus}
						onBlur={onSearchBlur}
						placeholder={t.menu.search}
						className="ps-11 pe-9 h-12 bg-background rounded-xl shadow-sm border border-border/50 focus-visible:ring-2 focus-visible:ring-primary text-base"
						aria-label={t.menu.search}
					/>
					{localSearch && (
						<button
							onClick={() => onSearchChange("")}
							className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							aria-label={t.common.cancel}
						>
							<X className="size-4" />
						</button>
					)}
					{/* Recent Searches Dropdown */}
					{searchFocused && !localSearch && recentSearches.length > 0 && (
						<div className="absolute top-full start-0 end-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
							<div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
								<span className="text-xs font-semibold text-muted-foreground">
									{t.menu.recentSearches}
								</span>
								<button
									onClick={onClearRecentSearches}
									className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
								>
									{t.menu.clearRecentSearches}
								</button>
							</div>
							<div className="max-h-40 overflow-y-auto">
								{recentSearches.map((search, idx) => (
									<div
										key={idx}
										className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
										onClick={() => onSearchChange(search)}
									>
										<div className="flex items-center gap-2 min-w-0">
											<Search className="size-3 text-muted-foreground shrink-0" />
											<span className="text-sm truncate">{search}</span>
										</div>
										<button
											onClick={(e) => {
												e.stopPropagation();
												onRemoveRecentSearch(search);
											}}
											className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
											aria-label={t.common.cancel}
										>
											<X className="size-3" />
										</button>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
				<Select
					value={sortOption}
					onValueChange={(v) => onSortChange(v as SortOption)}
				>
					<SelectTrigger className="w-auto min-w-[120px] h-12 bg-background rounded-xl shadow-sm border border-border/50">
						<ArrowUpDown className="size-3.5 me-1" />
						<SelectValue placeholder={t.menu.sortBy} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="default">{t.menu.sortBy}</SelectItem>
						<SelectItem value="price-low">{t.menu.sortPriceLow}</SelectItem>
						<SelectItem value="price-high">{t.menu.sortPriceHigh}</SelectItem>
						<SelectItem value="popular">{t.menu.sortPopular}</SelectItem>
						<SelectItem value="prep-time">{t.menu.sortPrepTime}</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* ─── Dietary Filters ─── */}
			<div
				className="flex gap-2 overflow-x-auto px-4 pb-1"
				style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
			>
				{dietaryFilterConfig.map((filter) => {
					const isActive = activeDietary.includes(filter.key);
					const Icon = filter.icon;

					return (
						<motion.button
							key={filter.key}
							whileTap={{ scale: 0.95 }}
							whileHover={{ scale: 1.05 }}
							onClick={() => onDietaryToggle(filter.key)}
							className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
								isActive
									? `${filter.activeColor} border-transparent shadow-sm`
									: `${filter.color} border-transparent hover:shadow-sm hover:scale-105`
							}`}
							aria-pressed={isActive}
						>
							<Icon className="size-3" />
							{t.menu[filter.key as keyof typeof t.menu] || filter.key}
						</motion.button>
					);
				})}
			</div>

			{/* ─── Allergen Exclusion Filters ─── */}
			<div className="px-4 space-y-2">
				<div className="flex items-center gap-2">
					<AlertTriangle className="size-3.5 text-orange-500" />
					<h3 className="text-xs font-semibold text-muted-foreground">
						{t.menu.allergenFilterTitle}
					</h3>
					<span className="text-[10px] text-muted-foreground">
						— {t.menu.allergenFilterDesc}
					</span>
				</div>
				<div
					className="flex gap-2 overflow-x-auto pb-1"
					style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
				>
					{allergenFilterConfig.map((filter) => {
						const isActive = allergenExclusions.includes(filter.key);
						return (
							<motion.button
								key={filter.key}
								whileTap={{ scale: 0.95 }}
								onClick={() => onAllergenToggle(filter.key)}
								className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
									isActive
										? `${filter.activeColor} border-transparent`
										: `${filter.color} border-transparent`
								}`}
								aria-pressed={isActive}
							>
								<span className="text-sm">{filter.emoji}</span>
								{t.menu[
									`allergen${filter.key.charAt(0).toUpperCase() + filter.key.slice(1)}` as keyof typeof t.menu
								] || filter.key}
							</motion.button>
						);
					})}
				</div>
				{/* Allergen filter active warning banner */}
				{allergenExclusions.length > 0 && (
					<div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
						<AlertTriangle className="size-3.5 text-orange-500 shrink-0" />
						<p className="text-xs text-orange-700 dark:text-orange-400">
							{t.menu.allergenFilterActive}
						</p>
					</div>
				)}
			</div>

			{/* ─── Results Count ─── */}
			<div className="px-4 flex items-center justify-between">
				<p className="text-xs text-muted-foreground">
					{t.menu.showing}{" "}
					<span className="font-semibold text-foreground">
						{totalFilteredItems}
					</span>{" "}
					{t.menu.items}
				</p>
				{hasActiveFilters && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-xs gap-1 text-muted-foreground"
						onClick={onClearFilters}
					>
						<FilterX className="size-3" />
						{t.menu.clearFilters}
					</Button>
				)}
			</div>
		</>
	);
}
