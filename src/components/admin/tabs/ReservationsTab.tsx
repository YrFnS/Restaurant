import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { Plus } from "lucide-react";
import type { ReservationData } from "@/components/admin/types";

interface ReservationsTabProps {
	reservations: ReservationData[];
	unreadCount: number;
	reservationDialogOpen: boolean;
	setReservationDialogOpen: (v: boolean) => void;
	reservationForm: {
		customerName: string;
		customerPhone: string;
		partySize: string;
		dateTime: string;
		notes: string;
		status: string;
	};
	setReservationForm: React.Dispatch<
		React.SetStateAction<{
			customerName: string;
			customerPhone: string;
			partySize: string;
			dateTime: string;
			notes: string;
			status: string;
		}>
	>;
	handleSaveReservation: () => void;
	handleUpdateReservationStatus: (id: string, status: string) => void;
	statusLabels: Record<string, string>;
}

export default function ReservationsTab({
	reservations,
	unreadCount,
	reservationDialogOpen,
	setReservationDialogOpen,
	reservationForm,
	setReservationForm,
	handleSaveReservation,
	handleUpdateReservationStatus,
	statusLabels,
}: ReservationsTabProps) {
	const { t } = useI18n();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-bold">{t.admin.reservations}</h2>
				<Button
					onClick={() => setReservationDialogOpen(true)}
					className="bg-amber-600 hover:bg-amber-500"
				>
					<Plus className="h-4 w-4 me-1" /> {t.admin.addReservation}
				</Button>
			</div>
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t.admin.customer}</TableHead>
							<TableHead>{t.admin.partySize}</TableHead>
							<TableHead>{t.admin.dateTime}</TableHead>
							<TableHead>{t.admin.status}</TableHead>
							<TableHead>{t.admin.actions}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{reservations.map((res) => (
							<TableRow key={res.id}>
								<TableCell>
									<div>
										<span className="font-medium">{res.customerName}</span>
									</div>
									<div className="text-xs text-muted-foreground">
										{res.customerPhone}
									</div>
								</TableCell>
								<TableCell>{res.partySize}</TableCell>
								<TableCell>{new Date(res.dateTime).toLocaleString()}</TableCell>
								<TableCell>
									<Badge
										className={
											res.status === "confirmed"
												? "bg-blue-100 text-blue-800"
												: res.status === "seated"
													? "bg-green-100 text-green-800"
													: res.status === "completed"
														? "bg-gray-100 text-gray-800"
														: res.status === "cancelled"
															? "bg-red-100 text-red-800"
															: "bg-orange-100 text-orange-800"
										}
									>
										{statusLabels[res.status] || res.status}
									</Badge>
								</TableCell>
								<TableCell>
									<Select
										value={res.status}
										onValueChange={(val) =>
											handleUpdateReservationStatus(res.id, val)
										}
									>
										<SelectTrigger className="w-32 h-8 text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="confirmed">
												{t.admin.confirmed}
											</SelectItem>
											<SelectItem value="seated">{t.admin.seated}</SelectItem>
											<SelectItem value="completed">
												{t.admin.completed}
											</SelectItem>
											<SelectItem value="cancelled">
												{t.admin.cancelled}
											</SelectItem>
											<SelectItem value="no_show">{t.admin.noShow}</SelectItem>
										</SelectContent>
									</Select>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{/* Reservation Dialog */}
			<Dialog
				open={reservationDialogOpen}
				onOpenChange={setReservationDialogOpen}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t.admin.addReservationTitle}</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div>
							<Label>{t.admin.customerName}</Label>
							<Input
								value={reservationForm.customerName}
								onChange={(e) =>
									setReservationForm((f) => ({
										...f,
										customerName: e.target.value,
									}))
								}
							/>
						</div>
						<div>
							<Label>{t.admin.customerPhone}</Label>
							<Input
								value={reservationForm.customerPhone}
								onChange={(e) =>
									setReservationForm((f) => ({
										...f,
										customerPhone: e.target.value,
									}))
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>{t.admin.partySize}</Label>
								<Input
									type="number"
									value={reservationForm.partySize}
									onChange={(e) =>
										setReservationForm((f) => ({
											...f,
											partySize: e.target.value,
										}))
									}
								/>
							</div>
							<div>
								<Label>{t.admin.dateTime}</Label>
								<Input
									type="datetime-local"
									value={reservationForm.dateTime}
									onChange={(e) =>
										setReservationForm((f) => ({
											...f,
											dateTime: e.target.value,
										}))
									}
								/>
							</div>
						</div>
						<div>
							<Label>{t.admin.note}</Label>
							<Textarea
								value={reservationForm.notes}
								onChange={(e) =>
									setReservationForm((f) => ({ ...f, notes: e.target.value }))
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setReservationDialogOpen(false)}
						>
							{t.common.cancel}
						</Button>
						<Button
							onClick={handleSaveReservation}
							className="bg-amber-600 hover:bg-amber-500"
						>
							{t.admin.create}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
