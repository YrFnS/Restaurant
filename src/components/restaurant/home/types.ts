import type { RestaurantSettings } from "@/lib/store";

export type { RestaurantSettings };

export interface Translations {
	app: {
		name: string;
	};
	home: {
		subtitle: string;
		orderNow: string;
		viewMenu: string;
		reserveTable: string;
		openNow: string;
		closed: string;
		categories: string;
		viewAll: string;
		todaysSpecials: string;
		popularItems: string;
		noSpecials: string;
		checkBackLater: string;
		statsTitle: string;
		statsOrders: string;
		statsMenuItems: string;
		statsHappyCustomers: string;
		statsYears: string;
		chefsRecommendation: string;
		chefsRecommendationDesc: string;
		recentOrders: string;
		viewAllOrders: string;
		orderPlacedAgo: string;
		hour: string;
		day: string;
		justNow: string;
		howItWorks: string;
		step1: string;
		step1Desc: string;
		step2: string;
		step2Desc: string;
		step3: string;
		step3Desc: string;
		deliveryTime: string;
		freeDelivery: string;
		restaurantHours: string;
		openUntil: string;
		closedUntil: string;
		happyHour: string;
		testimonials: string;
		verifiedGuest: string;
		joinWaitlist: string;
	};
	nav: {
		rewards: string;
	};
	menu: {
		new: string;
		popular: string;
		calories: string;
		addToCart: string;
		addedToFavorites: string;
		removedFromFavorites: string;
		[key: string]: string;
	};
	common: {
		minute: string;
	};
	cart: {
		deliveryFee: string;
	};
	orders: {
		status: Record<string, string>;
		items: string;
	};
}

export interface MenuItemModifier {
	id: string;
	nameEn: string;
	nameAr: string;
	type: string;
	price: number;
}

export interface MenuItem {
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

export interface MenuCategory {
	id: string;
	nameEn: string;
	nameAr: string;
	icon: string;
	sortOrder: number;
	isAvailable: boolean;
	items: MenuItem[];
}

export interface SpecialOffer {
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

export interface Testimonial {
	id: string;
	nameEn: string;
	nameAr: string;
	commentEn: string;
	commentAr: string;
	avatar: string;
	stars: number;
	sortOrder: number;
}


