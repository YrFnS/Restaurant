import React from "react";
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
import { useI18n } from "@/lib/i18n";
import { Plus } from "lucide-react";
import type { EmployeeData, ScheduleData } from "@/components/admin/types";

interface ScheduleTabProps {
	schedules: ScheduleData[];
	employees: EmployeeData[];
	DAY_NAMES: string[];
	scheduleDialogOpen: boolean;
	setScheduleDialogOpen: (v: boolean) => void;
	scheduleForm: {
		employeeId: string;
		dayOfWeek: string;
		startTime: string;
		endTime: string;
		role: string;
	};
	setScheduleForm: React.Dispatch<
		React.SetStateAction<{
			employeeId: string;
			dayOfWeek: string;
			startTime: string;
			endTime: string;
			role: string;
		}>
	>;
	handleSaveSchedule: () => void;
}

export default function ScheduleTab({
	schedules,
	employees,
	DAY_NAMES,
	scheduleDialogOpen,
	setScheduleDialogOpen,
	scheduleForm,
	setScheduleForm,
	handleSaveSchedule,
}: ScheduleTabProps) {
	const { t } = useI18n();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-bold">{t.admin.schedule}</h2>
				<Button
					onClick={() => setScheduleDialogOpen(true)}
					className="bg-amber-600 hover:bg-amber-500"
				>
					<Plus className="h-4 w-4 me-1" /> {t.admin.addShift}
				</Button>
			</div>
			<div className="grid grid-cols-7 gap-2">
				{DAY_NAMES.map((day, dayIdx) => (
					<div key={dayIdx} className="space-y-1">
						<div className="text-center text-xs font-semibold text-muted-foreground py-1 bg-muted rounded">
							{day}
						</div>
						{schedules
							.filter((s) => s.dayOfWeek === dayIdx)
							.map((s) => {
								const emp = employees.find((e) => e.id === s.employeeId);
								const roleColors: Record<string, string> = {
									Server: "bg-emerald-100 text-emerald-800",
									Cook: "bg-red-100 text-red-800",
									Bartender: "bg-amber-100 text-amber-800",
									Host: "bg-sky-100 text-sky-800",
									Manager: "bg-purple-100 text-purple-800",
								};
								return (
									<div
										key={s.id}
										className={`text-xs p-1.5 rounded border ${roleColors[s.role] || "bg-gray-100"}`}
									>
										<div className="font-medium">{emp?.name || "—"}</div>
										<div className="opacity-75">
											{s.startTime}-{s.endTime}
										</div>
									</div>
								);
							})}
					</div>
				))}
			</div>

			{/* Schedule Dialog */}
			<Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t.admin.addShiftTitle}</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div>
							<Label>{t.admin.employees}</Label>
							<Select
								value={scheduleForm.employeeId || undefined}
								onValueChange={(val) =>
									setScheduleForm((f) => ({ ...f, employeeId: val }))
								}
							>
								<SelectTrigger>
									<SelectValue placeholder={t.admin.selectEmployee} />
								</SelectTrigger>
								<SelectContent>
									{employees
										.filter((e) => e.isActive)
										.map((e) => (
											<SelectItem key={e.id} value={e.id}>
												{e.name}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-3 gap-3">
							<div>
								<Label>{t.admin.day}</Label>
								<Select
									value={scheduleForm.dayOfWeek}
									onValueChange={(val) =>
										setScheduleForm((f) => ({ ...f, dayOfWeek: val }))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{DAY_NAMES.map((d, i) => (
											<SelectItem key={i} value={String(i)}>
												{d}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>{t.admin.start}</Label>
								<Input
									type="time"
									value={scheduleForm.startTime}
									onChange={(e) =>
										setScheduleForm((f) => ({
											...f,
											startTime: e.target.value,
										}))
									}
								/>
							</div>
							<div>
								<Label>{t.admin.end}</Label>
								<Input
									type="time"
									value={scheduleForm.endTime}
									onChange={(e) =>
										setScheduleForm((f) => ({ ...f, endTime: e.target.value }))
									}
								/>
							</div>
						</div>
						<div>
							<Label>{t.admin.role}</Label>
							<Select
								value={scheduleForm.role}
								onValueChange={(val) =>
									setScheduleForm((f) => ({ ...f, role: val }))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="Server">{t.admin.roleServer}</SelectItem>
									<SelectItem value="Cook">{t.admin.roleCook}</SelectItem>
									<SelectItem value="Bartender">
										{t.admin.roleBartender}
									</SelectItem>
									<SelectItem value="Host">{t.admin.roleHost}</SelectItem>
									<SelectItem value="Manager">{t.admin.roleManager}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setScheduleDialogOpen(false)}
						>
							{t.common.cancel}
						</Button>
						<Button
							onClick={handleSaveSchedule}
							className="bg-amber-600 hover:bg-amber-500"
						>
							{t.admin.addShift}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
