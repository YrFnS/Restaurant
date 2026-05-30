'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from '@/lib/i18n';
import { useRestaurantStore } from '@/lib/store';
import ImageUploadButton from '@/components/shared/ImageUploadButton';
import {
  ChefHat, Package, Users, CalendarDays, BarChart3, DollarSign,
  Bell, Settings, Plus, Edit, Trash2, Search, RefreshCw, Save,
  ToggleLeft, AlertTriangle, CheckCircle2, XCircle, Clock, TrendingUp,
  ShoppingCart, Calendar, Wrench, Activity, Hash, Wallet, UserCog, Monitor, ExternalLink, Copy, Grid3X3, QrCode,
  ImageIcon, Facebook, Instagram, Twitter, Trophy, MapPin, Globe,
} from 'lucide-react';

// ============ TYPES ============
type AdminTab = 'menu' | 'inventory' | 'employees' | 'schedule' | 'kds-screens' | 'tables' | 'reports' | 'cash' | 'reservations' | 'notifications' | 'settings';

interface EmployeeData {
  id: string; name: string; pin?: string; role: string;
  hourlyWage: number; isActive: boolean; email: string | null; phone: string | null;
  clockedIn: boolean; lastClockIn: string | null; lastClockOut: string | null;
}

interface IngredientData {
  id: string; name: string; unit: string; quantity: number;
  lowThreshold: number; costPerUnit: number; supplier: string | null; category: string | null;
}

interface CategoryData {
  id: string; nameEn: string; nameAr: string; icon: string; sortOrder: number; isAvailable: boolean;
  items: ItemData[];
}

interface ItemData {
  id: string; nameEn: string; nameAr: string; price: number; isAvailable: boolean; categoryId: string;
  descriptionEn: string; descriptionAr: string; preparationTime: number; calories: number;
  allergens: string; dietary: string; image: string; isPopular: boolean;
}

interface CashEntryData {
  id: string; type: string; amount: number; note: string | null; createdBy: string | null; createdAt: string;
}

interface NotificationData {
  id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string;
}

interface ReservationData {
  id: string; customerName: string; customerPhone: string; partySize: number;
  dateTime: string; status: string; notes: string | null; tableId: string | null;
}

interface ScheduleData {
  id: string; employeeId: string; employeeName?: string;
  dayOfWeek: number; startTime: string; endTime: string; role: string;
}

interface KitchenScreenData {
  id: string;
  name: string;
  slug: string;
  description: string;
  stationFilter: string;
  layoutType: string;
  autoRefreshInterval: number;
  showCompleted: boolean;
  maxOrders: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

// ============ MAIN COMPONENT ============
export default function AdminPanel() {
  const { t, locale, isRTL } = useI18n();
  const storeFetchSettings = useRestaurantStore((s) => s.fetchSettings);
  const [activeTab, setActiveTab] = useState<AdminTab>('menu');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // i18n-aware sidebar items
  const SIDEBAR_ITEMS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'menu', label: t.admin.menu, icon: <ChefHat className="h-4 w-4" /> },
    { id: 'inventory', label: t.admin.inventory, icon: <Package className="h-4 w-4" /> },
    { id: 'employees', label: t.admin.employees, icon: <Users className="h-4 w-4" /> },
    { id: 'schedule', label: t.admin.schedule, icon: <CalendarDays className="h-4 w-4" /> },
    { id: 'kds-screens', label: t.admin.kdsScreens, icon: <Monitor className="h-4 w-4" /> },
    { id: 'tables', label: t.admin.tables || 'Tables', icon: <Grid3X3 className="h-4 w-4" /> },
    { id: 'reports', label: t.admin.reports, icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'cash', label: t.admin.cash, icon: <DollarSign className="h-4 w-4" /> },
    { id: 'reservations', label: t.admin.reservations, icon: <Calendar className="h-4 w-4" /> },
    { id: 'notifications', label: t.admin.notifications, icon: <Bell className="h-4 w-4" /> },
    { id: 'settings', label: t.admin.settings, icon: <Wrench className="h-4 w-4" /> },
  ];

  // i18n-aware day names
  const DAY_NAMES = [
    t.admin.daySun, t.admin.dayMon, t.admin.dayTue,
    t.admin.dayWed, t.admin.dayThu, t.admin.dayFri, t.admin.daySat,
  ];

  // i18n-aware role name mapping
  const roleLabels: Record<string, string> = {
    admin: t.admin.roleAdmin,
    manager: t.admin.roleManager,
    staff: t.admin.roleStaff,
    Server: t.admin.roleServer,
    Cook: t.admin.roleCook,
    Bartender: t.admin.roleBartender,
    Host: t.admin.roleHost,
    Manager: t.admin.roleManager,
  };

  // i18n-aware reservation status labels
  const statusLabels: Record<string, string> = {
    confirmed: t.admin.confirmed,
    seated: t.admin.seated,
    completed: t.admin.completed,
    cancelled: t.admin.cancelled,
    no_show: t.admin.noShow,
  };

  // i18n-aware cash type labels
  const cashTypeLabels: Record<string, string> = {
    payin: t.admin.payIn,
    payout: t.admin.payOut,
    drop: t.admin.drop,
    sale: t.admin.completed,
  };

  // i18n-aware settings day names
  const settingsDays = [
    t.contact.monday, t.contact.tuesday, t.contact.wednesday,
    t.contact.thursday, t.contact.friday, t.contact.saturday, t.contact.sunday,
  ];

  // Data state
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntryData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [kitchenScreens, setKitchenScreens] = useState<KitchenScreenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportStats, setReportStats] = useState({ revenue: 0, ordersToday: 0, avgValue: 0 });
  const hasLoaded = useRef(false);

  // Dialog states
  const [menuItemDialogOpen, setMenuItemDialogOpen] = useState(false);
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [kdsDialogOpen, setKdsDialogOpen] = useState(false);

  // Form states
  const [menuForm, setMenuForm] = useState({ nameEn: '', nameAr: '', price: '', categoryId: '', descriptionEn: '', isAvailable: true, preparationTime: '0', imageUrl: '' });
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [ingredientForm, setIngredientForm] = useState({ name: '', unit: 'pcs', quantity: '0', lowThreshold: '10', costPerUnit: '0', supplier: '', category: '' });
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ name: '', pin: '', role: 'staff', hourlyWage: '15', isActive: true, email: '', phone: '' });
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [cashForm, setCashForm] = useState({ type: 'payin', amount: '', note: '' });
  const [reservationForm, setReservationForm] = useState({ customerName: '', customerPhone: '', partySize: '2', dateTime: '', notes: '', status: 'confirmed' });
  const [scheduleForm, setScheduleForm] = useState({ employeeId: '', dayOfWeek: '1', startTime: '09:00', endTime: '17:00', role: 'Server' });
  const [kdsForm, setKdsForm] = useState({ name: '', slug: '', description: '', stationFilter: '', layoutType: 'grid', autoRefreshInterval: '10', showCompleted: false, maxOrders: '0', sortOrder: '0', isActive: true });
  const [editingKdsId, setEditingKdsId] = useState<string | null>(null);

  // Search
  const [menuSearch, setMenuSearch] = useState('');

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    nameEn: '', nameAr: '', taglineEn: '', taglineAr: '',
    descriptionEn: '', descriptionAr: '',
    phone: '', email: '', addressEn: '', addressAr: '',
    logoUrl: '', heroImageUrl: '',
    facebookUrl: '', instagramUrl: '', twitterUrl: '',
    taxRate: '', tipPresets: '', deliveryFee: '', minDeliveryOrder: '',
    deliveryRadius: '', avgPrepTime: '', currencySymbol: '', openTime: '', closeTime: '',
    statsOrdersServed: '', statsHappyCustomers: '', statsYearsService: '',
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Currency symbol from store settings
  const storeSettings = useRestaurantStore((s) => s.settings);
  const currencySym = storeSettings?.currencySymbol ?? '';

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [menuRes, invRes, empRes, cashRes, notifRes, resRes, schedRes, kdsRes] = await Promise.all([
        fetch('/api/menu'), fetch('/api/inventory'), fetch('/api/employees'),
        fetch('/api/cash'), fetch('/api/notifications'), fetch('/api/reservations'),
        fetch('/api/schedules'), fetch('/api/kitchen-screens'),
      ]);

      if (menuRes.ok) { const d = await menuRes.json(); setCategories(d.categories || []); }
      if (invRes.ok) { const d = await invRes.json(); setIngredients(d.ingredients || d || []); }
      if (empRes.ok) { const d = await empRes.json(); setEmployees(d.employees || d || []); }
      if (cashRes.ok) { const d = await cashRes.json(); setCashEntries(d.entries || d || []); }
      if (notifRes.ok) { const d = await notifRes.json(); setNotifications(d.notifications || d || []); }
      if (resRes.ok) { const d = await resRes.json(); setReservations(d.reservations || d || []); }
      if (schedRes.ok) { const d = await schedRes.json(); setSchedules(d.schedules || d || []); }
      if (kdsRes.ok) { const d = await kdsRes.json(); setKitchenScreens(d.screens || []); }
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      await fetchData();
      if (mounted) setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, []);

  // ============ MENU HANDLERS ============
  const handleSaveMenuItem = async () => {
    const payload = {
      nameEn: menuForm.nameEn, nameAr: menuForm.nameAr || menuForm.nameEn,
      price: parseFloat(menuForm.price) || 0, categoryId: menuForm.categoryId,
      descriptionEn: menuForm.descriptionEn, isAvailable: menuForm.isAvailable,
      preparationTime: parseInt(menuForm.preparationTime) || 0,
      image: menuForm.imageUrl || '',
    };
    try {
      if (editingMenuId) {
        await fetch(`/api/menu/${editingMenuId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await fetch('/api/menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      setMenuItemDialogOpen(false);
      setEditingMenuId(null);
      setMenuForm({ nameEn: '', nameAr: '', price: '', categoryId: '', descriptionEn: '', isAvailable: true, preparationTime: '0', imageUrl: '' });
      toast.success(editingMenuId ? t.admin.itemUpdated : t.admin.itemCreated);
      fetchData();
    } catch { toast.error(t.admin.failedSave); }
  };

  const handleDeleteMenuItem = async (id: string) => {
    if (!confirm(t.admin.deleteConfirm)) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    toast.success(t.admin.itemDeleted);
    fetchData();
  };

  const handleToggleAvailability = async (item: ItemData) => {
    await fetch(`/api/menu/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAvailable: !item.isAvailable }) });
    fetchData();
  };

  // ============ INGREDIENT HANDLERS ============
  const handleSaveIngredient = async () => {
    const payload = {
      name: ingredientForm.name, unit: ingredientForm.unit,
      quantity: parseFloat(ingredientForm.quantity) || 0,
      lowThreshold: parseFloat(ingredientForm.lowThreshold) || 10,
      costPerUnit: parseFloat(ingredientForm.costPerUnit) || 0,
      supplier: ingredientForm.supplier || null, category: ingredientForm.category || null,
    };
    try {
      if (editingIngredientId) {
        await fetch(`/api/inventory/${editingIngredientId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      setIngredientDialogOpen(false);
      setEditingIngredientId(null);
      setIngredientForm({ name: '', unit: 'pcs', quantity: '0', lowThreshold: '10', costPerUnit: '0', supplier: '', category: '' });
      toast.success(editingIngredientId ? t.admin.ingredientUpdated : t.admin.ingredientCreated);
      fetchData();
    } catch { toast.error(t.admin.failedSave); }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!confirm(t.admin.deleteIngredientConfirm)) return;
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    toast.success(t.admin.ingredientDeleted);
    fetchData();
  };

  // ============ EMPLOYEE HANDLERS ============
  const handleSaveEmployee = async () => {
    const payload: Record<string, unknown> = {
      name: employeeForm.name,
      role: employeeForm.role, hourlyWage: parseFloat(employeeForm.hourlyWage) || 15,
      isActive: employeeForm.isActive,
      email: employeeForm.email || null, phone: employeeForm.phone || null,
    };
    // Only include PIN if provided (required for new employees, optional for updates)
    if (employeeForm.pin) {
      payload.pin = employeeForm.pin;
    }
    try {
      if (editingEmployeeId) {
        await fetch(`/api/employees/${editingEmployeeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      setEmployeeDialogOpen(false);
      setEditingEmployeeId(null);
      setEmployeeForm({ name: '', pin: '', role: 'staff', hourlyWage: '15', isActive: true, email: '', phone: '' });
      toast.success(editingEmployeeId ? t.admin.employeeUpdated : t.admin.employeeCreated);
      fetchData();
    } catch { toast.error(t.admin.failedSave); }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm(t.admin.deleteEmployeeConfirm)) return;
    await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    toast.success(t.admin.employeeDeleted);
    fetchData();
  };

  // ============ CASH HANDLERS ============
  const handleSaveCash = async () => {
    await fetch('/api/cash', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: cashForm.type, amount: parseFloat(cashForm.amount) || 0, note: cashForm.note || null }),
    });
    setCashDialogOpen(false);
    setCashForm({ type: 'payin', amount: '', note: '' });
    toast.success(t.admin.entryAdded);
    fetchData();
  };

  // ============ RESERVATION HANDLERS ============
  const handleSaveReservation = async () => {
    const payload = {
      customerName: reservationForm.customerName, customerPhone: reservationForm.customerPhone,
      partySize: parseInt(reservationForm.partySize) || 2,
      dateTime: reservationForm.dateTime, notes: reservationForm.notes || null, status: reservationForm.status,
    };
    await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setReservationDialogOpen(false);
    setReservationForm({ customerName: '', customerPhone: '', partySize: '2', dateTime: '', notes: '', status: 'confirmed' });
    toast.success(t.admin.reservationCreated);
    fetchData();
  };

  const handleUpdateReservationStatus = async (id: string, status: string) => {
    await fetch(`/api/reservations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    toast.success(t.admin.statusUpdated);
    fetchData();
  };

  // ============ SCHEDULE HANDLERS ============
  const handleSaveSchedule = async () => {
    const payload = {
      employeeId: scheduleForm.employeeId, dayOfWeek: parseInt(scheduleForm.dayOfWeek),
      startTime: scheduleForm.startTime, endTime: scheduleForm.endTime, role: scheduleForm.role,
    };
    await fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setScheduleDialogOpen(false);
    setScheduleForm({ employeeId: '', dayOfWeek: '1', startTime: '09:00', endTime: '17:00', role: 'Server' });
    toast.success(t.admin.scheduleCreated);
    fetchData();
  };

  // ============ NOTIFICATION HANDLERS ============
  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) });
    fetchData();
  };

  // ============ SETTINGS HANDLERS ============
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const d = await res.json();
        if (d.settings) {
          const s = d.settings;
          setSettingsForm({
            nameEn: s.nameEn || '', nameAr: s.nameAr || '',
            taglineEn: s.taglineEn || '', taglineAr: s.taglineAr || '',
            descriptionEn: s.descriptionEn || '', descriptionAr: s.descriptionAr || '',
            phone: s.phone || '', email: s.email || '',
            addressEn: s.addressEn || '', addressAr: s.addressAr || '',
            logoUrl: s.logoUrl || '', heroImageUrl: s.heroImageUrl || '',
            facebookUrl: s.facebookUrl || '', instagramUrl: s.instagramUrl || '', twitterUrl: s.twitterUrl || '',
            taxRate: s.taxRate != null ? String(Math.round(s.taxRate * 100)) : '',
            tipPresets: s.tipPresets || '',
            deliveryFee: s.deliveryFee != null ? String(parseFloat(String(s.deliveryFee)).toFixed(2)) : '',
            minDeliveryOrder: s.minDeliveryOrder != null ? String(parseFloat(String(s.minDeliveryOrder)).toFixed(2)) : '',
            deliveryRadius: s.deliveryRadius != null ? String(Math.round(s.deliveryRadius)) : '',
            avgPrepTime: s.avgPrepTime != null ? String(s.avgPrepTime) : '',
            currencySymbol: s.currencySymbol || '',
            openTime: s.openTime || '', closeTime: s.closeTime || '',
            statsOrdersServed: s.statsOrdersServed != null ? String(s.statsOrdersServed) : '',
            statsHappyCustomers: s.statsHappyCustomers != null ? String(s.statsHappyCustomers) : '',
            statsYearsService: s.statsYearsService != null ? String(s.statsYearsService) : '',
          });
          setSettingsLoaded(true);
        }
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    }
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload = {
        nameEn: settingsForm.nameEn, nameAr: settingsForm.nameAr,
        taglineEn: settingsForm.taglineEn, taglineAr: settingsForm.taglineAr,
        descriptionEn: settingsForm.descriptionEn, descriptionAr: settingsForm.descriptionAr,
        phone: settingsForm.phone, email: settingsForm.email,
        addressEn: settingsForm.addressEn, addressAr: settingsForm.addressAr,
        logoUrl: settingsForm.logoUrl, heroImageUrl: settingsForm.heroImageUrl,
        facebookUrl: settingsForm.facebookUrl, instagramUrl: settingsForm.instagramUrl, twitterUrl: settingsForm.twitterUrl,
        taxRate: (parseFloat(settingsForm.taxRate) || 0) / 100,
        tipPresets: settingsForm.tipPresets,
        deliveryFee: parseFloat(settingsForm.deliveryFee) || 0,
        minDeliveryOrder: parseFloat(settingsForm.minDeliveryOrder) || 0,
        deliveryRadius: parseFloat(settingsForm.deliveryRadius) || 0,
        avgPrepTime: parseInt(settingsForm.avgPrepTime) || 0,
        currencySymbol: settingsForm.currencySymbol,
        openTime: settingsForm.openTime, closeTime: settingsForm.closeTime,
        statsOrdersServed: parseInt(settingsForm.statsOrdersServed) || 0,
        statsHappyCustomers: parseInt(settingsForm.statsHappyCustomers) || 0,
        statsYearsService: parseInt(settingsForm.statsYearsService) || 0,
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(t.admin.itemUpdated);
        fetchSettings();
        // Invalidate shared store so other components get updated settings
        useRestaurantStore.setState({ settings: null, settingsLoaded: false });
        storeFetchSettings();
      } else {
        toast.error(t.admin.failedSave);
      }
    } catch {
      toast.error(t.admin.failedSave);
    } finally {
      setSavingSettings(false);
    }
  };

  // ============ KDS SCREEN HANDLERS ============
  const handleSaveKds = async () => {
    const payload = {
      name: kdsForm.name,
      slug: kdsForm.slug,
      description: kdsForm.description || '',
      stationFilter: kdsForm.stationFilter || '',
      layoutType: kdsForm.layoutType || 'grid',
      autoRefreshInterval: parseInt(kdsForm.autoRefreshInterval) || 10,
      showCompleted: kdsForm.showCompleted,
      maxOrders: parseInt(kdsForm.maxOrders) || 0,
      sortOrder: parseInt(kdsForm.sortOrder) || 0,
      isActive: kdsForm.isActive,
    };
    try {
      let res: Response;
      if (editingKdsId) {
        res = await fetch(`/api/kitchen-screens/${editingKdsId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        res = await fetch('/api/kitchen-screens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || t.admin.failedSave);
        return;
      }
      setKdsDialogOpen(false);
      setEditingKdsId(null);
      setKdsForm({ name: '', slug: '', description: '', stationFilter: '', layoutType: 'grid', autoRefreshInterval: '10', showCompleted: false, maxOrders: '0', sortOrder: '0', isActive: true });
      toast.success(editingKdsId ? t.admin.screenUpdated : t.admin.screenCreated);
      fetchData();
    } catch { toast.error(t.admin.failedSave); }
  };

  const handleDeleteKds = async (id: string) => {
    if (!confirm(t.admin.deleteScreenConfirm)) return;
    const res = await fetch(`/api/kitchen-screens/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success(t.admin.screenDeleted);
      fetchData();
    } else {
      toast.error(t.admin.failedSave);
    }
  };

  // ============ REPORT STATS ============
  const fetchReportStats = useCallback(async () => {
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const d = await res.json();
        setReportStats({ revenue: d.todayRevenue || 0, ordersToday: d.todayOrders || 0, avgValue: d.avgOrderValue || 0 });
      }
    } catch (e) {
      console.error('Failed to fetch report stats:', e);
    }
  }, []);

  useEffect(() => {
    fetchReportStats();
  }, [fetchReportStats]);

  // ============ COMPUTED ============
  const allItems = categories.flatMap(c => c.items);
  const filteredItems = menuSearch ? allItems.filter(i =>
    (locale === 'ar' ? i.nameAr : i.nameEn).toLowerCase().includes(menuSearch.toLowerCase()) ||
    i.nameEn.toLowerCase().includes(menuSearch.toLowerCase())
  ) : allItems;
  const currentBalance = cashEntries.reduce((acc, e) => {
    if (e.type === 'payin' || e.type === 'sale') return acc + e.amount;
    return acc - e.amount;
  }, 0);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // ============ RENDER SECTIONS ============
  const renderMenu = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.admin.menu}</h2>
        <Button onClick={() => { setEditingMenuId(null); setMenuForm({ nameEn: '', nameAr: '', price: '', categoryId: '', descriptionEn: '', isAvailable: true, preparationTime: '0', imageUrl: '' }); setMenuItemDialogOpen(true); }} className="bg-amber-600 hover:bg-amber-500">
          <Plus className="h-4 w-4 me-1" /> {t.admin.addItem}
        </Button>
      </div>
      <div className="relative">
        <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
        <Input placeholder={t.admin.searchMenu} value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} className={isRTL ? 'pr-9' : 'pl-9'} />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.admin.name}</TableHead>
              <TableHead>{t.admin.category}</TableHead>
              <TableHead>{t.admin.price}</TableHead>
              <TableHead>{t.admin.available}</TableHead>
              <TableHead>{t.admin.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const cat = categories.find(c => c.id === item.categoryId);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{locale === 'ar' ? item.nameAr : item.nameEn}</TableCell>
                  <TableCell><Badge variant="outline">{cat ? (locale === 'ar' ? cat.nameAr : cat.nameEn) : 'N/A'}</Badge></TableCell>
                  <TableCell>{currencySym}{item.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Switch checked={item.isAvailable} onCheckedChange={() => handleToggleAvailability(item)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingMenuId(item.id);
                        setMenuForm({ nameEn: item.nameEn, nameAr: item.nameAr, price: item.price.toString(), categoryId: item.categoryId, descriptionEn: item.descriptionEn, isAvailable: item.isAvailable, preparationTime: item.preparationTime.toString(), imageUrl: item.image || '' });
                        setMenuItemDialogOpen(true);
                      }}><Edit className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteMenuItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.admin.inventory}</h2>
        <Button onClick={() => { setEditingIngredientId(null); setIngredientForm({ name: '', unit: 'pcs', quantity: '0', lowThreshold: '10', costPerUnit: '0', supplier: '', category: '' }); setIngredientDialogOpen(true); }} className="bg-amber-600 hover:bg-amber-500">
          <Plus className="h-4 w-4 me-1" /> {t.admin.addIngredient}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ingredients.map((ing) => {
          const isLow = ing.quantity <= ing.lowThreshold;
          return (
            <Card key={ing.id} className={`${isLow ? 'border-red-300 bg-red-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{ing.name}</h3>
                    <p className="text-sm text-muted-foreground">{ing.unit} · {ing.category || t.admin.noCategory}</p>
                  </div>
                  {isLow && <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 me-1" />{t.admin.lowStock}</Badge>}
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span>{t.admin.qty}: <strong>{ing.quantity}</strong></span>
                  <span>{t.admin.threshold}: {ing.lowThreshold}</span>
                  <span>{t.admin.cost}: {currencySym}{ing.costPerUnit.toFixed(2)}/{ing.unit}</span>
                </div>
                <div className="mt-2 flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => { setEditingIngredientId(ing.id); setIngredientForm({ name: ing.name, unit: ing.unit, quantity: ing.quantity.toString(), lowThreshold: ing.lowThreshold.toString(), costPerUnit: ing.costPerUnit.toString(), supplier: ing.supplier || '', category: ing.category || '' }); setIngredientDialogOpen(true); }}><Edit className="h-3 w-3" /></Button>
                  <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDeleteIngredient(ing.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderEmployees = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.admin.employees}</h2>
        <Button onClick={() => { setEditingEmployeeId(null); setEmployeeForm({ name: '', pin: '', role: 'staff', hourlyWage: '15', isActive: true, email: '', phone: '' }); setEmployeeDialogOpen(true); }} className="bg-amber-600 hover:bg-amber-500">
          <Plus className="h-4 w-4 me-1" /> {t.admin.addEmployee}
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.admin.name}</TableHead>
              <TableHead>{t.admin.pin}</TableHead>
              <TableHead>{t.admin.role}</TableHead>
              <TableHead>{t.admin.wage}</TableHead>
              <TableHead>{t.admin.status}</TableHead>
              <TableHead>{t.admin.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell><code className="bg-muted px-2 py-0.5 rounded text-sm">****</code></TableCell>
                <TableCell>
                  <Badge className={emp.role === 'admin' ? 'bg-purple-100 text-purple-800' : emp.role === 'manager' ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'}>
                    {roleLabels[emp.role] || emp.role}
                  </Badge>
                </TableCell>
                <TableCell>{currencySym}{emp.hourlyWage.toFixed(2)}/hr</TableCell>
                <TableCell>
                  <Badge variant={emp.isActive ? 'default' : 'secondary'} className={emp.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {emp.isActive ? t.admin.active : t.admin.inactive}
                  </Badge>
                  {emp.clockedIn && <Badge className="bg-emerald-100 text-emerald-800 ms-1">🟢 {t.admin.clockedIn}</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditingEmployeeId(emp.id);
                      setEmployeeForm({ name: emp.name, pin: '', role: emp.role, hourlyWage: emp.hourlyWage.toString(), isActive: emp.isActive, email: emp.email || '', phone: emp.phone || '' });
                      setEmployeeDialogOpen(true);
                    }}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteEmployee(emp.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderSchedule = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.admin.schedule}</h2>
        <Button onClick={() => setScheduleDialogOpen(true)} className="bg-amber-600 hover:bg-amber-500">
          <Plus className="h-4 w-4 me-1" /> {t.admin.addShift}
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {DAY_NAMES.map((day, dayIdx) => (
          <div key={dayIdx} className="space-y-1">
            <div className="text-center text-xs font-semibold text-muted-foreground py-1 bg-muted rounded">{day}</div>
            {schedules.filter(s => s.dayOfWeek === dayIdx).map((s) => {
              const emp = employees.find(e => e.id === s.employeeId);
              const roleColors: Record<string, string> = { Server: 'bg-emerald-100 text-emerald-800', Cook: 'bg-red-100 text-red-800', Bartender: 'bg-amber-100 text-amber-800', Host: 'bg-sky-100 text-sky-800', Manager: 'bg-purple-100 text-purple-800' };
              return (
                <div key={s.id} className={`text-xs p-1.5 rounded border ${roleColors[s.role] || 'bg-gray-100'}`}>
                  <div className="font-medium">{emp?.name || '—'}</div>
                  <div className="opacity-75">{s.startTime}-{s.endTime}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{t.admin.reportsAnalytics}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: t.admin.todaysRevenue, value: `${currencySym}${reportStats.revenue.toFixed(2)}`, icon: <DollarSign className="h-5 w-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { title: t.admin.ordersToday, value: String(reportStats.ordersToday), icon: <ShoppingCart className="h-5 w-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
          { title: t.admin.avgOrderValue, value: `${currencySym}${reportStats.avgValue.toFixed(2)}`, icon: <TrendingUp className="h-5 w-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { title: t.admin.activeEmployees, value: String(employees.filter(e => e.clockedIn).length), icon: <Users className="h-5 w-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>{stat.icon}</div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t.admin.topSellingItems}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allItems.slice(0, 5).map((item, i) => (
              <div key={item.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-4">{i + 1}.</span>
                  <span className="text-sm font-medium">{locale === 'ar' ? item.nameAr : item.nameEn}</span>
                </div>
                <div className="w-32 bg-muted rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.max(20, 100 - i * 18)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCash = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.admin.cash}</h2>
        <Button onClick={() => setCashDialogOpen(true)} className="bg-amber-600 hover:bg-amber-500">
          <Plus className="h-4 w-4 me-1" /> {t.admin.addEntry}
        </Button>
      </div>
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <Wallet className="h-8 w-8 text-emerald-600" />
          <div>
            <p className="text-sm text-muted-foreground">{t.admin.currentBalance}</p>
            <p className="text-3xl font-bold">{currencySym}{currentBalance.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.admin.type}</TableHead>
              <TableHead>{t.admin.amount}</TableHead>
              <TableHead>{t.admin.note}</TableHead>
              <TableHead>{t.admin.time}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashEntries.slice(-20).reverse().map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Badge className={entry.type === 'payin' || entry.type === 'sale' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {cashTypeLabels[entry.type] || entry.type}
                  </Badge>
                </TableCell>
                <TableCell className={entry.type === 'payin' || entry.type === 'sale' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {entry.type === 'payin' || entry.type === 'sale' ? '+' : '-'}{currencySym}{entry.amount.toFixed(2)}
                </TableCell>
                <TableCell className="text-muted-foreground">{entry.note || '-'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(entry.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderReservations = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.admin.reservations}</h2>
        <Button onClick={() => setReservationDialogOpen(true)} className="bg-amber-600 hover:bg-amber-500">
          <Plus className="h-4 w-4 me-1" /> {t.admin.addReservation}
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.admin.customer}</TableHead>
              <TableHead>{t.admin.partySize}</TableHead>
              <TableHead>{t.admin.dateTime}</TableHead>
              <TableHead>{t.admin.status}</TableHead>
              <TableHead>{t.admin.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.map((res) => (
              <TableRow key={res.id}>
                <TableCell>
                  <div><span className="font-medium">{res.customerName}</span></div>
                  <div className="text-xs text-muted-foreground">{res.customerPhone}</div>
                </TableCell>
                <TableCell>{res.partySize}</TableCell>
                <TableCell>{new Date(res.dateTime).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge className={
                    res.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                    res.status === 'seated' ? 'bg-green-100 text-green-800' :
                    res.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    res.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-orange-100 text-orange-800'
                  }>{statusLabels[res.status] || res.status}</Badge>
                </TableCell>
                <TableCell>
                  <Select value={res.status} onValueChange={(val) => handleUpdateReservationStatus(res.id, val)}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">{t.admin.confirmed}</SelectItem>
                      <SelectItem value="seated">{t.admin.seated}</SelectItem>
                      <SelectItem value="completed">{t.admin.completed}</SelectItem>
                      <SelectItem value="cancelled">{t.admin.cancelled}</SelectItem>
                      <SelectItem value="no_show">{t.admin.noShow}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.admin.notifications} {unreadCount > 0 && <Badge className="bg-red-500 text-white ms-2">{unreadCount}</Badge>}</h2>
        {unreadCount > 0 && <Button variant="outline" size="sm" onClick={handleMarkAllRead}><CheckCircle2 className="h-4 w-4 me-1" /> {t.admin.markAllReadBtn}</Button>}
      </div>
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">{t.admin.noNotifications}</CardContent></Card>
        ) : notifications.map((notif) => (
          <Card key={notif.id} className={`${!notif.isRead ? 'border-amber-300 bg-amber-50' : ''}`}>
            <CardContent className="p-3 flex items-start gap-3">
              <div className={`mt-0.5 ${notif.type === 'error' ? 'text-red-500' : notif.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}`}>
                {notif.type === 'error' ? <XCircle className="h-4 w-4" /> : notif.type === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{notif.title}</p>
                <p className="text-xs text-muted-foreground">{notif.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => {
    // Fetch settings on first render of this tab
    if (!settingsLoaded) fetchSettings();

    return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{t.admin.settings}</h2>
      {!settingsLoaded ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (<>

      {/* Restaurant Information */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base">{t.admin.restaurantInfo}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label className="text-sm">{t.admin.nameEn}</Label><Input value={settingsForm.nameEn} onChange={(e) => setSettingsForm({ ...settingsForm, nameEn: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.nameAr}</Label><Input value={settingsForm.nameAr} onChange={(e) => setSettingsForm({ ...settingsForm, nameAr: e.target.value })} dir="rtl" /></div>
            <div><Label className="text-sm">{t.admin.tagline}</Label><Input value={settingsForm.taglineEn} onChange={(e) => setSettingsForm({ ...settingsForm, taglineEn: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.taglineAr}</Label><Input value={settingsForm.taglineAr} onChange={(e) => setSettingsForm({ ...settingsForm, taglineAr: e.target.value })} dir="rtl" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label className="text-sm">{t.admin.descriptionEn}</Label><Textarea rows={3} value={settingsForm.descriptionEn} onChange={(e) => setSettingsForm({ ...settingsForm, descriptionEn: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.descriptionAr}</Label><Textarea rows={3} value={settingsForm.descriptionAr} onChange={(e) => setSettingsForm({ ...settingsForm, descriptionAr: e.target.value })} dir="rtl" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label className="text-sm">{t.admin.phone}</Label><Input value={settingsForm.phone} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.email}</Label><Input value={settingsForm.email} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.addressEn}</Label><Input value={settingsForm.addressEn} onChange={(e) => setSettingsForm({ ...settingsForm, addressEn: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.addressAr}</Label><Input value={settingsForm.addressAr} onChange={(e) => setSettingsForm({ ...settingsForm, addressAr: e.target.value })} dir="rtl" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base">{t.admin.branding}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">{t.admin.logoUrl}</Label>
              <ImageUploadButton
                value={settingsForm.logoUrl}
                onChange={(url) => setSettingsForm({ ...settingsForm, logoUrl: url })}
                label={t.admin.uploadImage}
                size="sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t.admin.heroImageUrl}</Label>
              <ImageUploadButton
                value={settingsForm.heroImageUrl}
                onChange={(url) => setSettingsForm({ ...settingsForm, heroImageUrl: url })}
                label={t.admin.uploadImage}
                size="sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base">{t.admin.socialMedia}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-sm flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5" /> {t.admin.facebookUrl}</Label>
              <Input value={settingsForm.facebookUrl} onChange={(e) => setSettingsForm({ ...settingsForm, facebookUrl: e.target.value })} placeholder="https://facebook.com/..." />
            </div>
            <div>
              <Label className="text-sm flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> {t.admin.instagramUrl}</Label>
              <Input value={settingsForm.instagramUrl} onChange={(e) => setSettingsForm({ ...settingsForm, instagramUrl: e.target.value })} placeholder="https://instagram.com/..." />
            </div>
            <div>
              <Label className="text-sm flex items-center gap-1.5"><Twitter className="h-3.5 w-3.5" /> {t.admin.twitterUrl}</Label>
              <Input value={settingsForm.twitterUrl} onChange={(e) => setSettingsForm({ ...settingsForm, twitterUrl: e.target.value })} placeholder="https://twitter.com/..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base">{t.admin.operatingHours}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-24 text-sm">{t.admin.openTime || 'Open'}</span>
            <Input className="w-24 h-8 text-sm" value={settingsForm.openTime} onChange={(e) => setSettingsForm({ ...settingsForm, openTime: e.target.value })} />
            <span className="text-sm text-muted-foreground">{t.admin.to}</span>
            <Input className="w-24 h-8 text-sm" value={settingsForm.closeTime} onChange={(e) => setSettingsForm({ ...settingsForm, closeTime: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* Financial Settings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base">{t.admin.financialSettings}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><Label className="text-sm">{t.admin.taxRateLabel}</Label><Input type="number" value={settingsForm.taxRate} onChange={(e) => setSettingsForm({ ...settingsForm, taxRate: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.tipPresetsLabel}</Label><Input value={settingsForm.tipPresets} onChange={(e) => setSettingsForm({ ...settingsForm, tipPresets: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.minOrderLabel}</Label><Input type="number" value={settingsForm.minDeliveryOrder} onChange={(e) => setSettingsForm({ ...settingsForm, minDeliveryOrder: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.radiusLabel}</Label><Input type="number" value={settingsForm.deliveryRadius} onChange={(e) => setSettingsForm({ ...settingsForm, deliveryRadius: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.deliveryFeeLabel}</Label><Input type="number" step="0.01" value={settingsForm.deliveryFee} onChange={(e) => setSettingsForm({ ...settingsForm, deliveryFee: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.avgPrepTimeLabel}</Label><Input type="number" value={settingsForm.avgPrepTime} onChange={(e) => setSettingsForm({ ...settingsForm, avgPrepTime: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.currencySymbolLabel}</Label><Input value={settingsForm.currencySymbol} onChange={(e) => setSettingsForm({ ...settingsForm, currencySymbol: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base">{t.admin.statistics}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label className="text-sm">{t.admin.statsOrdersServed}</Label><Input type="number" value={settingsForm.statsOrdersServed} onChange={(e) => setSettingsForm({ ...settingsForm, statsOrdersServed: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.statsHappyCustomers}</Label><Input type="number" value={settingsForm.statsHappyCustomers} onChange={(e) => setSettingsForm({ ...settingsForm, statsHappyCustomers: e.target.value })} /></div>
            <div><Label className="text-sm">{t.admin.statsYearsService}</Label><Input type="number" value={settingsForm.statsYearsService} onChange={(e) => setSettingsForm({ ...settingsForm, statsYearsService: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Button className="bg-amber-600 hover:bg-amber-500" onClick={handleSaveSettings} disabled={savingSettings}>
        {savingSettings ? <RefreshCw className="h-4 w-4 me-1 animate-spin" /> : <Save className="h-4 w-4 me-1" />} {t.admin.saveSettings}
      </Button>
      </>)}
    </div>
    );
  };

  const renderKdsScreens = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.admin.kdsScreens}</h2>
        <Button onClick={() => {
          setEditingKdsId(null);
          setKdsForm({ name: '', slug: '', description: '', stationFilter: '', layoutType: 'grid', autoRefreshInterval: '10', showCompleted: false, maxOrders: '0', sortOrder: '0', isActive: true });
          setKdsDialogOpen(true);
        }} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
          <Plus className="h-4 w-4 me-1" /> {t.admin.addScreen}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kitchenScreens.length === 0 ? (
          <Card className="col-span-full rounded-xl">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">{t.admin.noData}</p>
              <p className="text-sm mt-1 mb-4">{t.kitchen.noScreensDesc}</p>
              <Button onClick={() => {
                setEditingKdsId(null);
                setKdsForm({ name: '', slug: '', description: '', stationFilter: '', layoutType: 'grid', autoRefreshInterval: '10', showCompleted: false, maxOrders: '0', sortOrder: '0', isActive: true });
                setKdsDialogOpen(true);
              }} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                <Plus className="h-4 w-4 me-1" /> {t.admin.addScreen}
              </Button>
            </CardContent>
          </Card>
        ) : kitchenScreens.map((screen) => (
          <Card key={screen.id} className={`rounded-xl shadow-sm hover:shadow-md transition-shadow ${!screen.isActive ? 'opacity-60' : ''}`}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Monitor className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground truncate">{screen.name}</h3>
                    {screen.description && <p className="text-xs text-muted-foreground line-clamp-1">{screen.description}</p>}
                  </div>
                </div>
                <Badge className={screen.isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}>
                  {screen.isActive ? t.admin.activeScreen : t.admin.inactiveScreen}
                </Badge>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t.admin.stationFilter}:</span>
                  <Badge variant="outline" className="border-border">{screen.stationFilter || t.admin.allStations}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t.admin.screenUrl}:</span>
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <a href={`/kitchen/${screen.slug}`} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline flex items-center gap-1 text-xs truncate">
                      /kitchen/{screen.slug} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
                      onClick={() => {
                        const url = `${window.location.origin}/kitchen/${screen.slug}`;
                        navigator.clipboard.writeText(url).then(() => {
                          toast.success(t.admin.screenUrlCopied);
                        }).catch(() => {
                          toast.error(t.admin.failedSave);
                        });
                      }}
                      title={t.admin.copyScreenUrl}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">{t.admin.autoRefresh}: <strong>{screen.autoRefreshInterval}s</strong></span>
                  <span className="text-muted-foreground text-xs">{t.admin.layoutType}: <Badge variant="outline" className="border-border text-[10px]">{screen.layoutType === 'grid' ? t.admin.grid : screen.layoutType === 'list' ? t.admin.list : t.admin.compact}</Badge></span>
                  {screen.maxOrders > 0 && (
                    <span className="text-muted-foreground text-xs">{t.admin.maxOrders}: <strong>{screen.maxOrders}</strong></span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 pt-1">
                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => {
                  setEditingKdsId(screen.id);
                  setKdsForm({
                    name: screen.name, slug: screen.slug, description: screen.description,
                    stationFilter: screen.stationFilter, layoutType: screen.layoutType,
                    autoRefreshInterval: String(screen.autoRefreshInterval),
                    showCompleted: screen.showCompleted, maxOrders: String(screen.maxOrders),
                    sortOrder: String(screen.sortOrder), isActive: screen.isActive,
                  });
                  setKdsDialogOpen(true);
                }}><Edit className="h-3 w-3" /></Button>
                <Button variant="outline" size="sm" className="text-red-500 rounded-lg" onClick={() => handleDeleteKds(screen.id)}><Trash2 className="h-3 w-3" /></Button>
                <a href={`/kitchen/${screen.slug}`} target="_blank" rel="noopener noreferrer" className="ms-auto">
                  <Button variant="outline" size="sm" className="text-amber-600 rounded-lg"><Monitor className="h-3 w-3 me-1" />{t.admin.openScreen}</Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // ============ TABLES & QR ============
  const [tablesData, setTablesData] = useState<{id: string; number: number; seats: number; shape: string; status: string}[]>([]);
  const [qrTableId, setQrTableId] = useState<string | null>(null);
  const [qrTableNumber, setQrTableNumber] = useState<number>(0);

  useEffect(() => {
    if (activeTab === 'tables') {
      fetch('/api/tables').then(r => r.json()).then(d => setTablesData(d.tables || [])).catch(() => {});
    }
  }, [activeTab]);

  const renderTables = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.admin.tables || 'Tables'}</h2>
        <Badge variant="outline">{tablesData.length} {t.admin.tables || 'Tables'}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {tablesData.map((table) => (
          <Card key={table.id} className="bg-card border-border hover:border-amber-500/40 transition-colors">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
                <span className="text-lg font-black text-amber-600 dark:text-amber-400">{table.number}</span>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-foreground">{t.staff.table} {table.number}</div>
                <div className="text-xs text-muted-foreground">{table.seats} {t.admin.seats || 'seats'}</div>
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs gap-1.5" onClick={() => { setQrTableId(table.id); setQrTableNumber(table.number); }}>
                <QrCode className="size-3.5" /> {t.admin.viewQr || 'QR Code'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* QR Code Dialog */}
      <Dialog open={qrTableId !== null} onOpenChange={(open) => { if (!open) { setQrTableId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-5 text-amber-600" />
              {t.staff.table} {qrTableNumber} — QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl">
              {/* @ts-expect-error qrcode.react types */}
              <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?table=${qrTableNumber}`} size={200} />
            </div>
            <p className="text-sm text-muted-foreground text-center">{t.admin.qrDesc || 'Scan to view menu for this table'}</p>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 text-xs" onClick={() => {
                const url = `${window.location.origin}/?table=${qrTableNumber}`;
                navigator.clipboard.writeText(url);
                toast.success(t.admin.linkCopied || 'Link copied!');
              }}>
                <Copy className="size-3.5 me-1" /> {t.admin.copyLink || 'Copy Link'}
              </Button>
              <Button className="flex-1 text-xs bg-amber-600 hover:bg-amber-500 text-white" onClick={() => {
                const canvas = document.querySelector('#qr-canvas');
                if (canvas) {
                  const link = document.createElement('a');
                  link.download = `table-${qrTableNumber}-qr.png`;
                  link.href = canvas.querySelector('canvas')?.toDataURL() || '';
                  link.click();
                }
              }}>
                {t.admin.download || 'Download'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const tabRenderers: Record<AdminTab, () => React.ReactNode> = {
    menu: renderMenu, inventory: renderInventory, employees: renderEmployees,
    schedule: renderSchedule, 'kds-screens': renderKdsScreens, tables: renderTables, reports: renderReports, cash: renderCash,
    reservations: renderReservations, notifications: renderNotifications, settings: renderSettings,
  };

  return (
    <div className="min-h-screen bg-background pt-12">
      {/* Sidebar */}
      <div className={`fixed top-12 bottom-0 w-56 bg-card border-r border-border z-40 hidden md:block ${isRTL ? 'right-0' : 'left-0'}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <UserCog className="h-5 w-5 text-amber-600" />
            <h1 className="font-bold text-base">{t.admin.title}</h1>
          </div>
          <div className="space-y-0.5">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  activeTab === item.id ? 'bg-amber-100 text-amber-800 font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item.icon} {item.label}
                {item.id === 'notifications' && unreadCount > 0 && <Badge className="bg-red-500 text-white text-[10px] ms-auto h-4 min-w-[16px] px-1">{unreadCount}</Badge>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden fixed top-12 left-0 right-0 z-40 bg-card border-b border-border overflow-x-auto">
        <div className="flex gap-1 p-2">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${
                activeTab === item.id ? 'bg-amber-100 text-amber-800 font-medium' : 'text-muted-foreground'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className={`${isRTL ? 'md:mr-56' : 'md:ml-56'} p-4 pt-16 md:pt-4`}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          tabRenderers[activeTab]()
        )}
      </main>

      {/* Menu Item Dialog */}
      <Dialog open={menuItemDialogOpen} onOpenChange={setMenuItemDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMenuId ? t.admin.editMenuItem : t.admin.addMenuItem}</DialogTitle>
            <DialogDescription>{t.admin.fillDetails}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-4">
              <ImageUploadButton
                value={menuForm.imageUrl}
                onChange={(url) => setMenuForm(f => ({ ...f, imageUrl: url }))}
                label={t.admin.uploadImage || 'Upload Image'}
                size="lg"
              />
              <div className="flex-1 space-y-3">
                <div><Label>{t.admin.nameEn}</Label><Input value={menuForm.nameEn} onChange={(e) => setMenuForm(f => ({ ...f, nameEn: e.target.value }))} /></div>
                <div><Label>{t.admin.nameAr}</Label><Input value={menuForm.nameAr} onChange={(e) => setMenuForm(f => ({ ...f, nameAr: e.target.value }))} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t.admin.priceLabel}</Label><Input type="number" step="0.01" value={menuForm.price} onChange={(e) => setMenuForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div><Label>{t.admin.prepTimeLabel}</Label><Input type="number" value={menuForm.preparationTime} onChange={(e) => setMenuForm(f => ({ ...f, preparationTime: e.target.value }))} /></div>
            </div>
            <div><Label>{t.admin.category}</Label>
              <Select value={menuForm.categoryId || undefined} onValueChange={(val) => setMenuForm(f => ({ ...f, categoryId: val }))}>
                <SelectTrigger><SelectValue placeholder={t.admin.selectCategory} /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{locale === 'ar' ? c.nameAr : c.nameEn}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t.admin.description}</Label><Textarea value={menuForm.descriptionEn} onChange={(e) => setMenuForm(f => ({ ...f, descriptionEn: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={menuForm.isAvailable} onCheckedChange={(val) => setMenuForm(f => ({ ...f, isAvailable: val }))} /><Label>{t.admin.available}</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMenuItemDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveMenuItem} className="bg-amber-600 hover:bg-amber-500">{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ingredient Dialog */}
      <Dialog open={ingredientDialogOpen} onOpenChange={setIngredientDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingIngredientId ? t.admin.editIngredient : t.admin.addIngredientTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t.admin.name}</Label><Input value={ingredientForm.name} onChange={(e) => setIngredientForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t.admin.unit}</Label><Input value={ingredientForm.unit} onChange={(e) => setIngredientForm(f => ({ ...f, unit: e.target.value }))} /></div>
              <div><Label>{t.admin.quantity}</Label><Input type="number" value={ingredientForm.quantity} onChange={(e) => setIngredientForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t.admin.lowThreshold}</Label><Input type="number" value={ingredientForm.lowThreshold} onChange={(e) => setIngredientForm(f => ({ ...f, lowThreshold: e.target.value }))} /></div>
              <div><Label>{t.admin.costPerUnitLabel}</Label><Input type="number" step="0.01" value={ingredientForm.costPerUnit} onChange={(e) => setIngredientForm(f => ({ ...f, costPerUnit: e.target.value }))} /></div>
            </div>
            <div><Label>{t.admin.supplier}</Label><Input value={ingredientForm.supplier} onChange={(e) => setIngredientForm(f => ({ ...f, supplier: e.target.value }))} /></div>
            <div><Label>{t.admin.category}</Label><Input value={ingredientForm.category} onChange={(e) => setIngredientForm(f => ({ ...f, category: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIngredientDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveIngredient} className="bg-amber-600 hover:bg-amber-500">{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Dialog */}
      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingEmployeeId ? t.admin.editEmployeeTitle : t.admin.addEmployeeTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t.admin.name}</Label><Input value={employeeForm.name} onChange={(e) => setEmployeeForm(f => ({ ...f, name: e.target.value }))} /></div>
            {!editingEmployeeId && <div><Label>{t.admin.pin}</Label><Input type="password" maxLength={6} value={employeeForm.pin} onChange={(e) => setEmployeeForm(f => ({ ...f, pin: e.target.value }))} placeholder="4-6 digit PIN" /></div>}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t.admin.role}</Label>
                <Select value={employeeForm.role} onValueChange={(val) => setEmployeeForm(f => ({ ...f, role: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t.admin.roleAdmin}</SelectItem>
                    <SelectItem value="manager">{t.admin.roleManager}</SelectItem>
                    <SelectItem value="staff">{t.admin.roleStaff}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t.admin.hourlyWageLabel}</Label><Input type="number" step="0.5" value={employeeForm.hourlyWage} onChange={(e) => setEmployeeForm(f => ({ ...f, hourlyWage: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t.admin.email}</Label><Input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>{t.admin.phone}</Label><Input value={employeeForm.phone} onChange={(e) => setEmployeeForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={employeeForm.isActive} onCheckedChange={(val) => setEmployeeForm(f => ({ ...f, isActive: val }))} /><Label>{t.admin.active}</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveEmployee} className="bg-amber-600 hover:bg-amber-500">{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Dialog */}
      <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t.admin.addCashEntryTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t.admin.type}</Label>
              <Select value={cashForm.type} onValueChange={(val) => setCashForm(f => ({ ...f, type: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payin">{t.admin.payIn}</SelectItem>
                  <SelectItem value="payout">{t.admin.payOut}</SelectItem>
                  <SelectItem value="drop">{t.admin.drop}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t.admin.amountLabel}</Label><Input type="number" step="0.01" value={cashForm.amount} onChange={(e) => setCashForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>{t.admin.note}</Label><Input value={cashForm.note} onChange={(e) => setCashForm(f => ({ ...f, note: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveCash} className="bg-amber-600 hover:bg-amber-500">{t.admin.addEntry}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reservation Dialog */}
      <Dialog open={reservationDialogOpen} onOpenChange={setReservationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t.admin.addReservationTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t.admin.customerName}</Label><Input value={reservationForm.customerName} onChange={(e) => setReservationForm(f => ({ ...f, customerName: e.target.value }))} /></div>
            <div><Label>{t.admin.customerPhone}</Label><Input value={reservationForm.customerPhone} onChange={(e) => setReservationForm(f => ({ ...f, customerPhone: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t.admin.partySize}</Label><Input type="number" value={reservationForm.partySize} onChange={(e) => setReservationForm(f => ({ ...f, partySize: e.target.value }))} /></div>
              <div><Label>{t.admin.dateTime}</Label><Input type="datetime-local" value={reservationForm.dateTime} onChange={(e) => setReservationForm(f => ({ ...f, dateTime: e.target.value }))} /></div>
            </div>
            <div><Label>{t.admin.note}</Label><Textarea value={reservationForm.notes} onChange={(e) => setReservationForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReservationDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveReservation} className="bg-amber-600 hover:bg-amber-500">{t.admin.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t.admin.addShiftTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t.admin.employees}</Label>
              <Select value={scheduleForm.employeeId || undefined} onValueChange={(val) => setScheduleForm(f => ({ ...f, employeeId: val }))}>
                <SelectTrigger><SelectValue placeholder={t.admin.selectEmployee} /></SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.isActive).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>{t.admin.day}</Label>
                <Select value={scheduleForm.dayOfWeek} onValueChange={(val) => setScheduleForm(f => ({ ...f, dayOfWeek: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t.admin.start}</Label><Input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm(f => ({ ...f, startTime: e.target.value }))} /></div>
              <div><Label>{t.admin.end}</Label><Input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm(f => ({ ...f, endTime: e.target.value }))} /></div>
            </div>
            <div><Label>{t.admin.role}</Label>
              <Select value={scheduleForm.role} onValueChange={(val) => setScheduleForm(f => ({ ...f, role: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Server">{t.admin.roleServer}</SelectItem>
                  <SelectItem value="Cook">{t.admin.roleCook}</SelectItem>
                  <SelectItem value="Bartender">{t.admin.roleBartender}</SelectItem>
                  <SelectItem value="Host">{t.admin.roleHost}</SelectItem>
                  <SelectItem value="Manager">{t.admin.roleManager}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveSchedule} className="bg-amber-600 hover:bg-amber-500">{t.admin.addShift}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KDS Screen Dialog */}
      <Dialog open={kdsDialogOpen} onOpenChange={setKdsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKdsId ? t.admin.editScreen : t.admin.addScreen}</DialogTitle>
            <DialogDescription>{t.admin.screenFillDetails}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>{t.admin.screenName}</Label><Input value={kdsForm.name} onChange={(e) => {
              const name = e.target.value;
              const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              setKdsForm(f => ({ ...f, name, slug: editingKdsId ? f.slug : autoSlug }));
            }} /></div>
            <div><Label>{t.admin.slug}</Label><Input value={kdsForm.slug} onChange={(e) => setKdsForm(f => ({ ...f, slug: e.target.value }))} placeholder="e.g. grill-station" /></div>
            <div><Label>{t.admin.description}</Label><Input value={kdsForm.description} onChange={(e) => setKdsForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t.admin.stationFilter}</Label>
                <Select value={kdsForm.stationFilter || 'all'} onValueChange={(val) => setKdsForm(f => ({ ...f, stationFilter: val === 'all' ? '' : val }))}>
                  <SelectTrigger><SelectValue placeholder={t.admin.allStations} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.admin.allStations}</SelectItem>
                    <SelectItem value="Grill">{t.kitchen.grill}</SelectItem>
                    <SelectItem value="Prep">{t.kitchen.prep}</SelectItem>
                    <SelectItem value="Bar">{t.kitchen.bar}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t.admin.layoutType}</Label>
                <Select value={kdsForm.layoutType} onValueChange={(val) => setKdsForm(f => ({ ...f, layoutType: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">{t.admin.grid}</SelectItem>
                    <SelectItem value="list">{t.admin.list}</SelectItem>
                    <SelectItem value="compact">{t.admin.compact}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t.admin.autoRefresh}</Label><Input type="number" value={kdsForm.autoRefreshInterval} onChange={(e) => setKdsForm(f => ({ ...f, autoRefreshInterval: e.target.value }))} /></div>
              <div><Label>{t.admin.maxOrders}</Label><Input type="number" value={kdsForm.maxOrders} onChange={(e) => setKdsForm(f => ({ ...f, maxOrders: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t.admin.screenSortOrder}</Label><Input type="number" value={kdsForm.sortOrder} onChange={(e) => setKdsForm(f => ({ ...f, sortOrder: e.target.value }))} /></div>
              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-center gap-2"><Switch checked={kdsForm.showCompleted} onCheckedChange={(val) => setKdsForm(f => ({ ...f, showCompleted: val }))} /><Label>{t.admin.showCompleted}</Label></div>
                <div className="flex items-center gap-2"><Switch checked={kdsForm.isActive} onCheckedChange={(val) => setKdsForm(f => ({ ...f, isActive: val }))} /><Label>{t.admin.active}</Label></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKdsDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveKds} className="bg-amber-600 hover:bg-amber-500">{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
