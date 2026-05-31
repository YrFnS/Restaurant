export type AdminTab =
	| "menu"
	| "inventory"
	| "employees"
	| "schedule"
	| "kds-screens"
	| "tables"
	| "reports"
	| "cash"
	| "reservations"
	| "notifications"
	| "settings";

export interface EmployeeData {
	id: string;
	name: string;
	pin?: string;
	role: string;
	hourlyWage: number;
	isActive: boolean;
	email: string | null;
	phone: string | null;
	clockedIn: boolean;
	lastClockIn: string | null;
	lastClockOut: string | null;
}

export interface IngredientData {
	id: string;
	name: string;
	unit: string;
	quantity: number;
	lowThreshold: number;
	costPerUnit: number;
	supplier: string | null;
	category: string | null;
}

export interface CategoryData {
	id: string;
	nameEn: string;
	nameAr: string;
	icon: string;
	sortOrder: number;
	isAvailable: boolean;
	items: ItemData[];
}

export interface ItemData {
	id: string;
	nameEn: string;
	nameAr: string;
	price: number;
	isAvailable: boolean;
	categoryId: string;
	descriptionEn: string;
	descriptionAr: string;
	preparationTime: number;
	calories: number;
	allergens: string;
	dietary: string;
	image: string;
	isPopular: boolean;
}

export interface CashEntryData {
	id: string;
	type: string;
	amount: number;
	note: string | null;
	createdBy: string | null;
	createdAt: string;
}

export interface NotificationData {
	id: string;
	type: string;
	title: string;
	message: string;
	isRead: boolean;
	createdAt: string;
}

export interface ReservationData {
	id: string;
	customerName: string;
	customerPhone: string;
	partySize: number;
	dateTime: string;
	status: string;
	notes: string | null;
	tableId: string | null;
}

export interface ScheduleData {
	id: string;
	employeeId: string;
	employeeName?: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	role: string;
}

export interface KitchenScreenData {
	id: string;
	name: string;
	slug: string;
	description: string;
	stationFilter: string;
	layoutType: string;
	autoRefreshInterval: number;
	showCompleted: boolean;
	maxOrders: number;
	sortOrder: number;
	isActive: boolean;
	createdAt: string;
}
