"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	ChefHat,
	Monitor,
	Settings,
	Home,
	Menu,
	X,
	Shield,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/staff/ThemeToggle";
import { LanguageToggle } from "@/components/staff/LanguageToggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
	{ href: "/kitchen", labelKey: "kitchen", icon: ChefHat },
	{ href: "/pos", labelKey: "pos", icon: Monitor },
	{ href: "/admin", labelKey: "admin", icon: Settings },
	{ href: "/", labelKey: "home", icon: Home },
] as const;

export function StaffNavBar() {
	const { t, isRTL } = useI18n();
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);

	const getLabel = (key: string) => {
		switch (key) {
			case "kitchen":
				return t.kitchen?.title || "Kitchen";
			case "pos":
				return t.pos?.title || "POS";
			case "admin":
				return t.admin?.title || "Admin";
			case "home":
				return t.nav?.home || "Home";
			default:
				return key;
		}
	};

	const isActive = (href: string) => {
		if (href === "/") return pathname === "/";
		return pathname.startsWith(href);
	};

	return (
		<nav
			dir={isRTL ? "rtl" : "ltr"}
			className="sticky top-0 z-50 w-full border-b border-amber-500/20 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-white shadow-lg shadow-amber-600/15"
		>
			{/* Desktop / Main bar */}
			<div className="flex items-center justify-between h-11 px-3">
				{/* Left side: Staff badge + nav links */}
				<div className="flex items-center gap-2">
					{/* Staff badge */}
					<div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-md backdrop-blur-sm border border-white/10">
						<Shield className="size-3.5" />
						<span className="text-xs font-semibold tracking-wide uppercase">
							{t.staff?.staffArea || "Staff"}
						</span>
					</div>

					{/* Desktop nav links */}
					<div className="hidden sm:flex items-center gap-0.5 ms-2">
						{NAV_ITEMS.map((item) => {
							const Icon = item.icon;
							const active = isActive(item.href);
							const isHome = item.href === "/";

							return (
								<Link
									key={item.href}
									href={item.href}
									className={cn(
										"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
										active
											? "bg-white/25 text-white shadow-sm backdrop-blur-sm"
											: "text-white/80 hover:bg-white/15 hover:text-white",
										isHome && "border border-white/30",
									)}
								>
									<Icon className="size-3.5" />
									<span>{getLabel(item.labelKey)}</span>
									{isHome && (
										<span className="text-white/60 text-[10px]">←</span>
									)}
								</Link>
							);
						})}
					</div>
				</div>

				{/* Right side: toggles + mobile menu button */}
				<div className="flex items-center gap-1">
					<LanguageToggle
						size="sm"
						className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/15"
						variant="label"
					/>
					<ThemeToggle
						size="sm"
						className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/15"
					/>

					{/* Mobile hamburger */}
					<button
						onClick={() => setMobileOpen(!mobileOpen)}
						className="sm:hidden flex items-center justify-center h-7 w-7 rounded-md text-white/80 hover:text-white hover:bg-white/15 transition-colors"
						aria-label="Toggle menu"
					>
						{mobileOpen ? (
							<X className="size-4" />
						) : (
							<Menu className="size-4" />
						)}
					</button>
				</div>
			</div>

			{/* Mobile dropdown */}
			{mobileOpen && (
				<div className="sm:hidden border-t border-white/15 bg-amber-700/90 backdrop-blur-sm">
					<div className="flex flex-col gap-0.5 p-2">
						{NAV_ITEMS.map((item) => {
							const Icon = item.icon;
							const active = isActive(item.href);

							return (
								<Link
									key={item.href}
									href={item.href}
									onClick={() => setMobileOpen(false)}
									className={cn(
										"flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
										active
											? "bg-white/25 text-white"
											: "text-white/75 hover:bg-white/15 hover:text-white",
									)}
								>
									<Icon className="size-4" />
									<span>{getLabel(item.labelKey)}</span>
								</Link>
							);
						})}
					</div>
				</div>
			)}
		</nav>
	);
}
