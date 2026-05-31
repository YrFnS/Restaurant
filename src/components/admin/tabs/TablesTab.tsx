import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { QrCode, Copy } from "lucide-react";

interface TableRow {
	id: string;
	number: number;
	seats: number;
	shape: string;
	status: string;
}

interface TablesTabProps {
	activeTab: string;
}

export default function TablesTab({ activeTab }: TablesTabProps) {
	const { t } = useI18n();
	const [tablesData, setTablesData] = useState<TableRow[]>([]);
	const [qrTableId, setQrTableId] = useState<string | null>(null);
	const [qrTableNumber, setQrTableNumber] = useState<number>(0);

	useEffect(() => {
		if (activeTab === "tables") {
			fetch("/api/tables")
				.then((r) => r.json())
				.then((d) => setTablesData(d.tables || []))
				.catch(() => {});
		}
	}, [activeTab]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-bold">{t.admin.tables || "Tables"}</h2>
				<Badge variant="outline">
					{tablesData.length} {t.admin.tables || "Tables"}
				</Badge>
			</div>
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
				{tablesData.map((table) => (
					<Card
						key={table.id}
						className="bg-card border-border hover:border-amber-500/40 transition-colors"
					>
						<CardContent className="p-4 flex flex-col items-center gap-2">
							<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
								<span className="text-lg font-black text-amber-600 dark:text-amber-400">
									{table.number}
								</span>
							</div>
							<div className="text-center">
								<div className="text-sm font-semibold text-foreground">
									{t.staff.table} {table.number}
								</div>
								<div className="text-xs text-muted-foreground">
									{table.seats} {t.admin.seats || "seats"}
								</div>
							</div>
							<Button
								size="sm"
								variant="outline"
								className="w-full text-xs gap-1.5"
								onClick={() => {
									setQrTableId(table.id);
									setQrTableNumber(table.number);
								}}
							>
								<QrCode className="size-3.5" /> {t.admin.viewQr || "QR Code"}
							</Button>
						</CardContent>
					</Card>
				))}
			</div>
			{/* QR Code Dialog */}
			<Dialog
				open={qrTableId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setQrTableId(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<QrCode className="size-5 text-amber-600" />
							{t.staff.table} {qrTableNumber} — QR Code
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col items-center gap-4 py-4">
						<div className="bg-white p-4 rounded-xl">
							<QRCodeSVG
								value={`${typeof window !== "undefined" ? window.location.origin : ""}/?table=${qrTableNumber}`}
								size={200}
							/>
						</div>
						<p className="text-sm text-muted-foreground text-center">
							{t.admin.qrDesc || "Scan to view menu for this table"}
						</p>
						<div className="flex gap-2 w-full">
							<Button
								variant="outline"
								className="flex-1 text-xs"
								onClick={() => {
									const url = `${window.location.origin}/?table=${qrTableNumber}`;
									navigator.clipboard.writeText(url);
									toast.success(t.admin.linkCopied || "Link copied!");
								}}
							>
								<Copy className="size-3.5 me-1" />{" "}
								{t.admin.copyLink || "Copy Link"}
							</Button>
							<Button
								className="flex-1 text-xs bg-amber-600 hover:bg-amber-500 text-white"
								onClick={() => {
									const canvas = document.querySelector("#qr-canvas");
									if (canvas) {
										const link = document.createElement("a");
										link.download = `table-${qrTableNumber}-qr.png`;
										link.href =
											canvas.querySelector("canvas")?.toDataURL() || "";
										link.click();
									}
								}}
							>
								{t.admin.download || "Download"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
