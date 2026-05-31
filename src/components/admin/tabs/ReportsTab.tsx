import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import {
	DollarSign,
	ShoppingCart,
	TrendingUp,
	Users,
} from "lucide-react";
import type { EmployeeData, ItemData } from "@/components/admin/types";

interface ReportsTabProps {
	allItems: ItemData[];
	employees: EmployeeData[];
	reportStats: {
		revenue: number;
		ordersToday: number;
		avgValue: number;
	};
	currencySym: string;
}

export default function ReportsTab({
	allItems,
	employees,
	reportStats,
	currencySym,
}: ReportsTabProps) {
	const { t, locale } = useI18n();

	return (
		<div className="space-y-4">
			<h2 className="text-xl font-bold">{t.admin.reportsAnalytics}</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{[
					{
						title: t.admin.todaysRevenue,
						value: `${currencySym}${reportStats.revenue.toFixed(2)}`,
						icon: <DollarSign className="h-5 w-5" />,
						color: "text-emerald-600",
						bg: "bg-emerald-50",
					},
					{
						title: t.admin.ordersToday,
						value: String(reportStats.ordersToday),
						icon: <ShoppingCart className="h-5 w-5" />,
						color: "text-amber-600",
						bg: "bg-amber-50",
					},
					{
						title: t.admin.avgOrderValue,
						value: `${currencySym}${reportStats.avgValue.toFixed(2)}`,
						icon: <TrendingUp className="h-5 w-5" />,
						color: "text-blue-600",
						bg: "bg-blue-50",
					},
					{
						title: t.admin.activeEmployees,
						value: String(employees.filter((e) => e.clockedIn).length),
						icon: <Users className="h-5 w-5" />,
						color: "text-purple-600",
						bg: "bg-purple-50",
					},
				].map((stat, i) => (
					<Card key={i}>
						<CardContent className="p-4 flex items-center gap-3">
							<div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
								{stat.icon}
							</div>
							<div>
								<p className="text-sm text-muted-foreground">{stat.title}</p>
								<p className="text-xl font-bold">{stat.value}</p>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">{t.admin.topSellingItems}</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{allItems.slice(0, 5).map((item, i) => (
							<div
								key={item.id}
								className="flex items-center justify-between py-1"
							>
								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground w-4">
										{i + 1}.
									</span>
									<span className="text-sm font-medium">
										{locale === "ar" ? item.nameAr : item.nameEn}
									</span>
								</div>
								<div className="w-32 bg-muted rounded-full h-2">
									<div
										className="bg-amber-500 h-2 rounded-full"
										style={{ width: `${Math.max(20, 100 - i * 18)}%` }}
									/>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
