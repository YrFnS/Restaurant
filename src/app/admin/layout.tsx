import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Panel — Saffron & Spice",
  description: "Manage your restaurant: menu, orders, KDS screens, staff, and more.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
