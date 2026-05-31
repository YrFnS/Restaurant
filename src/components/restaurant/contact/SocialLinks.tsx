"use client";

import React from "react";
import { Facebook, Instagram, Twitter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface SocialLinksProps {
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
}

export function SocialLinks({ facebookUrl, instagramUrl, twitterUrl }: SocialLinksProps) {
  const { t } = useI18n();

  return (
    <Card className="shadow-sm border-border/50">
      <CardContent className="pt-6">
        <p className="text-sm font-medium mb-3">{t.contact.followUs}</p>
        <div className="flex items-center gap-2">
          {facebookUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                <Facebook className="size-4 me-1.5" />
                Facebook
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <Facebook className="size-4 me-1.5" />
              Facebook
            </Button>
          )}
          {instagramUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
                <Instagram className="size-4 me-1.5" />
                Instagram
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <Instagram className="size-4 me-1.5" />
              Instagram
            </Button>
          )}
          {twitterUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
                <Twitter className="size-4 me-1.5" />
                Twitter
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <Twitter className="size-4 me-1.5" />
              Twitter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
