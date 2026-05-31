import React from "react";
import { Card, CardContent } from "@/components/ui/card";
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
	DialogDescription,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
	Plus,
	Edit,
	Trash2,
	Monitor,
	ExternalLink,
	Copy,
} from "lucide-react";
import type { KitchenScreenData } from "@/components/admin/types";

interface KdsScreensTabProps {
	kitchenScreens: KitchenScreenData[];
	kdsDialogOpen: boolean;
	setKdsDialogOpen: (v: boolean) => void;
	editingKdsId: string | null;
	setEditingKdsId: (v: string | null) => void;
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
	setKdsForm: React.Dispatch<
		React.SetStateAction<{
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
		}>
	>;
	handleSaveKds: () => void;
	handleDeleteKds: (id: string) => void;
}

export default function KdsScreensTab({
	kitchenScreens,
	kdsDialogOpen,
	setKdsDialogOpen,
	editingKdsId,
	setEditingKdsId,
	kdsForm,
	setKdsForm,
	handleSaveKds,
	handleDeleteKds,
}: KdsScreensTabProps) {
	const { t } = useI18n();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-bold">{t.admin.kdsScreens}</h2>
				<Button
					onClick={() => {
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
						setKdsDialogOpen(true);
					}}
					className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
				>
					<Plus className="h-4 w-4 me-1" /> {t.admin.addScreen}
				</Button>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{kitchenScreens.length === 0 ? (
					<Card className="col-span-full rounded-xl">
						<CardContent className="p-8 text-center text-muted-foreground">
							<Monitor className="h-12 w-12 mx-auto mb-3 opacity-20" />
							<p className="font-medium">{t.admin.noData}</p>
							<p className="text-sm mt-1 mb-4">{t.kitchen.noScreensDesc}</p>
							<Button
								onClick={() => {
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
									setKdsDialogOpen(true);
								}}
								className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
							>
								<Plus className="h-4 w-4 me-1" /> {t.admin.addScreen}
							</Button>
						</CardContent>
					</Card>
				) : (
					kitchenScreens.map((screen) => (
						<Card
							key={screen.id}
							className={`rounded-xl shadow-sm hover:shadow-md transition-shadow ${!screen.isActive ? "opacity-60" : ""}`}
						>
							<CardContent className="p-5 space-y-3">
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-2.5 min-w-0">
										<div className="p-2 bg-amber-500/10 rounded-lg">
											<Monitor className="h-4 w-4 text-amber-600" />
										</div>
										<div className="min-w-0">
											<h3 className="font-bold text-foreground truncate">
												{screen.name}
											</h3>
											{screen.description && (
												<p className="text-xs text-muted-foreground line-clamp-1">
													{screen.description}
												</p>
											)}
										</div>
									</div>
									<Badge
										className={
											screen.isActive
												? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
												: "bg-muted text-muted-foreground"
										}
									>
										{screen.isActive
											? t.admin.activeScreen
											: t.admin.inactiveScreen}
									</Badge>
								</div>
								<div className="space-y-1.5 text-sm">
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground">
											{t.admin.stationFilter}:
										</span>
										<Badge variant="outline" className="border-border">
											{screen.stationFilter || t.admin.allStations}
										</Badge>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground">
											{t.admin.screenUrl}:
										</span>
										<div className="flex items-center gap-1 min-w-0 flex-1">
											<a
												href={`/kitchen/${screen.slug}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-amber-600 hover:underline flex items-center gap-1 text-xs truncate"
											>
												/kitchen/{screen.slug}{" "}
												<ExternalLink className="h-3 w-3 flex-shrink-0" />
											</a>
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
												onClick={() => {
													const url = `${window.location.origin}/kitchen/${screen.slug}`;
													navigator.clipboard
														.writeText(url)
														.then(() => {
															toast.success(t.admin.screenUrlCopied);
														})
														.catch(() => {
															toast.error(t.admin.failedSave);
														});
												}}
												title={t.admin.copyScreenUrl}
											>
												<Copy className="h-3 w-3" />
											</Button>
										</div>
									</div>
									<div className="flex items-center gap-3">
										<span className="text-muted-foreground text-xs">
											{t.admin.autoRefresh}:{" "}
											<strong>{screen.autoRefreshInterval}s</strong>
										</span>
										<span className="text-muted-foreground text-xs">
											{t.admin.layoutType}:{" "}
											<Badge
												variant="outline"
												className="border-border text-[10px]"
											>
												{screen.layoutType === "grid"
													? t.admin.grid
													: screen.layoutType === "list"
														? t.admin.list
														: t.admin.compact}
											</Badge>
										</span>
										{screen.maxOrders > 0 && (
											<span className="text-muted-foreground text-xs">
												{t.admin.maxOrders}: <strong>{screen.maxOrders}</strong>
											</span>
										)}
									</div>
								</div>
								<div className="flex gap-1 pt-1">
									<Button
										variant="outline"
										size="sm"
										className="rounded-lg"
										onClick={() => {
											setEditingKdsId(screen.id);
											setKdsForm({
												name: screen.name,
												slug: screen.slug,
												description: screen.description,
												stationFilter: screen.stationFilter,
												layoutType: screen.layoutType,
												autoRefreshInterval: String(screen.autoRefreshInterval),
												showCompleted: screen.showCompleted,
												maxOrders: String(screen.maxOrders),
												sortOrder: String(screen.sortOrder),
												isActive: screen.isActive,
											});
											setKdsDialogOpen(true);
										}}
									>
										<Edit className="h-3 w-3" />
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="text-red-500 rounded-lg"
										onClick={() => handleDeleteKds(screen.id)}
									>
										<Trash2 className="h-3 w-3" />
									</Button>
									<a
										href={`/kitchen/${screen.slug}`}
										target="_blank"
										rel="noopener noreferrer"
										className="ms-auto"
									>
										<Button
											variant="outline"
											size="sm"
											className="text-amber-600 rounded-lg"
										>
											<Monitor className="h-3 w-3 me-1" />
											{t.admin.openScreen}
										</Button>
									</a>
								</div>
							</CardContent>
						</Card>
					))
				)}
			</div>

			{/* KDS Screen Dialog */}
			<Dialog open={kdsDialogOpen} onOpenChange={setKdsDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editingKdsId ? t.admin.editScreen : t.admin.addScreen}
						</DialogTitle>
						<DialogDescription>{t.admin.screenFillDetails}</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div>
							<Label>{t.admin.screenName}</Label>
							<Input
								value={kdsForm.name}
								onChange={(e) => {
									const name = e.target.value;
									const autoSlug = name
										.toLowerCase()
										.replace(/[^a-z0-9]+/g, "-")
										.replace(/^-|-$/g, "");
									setKdsForm((f) => ({
										...f,
										name,
										slug: editingKdsId ? f.slug : autoSlug,
									}));
								}}
							/>
						</div>
						<div>
							<Label>{t.admin.slug}</Label>
							<Input
								value={kdsForm.slug}
								onChange={(e) =>
									setKdsForm((f) => ({ ...f, slug: e.target.value }))
								}
								placeholder="e.g. grill-station"
							/>
						</div>
						<div>
							<Label>{t.admin.description}</Label>
							<Input
								value={kdsForm.description}
								onChange={(e) =>
									setKdsForm((f) => ({ ...f, description: e.target.value }))
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>{t.admin.stationFilter}</Label>
								<Select
									value={kdsForm.stationFilter || "all"}
									onValueChange={(val) =>
										setKdsForm((f) => ({
											...f,
											stationFilter: val === "all" ? "" : val,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder={t.admin.allStations} />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">{t.admin.allStations}</SelectItem>
										<SelectItem value="Grill">{t.kitchen.grill}</SelectItem>
										<SelectItem value="Prep">{t.kitchen.prep}</SelectItem>
										<SelectItem value="Bar">{t.kitchen.bar}</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>{t.admin.layoutType}</Label>
								<Select
									value={kdsForm.layoutType}
									onValueChange={(val) =>
										setKdsForm((f) => ({ ...f, layoutType: val }))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="grid">{t.admin.grid}</SelectItem>
										<SelectItem value="list">{t.admin.list}</SelectItem>
										<SelectItem value="compact">{t.admin.compact}</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>{t.admin.autoRefresh}</Label>
								<Input
									type="number"
									value={kdsForm.autoRefreshInterval}
									onChange={(e) =>
										setKdsForm((f) => ({
											...f,
											autoRefreshInterval: e.target.value,
										}))
									}
								/>
							</div>
							<div>
								<Label>{t.admin.maxOrders}</Label>
								<Input
									type="number"
									value={kdsForm.maxOrders}
									onChange={(e) =>
										setKdsForm((f) => ({ ...f, maxOrders: e.target.value }))
									}
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>{t.admin.screenSortOrder}</Label>
								<Input
									type="number"
									value={kdsForm.sortOrder}
									onChange={(e) =>
										setKdsForm((f) => ({ ...f, sortOrder: e.target.value }))
									}
								/>
							</div>
							<div className="flex flex-col gap-3 pt-1">
								<div className="flex items-center gap-2">
									<Switch
										checked={kdsForm.showCompleted}
										onCheckedChange={(val) =>
											setKdsForm((f) => ({ ...f, showCompleted: val }))
										}
									/>
									<Label>{t.admin.showCompleted}</Label>
								</div>
								<div className="flex items-center gap-2">
									<Switch
										checked={kdsForm.isActive}
										onCheckedChange={(val) =>
											setKdsForm((f) => ({ ...f, isActive: val }))
										}
									/>
									<Label>{t.admin.active}</Label>
								</div>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setKdsDialogOpen(false)}>
							{t.common.cancel}
						</Button>
						<Button
							onClick={handleSaveKds}
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
