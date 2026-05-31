import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	ChefHat,
	ImageIcon,
	Globe,
	Clock,
	DollarSign,
	Trophy,
	Save,
	RefreshCw,
	Facebook,
	Instagram,
	Twitter,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import ImageUploadButton from "@/components/shared/ImageUploadButton";
import { useI18n } from "@/lib/i18n";

interface SettingsTabProps {
	settingsLoaded: boolean;
	fetchSettings: () => void;
	savingSettings: boolean;
	settingsForm: {
		nameEn: string;
		nameAr: string;
		taglineEn: string;
		taglineAr: string;
		descriptionEn: string;
		descriptionAr: string;
		phone: string;
		email: string;
		addressEn: string;
		addressAr: string;
		logoUrl: string;
		heroImageUrl: string;
		facebookUrl: string;
		instagramUrl: string;
		twitterUrl: string;
		taxRate: string;
		tipPresets: string;
		deliveryFee: string;
		minDeliveryOrder: string;
		deliveryRadius: string;
		avgPrepTime: string;
		currencySymbol: string;
		openTime: string;
		closeTime: string;
		statsOrdersServed: string;
		statsHappyCustomers: string;
		statsYearsService: string;
	};
	setSettingsForm: React.Dispatch<
		React.SetStateAction<{
			nameEn: string;
			nameAr: string;
			taglineEn: string;
			taglineAr: string;
			descriptionEn: string;
			descriptionAr: string;
			phone: string;
			email: string;
			addressEn: string;
			addressAr: string;
			logoUrl: string;
			heroImageUrl: string;
			facebookUrl: string;
			instagramUrl: string;
			twitterUrl: string;
			taxRate: string;
			tipPresets: string;
			deliveryFee: string;
			minDeliveryOrder: string;
			deliveryRadius: string;
			avgPrepTime: string;
			currencySymbol: string;
			openTime: string;
			closeTime: string;
			statsOrdersServed: string;
			statsHappyCustomers: string;
			statsYearsService: string;
		}>
	>;
	handleSaveSettings: () => void;
}

export default function SettingsTab({
	settingsLoaded,
	fetchSettings,
	savingSettings,
	settingsForm,
	setSettingsForm,
	handleSaveSettings,
}: SettingsTabProps) {
	const { t } = useI18n();

	useEffect(() => {
		if (!settingsLoaded) fetchSettings();
	}, [settingsLoaded]);

	return (
		<div className="space-y-4">
			<h2 className="text-xl font-bold">{t.admin.settings}</h2>
			{!settingsLoaded ? (
				<div className="flex items-center justify-center h-32">
					<RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					{/* Restaurant Information */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<ChefHat className="h-4 w-4 text-amber-600" />
								<CardTitle className="text-base">
									{t.admin.restaurantInfo}
								</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div>
									<Label className="text-sm">{t.admin.nameEn}</Label>
									<Input
										value={settingsForm.nameEn}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												nameEn: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.nameAr}</Label>
									<Input
										value={settingsForm.nameAr}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												nameAr: e.target.value,
											})
										}
										dir="rtl"
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.tagline}</Label>
									<Input
										value={settingsForm.taglineEn}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												taglineEn: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.taglineAr}</Label>
									<Input
										value={settingsForm.taglineAr}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												taglineAr: e.target.value,
											})
										}
										dir="rtl"
									/>
								</div>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div>
									<Label className="text-sm">{t.admin.descriptionEn}</Label>
									<Textarea
										rows={3}
										value={settingsForm.descriptionEn}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												descriptionEn: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.descriptionAr}</Label>
									<Textarea
										rows={3}
										value={settingsForm.descriptionAr}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												descriptionAr: e.target.value,
											})
										}
										dir="rtl"
									/>
								</div>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div>
									<Label className="text-sm">{t.admin.phone}</Label>
									<Input
										value={settingsForm.phone}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												phone: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.email}</Label>
									<Input
										value={settingsForm.email}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												email: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.addressEn}</Label>
									<Input
										value={settingsForm.addressEn}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												addressEn: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.addressAr}</Label>
									<Input
										value={settingsForm.addressAr}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												addressAr: e.target.value,
											})
										}
										dir="rtl"
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Branding */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<ImageIcon className="h-4 w-4 text-amber-600" />
								<CardTitle className="text-base">
									{t.admin.branding}
								</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label className="text-sm">{t.admin.logoUrl}</Label>
									<ImageUploadButton
										value={settingsForm.logoUrl}
										onChange={(url) =>
											setSettingsForm({ ...settingsForm, logoUrl: url })
										}
										label={t.admin.uploadImage}
										size="sm"
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="text-sm">{t.admin.heroImageUrl}</Label>
									<ImageUploadButton
										value={settingsForm.heroImageUrl}
										onChange={(url) =>
											setSettingsForm({ ...settingsForm, heroImageUrl: url })
										}
										label={t.admin.uploadImage}
										size="sm"
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Social Media */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Globe className="h-4 w-4 text-amber-600" />
								<CardTitle className="text-base">
									{t.admin.socialMedia}
								</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<div>
									<Label className="text-sm flex items-center gap-1.5">
										<Facebook className="h-3.5 w-3.5" /> {t.admin.facebookUrl}
									</Label>
									<Input
										value={settingsForm.facebookUrl}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												facebookUrl: e.target.value,
											})
										}
										placeholder="https://facebook.com/..."
									/>
								</div>
								<div>
									<Label className="text-sm flex items-center gap-1.5">
										<Instagram className="h-3.5 w-3.5" />{" "}
										{t.admin.instagramUrl}
									</Label>
									<Input
										value={settingsForm.instagramUrl}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												instagramUrl: e.target.value,
											})
										}
										placeholder="https://instagram.com/..."
									/>
								</div>
								<div>
									<Label className="text-sm flex items-center gap-1.5">
										<Twitter className="h-3.5 w-3.5" /> {t.admin.twitterUrl}
									</Label>
									<Input
										value={settingsForm.twitterUrl}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												twitterUrl: e.target.value,
											})
										}
										placeholder="https://twitter.com/..."
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Operating Hours */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Clock className="h-4 w-4 text-amber-600" />
								<CardTitle className="text-base">
									{t.admin.operatingHours}
								</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-2">
							<div className="flex items-center gap-3">
								<span className="w-24 text-sm">
									{t.admin.openTime || "Open"}
								</span>
								<Input
									className="w-24 h-8 text-sm"
									value={settingsForm.openTime}
									onChange={(e) =>
										setSettingsForm({
											...settingsForm,
											openTime: e.target.value,
										})
									}
								/>
								<span className="text-sm text-muted-foreground">
									{t.admin.to}
								</span>
								<Input
									className="w-24 h-8 text-sm"
									value={settingsForm.closeTime}
									onChange={(e) =>
										setSettingsForm({
											...settingsForm,
											closeTime: e.target.value,
										})
									}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Financial Settings */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<DollarSign className="h-4 w-4 text-amber-600" />
								<CardTitle className="text-base">
									{t.admin.financialSettings}
								</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
								<div>
									<Label className="text-sm">{t.admin.taxRateLabel}</Label>
									<Input
										type="number"
										value={settingsForm.taxRate}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												taxRate: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.tipPresetsLabel}</Label>
									<Input
										value={settingsForm.tipPresets}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												tipPresets: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.minOrderLabel}</Label>
									<Input
										type="number"
										value={settingsForm.minDeliveryOrder}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												minDeliveryOrder: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">{t.admin.radiusLabel}</Label>
									<Input
										type="number"
										value={settingsForm.deliveryRadius}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												deliveryRadius: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">
										{t.admin.deliveryFeeLabel}
									</Label>
									<Input
										type="number"
										step="0.01"
										value={settingsForm.deliveryFee}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												deliveryFee: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">
										{t.admin.avgPrepTimeLabel}
									</Label>
									<Input
										type="number"
										value={settingsForm.avgPrepTime}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												avgPrepTime: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">
										{t.admin.currencySymbolLabel}
									</Label>
									<Input
										value={settingsForm.currencySymbol}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												currencySymbol: e.target.value,
											})
										}
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Statistics */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Trophy className="h-4 w-4 text-amber-600" />
								<CardTitle className="text-base">
									{t.admin.statistics}
								</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<div>
									<Label className="text-sm">
										{t.admin.statsOrdersServed}
									</Label>
									<Input
										type="number"
										value={settingsForm.statsOrdersServed}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												statsOrdersServed: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">
										{t.admin.statsHappyCustomers}
									</Label>
									<Input
										type="number"
										value={settingsForm.statsHappyCustomers}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												statsHappyCustomers: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-sm">
										{t.admin.statsYearsService}
									</Label>
									<Input
										type="number"
										value={settingsForm.statsYearsService}
										onChange={(e) =>
											setSettingsForm({
												...settingsForm,
												statsYearsService: e.target.value,
											})
										}
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					<Button
						className="bg-amber-600 hover:bg-amber-500"
						onClick={handleSaveSettings}
						disabled={savingSettings}
					>
						{savingSettings ? (
							<RefreshCw className="h-4 w-4 me-1 animate-spin" />
						) : (
							<Save className="h-4 w-4 me-1" />
						)}{" "}
						{t.admin.saveSettings}
					</Button>
				</>
			)}
		</div>
	);
}
