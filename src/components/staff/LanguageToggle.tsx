'use client';

import React from 'react';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

interface LanguageToggleProps {
  className?: string;
  size?: 'sm' | 'default';
  variant?: 'icon' | 'label';
}

export function LanguageToggle({ className = '', size = 'default', variant = 'icon' }: LanguageToggleProps) {
  const { locale, setLocale } = useI18n();

  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4';
  const btnSize = size === 'sm' ? 'sm' : 'default';

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'ar' : 'en');
  };

  if (variant === 'label') {
    return (
      <Button
        variant="ghost"
        size={btnSize}
        onClick={toggleLanguage}
        className={`text-muted-foreground hover:text-foreground ${className}`}
        aria-label={locale === 'en' ? 'Switch to Arabic' : 'Switch to English'}
      >
        <Languages className={iconSize} />
        <span className="text-xs ms-1.5">
          {locale === 'en' ? 'العربية' : 'English'}
        </span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size={btnSize}
      onClick={toggleLanguage}
      className={`text-muted-foreground hover:text-foreground ${className}`}
      aria-label={locale === 'en' ? 'Switch to Arabic' : 'Switch to English'}
    >
      <Languages className={iconSize} />
    </Button>
  );
}
