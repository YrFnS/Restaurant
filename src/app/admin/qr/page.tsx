"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Printer, Download, Utensils, QrCode } from "lucide-react";
import Link from "next/link";
import { useState, useRef } from "react";

export default function AdminQrPage() {
  const { t, isRTL } = useI18n();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const [origin, setOrigin] = useState("");
  useState(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  });

  const { data, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => (await fetch("/api/tables")).json(),
  });
  const tables: any[] = data?.tables || [];

  const grouped: Record<string, any[]> = {};
  tables.forEach((t) => {
    if (!grouped[t.section]) grouped[t.section] = [];
    grouped[t.section].push(t);
  });
  Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.number - b.number));

  const sectionLabels: Record<string, { en: string; ar: string }> = {
    main: { en: "Main Hall", ar: "القاعة الرئيسية" },
    patio: { en: "Patio", ar: "الفناء" },
    bar: { en: "Bar", ar: "البار" },
    private: { en: "Private", ar: "خاص" },
  };

  const getQrUrl = (tableNumber: number) => `${origin}/menu/qr/${tableNumber}`;

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(t.admin.urlCopied);
  };

  const printAll = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header (no print) */}
      <header className="border-b border-border bg-card print:hidden sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><Arrow className="size-5" /></Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <QrCode className="size-5 text-primary" />
                {isRTL ? "رماز الطاولات" : "Table QR Codes"}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {isRTL ? "اطبع رمز QR لكل طاولة — يمسحه الضيوف لعرض القائمة والطلب" : "Print a QR code for each table — guests scan to view menu and order"}
              </p>
            </div>
          </div>
          <Button onClick={printAll} className="gap-2">
            <Printer className="size-4" />
            {isRTL ? "طباعة الكل" : "Print All"}
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">{t.common.loading}</div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([section, secTables]) => {
              const label = sectionLabels[section] || { en: section, ar: section };
              return (
                <div key={section}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px flex-1 bg-border" />
                    <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground px-3">
                      {isRTL ? label.ar : label.en}
                    </h2>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {secTables.map((table) => {
                      const url = getQrUrl(table.number);
                      return (
                        <Card key={table.id} className="print:shadow-none print:border-2 break-inside-avoid">
                          <CardContent className="p-5 text-center">
                            <div className="flex items-center justify-between mb-3">
                              <Badge variant="secondary" className="gap-1">
                                <Utensils className="size-3" />
                                {isRTL ? `طاولة ${table.number}` : `Table ${table.number}`}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{table.capacity} {isRTL ? "مقاعد" : "seats"}</span>
                            </div>
                            <div className="inline-block p-3 bg-white rounded-xl border border-border mb-3">
                              <QRCodeSVG
                                value={url}
                                size={160}
                                level="M"
                                includeMargin={false}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 line-clamp-1" dir="ltr">{url}</p>
                            <div className="flex gap-2 print:hidden">
                              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => copyUrl(url)}>
                                <Download className="size-3.5" />
                                {isRTL ? "نسخ" : "Copy"}
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => window.open(url, "_blank")}>
                                <Utensils className="size-3.5" />
                                {isRTL ? "فتح" : "Open"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
