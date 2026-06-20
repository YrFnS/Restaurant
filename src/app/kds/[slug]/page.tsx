import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { KitchenDisplay } from "@/components/kds/KitchenDisplay";
import type {
  KdsScreen,
  KdsScreenResponse,
  KdsSettings,
  KdsStation,
} from "@/lib/kds/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `KDS · ${slug} — Saffron & Spice`,
    description: "Kitchen Display System screen",
    robots: { index: false, follow: false },
  };
}

export default async function KdsScreenPage({ params }: PageProps) {
  const { slug } = await params;

  // Server-side prefetch for instant first paint
  let initialScreen: KdsScreenResponse | null = null;
  let initialSettings: KdsSettings | null = null;

  try {
    const [screen, stations, settings] = await Promise.all([
      db.kitchenScreen.findUnique({ where: { slug } }),
      db.kitchenStation.findMany({ orderBy: { sortOrder: "asc" } }),
      db.restaurantSettings.findFirst({ where: { id: "1" } }),
    ]);

    if (screen) {
      const stationSlugs = screen.stationFilter
        ? screen.stationFilter.split(",").filter(Boolean)
        : [];
      const filteredStations: KdsStation[] = (stations as any[] ?? [])
        .filter((s) => (stationSlugs.length ? stationSlugs.includes(s.slug) : true))
        .map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          icon: s.icon,
          color: s.color,
          targetPrepMin: s.targetPrepMin,
          isActive: s.isActive,
        }));
      initialScreen = {
        screen: {
          id: screen.id,
          name: screen.name,
          slug: screen.slug,
          description: screen.description,
          stationFilter: screen.stationFilter,
          screenType: screen.screenType as KdsScreen["screenType"],
          layoutType: screen.layoutType as KdsScreen["layoutType"],
          autoRefreshSec: screen.autoRefreshSec,
          showCompleted: screen.showCompleted,
          maxOrders: screen.maxOrders,
          isActive: screen.isActive,
        },
        stations: filteredStations,
      };
    } else {
      initialScreen = { screen: null, stations: [] };
    }

    if (settings) {
      initialSettings = {
        id: settings.id,
        nameEn: settings.nameEn,
        nameAr: settings.nameAr,
        currency: settings.currency,
        currencySymbol: settings.currencySymbol,
        kdsGreenMin: settings.kdsGreenMin,
        kdsYellowMin: settings.kdsYellowMin,
        kdsRedMin: settings.kdsRedMin,
        soundOnNewTicket: settings.soundOnNewTicket,
        avgPrepTimeMin: settings.avgPrepTimeMin,
      } as KdsSettings;
    }
  } catch (e) {
    // DB not ready; the client component will retry
    console.error("[kds/page] prefetch failed:", e);
  }

  return (
    <KitchenDisplay
      slug={slug}
      initialScreen={initialScreen}
      initialSettings={initialSettings}
    />
  );
}
