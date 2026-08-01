import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/session";
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

const KDS_PAGE_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "server",
  "cook",
  "bartender",
]);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `KDS · ${slug} — Restaurant`,
    description: "Kitchen Display System screen",
    robots: { index: false, follow: false },
  };
}

export default async function KdsScreenPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await getStaffSession();

  if (!session) {
    redirect(`/admin?next=${encodeURIComponent(`/kds/${slug}`)}`);
  }
  if (!KDS_PAGE_ROLES.has(session.role)) {
    redirect("/admin?error=kds_access_denied");
  }

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
      const filteredStations: KdsStation[] = (stations ?? [])
        .filter((station) =>
          stationSlugs.length ? stationSlugs.includes(station.slug) : true
        )
        .map((station) => ({
          id: station.id,
          name: station.name,
          slug: station.slug,
          icon: station.icon,
          color: station.color,
          targetPrepMin: station.targetPrepMin,
          isActive: station.isActive,
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
  } catch (error) {
    console.error("[kds/page] prefetch failed:", error);
  }

  return (
    <KitchenDisplay
      slug={slug}
      initialScreen={initialScreen}
      initialSettings={initialSettings}
    />
  );
}
