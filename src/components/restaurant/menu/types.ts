export interface MenuItemModifier {
  id: string;
  nameEn: string;
  nameAr: string;
  type: string;
  price: number;
}

export interface MenuItem {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: number;
  image: string;
  isAvailable: boolean;
  isPopular: boolean;
  isSpecial: boolean;
  preparationTime: number;
  calories: number;
  allergens: string;
  dietary: string;
  sortOrder: number;
  categoryId: string;
  modifiers: MenuItemModifier[];
}

export interface MenuCategory {
  id: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  sortOrder: number;
  isAvailable: boolean;
  items: MenuItem[];
}
