"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
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
import type { AdminTab } from "@/components/admin/types";

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
import { useAdminPanel } from "@/components/admin/useAdminPanel";

export default function AdminPanel() {
	const { t, isRTL } = useI18n();
	const [activeTab, setActiveTab] = useState<AdminTab>("menu");
	const state = useAdminPanel();

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
								{item.id === "notifications" && state.unreadCount > 0 && (
									<Badge className="bg-red-500 text-white text-[10px] ms-auto h-4 min-w-[16px] px-1">
										{state.unreadCount}
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
				{state.loading ? (
					<div className="flex items-center justify-center h-64">
						<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<>
						{activeTab === "menu" && (
							<MenuTab
								categories={state.categories}
								filteredItems={state.filteredItems}
								menuSearch={state.menuSearch}
								setMenuSearch={state.setMenuSearch}
								menuItemDialogOpen={state.menuItemDialogOpen}
								setMenuItemDialogOpen={state.setMenuItemDialogOpen}
								editingMenuId={state.editingMenuId}
								setEditingMenuId={state.setEditingMenuId}
								menuForm={state.menuForm}
								setMenuForm={state.setMenuForm}
								handleSaveMenuItem={state.handleSaveMenuItem}
								handleDeleteMenuItem={state.handleDeleteMenuItem}
								handleToggleAvailability={state.handleToggleAvailability}
								currencySym={state.currencySym}
							/>
						)}
						{activeTab === "inventory" && (
							<InventoryTab
								ingredients={state.ingredients}
								ingredientDialogOpen={state.ingredientDialogOpen}
								setIngredientDialogOpen={state.setIngredientDialogOpen}
								editingIngredientId={state.editingIngredientId}
								setEditingIngredientId={state.setEditingIngredientId}
								ingredientForm={state.ingredientForm}
								setIngredientForm={state.setIngredientForm}
								handleSaveIngredient={state.handleSaveIngredient}
								handleDeleteIngredient={state.handleDeleteIngredient}
								currencySym={state.currencySym}
							/>
						)}
						{activeTab === "employees" && (
							<EmployeesTab
								employees={state.employees}
								employeeDialogOpen={state.employeeDialogOpen}
								setEmployeeDialogOpen={state.setEmployeeDialogOpen}
								editingEmployeeId={state.editingEmployeeId}
								setEditingEmployeeId={state.setEditingEmployeeId}
								employeeForm={state.employeeForm}
								setEmployeeForm={state.setEmployeeForm}
								handleSaveEmployee={state.handleSaveEmployee}
								handleDeleteEmployee={state.handleDeleteEmployee}
								currencySym={state.currencySym}
								roleLabels={state.roleLabels}
							/>
						)}
						{activeTab === "schedule" && (
							<ScheduleTab
								schedules={state.schedules}
								employees={state.employees}
								DAY_NAMES={state.DAY_NAMES}
								scheduleDialogOpen={state.scheduleDialogOpen}
								setScheduleDialogOpen={state.setScheduleDialogOpen}
								scheduleForm={state.scheduleForm}
								setScheduleForm={state.setScheduleForm}
								handleSaveSchedule={state.handleSaveSchedule}
							/>
						)}
						{activeTab === "kds-screens" && (
							<KdsScreensTab
								kitchenScreens={state.kitchenScreens}
								kdsDialogOpen={state.kdsDialogOpen}
								setKdsDialogOpen={state.setKdsDialogOpen}
								editingKdsId={state.editingKdsId}
								setEditingKdsId={state.setEditingKdsId}
								kdsForm={state.kdsForm}
								setKdsForm={state.setKdsForm}
								handleSaveKds={state.handleSaveKds}
								handleDeleteKds={state.handleDeleteKds}
							/>
						)}
						{activeTab === "tables" && <TablesTab activeTab={activeTab} />}
						{activeTab === "reports" && (
							<ReportsTab
								allItems={state.allItems}
								employees={state.employees}
								reportStats={state.reportStats}
								currencySym={state.currencySym}
							/>
						)}
						{activeTab === "cash" && (
							<CashDrawerTab
								cashEntries={state.cashEntries}
								currentBalance={state.currentBalance}
								cashDialogOpen={state.cashDialogOpen}
								setCashDialogOpen={state.setCashDialogOpen}
								cashForm={state.cashForm}
								setCashForm={state.setCashForm}
								handleSaveCash={state.handleSaveCash}
								currencySym={state.currencySym}
								cashTypeLabels={state.cashTypeLabels}
							/>
						)}
						{activeTab === "reservations" && (
							<ReservationsTab
								reservations={state.reservations}
								unreadCount={state.unreadCount}
								reservationDialogOpen={state.reservationDialogOpen}
								setReservationDialogOpen={state.setReservationDialogOpen}
								reservationForm={state.reservationForm}
								setReservationForm={state.setReservationForm}
								handleSaveReservation={state.handleSaveReservation}
								handleUpdateReservationStatus={
									state.handleUpdateReservationStatus
								}
								statusLabels={state.statusLabels}
							/>
						)}
						{activeTab === "notifications" && (
							<NotificationsTab
								notifications={state.notifications}
								unreadCount={state.unreadCount}
								handleMarkAllRead={state.handleMarkAllRead}
							/>
						)}
						{activeTab === "settings" && (
							<SettingsTab
								settingsLoaded={state.settingsLoaded}
								fetchSettings={state.fetchSettings}
								savingSettings={state.savingSettings}
								settingsForm={state.settingsForm}
								setSettingsForm={state.setSettingsForm}
								handleSaveSettings={state.handleSaveSettings}
							/>
						)}
					</>
				)}
			</main>
		</div>
	);
}
