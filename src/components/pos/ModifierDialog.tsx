"use client";

import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Minus, X, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type MenuItem,
  type ModifierGroup,
  type ModifierOption,
  type PosOrderItem,
  type PosModifier,
} from "./types";
import { lineId } from "./types";

interface ModifierDialogProps {
  item: MenuItem | null;
  stationSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: PosOrderItem) => void;
}

export function ModifierDialog({
  item, stationSlug, open, onOpenChange, onAddItem,
}: ModifierDialogProps) {
  const { t, isRTL, fmtCurrency } = useI18n();
  // NOTE: parent uses a `key` to remount this component on each open so these
  // useState initializers run fresh per session. No effect needed.
  const [selected, setSelected] = useState<Record<string, Set<string>>>(() => {
    if (!item) return {};
    const init: Record<string, Set<string>> = {};
    for (const g of item.modifierGroups ?? []) {
      const defaults = new Set<string>();
      for (const o of g.options) if (o.isDefault) defaults.add(o.id);
      init[g.id] = defaults;
    }
    return init;
  });
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  const selectedOptions = useMemo(() => {
    if (!item) return [] as { option: ModifierOption; group: ModifierGroup }[];
    const out: { option: ModifierOption; group: ModifierGroup }[] = [];
    for (const g of item.modifierGroups ?? []) {
      const set = selected[g.id] ?? new Set();
      for (const o of g.options) {
        if (set.has(o.id)) out.push({ option: o, group: g });
      }
    }
    return out;
  }, [item, selected]);

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    return item.price + selectedOptions.reduce((s, { option }) => s + option.price, 0);
  }, [item, selectedOptions]);

  const totalPrice = unitPrice * qty;

  const toggleOption = (groupId: string, opt: ModifierOption, group: ModifierGroup) => {
    setSelected((prev) => {
      const next = { ...prev };
      const current = new Set(next[groupId] ?? []);
      if (group.maxSelect === 1) {
        current.clear();
        current.add(opt.id);
      } else {
        if (current.has(opt.id)) {
          current.delete(opt.id);
        } else {
          if (current.size >= group.maxSelect) {
            toast.warning(t.menu.chooseUpTo.replace("{n}", String(group.maxSelect)));
            return prev;
          }
          current.add(opt.id);
        }
      }
      next[groupId] = current;
      return next;
    });
  };

  const missingRequired = useMemo(() => {
    if (!item) return [] as ModifierGroup[];
    return (item.modifierGroups ?? [])
      .filter((g) => g.isRequired)
      .filter((g) => (selected[g.id]?.size ?? 0) < Math.max(1, g.minSelect));
  }, [item, selected]);

  const handleAdd = () => {
    if (!item) return;
    if (missingRequired.length > 0) {
      toast.error(t.menu.modifierRequired);
      return;
    }
    const mods: PosModifier[] = selectedOptions.map(({ option }) => ({
      id: option.id,
      nameEn: option.nameEn,
      nameAr: option.nameAr,
      price: option.price,
      preset: option.preset,
    }));
    const line: PosOrderItem = {
      id: lineId(),
      menuItemId: item.id,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      price: unitPrice,
      basePrice: item.price,
      quantity: qty,
      image: item.image || "",
      modifiers: mods,
      notes: notes.trim(),
      course: 1,
      stationSlug,
      totalPrice,
      allergens: item.allergens,
      dietary: item.dietary,
    };
    onAddItem(line);
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden gap-0 flex flex-col">
        <DialogTitle className="sr-only">
          {isRTL ? item.nameAr : item.nameEn}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isRTL ? item.descriptionAr : item.descriptionEn}
        </DialogDescription>

        {/* Item header */}
        <div className="bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/40 p-4 flex items-start gap-3">
          {item.image ? (
            <img
              src={item.image}
              alt={isRTL ? item.nameAr : item.nameEn}
              className="size-16 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="size-16 rounded-lg bg-background/60 flex items-center justify-center text-3xl shrink-0">
              🍽️
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg leading-tight">
              {isRTL ? item.nameAr : item.nameEn}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {isRTL ? item.descriptionAr : item.descriptionEn}
            </p>
            <p className="font-bold text-primary mt-1 tabular-nums">
              {fmtCurrency(item.price)}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="size-8 inline-flex items-center justify-center rounded-full bg-background/60 hover:bg-background text-muted-foreground"
            aria-label={t.common.close}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modifier groups (scrollable) */}
        <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-4">
          {item.modifierGroups?.map((g) => {
            const sel = selected[g.id] ?? new Set();
            const isMaxMulti = g.maxSelect > 1;
            const isReq = g.isRequired;
            return (
              <fieldset key={g.id} className="space-y-2">
                <legend className="flex items-center gap-2 mb-1.5">
                  <span className="font-semibold text-sm">
                    {isRTL ? g.nameAr : g.nameEn}
                  </span>
                  {isReq ? (
                    <Badge variant="destructive" className="text-[10px] h-5">
                      {t.menu.required}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {t.menu.optional}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {isMaxMulti
                      ? t.menu.chooseUpTo.replace("{n}", String(g.maxSelect))
                      : t.menu.chooseOne}
                  </span>
                </legend>
                <div className="grid grid-cols-1 gap-1.5">
                  {g.options.map((o) => {
                    const isSel = sel.has(o.id);
                    return (
                      <button
                        key={o.id}
                        onClick={() => toggleOption(g.id, o, g)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border text-start transition-all active:scale-[0.99] ${
                          isSel
                            ? "bg-primary/10 border-primary ring-1 ring-primary"
                            : "bg-background border-border hover:bg-accent"
                        }`}
                        aria-pressed={isSel}
                      >
                        <span
                          className={`shrink-0 ${
                            isMaxMulti ? "size-5 rounded-md" : "size-5 rounded-full"
                          } border-2 flex items-center justify-center ${
                            isSel
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSel && <Check className="size-3" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium">
                            {isRTL ? o.nameAr : o.nameEn}
                          </span>
                          {o.preset && o.preset !== "none" && (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              {o.preset}
                            </span>
                          )}
                        </span>
                        {o.price > 0 && (
                          <span className="text-sm font-semibold text-primary tabular-nums shrink-0">
                            +{fmtCurrency(o.price)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          {/* Special notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">
              {t.menu.specialInstructions}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.menu.specialInstructionsPlaceholder}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
            />
          </div>

          {missingRequired.length > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>{t.menu.modifierRequired}</span>
            </div>
          )}
        </div>

        {/* Footer: qty + add */}
        <div className="border-t border-border p-3 flex items-center gap-3 bg-background">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="size-11 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-accent active:scale-95"
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center font-bold tabular-nums text-lg">
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              className="size-11 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-accent active:scale-95"
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <Button
            size="lg"
            className="flex-1 h-14 text-base"
            onClick={handleAdd}
            disabled={missingRequired.length > 0}
          >
            <Plus className="size-5" />
            <span>{t.pos.addToOrder}</span>
            <span className="ms-2 font-bold tabular-nums">
              {fmtCurrency(totalPrice)}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
