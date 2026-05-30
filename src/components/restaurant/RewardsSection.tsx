"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
	Gift,
	Star,
	Search,
	Phone,
	Loader2,
	AlertCircle,
	Trophy,
	ShoppingBag,
	ArrowRightLeft,
	UserPlus,
	CreditCard,
	Sparkles,
	CheckCircle2,
	Copy,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { toast } from "sonner";

/* ─── Types ─── */
interface Customer {
	id: string;
	name: string;
	phone: string;
	email: string | null;
	loyaltyPoints: number;
	totalSpent: number;
	visits: number;
	createdAt: string;
}

interface GiftCardData {
	id: string;
	code: string;
	amount: number;
	balance: number;
	purchaserName: string;
	recipientName: string;
	message: string | null;
	template: string;
	isRedeemed: boolean;
	createdAt: string;
}

/* ─── Reward tier type (fetched from API) ─── */
interface RewardTier {
	id: string;
	nameEn: string;
	nameAr: string;
	points: number;
	icon: string;
	tier: string;
	sortOrder: number;
}

/* ─── Gift card templates ─── */
const CARD_TEMPLATES = [
	{ key: "birthday", gradient: "from-pink-500 to-orange-400", icon: "🎂" },
	{ key: "thank_you", gradient: "from-teal-500 to-emerald-400", icon: "🙏" },
	{ key: "holiday", gradient: "from-red-500 to-amber-400", icon: "🎄" },
] as const;

// Amount presets come from settings.giftCardAmounts — no hardcoded fallbacks

/* ─── Animation variants ─── */
const fadeIn = {
	initial: { opacity: 0, y: 12 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -12 },
};

const stagger = {
	animate: { transition: { staggerChildren: 0.06 } },
};

/* ─── Component ─── */
export function RewardsSection() {
	const { t, isRTL, locale } = useI18n();
	const customerPhone = useRestaurantStore((s) => s.customerPhone);
	const customerName = useRestaurantStore((s) => s.customerName);
	const setCustomerPhone = useRestaurantStore((s) => s.setCustomerPhone);
	const setCustomerName = useRestaurantStore((s) => s.setCustomerName);
	const settings = useRestaurantStore((s) => s.settings);
	const fetchSettings = useRestaurantStore((s) => s.fetchSettings);
	const currency = settings?.currencySymbol ?? "";

	// Gift card amount presets from settings
	const AMOUNT_PRESETS = settings?.giftCardAmounts
		? settings.giftCardAmounts
				.split(",")
				.map(Number)
				.filter((n) => !isNaN(n) && n > 0)
		: [];

	// Account state
	const [customer, setCustomer] = useState<Customer | null>(null);
	const [lookupPhone, setLookupPhone] = useState(customerPhone || "");
	const [isLookingUp, setIsLookingUp] = useState(false);
	const [lookupError, setLookupError] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	// Sign up
	const [signUpName, setSignUpName] = useState("");
	const [signUpPhone, setSignUpPhone] = useState(customerPhone || "");
	const [signUpEmail, setSignUpEmail] = useState("");
	const [isSigningUp, setIsSigningUp] = useState(false);
	const [showSignUp, setShowSignUp] = useState(false);

	// Gift card form
	const [gcTemplate, setGcTemplate] = useState<string>("birthday");
	const [gcAmount, setGcAmount] = useState<number>(50);
	const [gcCustomAmount, setGcCustomAmount] = useState<string>("");
	const [gcRecipient, setGcRecipient] = useState("");
	const [gcMessage, setGcMessage] = useState("");
	const [gcFrom, setGcFrom] = useState(customerName || "");
	const [isPurchasing, setIsPurchasing] = useState(false);

	// Redeem
	const [redeemSparkle, setRedeemSparkle] = useState<number | null>(null);
	const [giftCards, setGiftCards] = useState<GiftCardData[]>([]);
	const [gcLookupName, setGcLookupName] = useState(customerName || "");
	const [isLoadingGc, setIsLoadingGc] = useState(false);

	// Reward tiers from database
	const [rewardTiers, setRewardTiers] = useState<RewardTier[]>([]);

	// Sync from store
	useEffect(() => {
		if (customerName && !gcFrom) setGcFrom(customerName);
		if (customerPhone && !signUpPhone) setSignUpPhone(customerPhone);
		if (customerPhone && !lookupPhone) setLookupPhone(customerPhone);
	}, [customerName, customerPhone]);

	// Fetch reward tiers and settings from API
	useEffect(() => {
		async function fetchTiers() {
			try {
				const res = await fetch("/api/reward-tiers");
				if (!res.ok) return;
				const data = await res.json();
				if (data.rewardTiers) setRewardTiers(data.rewardTiers);
			} catch {
				// Reward tiers unavailable
			}
		}
		fetchTiers();
		fetchSettings();
	}, [fetchSettings]);

	// Auto-lookup if phone is in store
	useEffect(() => {
		if (customerPhone && !customer && !hasSearched) {
			handleLookup(customerPhone);
		}
	}, []);

	/* ─── Look up account ─── */
	const handleLookup = async (phoneNum?: string) => {
		const num = phoneNum || lookupPhone;
		if (!num.trim()) return;
		setIsLookingUp(true);
		setLookupError(false);
		setHasSearched(true);
		try {
			const res = await fetch(
				`/api/customers?phone=${encodeURIComponent(num.trim())}`,
			);
			if (res.status === 404) {
				setCustomer(null);
				setLookupError(true);
				return;
			}
			if (!res.ok) throw new Error("Failed to fetch");
			const data = await res.json();
			setCustomer(data.customer);
			setLookupError(false);
			setCustomerPhone(num.trim());
		} catch {
			setCustomer(null);
			setLookupError(true);
			toast.error(t.common.error);
		} finally {
			setIsLookingUp(false);
		}
	};

	/* ─── Sign up ─── */
	const handleSignUp = async () => {
		if (!signUpName || !signUpPhone) {
			toast.error(t.common.error, { description: t.common.requiredFields });
			return;
		}
		setIsSigningUp(true);
		try {
			const res = await fetch("/api/customers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: signUpName,
					phone: signUpPhone,
					email: signUpEmail || undefined,
				}),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to create account");
			}
			const data = await res.json();
			setCustomer(data.customer);
			setCustomerPhone(signUpPhone);
			setCustomerName(signUpName);
			setShowSignUp(false);
			toast.success(t.rewards.createAccount);
		} catch (err) {
			toast.error(t.common.error, {
				description: err instanceof Error ? err.message : t.common.error,
			});
		} finally {
			setIsSigningUp(false);
		}
	};

	/* ─── Redeem reward ─── */
	const handleRedeem = async (points: number) => {
		if (!customer || customer.loyaltyPoints < points) return;
		setRedeemSparkle(points);
		try {
			const res = await fetch(`/api/customers/${customer.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					loyaltyPoints: customer.loyaltyPoints - points,
				}),
			});
			if (!res.ok) throw new Error("Failed to redeem");
			const data = await res.json();
			setCustomer(data.customer);
			toast.success(t.rewards.redeem, { description: t.rewards.redeemSuccess });
		} catch {
			toast.error(t.common.error);
		}
		setTimeout(() => setRedeemSparkle(null), 1500);
	};

	/* ─── Purchase gift card ─── */
	const handlePurchaseGc = async () => {
		const amount = gcCustomAmount ? parseFloat(gcCustomAmount) : gcAmount;
		if (!amount || amount <= 0 || !gcRecipient || !gcFrom) {
			toast.error(t.common.error, { description: t.common.requiredFields });
			return;
		}
		setIsPurchasing(true);
		try {
			const res = await fetch("/api/gift-cards", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					amount,
					purchaserName: gcFrom,
					recipientName: gcRecipient,
					message: gcMessage || undefined,
					template: gcTemplate,
				}),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to purchase");
			}
			toast.success(t.rewards.purchasedSuccess);
			// Reset form
			setGcRecipient("");
			setGcMessage("");
			setGcCustomAmount("");
			// Refresh gift cards
			if (gcFrom) fetchGiftCards(gcFrom);
		} catch (err) {
			toast.error(t.common.error, {
				description: err instanceof Error ? err.message : t.common.error,
			});
		} finally {
			setIsPurchasing(false);
		}
	};

	/* ─── Fetch gift cards ─── */
	const fetchGiftCards = async (purchaserName: string) => {
		if (!purchaserName.trim()) return;
		setIsLoadingGc(true);
		try {
			const res = await fetch(
				`/api/gift-cards?purchaserName=${encodeURIComponent(purchaserName.trim())}`,
			);
			if (!res.ok) throw new Error("Failed to fetch");
			const data = await res.json();
			setGiftCards(data.giftCards || []);
		} catch {
			setGiftCards([]);
		} finally {
			setIsLoadingGc(false);
		}
	};

	/* ─── Copy code ─── */
	const copyCode = (code: string) => {
		navigator.clipboard.writeText(code);
		toast.success(t.common.copied);
	};

	/* ─── Next reward calculation ─── */
	const getNextReward = () => {
		if (!customer || rewardTiers.length === 0) return null;
		const points = customer.loyaltyPoints;
		for (const tier of rewardTiers) {
			if (points < tier.points) {
				return {
					...tier,
					remaining: tier.points - points,
					progress: (points / tier.points) * 100,
				};
			}
		}
		return null;
	};
	const nextReward = getNextReward();

	/* ─── Get template gradient ─── */
	const getTemplateGradient = (key: string) => {
		const tmpl = CARD_TEMPLATES.find((t) => t.key === key);
		return tmpl?.gradient || "from-gray-500 to-gray-400";
	};

	const getTemplateIcon = (key: string) => {
		const tmpl = CARD_TEMPLATES.find((t) => t.key === key);
		return tmpl?.icon || "🎁";
	};

	/* ─── Effective amount for gift card ─── */
	const effectiveAmount = gcCustomAmount
		? parseFloat(gcCustomAmount) || 0
		: gcAmount;

	return (
		<div className="min-h-screen bg-background">
			<motion.div
				className="px-4 py-6 max-w-2xl mx-auto space-y-6"
				variants={stagger}
				initial="initial"
				animate="animate"
			>
				{/* ─── Header ─── */}
				<motion.div variants={fadeIn} className="text-center">
					<motion.div
						initial={{ scale: 0, rotate: -180 }}
						animate={{ scale: 1, rotate: 0 }}
						transition={{
							type: "spring",
							stiffness: 200,
							damping: 15,
							delay: 0.1,
						}}
						className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-rose-500/15 to-pink-500/15 border border-rose-500/20 mb-3"
					>
						<Gift className="size-8 text-rose-600 dark:text-rose-400" />
					</motion.div>
					<h1 className="text-2xl font-bold">{t.rewards.title}</h1>
					<p className="text-muted-foreground mt-1">{t.rewards.subtitle}</p>
				</motion.div>

				{/* ─── Tabs ─── */}
				<motion.div variants={fadeIn}>
					<Tabs defaultValue="rewards" className="w-full">
						<TabsList className="w-full">
							<TabsTrigger value="rewards" className="flex-1">
								<Trophy className="size-4 me-1.5" />
								{t.rewards.rewardsTab}
							</TabsTrigger>
							<TabsTrigger value="giftcards" className="flex-1">
								<CreditCard className="size-4 me-1.5" />
								{t.rewards.giftCardsTab}
							</TabsTrigger>
						</TabsList>

						{/* ═══ REWARDS TAB ═══ */}
						<TabsContent value="rewards" className="space-y-6 mt-4">
							{/* Lookup / Account */}
							{!customer ? (
								<Card className="shadow-sm border-border/50">
									<CardContent className="pt-6 space-y-4">
										{!showSignUp ? (
											<>
												<div className="text-center">
													<Search className="size-10 text-muted-foreground mx-auto mb-2" />
													<p className="font-medium">{t.rewards.lookupPhone}</p>
													<p className="text-sm text-muted-foreground">
														{t.rewards.lookupDesc}
													</p>
												</div>
												<div className="flex gap-2">
													<div className="relative flex-1">
														<Phone className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
														<Input
															placeholder={t.rewards.phonePlaceholder}
															value={lookupPhone}
															onChange={(e) => setLookupPhone(e.target.value)}
															className="ps-9"
															type="tel"
														/>
													</div>
													<Button
														onClick={() => handleLookup()}
														disabled={isLookingUp || !lookupPhone.trim()}
													>
														{isLookingUp ? (
															<Loader2 className="size-4 animate-spin" />
														) : (
															<Search className="size-4" />
														)}
													</Button>
												</div>
												{lookupError && hasSearched && (
													<div className="text-center">
														<p className="text-sm text-muted-foreground mb-3">
															{t.rewards.notOnList}
														</p>
														<Button
															variant="outline"
															onClick={() => setShowSignUp(true)}
														>
															<UserPlus className="size-4 me-2" />
															{t.rewards.signUp}
														</Button>
													</div>
												)}
											</>
										) : (
											<div className="space-y-4">
												<div className="text-center">
													<UserPlus className="size-10 text-primary mx-auto mb-2" />
													<p className="font-medium">{t.rewards.signUp}</p>
													<p className="text-sm text-muted-foreground">
														{t.rewards.signUpDesc}
													</p>
												</div>
												<div className="space-y-1.5">
													<Label>{t.rewards.name}</Label>
													<Input
														placeholder={t.rewards.namePlaceholder}
														value={signUpName}
														onChange={(e) => setSignUpName(e.target.value)}
													/>
												</div>
												<div className="space-y-1.5">
													<Label>{t.rewards.phoneLabel}</Label>
													<Input
														placeholder={t.rewards.phonePlaceholder}
														value={signUpPhone}
														onChange={(e) => setSignUpPhone(e.target.value)}
														type="tel"
													/>
												</div>
												<div className="space-y-1.5">
													<Label>{t.rewards.email}</Label>
													<Input
														placeholder={t.rewards.emailPlaceholder}
														value={signUpEmail}
														onChange={(e) => setSignUpEmail(e.target.value)}
														type="email"
													/>
												</div>
												<Button
													className="w-full"
													onClick={handleSignUp}
													disabled={isSigningUp}
												>
													{isSigningUp ? (
														<Loader2 className="size-4 animate-spin me-2" />
													) : (
														<UserPlus className="size-4 me-2" />
													)}
													{t.rewards.createAccount}
												</Button>
												<Button
													variant="ghost"
													className="w-full"
													onClick={() => setShowSignUp(false)}
												>
													{t.common.back}
												</Button>
											</div>
										)}
									</CardContent>
								</Card>
							) : (
								<>
									{/* ─── Account Dashboard ─── */}
									<Card className="border-primary/20 shadow-sm">
										<CardContent className="pt-6 space-y-4">
											<div className="flex items-center justify-between">
												<div>
													<p className="text-sm text-muted-foreground">
														{t.rewards.welcomeBack}
													</p>
													<p className="text-lg font-bold">{customer.name}</p>
												</div>
												<div className="text-end">
													<p className="text-sm text-muted-foreground">
														{t.rewards.memberSince}
													</p>
													<p className="text-sm font-medium">
														{format(new Date(customer.createdAt), "MMM yyyy")}
													</p>
												</div>
											</div>

											<Separator />

											{/* Points balance */}
											<div className="text-center py-2">
												<motion.div
													animate={{ scale: [1, 1.05, 1] }}
													transition={{
														repeat: Infinity,
														duration: 3,
														ease: "easeInOut",
													}}
													className="inline-flex items-center justify-center size-20 rounded-full bg-primary/10 mb-2"
												>
													<Star className="size-10 text-primary" />
												</motion.div>
												<p className="text-4xl font-bold text-primary">
													{customer.loyaltyPoints}
												</p>
												<p className="text-sm text-muted-foreground">
													{t.rewards.yourPoints}
												</p>
											</div>

											{/* Stats */}
											<div className="grid grid-cols-2 gap-3">
												<div className="text-center p-3 rounded-lg bg-muted/50">
													<p className="text-lg font-bold">
														{currency}
														{customer.totalSpent.toFixed(0)}
													</p>
													<p className="text-xs text-muted-foreground">
														{t.rewards.totalSpent}
													</p>
												</div>
												<div className="text-center p-3 rounded-lg bg-muted/50">
													<p className="text-lg font-bold">{customer.visits}</p>
													<p className="text-xs text-muted-foreground">
														{t.rewards.visits}
													</p>
												</div>
											</div>

											{/* Next reward progress */}
											{nextReward && (
												<div className="space-y-2">
													<div className="flex items-center justify-between text-sm">
														<span className="text-muted-foreground">
															{t.rewards.nextReward}
														</span>
														<span className="font-medium">
															{nextReward.remaining} {t.rewards.pointsToNext}
														</span>
													</div>
													<div className="h-2.5 bg-muted rounded-full overflow-hidden">
														<motion.div
															className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-full progress-glow"
															initial={{ width: "0%" }}
															animate={{ width: `${nextReward.progress}%` }}
															transition={{ duration: 1.2, ease: "easeOut" }}
														/>
													</div>
													<p className="text-xs text-muted-foreground">
														{nextReward.icon}{" "}
														{locale === "ar"
															? nextReward.nameAr
															: nextReward.nameEn}{" "}
														— {nextReward.points} {t.rewards.pointsNeeded}
													</p>
												</div>
											)}

											<p className="text-xs text-center text-muted-foreground">
												{t.rewards.earnMore}
											</p>
										</CardContent>
									</Card>

									{/* ─── How It Works ─── */}
									<Card className="shadow-sm border-border/50">
										<CardHeader className="pb-3">
											<CardTitle className="text-base">
												{t.rewards.howItWorks}
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="space-y-3">
												{[
													{
														icon: ShoppingBag,
														label: t.rewards.step1,
														num: "1",
													},
													{
														icon: ArrowRightLeft,
														label: t.rewards.step2,
														num: "2",
													},
													{ icon: Gift, label: t.rewards.step3, num: "3" },
												].map((step) => (
													<div
														key={step.num}
														className="flex items-center gap-3"
													>
														<div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
															{step.num}
														</div>
														<step.icon className="size-4 text-muted-foreground shrink-0" />
														<span className="text-sm">{step.label}</span>
													</div>
												))}
											</div>
										</CardContent>
									</Card>

									{/* ─── Available Rewards ─── */}
									<Card className="shadow-sm border-border/50">
										<CardHeader className="pb-3">
											<CardTitle className="text-base">
												{t.rewards.rewards}
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3">
											{rewardTiers.map((tier) => {
												const canRedeem = customer.loyaltyPoints >= tier.points;
												return (
													<div
														key={tier.id}
														className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
															canRedeem
																? "hover:shadow-md hover:border-primary/30"
																: ""
														}`}
													>
														<div className="flex items-center gap-3">
															<motion.span
																animate={
																	canRedeem
																		? { scale: [1, 1.15, 1] }
																		: { scale: 1 }
																}
																transition={{
																	repeat: canRedeem ? Infinity : 0,
																	duration: 2,
																	ease: "easeInOut",
																}}
																className="text-2xl"
															>
																{tier.icon}
															</motion.span>
															<div>
																<p className="font-medium text-sm">
																	{locale === "ar" ? tier.nameAr : tier.nameEn}
																</p>
																<div className="flex items-center gap-1.5">
																	<span
																		className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full tier-badge-${tier.tier}`}
																	>
																		{tier.tier.charAt(0).toUpperCase() +
																			tier.tier.slice(1)}
																	</span>
																	<p className="text-xs text-muted-foreground">
																		{tier.points} {t.rewards.pointsNeeded}
																	</p>
																</div>
															</div>
														</div>
														<div className="relative">
															<Button
																size="sm"
																variant={canRedeem ? "default" : "outline"}
																disabled={!canRedeem}
																onClick={() => handleRedeem(tier.points)}
															>
																{canRedeem
																	? t.rewards.redeem
																	: t.rewards.notEnoughPoints}
															</Button>
															{/* Sparkle effect on redeem */}
															{redeemSparkle === tier.points && (
																<>
																	<motion.span
																		className="absolute -top-3 start-2 text-sm pointer-events-none"
																		initial={{ scale: 0, opacity: 1 }}
																		animate={{ scale: 1.5, opacity: 0, y: -15 }}
																		transition={{ duration: 0.8 }}
																	>
																		✨
																	</motion.span>
																	<motion.span
																		className="absolute -top-2 end-0 text-xs pointer-events-none"
																		initial={{ scale: 0, opacity: 1 }}
																		animate={{ scale: 1.2, opacity: 0, y: -10 }}
																		transition={{ duration: 0.6, delay: 0.2 }}
																	>
																		⭐
																	</motion.span>
																</>
															)}
														</div>
													</div>
												);
											})}
										</CardContent>
									</Card>
								</>
							)}
						</TabsContent>

						{/* ═══ GIFT CARDS TAB ═══ */}
						<TabsContent value="giftcards" className="space-y-6 mt-4">
							{/* Buy Gift Card */}
							<Card className="shadow-sm border-border/50">
								<CardHeader className="pb-3">
									<CardTitle className="text-base flex items-center gap-2">
										<div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
											<CreditCard className="size-4 text-primary" />
										</div>
										{t.rewards.buyGiftCard}
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									{/* Template selection */}
									<div className="space-y-1.5">
										<Label>{t.rewards.selectTemplate}</Label>
										<div className="grid grid-cols-3 gap-2">
											{CARD_TEMPLATES.map((tmpl) => (
												<button
													key={tmpl.key}
													onClick={() => setGcTemplate(tmpl.key)}
													className={`relative rounded-lg border-2 p-2 text-center transition-all ${
														gcTemplate === tmpl.key
															? "border-primary shadow-sm"
															: "border-transparent hover:border-muted"
													}`}
												>
													<span className="text-xl">{tmpl.icon}</span>
													<p className="text-[10px] mt-1 font-medium">
														{t.rewards.template[tmpl.key]}
													</p>
												</button>
											))}
										</div>
									</div>

									{/* Amount */}
									<div className="space-y-1.5">
										<Label>{t.rewards.balance}</Label>
										<div className="flex flex-wrap gap-2">
											{AMOUNT_PRESETS.map((amt) => (
												<Button
													key={amt}
													variant={
														gcAmount === amt && !gcCustomAmount
															? "default"
															: "outline"
													}
													size="sm"
													onClick={() => {
														setGcAmount(amt);
														setGcCustomAmount("");
													}}
												>
													{currency}
													{amt}
												</Button>
											))}
											<div className="relative">
												<Input
													placeholder={t.rewards.customAmount}
													value={gcCustomAmount}
													onChange={(e) => setGcCustomAmount(e.target.value)}
													className="w-24 h-9 text-sm"
													type="number"
													min="1"
												/>
											</div>
										</div>
									</div>

									{/* Recipient */}
									<div className="space-y-1.5">
										<Label>{t.rewards.recipient}</Label>
										<Input
											placeholder={t.rewards.recipientPlaceholder}
											value={gcRecipient}
											onChange={(e) => setGcRecipient(e.target.value)}
										/>
									</div>

									{/* Message */}
									<div className="space-y-1.5">
										<Label>{t.rewards.message}</Label>
										<Textarea
											placeholder={t.rewards.messagePlaceholder}
											value={gcMessage}
											onChange={(e) => setGcMessage(e.target.value)}
											rows={2}
										/>
									</div>

									{/* From */}
									<div className="space-y-1.5">
										<Label>{t.rewards.from}</Label>
										<Input
											placeholder={t.rewards.fromPlaceholder}
											value={gcFrom}
											onChange={(e) => setGcFrom(e.target.value)}
										/>
									</div>

									{/* Preview */}
									{gcRecipient && effectiveAmount > 0 && (
										<motion.div
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											className="rounded-xl overflow-hidden shadow-lg"
										>
											<div
												className={`bg-gradient-to-br ${getTemplateGradient(gcTemplate)} p-5 text-white relative`}
											>
												{/* Decorative pattern */}
												<div className="absolute inset-0 opacity-10">
													<div className="absolute top-2 start-2 size-8 rounded-full border-2 border-white" />
													<div className="absolute top-6 start-6 size-4 rounded-full border border-white" />
													<div className="absolute bottom-4 end-4 size-12 rounded-full border-2 border-white" />
													<div className="absolute bottom-8 end-8 size-6 rounded-full border border-white" />
													<div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 size-20 rounded-full border border-white" />
												</div>
												<div className="relative z-10">
													<div className="flex items-center justify-between mb-6">
														<span className="text-2xl">
															{getTemplateIcon(gcTemplate)}
														</span>
														<span className="text-xs font-medium opacity-80">
															{t.app.name}
														</span>
													</div>
													<p className="text-xl font-bold mb-1">
														{currency}
														{effectiveAmount.toFixed(2)}
													</p>
													<p className="text-sm opacity-90 mb-3">
														{t.admin.to}: {gcRecipient}
													</p>
													{gcMessage && (
														<p className="text-xs opacity-75 italic line-clamp-2">
															&ldquo;{gcMessage}&rdquo;
														</p>
													)}
													<p className="text-xs opacity-60 mt-2">
														{t.admin.from || "From"}: {gcFrom}
													</p>
												</div>
											</div>
										</motion.div>
									)}

									{/* Purchase */}
									<Button
										className="w-full"
										size="lg"
										onClick={handlePurchaseGc}
										disabled={
											isPurchasing ||
											!gcRecipient ||
											!gcFrom ||
											effectiveAmount <= 0
										}
									>
										{isPurchasing ? (
											<Loader2 className="size-4 animate-spin me-2" />
										) : (
											<Sparkles className="size-4 me-2" />
										)}
										{t.rewards.purchase}
									</Button>
								</CardContent>
							</Card>

							{/* My Gift Cards */}
							<Card className="shadow-sm border-border/50">
								<CardHeader className="pb-3">
									<CardTitle className="text-base">
										{t.rewards.myGiftCards}
									</CardTitle>
									<CardDescription>{t.rewards.lookupGiftCards}</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex gap-2">
										<Input
											placeholder={t.rewards.fromPlaceholder}
											value={gcLookupName}
											onChange={(e) => setGcLookupName(e.target.value)}
										/>
										<Button
											onClick={() => fetchGiftCards(gcLookupName)}
											disabled={isLoadingGc || !gcLookupName.trim()}
										>
											{isLoadingGc ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												<Search className="size-4" />
											)}
										</Button>
									</div>

									<AnimatePresence mode="wait">
										{giftCards.length === 0 && gcLookupName && !isLoadingGc ? (
											<motion.div
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												exit={{ opacity: 0 }}
												className="text-center py-6"
											>
												<div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
													<AlertCircle className="size-7 text-muted-foreground" />
												</div>
												<p className="text-sm text-muted-foreground">
													{t.rewards.noGiftCards}
												</p>
											</motion.div>
										) : (
											<motion.div
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												exit={{ opacity: 0 }}
												className="space-y-3 max-h-64 overflow-y-auto"
											>
												{giftCards.map((gc) => (
													<div
														key={gc.id}
														className="p-3 rounded-lg border bg-card space-y-2"
													>
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-2">
																<span className="text-lg">
																	{getTemplateIcon(gc.template)}
																</span>
																<div>
																	<p className="text-sm font-medium">
																		{currency}
																		{gc.balance.toFixed(2)}
																	</p>
																	<p className="text-xs text-muted-foreground">
																		{t.admin.to}: {gc.recipientName}
																	</p>
																</div>
															</div>
															<Badge
																variant={gc.isRedeemed ? "outline" : "default"}
																className={
																	gc.isRedeemed
																		? ""
																		: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
																}
															>
																{gc.isRedeemed
																	? t.rewards.redeemed
																	: t.rewards.active}
															</Badge>
														</div>
														<div className="flex items-center gap-1.5">
															<code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
																{gc.code}
															</code>
															<Button
																variant="ghost"
																size="sm"
																className="h-6 w-6 p-0"
																onClick={() => copyCode(gc.code)}
															>
																<Copy className="size-3" />
															</Button>
														</div>
													</div>
												))}
											</motion.div>
										)}
									</AnimatePresence>
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</motion.div>

				{/* Bottom spacing */}
				<div className="h-4" />
			</motion.div>
		</div>
	);
}
