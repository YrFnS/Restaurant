"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

interface QRCodeMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QRCodeMenu({ open, onOpenChange }: QRCodeMenuProps) {
  const { t, locale } = useI18n();

  const menuUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleDownload = () => {
    const svg = document.querySelector("#menu-qr-code svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "menu-qr.png";
      link.href = pngUrl;
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t.app.name,
          text: t.qr.shareText,
          url: menuUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(menuUrl);
      } catch {
        // ignore
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">{t.qr.title}</DialogTitle>
          <DialogDescription className="text-center">
            {t.qr.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-4">
          {/* QR Code */}
          <div
            id="menu-qr-code"
            className="p-5 bg-white rounded-2xl shadow-lg border border-amber-100"
          >
            <QRCodeSVG
              value={menuUrl}
              size={200}
              level="H"
              includeMargin={false}
              fgColor="#92400e"
              bgColor="#ffffff"
            />
          </div>

          {/* Restaurant branding */}
          <div className="text-center space-y-1">
            <h3 className="font-bold text-lg text-foreground">
              {t.app.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.qr.scanHint}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleShare}
            >
              <Share2 className="size-4" />
              {t.qr.share}
            </Button>
            <Button
              className="flex-1 gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0"
              onClick={handleDownload}
            >
              <Download className="size-4" />
              {t.qr.download}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
