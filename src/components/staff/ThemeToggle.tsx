'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'default';
}

export function ThemeToggle({ className = '', size = 'default' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4';
  const btnSize = size === 'sm' ? 'sm' : 'default';

  return (
    <Button
      variant="ghost"
      size={btnSize}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`text-muted-foreground hover:text-foreground ${className}`}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className={iconSize} />
      ) : (
        <Moon className={iconSize} />
      )}
    </Button>
  );
}
