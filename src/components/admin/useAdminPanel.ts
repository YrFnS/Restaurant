import { useState, useEffect, useCallback } from "react";
import { useRestaurantStore } from "@/lib/store";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import type {
	CategoryData,
	IngredientData,
	EmployeeData,
	ScheduleData,
	CashEntryData,
	NotificationData,
	ReservationData,
	KitchenScreenData,
	ItemData,
} from "@/components/admin/types";

export interface AdminPanelState {
	// Data
	categories: CategoryData[];
	ingredients: IngredientData[];
	employees: EmployeeData[];
	schedules: ScheduleData[];
	cashEntries: CashEntryData[];
	notifications: NotificationData[];
	reservations: ReservationData[];
	kitchenScreens: KitchenScreenData[];
	loading: boolean;
	reportStats: { revenue: number; ordersToday: number; avgValue: number };

	// Dialog open states
	menuItemDialogOpen: boolean;
	ingredientDialogOpen: boolean;
	employeeDialogOpen: boolean;
	cashDialogOpen: boolean;
	reservationDialogOpen: boolean;
	scheduleDialogOpen: boolean;
	kdsDialogOpen: boolean;

	// Editing IDs
	editingMenuId: string | null;
	editingIngredientId: string | null;
	editingEmployeeId: string | null;
	editingKdsId: string | null;

	// Form states
	menuForm: {
		nameEn: string;
		nameAr: string;
		price: string;
		categoryId: string;
		descriptionEn: string;
		isAvailable: boolean;
		preparationTime: string;
		imageUrl: string;
	};
	ingredientForm: {
		name: string;
		unit: string;
		quantity: string;
		lowThreshold: string;
		costPerUnit: string;
		supplier: string;
		category: string;
	};
	employeeForm: {
		name: string;
		pin: string;
		role: string;
		hourlyWage: string;
		isActive: boolean;
		email: string;
		phone: string;
	};
	cashForm: { type: string; amount: string; note: string };
	reservationForm: {
		customerName: string;
		customerPhone: string;
		partySize: string;
		dateTime: string;
		notes: string;
		status: string;
	};
	scheduleForm: {
		employeeId: string;
		dayOfWeek: string;
		startTime: string;
		endTime: string;
		role: string;
	};
	kdsForm: {
		name: string;
		slug: string;
		description: string;
		stationFilter: string;
		layoutType: string;
		autoRefreshInterval: string;
		showCompleted: boolean;
		maxOrders: string;
		sortOrder: string;
		isActive: boolean;
	};

	// Search
	menuSearch: string;

	// Settings
	settingsForm: {
		nameEn: string;
		nameAr: string;
		taglineEn: string;
		taglineAr: string;
		descriptionEn: string;
		descriptionAr: string;
		phone: string;
		email: string;
		addressEn: string;
		addressAr: string;
		logoUrl: string;
		heroImageUrl: string;
		facebookUrl: string;
		instagramUrl: string;
		twitterUrl: string;
		taxRate: string;
		tipPresets: string;
		deliveryFee: string;
		minDeliveryOrder: string;
		deliveryRadius: string;
		avgPrepTime: string;
		currencySymbol: string;
		openTime: string;
		closeTime: string;
		statsOrdersServed: string;
		statsHappyCustomers: string;
		statsYearsService: string;
	};
	settingsLoaded: boolean;
	savingSettings: boolean;

	// Computed
	allItems: ItemData[];
	filteredItems: ItemData[];
	currentBalance: number;
	unreadCount: number;

	// i18n labels
	roleLabels: Record<string, string>;
	statusLabels: Record<string, string>;
	cashTypeLabels: Record<string, string>;
	DAY_NAMES: string[];
	currencySym: string;

	// Setters
	setMenuItemDialogOpen: (v: boolean) => void;
	setIngredientDialogOpen: (v: boolean) => void;
	setEmployeeDialogOpen: (v: boolean) => void;
	setCashDialogOpen: (v: boolean) => void;
	setReservationDialogOpen: (v: boolean) => void;
	setScheduleDialogOpen: (v: boolean) => void;
	setKdsDialogOpen: (v: boolean) => void;
	setEditingMenuId: (v: string | null) => void;
	setEditingIngredientId: (v: string | null) => void;
	setEditingEmployeeId: (v: string | null) => void;
	setEditingKdsId: (v: string | null) => void;
	setMenuForm: React.Dispatch<React.SetStateAction<AdminPanelState["menuForm"]>>;
	setIngredientForm: React.Dispatch<React.SetStateAction<AdminPanelState["ingredientForm"]>>;
	setEmployeeForm: React.Dispatch<React.SetStateAction<AdminPanelState["employeeForm"]>>;
	setCashForm: React.Dispatch<React.SetStateAction<AdminPanelState["cashForm"]>>;
	setReservationForm: React.Dispatch<React.SetStateAction<AdminPanelState["reservationForm"]>>;
	setScheduleForm: React.Dispatch<React.SetStateAction<AdminPanelState["scheduleForm"]>>;
	setKdsForm: React.Dispatch<React.SetStateAction<AdminPanelState["kdsForm"]>>;
	setMenuSearch: (v: string) => void;
	setSettingsForm: React.Dispatch<React.SetStateAction<AdminPanelState["settingsForm"]>>;

	// Handlers
	handleSaveMenuItem: () => Promise<void>;
	handleDeleteMenuItem: (id: string) => Promise<void>;
	handleToggleAvailability: (item: ItemData) => Promise<void>;
	handleSaveIngredient: () => Promise<void>;
	handleDeleteIngredient: (id: string) => Promise<void>;
	handleSaveEmployee: () => Promise<void>;
	handleDeleteEmployee: (id: string) => Promise<void>;
	handleSaveCash: () => Promise<void>;
	handleSaveReservation: () => Promise<void>;
	handleUpdateReservationStatus: (id: string, status: string) => Promise<void>;
	handleSaveSchedule: () => Promise<void>;
	handleMarkAllRead: () => Promise<void>;
	fetchSettings: () => Promise<void>;
	handleSaveSettings: () => Promise<void>;
	handleSaveKds: () => Promise<void>;
	handleDeleteKds: (id: string) => Promise<void>;
}

export function useAdminPanel(): AdminPanelState {
	const { t, locale } = useI18n();
	const storeFetchSettings = useRestaurantStore((s) => s.fetchSettings);

	// Data state
	const [categories, setCategories] = useState<CategoryData[]>([]);
	const [ingredients, setIngredients] = useState<IngredientData[]>([]);
	const [employees, setEmployees] = useState<EmployeeData[]>([]);
	const [schedules, setSchedules] = useState<ScheduleData[]>([]);
	const [cashEntries, setCashEntries] = useState<CashEntryData[]>([]);
	const [notifications, setNotifications] = useState<NotificationData[]>([]);
	const [reservations, setReservations] = useState<ReservationData[]>([]);
	const [kitchenScreens, setKitchenScreens] = useState<KitchenScreenData[]>([]);
	const [loading, setLoading] = useState(true);
	const [reportStats, setReportStats] = useState({
		revenue: 0,
		ordersToday: 0,
		avgValue: 0,
	});

	// Dialog states
	const [menuItemDialogOpen, setMenuItemDialogOpen] = useState(false);
	const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);
	const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
	const [cashDialogOpen, setCashDialogOpen] = useState(false);
	const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
	const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
	const [kdsDialogOpen, setKdsDialogOpen] = useState(false);

	// Editing IDs
	const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
	const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
	const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
	const [editingKdsId, setEditingKdsId] = useState<string | null>(null);

	// Form states
	const [menuForm, setMenuForm] = useState({
		nameEn: "",
		nameAr: "",
		price: "",
		categoryId: "",
		descriptionEn: "",
		isAvailable: true,
		preparationTime: "0",
		imageUrl: "",
	});
	const [ingredientForm, setIngredientForm] = useState({
		name: "",
		unit: "pcs",
		quantity: "0",
		lowThreshold: "10",
		costPerUnit: "0",
		supplier: "",
		category: "",
	});
	const [employeeForm, setEmployeeForm] = useState({
		name: "",
		pin: "",
		role: "staff",
		hourlyWage: "15",
		isActive: true,
		email: "",
		phone: "",
	});
	const [cashForm, setCashForm] = useState({ type: "payin", amount: "", note: "" });
	const [reservationForm, setReservationForm] = useState({
		customerName: "",
		customerPhone: "",
		partySize: "2",
		dateTime: "",
		notes: "",
		status: "confirmed",
	});
	const [scheduleForm, setScheduleForm] = useState({
		employeeId: "",
		dayOfWeek: "1",
		startTime: "09:00",
		endTime: "17:00",
		role: "Server",
	});
	const [kdsForm, setKdsForm] = useState({
		name: "",
		slug: "",
		description: "",
		stationFilter: "",
		layoutType: "grid",
		autoRefreshInterval: "10",
		showCompleted: false,
		maxOrders: "0",
		sortOrder: "0",
		isActive: true,
	});

	// Search
	const [menuSearch, setMenuSearch] = useState("");

	// Settings form state
	const [settingsForm, setSettingsForm] = useState({
		nameEn: "",
		nameAr: "",
		taglineEn: "",
		taglineAr: "",
		descriptionEn: "",
		descriptionAr: "",
		phone: "",
		email: "",
		addressEn: "",
		addressAr: "",
		logoUrl: "",
		heroImageUrl: "",
		facebookUrl: "",
		instagramUrl: "",
		twitterUrl: "",
		taxRate: "",
		tipPresets: "",
		deliveryFee: "",
		minDeliveryOrder: "",
		deliveryRadius: "",
		avgPrepTime: "",
		currencySymbol: "",
		openTime: "",
		closeTime: "",
		statsOrdersServed: "",
		statsHappyCustomers: "",
		statsYearsService: "",
	});
	const [settingsLoaded, setSettingsLoaded] = useState(false);
	const [savingSettings, setSavingSettings] = useState(false);

	// Currency symbol from store
	const storeSettings = useRestaurantStore((s) => s.settings);
	const currencySym = storeSettings?.currencySymbol ?? "";

	// i18n labels
	const DAY_NAMES = [
		t.admin.daySun,
		t.admin.dayMon,
		t.admin.dayTue,
		t.admin.dayWed,
		t.admin.dayThu,
		t.admin.dayFri,
		t.admin.daySat,
	];
	const roleLabels: Record<string, string> = {
		admin: t.admin.roleAdmin,
		manager: t.admin.roleManager,
		staff: t.admin.roleStaff,
		Server: t.admin.roleServer,
		Cook: t.admin.roleCook,
		Bartender: t.admin.roleBartender,
		Host: t.admin.roleHost,
		Manager: t.admin.roleManager,
	};
	const statusLabels: Record<string, string> = {
		confirmed: t.admin.confirmed,
		seated: t.admin.seated,
		completed: t.admin.completed,
		cancelled: t.admin.cancelled,
		no_show: t.admin.noShow,
	};
	const cashTypeLabels: Record<string, string> = {
		payin: t.admin.payIn,
		payout: t.admin.payOut,
		drop: t.admin.drop,
		sale: t.admin.completed,
	};

	// Fetch all data
	const fetchData = useCallback(async () => {
		try {
			const [menuRes, invRes, empRes, cashRes, notifRes, resRes, schedRes, kdsRes] =
				await Promise.all([
					fetch("/api/menu"),
					fetch("/api/inventory"),
					fetch("/api/employees"),
					fetch("/api/cash"),
					fetch("/api/notifications"),
					fetch("/api/reservations"),
					fetch("/api/schedules"),
					fetch("/api/kitchen-screens"),
				]);
			if (menuRes.ok) {
				const d = await menuRes.json();
				setCategories(d.categories || []);
			}
			if (invRes.ok) {
				const d = await invRes.json();
				setIngredients(d.ingredients || d || []);
			}
			if (empRes.ok) {
				const d = await empRes.json();
				setEmployees(d.employees || d || []);
			}
			if (cashRes.ok) {
				const d = await cashRes.json();
				setCashEntries(d.entries || d || []);
			}
			if (notifRes.ok) {
				const d = await notifRes.json();
				setNotifications(d.notifications || d || []);
			}
			if (resRes.ok) {
				const d = await resRes.json();
				setReservations(d.reservations || d || []);
			}
			if (schedRes.ok) {
				const d = await schedRes.json();
				setSchedules(d.schedules || d || []);
			}
			if (kdsRes.ok) {
				const d = await kdsRes.json();
				setKitchenScreens(d.screens || []);
			}
		} catch (e) {
			console.error("Failed to fetch data:", e);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		let mounted = true;
		const load = async () => {
			await fetchData();
			if (mounted) setLoading(false);
		};
		load();
		return () => {
			mounted = false;
		};
	}, []);

	// ============ MENU HANDLERS ============
	const handleSaveMenuItem = async () => {
		const payload = {
			nameEn: menuForm.nameEn,
			nameAr: menuForm.nameAr || menuForm.nameEn,
			price: parseFloat(menuForm.price) || 0,
			categoryId: menuForm.categoryId,
			descriptionEn: menuForm.descriptionEn,
			isAvailable: menuForm.isAvailable,
			preparationTime: parseInt(menuForm.preparationTime) || 0,
			image: menuForm.imageUrl || "",
		};
		try {
			if (editingMenuId) {
				await fetch(`/api/menu/${editingMenuId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
			} else {
				await fetch("/api/menu", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
			}
			setMenuItemDialogOpen(false);
			setEditingMenuId(null);
			setMenuForm({
				nameEn: "",
				nameAr: "",
				price: "",
				categoryId: "",
				descriptionEn: "",
				isAvailable: true,
				preparationTime: "0",
				imageUrl: "",
			});
			toast.success(editingMenuId ? t.admin.itemUpdated : t.admin.itemCreated);
			fetchData();
		} catch {
			toast.error(t.admin.failedSave);
		}
	};

	const handleDeleteMenuItem = async (id: string) => {
		if (!confirm(t.admin.deleteConfirm)) return;
		await fetch(`/api/menu/${id}`, { method: "DELETE" });
		toast.success(t.admin.itemDeleted);
		fetchData();
	};

	const handleToggleAvailability = async (item: ItemData) => {
		await fetch(`/api/menu/${item.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ isAvailable: !item.isAvailable }),
		});
		fetchData();
	};

	// ============ INGREDIENT HANDLERS ============
	const handleSaveIngredient = async () => {
		const payload = {
			name: ingredientForm.name,
			unit: ingredientForm.unit,
			quantity: parseFloat(ingredientForm.quantity) || 0,
			lowThreshold: parseFloat(ingredientForm.lowThreshold) || 10,
			costPerUnit: parseFloat(ingredientForm.costPerUnit) || 0,
			supplier: ingredientForm.supplier || null,
			category: ingredientForm.category || null,
		};
		try {
			if (editingIngredientId) {
				await fetch(`/api/inventory/${editingIngredientId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
			} else {
				await fetch("/api/inventory", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
			}
			setIngredientDialogOpen(false);
			setEditingIngredientId(null);
			setIngredientForm({
				name: "",
				unit: "pcs",
				quantity: "0",
				lowThreshold: "10",
				costPerUnit: "0",
				supplier: "",
				category: "",
			});
			toast.success(
				editingIngredientId ? t.admin.ingredientUpdated : t.admin.ingredientCreated,
			);
			fetchData();
		} catch {
			toast.error(t.admin.failedSave);
		}
	};

	const handleDeleteIngredient = async (id: string) => {
		if (!confirm(t.admin.deleteIngredientConfirm)) return;
		await fetch(`/api/inventory/${id}`, { method: "DELETE" });
		toast.success(t.admin.ingredientDeleted);
		fetchData();
	};

	// ============ EMPLOYEE HANDLERS ============
	const handleSaveEmployee = async () => {
		const payload: Record<string, unknown> = {
			name: employeeForm.name,
			role: employeeForm.role,
			hourlyWage: parseFloat(employeeForm.hourlyWage) || 15,
			isActive: employeeForm.isActive,
			email: employeeForm.email || null,
			phone: employeeForm.phone || null,
		};
		if (employeeForm.pin) {
			payload.pin = employeeForm.pin;
		}
		try {
			if (editingEmployeeId) {
				await fetch(`/api/employees/${editingEmployeeId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
			} else {
				await fetch("/api/employees", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
			}
			setEmployeeDialogOpen(false);
			setEditingEmployeeId(null);
			setEmployeeForm({
				name: "",
				pin: "",
				role: "staff",
				hourlyWage: "15",
				isActive: true,
				email: "",
				phone: "",
			});
			toast.success(
				editingEmployeeId ? t.admin.employeeUpdated : t.admin.employeeCreated,
			);
			fetchData();
		} catch {
			toast.error(t.admin.failedSave);
		}
	};

	const handleDeleteEmployee = async (id: string) => {
		if (!confirm(t.admin.deleteEmployeeConfirm)) return;
		await fetch(`/api/employees/${id}`, { method: "DELETE" });
		toast.success(t.admin.employeeDeleted);
		fetchData();
	};

	// ============ CASH HANDLERS ============
	const handleSaveCash = async () => {
		await fetch("/api/cash", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: cashForm.type,
				amount: parseFloat(cashForm.amount) || 0,
				note: cashForm.note || null,
			}),
		});
		setCashDialogOpen(false);
		setCashForm({ type: "payin", amount: "", note: "" });
		toast.success(t.admin.entryAdded);
		fetchData();
	};

	// ============ RESERVATION HANDLERS ============
	const handleSaveReservation = async () => {
		const payload = {
			customerName: reservationForm.customerName,
			customerPhone: reservationForm.customerPhone,
			partySize: parseInt(reservationForm.partySize) || 2,
			dateTime: reservationForm.dateTime,
			notes: reservationForm.notes || null,
			status: reservationForm.status,
		};
		await fetch("/api/reservations", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		setReservationDialogOpen(false);
		setReservationForm({
			customerName: "",
			customerPhone: "",
			partySize: "2",
			dateTime: "",
			notes: "",
			status: "confirmed",
		});
		toast.success(t.admin.reservationCreated);
		fetchData();
	};

	const handleUpdateReservationStatus = async (id: string, status: string) => {
		await fetch(`/api/reservations/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status }),
		});
		toast.success(t.admin.statusUpdated);
		fetchData();
	};

	// ============ SCHEDULE HANDLERS ============
	const handleSaveSchedule = async () => {
		const payload = {
			employeeId: scheduleForm.employeeId,
			dayOfWeek: parseInt(scheduleForm.dayOfWeek),
			startTime: scheduleForm.startTime,
			endTime: scheduleForm.endTime,
			role: scheduleForm.role,
		};
		await fetch("/api/schedules", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		setScheduleDialogOpen(false);
		setScheduleForm({
			employeeId: "",
			dayOfWeek: "1",
			startTime: "09:00",
			endTime: "17:00",
			role: "Server",
		});
		toast.success(t.admin.scheduleCreated);
		fetchData();
	};

	// ============ NOTIFICATION HANDLERS ============
	const handleMarkAllRead = async () => {
		await fetch("/api/notifications", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ markAll: true }),
		});
		fetchData();
	};

	// ============ SETTINGS HANDLERS ============
	const fetchSettings = useCallback(async () => {
		try {
			const res = await fetch("/api/settings");
			if (res.ok) {
				const d = await res.json();
				if (d.settings) {
					const s = d.settings;
					setSettingsForm({
						nameEn: s.nameEn || "",
						nameAr: s.nameAr || "",
						taglineEn: s.taglineEn || "",
						taglineAr: s.taglineAr || "",
						descriptionEn: s.descriptionEn || "",
						descriptionAr: s.descriptionAr || "",
						phone: s.phone || "",
						email: s.email || "",
						addressEn: s.addressEn || "",
						addressAr: s.addressAr || "",
						logoUrl: s.logoUrl || "",
						heroImageUrl: s.heroImageUrl || "",
						facebookUrl: s.facebookUrl || "",
						instagramUrl: s.instagramUrl || "",
						twitterUrl: s.twitterUrl || "",
						taxRate: s.taxRate != null ? String(Math.round(s.taxRate * 100)) : "",
						tipPresets: s.tipPresets || "",
						deliveryFee:
							s.deliveryFee != null
								? String(parseFloat(String(s.deliveryFee)).toFixed(2))
								: "",
						minDeliveryOrder:
							s.minDeliveryOrder != null
								? String(parseFloat(String(s.minDeliveryOrder)).toFixed(2))
								: "",
						deliveryRadius:
							s.deliveryRadius != null ? String(Math.round(s.deliveryRadius)) : "",
						avgPrepTime: s.avgPrepTime != null ? String(s.avgPrepTime) : "",
						currencySymbol: s.currencySymbol || "",
						openTime: s.openTime || "",
						closeTime: s.closeTime || "",
						statsOrdersServed:
							s.statsOrdersServed != null ? String(s.statsOrdersServed) : "",
						statsHappyCustomers:
							s.statsHappyCustomers != null ? String(s.statsHappyCustomers) : "",
						statsYearsService:
							s.statsYearsService != null ? String(s.statsYearsService) : "",
					});
					setSettingsLoaded(true);
				}
			}
		} catch (e) {
			console.error("Failed to fetch settings:", e);
		}
	}, []);

	const handleSaveSettings = async () => {
		setSavingSettings(true);
		try {
			const payload = {
				nameEn: settingsForm.nameEn,
				nameAr: settingsForm.nameAr,
				taglineEn: settingsForm.taglineEn,
				taglineAr: settingsForm.taglineAr,
				descriptionEn: settingsForm.descriptionEn,
				descriptionAr: settingsForm.descriptionAr,
				phone: settingsForm.phone,
				email: settingsForm.email,
				addressEn: settingsForm.addressEn,
				addressAr: settingsForm.addressAr,
				logoUrl: settingsForm.logoUrl,
				heroImageUrl: settingsForm.heroImageUrl,
				facebookUrl: settingsForm.facebookUrl,
				instagramUrl: settingsForm.instagramUrl,
				twitterUrl: settingsForm.twitterUrl,
				taxRate: (parseFloat(settingsForm.taxRate) || 0) / 100,
				tipPresets: settingsForm.tipPresets,
				deliveryFee: parseFloat(settingsForm.deliveryFee) || 0,
				minDeliveryOrder: parseFloat(settingsForm.minDeliveryOrder) || 0,
				deliveryRadius: parseFloat(settingsForm.deliveryRadius) || 0,
				avgPrepTime: parseInt(settingsForm.avgPrepTime) || 0,
				currencySymbol: settingsForm.currencySymbol,
				openTime: settingsForm.openTime,
				closeTime: settingsForm.closeTime,
				statsOrdersServed: parseInt(settingsForm.statsOrdersServed) || 0,
				statsHappyCustomers: parseInt(settingsForm.statsHappyCustomers) || 0,
				statsYearsService: parseInt(settingsForm.statsYearsService) || 0,
			};
			const res = await fetch("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (res.ok) {
				toast.success(t.admin.itemUpdated);
				fetchSettings();
				useRestaurantStore.setState({ settings: null, settingsLoaded: false });
				storeFetchSettings();
			} else {
				toast.error(t.admin.failedSave);
			}
		} catch {
			toast.error(t.admin.failedSave);
		} finally {
			setSavingSettings(false);
		}
	};

	// ============ KDS SCREEN HANDLERS ============
	const handleSaveKds = async () => {
		const payload = {
			name: kdsForm.name,
			slug: kdsForm.slug,
			description: kdsForm.description || "",
			stationFilter: kdsForm.stationFilter || "",
			layoutType: kdsForm.layoutType || "grid",
			autoRefreshInterval: parseInt(kdsForm.autoRefreshInterval) || 10,
			showCompleted: kdsForm.showCompleted,
			maxOrders: parseInt(kdsForm.maxOrders) || 0,
			sortOrder: parseInt(kdsForm.sortOrder) || 0,
			isActive: kdsForm.isActive,
		};
		try {
			let res: Response;
			if (editingKdsId) {
				res = await fetch(`/api/kitchen-screens/${editingKdsId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
			} else {
				res = await fetch("/api/kitchen-screens", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
			}
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				toast.error(errData.error || t.admin.failedSave);
				return;
			}
			setKdsDialogOpen(false);
			setEditingKdsId(null);
			setKdsForm({
				name: "",
				slug: "",
				description: "",
				stationFilter: "",
				layoutType: "grid",
				autoRefreshInterval: "10",
				showCompleted: false,
				maxOrders: "0",
				sortOrder: "0",
				isActive: true,
			});
			toast.success(editingKdsId ? t.admin.screenUpdated : t.admin.screenCreated);
			fetchData();
		} catch {
			toast.error(t.admin.failedSave);
		}
	};

	const handleDeleteKds = async (id: string) => {
		if (!confirm(t.admin.deleteScreenConfirm)) return;
		const res = await fetch(`/api/kitchen-screens/${id}`, { method: "DELETE" });
		if (res.ok) {
			toast.success(t.admin.screenDeleted);
			fetchData();
		} else {
			toast.error(t.admin.failedSave);
		}
	};

	// ============ REPORT STATS ============
	const fetchReportStats = useCallback(async () => {
		try {
			const res = await fetch("/api/reports");
			if (res.ok) {
				const d = await res.json();
				setReportStats({
					revenue: d.todayRevenue || 0,
					ordersToday: d.todayOrders || 0,
					avgValue: d.avgOrderValue || 0,
				});
			}
		} catch (e) {
			console.error("Failed to fetch report stats:", e);
		}
	}, []);

	useEffect(() => {
		fetchReportStats();
	}, [fetchReportStats]);

	// ============ COMPUTED ============
	const allItems = categories.flatMap((c) => c.items);
	const filteredItems = menuSearch
		? allItems.filter(
				(i) =>
					(locale === "ar" ? i.nameAr : i.nameEn)
						.toLowerCase()
						.includes(menuSearch.toLowerCase()) ||
					i.nameEn.toLowerCase().includes(menuSearch.toLowerCase()),
			)
		: allItems;
	const currentBalance = cashEntries.reduce((acc, e) => {
		if (e.type === "payin" || e.type === "sale") return acc + e.amount;
		return acc - e.amount;
	}, 0);
	const unreadCount = notifications.filter((n) => !n.isRead).length;

	return {
		categories,
		ingredients,
		employees,
		schedules,
		cashEntries,
		notifications,
		reservations,
		kitchenScreens,
		loading,
		reportStats,
		menuItemDialogOpen,
		ingredientDialogOpen,
		employeeDialogOpen,
		cashDialogOpen,
		reservationDialogOpen,
		scheduleDialogOpen,
		kdsDialogOpen,
		editingMenuId,
		editingIngredientId,
		editingEmployeeId,
		editingKdsId,
		menuForm,
		ingredientForm,
		employeeForm,
		cashForm,
		reservationForm,
		scheduleForm,
		kdsForm,
		menuSearch,
		settingsForm,
		settingsLoaded,
		savingSettings,
		allItems,
		filteredItems,
		currentBalance,
		unreadCount,
		roleLabels,
		statusLabels,
		cashTypeLabels,
		DAY_NAMES,
		currencySym,
		setMenuItemDialogOpen,
		setIngredientDialogOpen,
		setEmployeeDialogOpen,
		setCashDialogOpen,
		setReservationDialogOpen,
		setScheduleDialogOpen,
		setKdsDialogOpen,
		setEditingMenuId,
		setEditingIngredientId,
		setEditingEmployeeId,
		setEditingKdsId,
		setMenuForm,
		setIngredientForm,
		setEmployeeForm,
		setCashForm,
		setReservationForm,
		setScheduleForm,
		setKdsForm,
		setMenuSearch,
		setSettingsForm,
		handleSaveMenuItem,
		handleDeleteMenuItem,
		handleToggleAvailability,
		handleSaveIngredient,
		handleDeleteIngredient,
		handleSaveEmployee,
		handleDeleteEmployee,
		handleSaveCash,
		handleSaveReservation,
		handleUpdateReservationStatus,
		handleSaveSchedule,
		handleMarkAllRead,
		fetchSettings,
		handleSaveSettings,
		handleSaveKds,
		handleDeleteKds,
	};
}
