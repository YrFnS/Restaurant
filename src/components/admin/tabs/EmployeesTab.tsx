import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useI18n } from "@/lib/i18n";
import { Plus, Edit, Trash2 } from "lucide-react";
import type { EmployeeData } from "@/components/admin/types";

interface EmployeesTabProps {
	employees: EmployeeData[];
	employeeDialogOpen: boolean;
	setEmployeeDialogOpen: (v: boolean) => void;
	editingEmployeeId: string | null;
	setEditingEmployeeId: (v: string | null) => void;
	employeeForm: {
		name: string;
		pin: string;
		role: string;
		hourlyWage: string;
		isActive: boolean;
		email: string;
		phone: string;
	};
	setEmployeeForm: React.Dispatch<
		React.SetStateAction<{
			name: string;
			pin: string;
			role: string;
			hourlyWage: string;
			isActive: boolean;
			email: string;
			phone: string;
		}>
	>;
	handleSaveEmployee: () => void;
	handleDeleteEmployee: (id: string) => void;
	currencySym: string;
	roleLabels: Record<string, string>;
}

export default function EmployeesTab({
	employees,
	employeeDialogOpen,
	setEmployeeDialogOpen,
	editingEmployeeId,
	setEditingEmployeeId,
	employeeForm,
	setEmployeeForm,
	handleSaveEmployee,
	handleDeleteEmployee,
	currencySym,
	roleLabels,
}: EmployeesTabProps) {
	const { t } = useI18n();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-bold">{t.admin.employees}</h2>
				<Button
					onClick={() => {
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
						setEmployeeDialogOpen(true);
					}}
					className="bg-amber-600 hover:bg-amber-500"
				>
					<Plus className="h-4 w-4 me-1" /> {t.admin.addEmployee}
				</Button>
			</div>
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t.admin.name}</TableHead>
							<TableHead>{t.admin.pin}</TableHead>
							<TableHead>{t.admin.role}</TableHead>
							<TableHead>{t.admin.wage}</TableHead>
							<TableHead>{t.admin.status}</TableHead>
							<TableHead>{t.admin.actions}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{employees.map((emp) => (
							<TableRow key={emp.id}>
								<TableCell className="font-medium">{emp.name}</TableCell>
								<TableCell>
									<code className="bg-muted px-2 py-0.5 rounded text-sm">
										****
									</code>
								</TableCell>
								<TableCell>
									<Badge
										className={
											emp.role === "admin"
												? "bg-purple-100 text-purple-800"
												: emp.role === "manager"
													? "bg-amber-100 text-amber-800"
													: "bg-cyan-100 text-cyan-800"
										}
									>
										{roleLabels[emp.role] || emp.role}
									</Badge>
								</TableCell>
								<TableCell>
									{currencySym}
									{emp.hourlyWage.toFixed(2)}/hr
								</TableCell>
								<TableCell>
									<Badge
										variant={emp.isActive ? "default" : "secondary"}
										className={
											emp.isActive
												? "bg-green-100 text-green-800"
												: "bg-gray-100 text-gray-800"
										}
									>
										{emp.isActive ? t.admin.active : t.admin.inactive}
									</Badge>
									{emp.clockedIn && (
										<Badge className="bg-emerald-100 text-emerald-800 ms-1">
											🟢 {t.admin.clockedIn}
										</Badge>
									)}
								</TableCell>
								<TableCell>
									<div className="flex gap-1">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setEditingEmployeeId(emp.id);
												setEmployeeForm({
													name: emp.name,
													pin: "",
													role: emp.role,
													hourlyWage: emp.hourlyWage.toString(),
													isActive: emp.isActive,
													email: emp.email || "",
													phone: emp.phone || "",
												});
												setEmployeeDialogOpen(true);
											}}
										>
											<Edit className="h-3 w-3" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="text-red-500"
											onClick={() => handleDeleteEmployee(emp.id)}
										>
											<Trash2 className="h-3 w-3" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{/* Employee Dialog */}
			<Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editingEmployeeId
								? t.admin.editEmployeeTitle
								: t.admin.addEmployeeTitle}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div>
							<Label>{t.admin.name}</Label>
							<Input
								value={employeeForm.name}
								onChange={(e) =>
									setEmployeeForm((f) => ({ ...f, name: e.target.value }))
								}
							/>
						</div>
						{!editingEmployeeId && (
							<div>
								<Label>{t.admin.pin}</Label>
								<Input
									type="password"
									maxLength={6}
									value={employeeForm.pin}
									onChange={(e) =>
										setEmployeeForm((f) => ({ ...f, pin: e.target.value }))
									}
									placeholder="4-6 digit PIN"
								/>
							</div>
						)}
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>{t.admin.role}</Label>
								<Select
									value={employeeForm.role}
									onValueChange={(val) =>
										setEmployeeForm((f) => ({ ...f, role: val }))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="admin">{t.admin.roleAdmin}</SelectItem>
										<SelectItem value="manager">
											{t.admin.roleManager}
										</SelectItem>
										<SelectItem value="staff">{t.admin.roleStaff}</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>{t.admin.hourlyWageLabel}</Label>
								<Input
									type="number"
									step="0.5"
									value={employeeForm.hourlyWage}
									onChange={(e) =>
										setEmployeeForm((f) => ({
											...f,
											hourlyWage: e.target.value,
										}))
									}
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>{t.admin.email}</Label>
								<Input
									type="email"
									value={employeeForm.email}
									onChange={(e) =>
										setEmployeeForm((f) => ({ ...f, email: e.target.value }))
									}
								/>
							</div>
							<div>
								<Label>{t.admin.phone}</Label>
								<Input
									value={employeeForm.phone}
									onChange={(e) =>
										setEmployeeForm((f) => ({ ...f, phone: e.target.value }))
									}
								/>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Switch
								checked={employeeForm.isActive}
								onCheckedChange={(val) =>
									setEmployeeForm((f) => ({ ...f, isActive: val }))
								}
							/>
							<Label>{t.admin.active}</Label>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setEmployeeDialogOpen(false)}
						>
							{t.common.cancel}
						</Button>
						<Button
							onClick={handleSaveEmployee}
							className="bg-amber-600 hover:bg-amber-500"
						>
							{t.common.save}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
