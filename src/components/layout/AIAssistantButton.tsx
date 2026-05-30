"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Sparkles,
  Leaf,
  Flame,
  Zap,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AIAssistantButton() {
  const { t, locale, isRTL } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get cart state to determine if FloatingCartBar is visible
  const cart = useRestaurantStore((s) => s.cart);
  const activeSection = useRestaurantStore((s) => s.activeSection);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isFloatingCartVisible = cartItemCount > 0 && activeSection !== "cart";

  // Initialize greeting when opened
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content: t.ai.greeting,
        },
      ]);
    }
  }, [open, messages.length, t.ai.greeting]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, locale }),
      });

      const data = await res.json();

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.message || data.error || t.ai.error,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: t.ai.error,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    { key: "suggestVegan", icon: Leaf, color: "text-emerald-500" },
    { key: "suggestSpicy", icon: Flame, color: "text-red-500" },
    { key: "suggestPopular", icon: Sparkles, color: "text-amber-500" },
    { key: "suggestQuick", icon: Clock, color: "text-blue-500" },
  ];

  // Determine bottom position for the FAB
  // On mobile: above FloatingCartBar when visible (bottom-28), otherwise above bottom nav (bottom-20)
  // On desktop: bottom-6 end-6 (outside sidebar area)
  const mobileBottom = isFloatingCartVisible ? "bottom-28" : "bottom-20";

  return (
    <>
      {/* Floating AI Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200, damping: 15 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className={`fixed ${mobileBottom} end-4 z-40 size-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center md:bottom-6 md:end-6`}
        aria-label={t.ai.title}
      >
        <Sparkles className="size-5" />
      </motion.button>

      {/* AI Chat Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isRTL ? "left" : "right"}
          className="w-full sm:max-w-md p-0 flex flex-col"
        >
          {/* Header */}
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Bot className="size-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-base">{t.ai.title}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {t.app.name}
                </p>
              </div>
            </div>
          </SheetHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Bot className="size-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {t.ai.title}
                        </span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-amber-500" />
                    <span className="text-sm text-muted-foreground">{t.ai.thinking}</span>
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>

          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <div className="px-4 py-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">
                {t.ai.tryThese}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.key}
                      onClick={() => handleSend(t.ai[prompt.key as keyof typeof t.ai])}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-muted/50 text-xs font-medium hover:bg-muted transition-colors border border-border/50"
                    >
                      <Icon className={`size-3 ${prompt.color}`} />
                      {t.ai[prompt.key as keyof typeof t.ai]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.ai.placeholder}
                disabled={isLoading}
                className="flex-1 bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary"
              />
              <Button
                size="icon"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
