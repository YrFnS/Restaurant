import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { CheckCircle2, XCircle, AlertTriangle, Bell } from "lucide-react";
import type { NotificationData } from "@/components/admin/types";

interface NotificationsTabProps {
	notifications: NotificationData[];
	unreadCount: number;
	handleMarkAllRead: () => void;
}

export default function NotificationsTab({
	notifications,
	unreadCount,
	handleMarkAllRead,
}: NotificationsTabProps) {
	const { t } = useI18n();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-bold">
					{t.admin.notifications}{" "}
					{unreadCount > 0 && (
						<Badge className="bg-red-500 text-white ms-2">{unreadCount}</Badge>
					)}
				</h2>
				{unreadCount > 0 && (
					<Button variant="outline" size="sm" onClick={handleMarkAllRead}>
						<CheckCircle2 className="h-4 w-4 me-1" /> {t.admin.markAllReadBtn}
					</Button>
				)}
			</div>
			<div className="space-y-2">
				{notifications.length === 0 ? (
					<Card>
						<CardContent className="p-8 text-center text-muted-foreground">
							{t.admin.noNotifications}
						</CardContent>
					</Card>
				) : (
					notifications.map((notif) => (
						<Card
							key={notif.id}
							className={`${!notif.isRead ? "border-amber-300 bg-amber-50" : ""}`}
						>
							<CardContent className="p-3 flex items-start gap-3">
								<div
									className={`mt-0.5 ${notif.type === "error" ? "text-red-500" : notif.type === "warning" ? "text-amber-500" : "text-blue-500"}`}
								>
									{notif.type === "error" ? (
										<XCircle className="h-4 w-4" />
									) : notif.type === "warning" ? (
										<AlertTriangle className="h-4 w-4" />
									) : (
										<Bell className="h-4 w-4" />
									)}
								</div>
								<div className="flex-1">
									<p className="text-sm font-medium">{notif.title}</p>
									<p className="text-xs text-muted-foreground">
										{notif.message}
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										{new Date(notif.createdAt).toLocaleString()}
									</p>
								</div>
							</CardContent>
						</Card>
					))
				)}
			</div>
		</div>
	);
}
