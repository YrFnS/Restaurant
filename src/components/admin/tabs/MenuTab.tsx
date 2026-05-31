import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import ImageUploadButton from "@/components/shared/ImageUploadButton";
import { useI18n } from "@/lib/i18n";
import {
	Plus,
	Edit,
	Trash2,
	Search,
	ImageIcon,
} from "lucide-react";
import type { CategoryData, ItemData } from "@/components/admin/types";

interface MenuTabProps {
	categories: CategoryData[];
	filteredItems: ItemData[];
	menuSearch: string;
	setMenuSearch: (v: string) => void;
	menuItemDialogOpen: boolean;
	setMenuItemDialogOpen: (v: boolean) => void;
	editingMenuId: string | null;
	setEditingMenuId: (v: string | null) => void;
	menuForm: {
		nameEn: string;
		nameAr: string;
		price: string;
		categoryId: string;
		descriptionEn: string;
		isAvailable: boolean;
		preparationTime: string;
		imageUrl: string;
	};
	setMenuForm: React.Dispatch<
		React.SetStateAction<{
			nameEn: string;
			nameAr: string;
			price: string;
			categoryId: string;
			descriptionEn: string;
			isAvailable: boolean;
			preparationTime: string;
			imageUrl: string;
		}>
	>;
	handleSaveMenuItem: () => void;
	handleDeleteMenuItem: (id: string) => void;
	handleToggleAvailability: (item: ItemData) => void;
	currencySym: string;
}

export default function MenuTab({
	categories,
	filteredItems,
	menuSearch,
	setMenuSearch,
	menuItemDialogOpen,
	setMenuItemDialogOpen,
	editingMenuId,
	setEditingMenuId,
	menuForm,
	setMenuForm,
	handleSaveMenuItem,
	handleDeleteMenuItem,
	handleToggleAvailability,
	currencySym,
}: MenuTabProps) {
	const { t, locale, isRTL } = useI18n();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-bold">{t.admin.menu}</h2>
				<Button
					onClick={() => {
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
						setMenuItemDialogOpen(true);
					}}
					className="bg-amber-600 hover:bg-amber-500"
				>
					<Plus className="h-4 w-4 me-1" /> {t.admin.addItem}
				</Button>
			</div>
			<div className="relative">
				<Search
					className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`}
				/>
				<Input
					placeholder={t.admin.searchMenu}
					value={menuSearch}
					onChange={(e) => setMenuSearch(e.target.value)}
					className={isRTL ? "pr-9" : "pl-9"}
				/>
			</div>
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t.admin.name}</TableHead>
							<TableHead>{t.admin.category}</TableHead>
							<TableHead>{t.admin.price}</TableHead>
							<TableHead>{t.admin.available}</TableHead>
							<TableHead>{t.admin.actions}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredItems.map((item) => {
							const cat = categories.find((c) => c.id === item.categoryId);
							return (
								<TableRow key={item.id}>
									<TableCell className="font-medium">
										{locale === "ar" ? item.nameAr : item.nameEn}
									</TableCell>
									<TableCell>
										<Badge variant="outline">
											{cat
												? locale === "ar"
													? cat.nameAr
													: cat.nameEn
												: "N/A"}
										</Badge>
									</TableCell>
									<TableCell>
										{currencySym}
										{item.price.toFixed(2)}
									</TableCell>
									<TableCell>
										<Switch
											checked={item.isAvailable}
											onCheckedChange={() => handleToggleAvailability(item)}
										/>
									</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => {
													setEditingMenuId(item.id);
													setMenuForm({
														nameEn: item.nameEn,
														nameAr: item.nameAr,
														price: item.price.toString(),
														categoryId: item.categoryId,
														descriptionEn: item.descriptionEn,
														isAvailable: item.isAvailable,
														preparationTime: item.preparationTime.toString(),
														imageUrl: item.image || "",
													});
													setMenuItemDialogOpen(true);
												}}
											>
												<Edit className="h-3 w-3" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="text-red-500 hover:text-red-700"
												onClick={() => handleDeleteMenuItem(item.id)}
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>

			{/* Menu Item Dialog */}
			<Dialog open={menuItemDialogOpen} onOpenChange={setMenuItemDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editingMenuId ? t.admin.editMenuItem : t.admin.addMenuItem}
						</DialogTitle>
						<DialogDescription>{t.admin.fillDetails}</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div className="flex items-start gap-4">
							<ImageUploadButton
								value={menuForm.imageUrl}
								onChange={(url) =>
									setMenuForm((f) => ({ ...f, imageUrl: url }))
								}
								label={t.admin.uploadImage || "Upload Image"}
								size="lg"
							/>
							<div className="flex-1 space-y-3">
								<div>
									<Label>{t.admin.nameEn}</Label>
									<Input
										value={menuForm.nameEn}
										onChange={(e) =>
											setMenuForm((f) => ({ ...f, nameEn: e.target.value }))
										}
									/>
								</div>
								<div>
									<Label>{t.admin.nameAr}</Label>
									<Input
										value={menuForm.nameAr}
										onChange={(e) =>
											setMenuForm((f) => ({ ...f, nameAr: e.target.value }))
										}
									/>
								</div>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>{t.admin.priceLabel}</Label>
								<Input
									type="number"
									step="0.01"
									value={menuForm.price}
									onChange={(e) =>
										setMenuForm((f) => ({ ...f, price: e.target.value }))
									}
								/>
							</div>
							<div>
								<Label>{t.admin.prepTimeLabel}</Label>
								<Input
									type="number"
									value={menuForm.preparationTime}
									onChange={(e) =>
										setMenuForm((f) => ({
											...f,
											preparationTime: e.target.value,
										}))
									}
								/>
							</div>
						</div>
						<div>
							<Label>{t.admin.category}</Label>
							<Select
								value={menuForm.categoryId || undefined}
								onValueChange={(val) =>
									setMenuForm((f) => ({ ...f, categoryId: val }))
								}
							>
								<SelectTrigger>
									<SelectValue placeholder={t.admin.selectCategory} />
								</SelectTrigger>
								<SelectContent>
									{categories.map((c) => (
										<SelectItem key={c.id} value={c.id}>
											{locale === "ar" ? c.nameAr : c.nameEn}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>{t.admin.description}</Label>
							<Textarea
								value={menuForm.descriptionEn}
								onChange={(e) =>
									setMenuForm((f) => ({ ...f, descriptionEn: e.target.value }))
								}
							/>
						</div>
						<div className="flex items-center gap-2">
							<Switch
								checked={menuForm.isAvailable}
								onCheckedChange={(val) =>
									setMenuForm((f) => ({ ...f, isAvailable: val }))
								}
							/>
							<Label>{t.admin.available}</Label>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setMenuItemDialogOpen(false)}
						>
							{t.common.cancel}
						</Button>
						<Button
							onClick={handleSaveMenuItem}
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
