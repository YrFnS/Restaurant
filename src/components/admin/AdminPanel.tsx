"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import {
	ChefHat,
	Package,
	Users,
	CalendarDays,
	BarChart3,
	DollarSign,
	Bell,
	Wrench,
	UserCog,
	Monitor,
	Grid3X3,
	Calendar,
} from "lucide-react";
import type {
	AdminTab,
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

import MenuTab from "@/components/admin/tabs/MenuTab";
import InventoryTab from "@/components/admin/tabs/InventoryTab";
import EmployeesTab from "@/components/admin/tabs/EmployeesTab";
import ScheduleTab from "@/components/admin/tabs/ScheduleTab";
import KdsScreensTab from "@/components/admin/tabs/KdsScreensTab";
import TablesTab from "@/components/admin/tabs/TablesTab";
import ReportsTab from "@/components/admin/tabs/ReportsTab";
import CashDrawerTab from "@/components/admin/tabs/CashDrawerTab";
import ReservationsTab from "@/components/admin/tabs/ReservationsTab";
import NotificationsTab from "@/components/admin/tabs/NotificationsTab";
import SettingsTab from "@/components/admin/tabs/SettingsTab";

export default function AdminPanel() {
	const { t, locale, isRTL } = useI18n();
	const storeFetchSettings = useRestaurantStore((s) => s.fetchSettings);
	const [activeTab, setActiveTab] = useState<AdminTab>("menu");
	const [sidebarOpen, setSidebarOpen] = useState(false);

	// i18n-aware sidebar items
	const SIDEBAR_ITEMS: {
		id: AdminTab;
		label: string;
		icon: React.ReactNode;
	}[] = [
		{ id: "menu", label: t.admin.menu, icon: <ChefHat className="h-4 w-4" /> },
		{
			id: "inventory",
			label: t.admin.inventory,
			icon: <Package className="h-4 w-4" />,
		},
		{
			id: "employees",
			label: t.admin.employees,
			icon: <Users className="h-4 w-4" />,
		},
		{
			id: "schedule",
			label: t.admin.schedule,
			icon: <CalendarDays className="h-4 w-4" />,
		},
		{
			id: "kds-screens",
			label: t.admin.kdsScreens,
			icon: <Monitor className="h-4 w-4" />,
		},
		{
			id: "tables",
			label: t.admin.tables || "Tables",
			icon: <Grid3X3 className="h-4 w-4" />,
		},
		{
			id: "reports",
			label: t.admin.reports,
			icon: <BarChart3 className="h-4 w-4" />,
		},
		{
			id: "cash",
			label: t.admin.cash,
			icon: <DollarSign className="h-4 w-4" />,
		},
		{
			id: "reservations",
			label: t.admin.reservations,
			icon: <Calendar className="h-4 w-4" />,
		},
		{
			id: "notifications",
			label: t.admin.notifications,
			icon: <Bell className="h-4 w-4" />,
		},
		{
			id: "settings",
			label: t.admin.settings,
			icon: <Wrench className="h-4 w-4" />,
		},
	];

	// i18n-aware day names
	const DAY_NAMES = [
		t.admin.daySun,
		t.admin.dayMon,
		t.admin.dayTue,
		t.admin.dayWed,
		t.admin.dayThu,
		t.admin.dayFri,
		t.admin.daySat,
	];

	// i18n-aware role name mapping
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

	// i18n-aware reservation status labels
	const statusLabels: Record<string, string> = {
		confirmed: t.admin.confirmed,
		seated: t.admin.seated,
		completed: t.admin.completed,
		cancelled: t.admin.cancelled,
		no_show: t.admin.noShow,
	};

	// i18n-aware cash type labels
	const cashTypeLabels: Record<string, string> = {
		payin: t.admin.payIn,
		payout: t.admin.payOut,
		drop: t.admin.drop,
		sale: t.admin.completed,
	};

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
	const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
	const [ingredientForm, setIngredientForm] = useState({
		name: "",
		unit: "pcs",
		quantity: "0",
		lowThreshold: "10",
		costPerUnit: "0",
		supplier: "",
		category: "",
	});
	const [editingIngredientId, setEditingIngredientId] = useState<string | null>(
		null,
	);
	const [employeeForm, setEmployeeForm] = useState({
		name: "",
		pin: "",
		role: "staff",
		hourlyWage: "15",
		isActive: true,
		email: "",
		phone: "",
	});
	const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(
		null,
	);
	const [cashForm, setCashForm] = useState({
		type: "payin",
		amount: "",
		note: "",
	});
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
	const [editingKdsId, setEditingKdsId] = useState<string | null>(null);

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

	// Currency symbol from store settings
	const storeSettings = useRestaurantStore((s) => s.settings);
	const currencySym = storeSettings?.currencySymbol ?? "";

	// Fetch all data
	const fetchData = useCallback(async () => {
		try {
			const [
				menuRes,
				invRes,
				empRes,
				cashRes,
				notifRes,
				resRes,
				schedRes,
				kdsRes,
			] = await Promise.all([
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
				editingIngredientId
					? t.admin.ingredientUpdated
					: t.admin.ingredientCreated,
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
						taxRate:
							s.taxRate != null ? String(Math.round(s.taxRate * 100)) : "",
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
							s.deliveryRadius != null
								? String(Math.round(s.deliveryRadius))
								: "",
						avgPrepTime: s.avgPrepTime != null ? String(s.avgPrepTime) : "",
						currencySymbol: s.currencySymbol || "",
						openTime: s.openTime || "",
						closeTime: s.closeTime || "",
						statsOrdersServed:
							s.statsOrdersServed != null ? String(s.statsOrdersServed) : "",
						statsHappyCustomers:
							s.statsHappyCustomers != null
								? String(s.statsHappyCustomers)
								: "",
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
			toast.success(
				editingKdsId ? t.admin.screenUpdated : t.admin.screenCreated,
			);
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

	// ============ RENDER ============
	return (
		<div className="min-h-screen bg-background pt-12">
			{/* Sidebar */}
			<div
				className={`fixed top-12 bottom-0 w-56 bg-card border-r border-border z-40 hidden md:block ${isRTL ? "right-0" : "left-0"}`}
			>
				<div className="p-4">
					<div className="flex items-center gap-2 mb-4">
						<UserCog className="h-5 w-5 text-amber-600" />
						<h1 className="font-bold text-base">{t.admin.title}</h1>
					</div>
					<div className="space-y-0.5">
						{SIDEBAR_ITEMS.map((item) => (
							<button
								key={item.id}
								onClick={() => setActiveTab(item.id)}
								className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
									activeTab === item.id
										? "bg-amber-100 text-amber-800 font-medium"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								}`}
							>
								{item.icon} {item.label}
								{item.id === "notifications" && unreadCount > 0 && (
									<Badge className="bg-red-500 text-white text-[10px] ms-auto h-4 min-w-[16px] px-1">
										{unreadCount}
									</Badge>
								)}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Mobile nav */}
			<div className="md:hidden fixed top-12 left-0 right-0 z-40 bg-card border-b border-border overflow-x-auto">
				<div className="flex gap-1 p-2">
					{SIDEBAR_ITEMS.map((item) => (
						<button
							key={item.id}
							onClick={() => setActiveTab(item.id)}
							className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${
								activeTab === item.id
									? "bg-amber-100 text-amber-800 font-medium"
									: "text-muted-foreground"
							}`}
						>
							{item.icon} {item.label}
						</button>
					))}
				</div>
			</div>

			{/* Content */}
			<main className={`${isRTL ? "md:mr-56" : "md:ml-56"} p-4 pt-16 md:pt-4`}>
				{loading ? (
					<div className="flex items-center justify-center h-64">
						<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<>
						{activeTab === "menu" && (
							<MenuTab
								categories={categories}
								filteredItems={filteredItems}
								menuSearch={menuSearch}
								setMenuSearch={setMenuSearch}
								menuItemDialogOpen={menuItemDialogOpen}
								setMenuItemDialogOpen={setMenuItemDialogOpen}
								editingMenuId={editingMenuId}
								setEditingMenuId={setEditingMenuId}
								menuForm={menuForm}
								setMenuForm={setMenuForm}
								handleSaveMenuItem={handleSaveMenuItem}
								handleDeleteMenuItem={handleDeleteMenuItem}
								handleToggleAvailability={handleToggleAvailability}
								currencySym={currencySym}
							/>
						)}
						{activeTab === "inventory" && (
							<InventoryTab
								ingredients={ingredients}
								ingredientDialogOpen={ingredientDialogOpen}
								setIngredientDialogOpen={setIngredientDialogOpen}
								editingIngredientId={editingIngredientId}
								setEditingIngredientId={setEditingIngredientId}
								ingredientForm={ingredientForm}
								setIngredientForm={setIngredientForm}
								handleSaveIngredient={handleSaveIngredient}
								handleDeleteIngredient={handleDeleteIngredient}
								currencySym={currencySym}
							/>
						)}
						{activeTab === "employees" && (
							<EmployeesTab
								employees={employees}
								employeeDialogOpen={employeeDialogOpen}
								setEmployeeDialogOpen={setEmployeeDialogOpen}
								editingEmployeeId={editingEmployeeId}
								setEditingEmployeeId={setEditingEmployeeId}
								employeeForm={employeeForm}
								setEmployeeForm={setEmployeeForm}
								handleSaveEmployee={handleSaveEmployee}
								handleDeleteEmployee={handleDeleteEmployee}
								currencySym={currencySym}
								roleLabels={roleLabels}
							/>
						)}
						{activeTab === "schedule" && (
							<ScheduleTab
								schedules={schedules}
								employees={employees}
								DAY_NAMES={DAY_NAMES}
								scheduleDialogOpen={scheduleDialogOpen}
								setScheduleDialogOpen={setScheduleDialogOpen}
								scheduleForm={scheduleForm}
								setScheduleForm={setScheduleForm}
								handleSaveSchedule={handleSaveSchedule}
							/>
						)}
						{activeTab === "kds-screens" && (
							<KdsScreensTab
								kitchenScreens={kitchenScreens}
								kdsDialogOpen={kdsDialogOpen}
								setKdsDialogOpen={setKdsDialogOpen}
								editingKdsId={editingKdsId}
								setEditingKdsId={setEditingKdsId}
								kdsForm={kdsForm}
								setKdsForm={setKdsForm}
								handleSaveKds={handleSaveKds}
								handleDeleteKds={handleDeleteKds}
							/>
						)}
						{activeTab === "tables" && (
							<TablesTab activeTab={activeTab} />
						)}
						{activeTab === "reports" && (
							<ReportsTab
								allItems={allItems}
								employees={employees}
								reportStats={reportStats}
								currencySym={currencySym}
							/>
						)}
						{activeTab === "cash" && (
							<CashDrawerTab
								cashEntries={cashEntries}
								currentBalance={currentBalance}
								cashDialogOpen={cashDialogOpen}
								setCashDialogOpen={setCashDialogOpen}
								cashForm={cashForm}
								setCashForm={setCashForm}
								handleSaveCash={handleSaveCash}
								currencySym={currencySym}
								cashTypeLabels={cashTypeLabels}
							/>
						)}
						{activeTab === "reservations" && (
							<ReservationsTab
								reservations={reservations}
								unreadCount={unreadCount}
								reservationDialogOpen={reservationDialogOpen}
								setReservationDialogOpen={setReservationDialogOpen}
								reservationForm={reservationForm}
								setReservationForm={setReservationForm}
								handleSaveReservation={handleSaveReservation}
								handleUpdateReservationStatus={handleUpdateReservationStatus}
								statusLabels={statusLabels}
							/>
						)}
						{activeTab === "notifications" && (
							<NotificationsTab
								notifications={notifications}
								unreadCount={unreadCount}
								handleMarkAllRead={handleMarkAllRead}
							/>
						)}
						{activeTab === "settings" && (
							<SettingsTab
								settingsLoaded={settingsLoaded}
								fetchSettings={fetchSettings}
								savingSettings={savingSettings}
								settingsForm={settingsForm}
								setSettingsForm={setSettingsForm}
								handleSaveSettings={handleSaveSettings}
							/>
						)}
					</>
				)}
			</main>
		</div>
	);
}
