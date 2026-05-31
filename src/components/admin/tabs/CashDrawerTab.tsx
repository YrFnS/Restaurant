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
import { useI18n } from "@/lib/i18n";
import { Plus, Wallet } from "lucide-react";
import type { CashEntryData } from "@/components/admin/types";

interface CashDrawerTabProps {
	cashEntries: CashEntryData[];
	currentBalance: number;
	cashDialogOpen: boolean;
	setCashDialogOpen: (v: boolean) => void;
	cashForm: {
		type: string;
		amount: string;
		note: string;
	};
	setCashForm: React.Dispatch<
		React.SetStateAction<{
			type: string;
			amount: string;
			note: string;
		}>
	>;
	handleSaveCash: () => void;
	currencySym: string;
	cashTypeLabels: Record<string, string>;
}

export default function CashDrawerTab({
	cashEntries,
	currentBalance,
	cashDialogOpen,
	setCashDialogOpen,
	cashForm,
	setCashForm,
	handleSaveCash,
	currencySym,
	cashTypeLabels,
}: CashDrawerTabProps) {
	const { t } = useI18n();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-bold">{t.admin.cash}</h2>
				<Button
					onClick={() => setCashDialogOpen(true)}
					className="bg-amber-600 hover:bg-amber-500"
				>
					<Plus className="h-4 w-4 me-1" /> {t.admin.addEntry}
				</Button>
			</div>
			<Card>
				<CardContent className="p-6 flex items-center gap-4">
					<Wallet className="h-8 w-8 text-emerald-600" />
					<div>
						<p className="text-sm text-muted-foreground">
							{t.admin.currentBalance}
						</p>
						<p className="text-3xl font-bold">
							{currencySym}
							{currentBalance.toFixed(2)}
						</p>
					</div>
				</CardContent>
			</Card>
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t.admin.type}</TableHead>
							<TableHead>{t.admin.amount}</TableHead>
							<TableHead>{t.admin.note}</TableHead>
							<TableHead>{t.admin.time}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{cashEntries
							.slice(-20)
							.reverse()
							.map((entry) => (
								<TableRow key={entry.id}>
									<TableCell>
										<Badge
											className={
												entry.type === "payin" || entry.type === "sale"
													? "bg-green-100 text-green-800"
													: "bg-red-100 text-red-800"
											}
										>
											{cashTypeLabels[entry.type] || entry.type}
										</Badge>
									</TableCell>
									<TableCell
										className={
											entry.type === "payin" || entry.type === "sale"
												? "text-green-600 font-semibold"
												: "text-red-600 font-semibold"
										}
									>
										{entry.type === "payin" || entry.type === "sale"
											? "+"
											: "-"}
										{currencySym}
										{entry.amount.toFixed(2)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{entry.note || "-"}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{new Date(entry.createdAt).toLocaleString()}
									</TableCell>
								</TableRow>
							))}
					</TableBody>
				</Table>
			</div>

			{/* Cash Dialog */}
			<Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>{t.admin.addCashEntryTitle}</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div>
							<Label>{t.admin.type}</Label>
							<Select
								value={cashForm.type}
								onValueChange={(val) =>
									setCashForm((f) => ({ ...f, type: val }))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="payin">{t.admin.payIn}</SelectItem>
									<SelectItem value="payout">{t.admin.payOut}</SelectItem>
									<SelectItem value="drop">{t.admin.drop}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>{t.admin.amountLabel}</Label>
							<Input
								type="number"
								step="0.01"
								value={cashForm.amount}
								onChange={(e) =>
									setCashForm((f) => ({ ...f, amount: e.target.value }))
								}
							/>
						</div>
						<div>
							<Label>{t.admin.note}</Label>
							<Input
								value={cashForm.note}
								onChange={(e) =>
									setCashForm((f) => ({ ...f, note: e.target.value }))
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCashDialogOpen(false)}>
							{t.common.cancel}
						</Button>
						<Button
							onClick={handleSaveCash}
							className="bg-amber-600 hover:bg-amber-500"
						>
							{t.admin.addEntry}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
