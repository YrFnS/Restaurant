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
import { useI18n } from "@/lib/i18n";
import { Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import type { IngredientData } from "@/components/admin/types";

interface InventoryTabProps {
	ingredients: IngredientData[];
	ingredientDialogOpen: boolean;
	setIngredientDialogOpen: (v: boolean) => void;
	editingIngredientId: string | null;
	setEditingIngredientId: (v: string | null) => void;
	ingredientForm: {
		name: string;
		unit: string;
		quantity: string;
		lowThreshold: string;
		costPerUnit: string;
		supplier: string;
		category: string;
	};
	setIngredientForm: React.Dispatch<
		React.SetStateAction<{
			name: string;
			unit: string;
			quantity: string;
			lowThreshold: string;
			costPerUnit: string;
			supplier: string;
			category: string;
		}>
	>;
	handleSaveIngredient: () => void;
	handleDeleteIngredient: (id: string) => void;
	currencySym: string;
}

export default function InventoryTab({
	ingredients,
	ingredientDialogOpen,
	setIngredientDialogOpen,
	editingIngredientId,
	setEditingIngredientId,
	ingredientForm,
	setIngredientForm,
	handleSaveIngredient,
	handleDeleteIngredient,
	currencySym,
}: InventoryTabProps) {
	const { t } = useI18n();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-bold">{t.admin.inventory}</h2>
				<Button
					onClick={() => {
						setEditingIngredientId(null);
						setIngredientForm({
							name: "",
							unit: "pcs",
							quantity: "0",
							lowThreshold: "10",
							costPerUnit: "0",
							supplier: "",
							category: "",
						});
						setIngredientDialogOpen(true);
					}}
					className="bg-amber-600 hover:bg-amber-500"
				>
					<Plus className="h-4 w-4 me-1" /> {t.admin.addIngredient}
				</Button>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
				{ingredients.map((ing) => {
					const isLow = ing.quantity <= ing.lowThreshold;
					return (
						<Card
							key={ing.id}
							className={`${isLow ? "border-red-300 bg-red-50" : ""}`}
						>
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div>
										<h3 className="font-semibold">{ing.name}</h3>
										<p className="text-sm text-muted-foreground">
											{ing.unit} · {ing.category || t.admin.noCategory}
										</p>
									</div>
									{isLow && (
										<Badge className="bg-red-100 text-red-700">
											<AlertTriangle className="h-3 w-3 me-1" />
											{t.admin.lowStock}
										</Badge>
									)}
								</div>
								<div className="mt-2 flex items-center gap-4 text-sm">
									<span>
										{t.admin.qty}: <strong>{ing.quantity}</strong>
									</span>
									<span>
										{t.admin.threshold}: {ing.lowThreshold}
									</span>
									<span>
										{t.admin.cost}: {currencySym}
										{ing.costPerUnit.toFixed(2)}/{ing.unit}
									</span>
								</div>
								<div className="mt-2 flex gap-1">
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setEditingIngredientId(ing.id);
											setIngredientForm({
												name: ing.name,
												unit: ing.unit,
												quantity: ing.quantity.toString(),
												lowThreshold: ing.lowThreshold.toString(),
												costPerUnit: ing.costPerUnit.toString(),
												supplier: ing.supplier || "",
												category: ing.category || "",
											});
											setIngredientDialogOpen(true);
										}}
									>
										<Edit className="h-3 w-3" />
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="text-red-500"
										onClick={() => handleDeleteIngredient(ing.id)}
									>
										<Trash2 className="h-3 w-3" />
									</Button>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Ingredient Dialog */}
			<Dialog
				open={ingredientDialogOpen}
				onOpenChange={setIngredientDialogOpen}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editingIngredientId
								? t.admin.editIngredient
								: t.admin.addIngredientTitle}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div>
							<Label>{t.admin.name}</Label>
							<Input
								value={ingredientForm.name}
								onChange={(e) =>
									setIngredientForm((f) => ({ ...f, name: e.target.value }))
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>{t.admin.unit}</Label>
								<Input
									value={ingredientForm.unit}
									onChange={(e) =>
										setIngredientForm((f) => ({ ...f, unit: e.target.value }))
									}
								/>
							</div>
							<div>
								<Label>{t.admin.quantity}</Label>
								<Input
									type="number"
									value={ingredientForm.quantity}
									onChange={(e) =>
										setIngredientForm((f) => ({
											...f,
											quantity: e.target.value,
										}))
									}
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>{t.admin.lowThreshold}</Label>
								<Input
									type="number"
									value={ingredientForm.lowThreshold}
									onChange={(e) =>
										setIngredientForm((f) => ({
											...f,
											lowThreshold: e.target.value,
										}))
									}
								/>
							</div>
							<div>
								<Label>{t.admin.costPerUnitLabel}</Label>
								<Input
									type="number"
									step="0.01"
									value={ingredientForm.costPerUnit}
									onChange={(e) =>
										setIngredientForm((f) => ({
											...f,
											costPerUnit: e.target.value,
										}))
									}
								/>
							</div>
						</div>
						<div>
							<Label>{t.admin.supplier}</Label>
							<Input
								value={ingredientForm.supplier}
								onChange={(e) =>
									setIngredientForm((f) => ({ ...f, supplier: e.target.value }))
								}
							/>
						</div>
						<div>
							<Label>{t.admin.category}</Label>
							<Input
								value={ingredientForm.category}
								onChange={(e) =>
									setIngredientForm((f) => ({ ...f, category: e.target.value }))
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIngredientDialogOpen(false)}
						>
							{t.common.cancel}
						</Button>
						<Button
							onClick={handleSaveIngredient}
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
