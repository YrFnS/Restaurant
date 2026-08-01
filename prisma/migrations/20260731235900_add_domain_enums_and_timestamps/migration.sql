-- P1-A03/P1-A04: constrain controlled operational values with PostgreSQL enums.
-- The preflight block intentionally fails before changing any column when an
-- unknown legacy value exists. Operators must normalize such data explicitly.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Order" WHERE "type" NOT IN ('dine_in', 'takeout', 'delivery')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: Order.type contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "Order" WHERE "status" NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: Order.status contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "Order" WHERE "paymentMethod" NOT IN ('cash', 'card', 'split')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: Order.paymentMethod contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "Order" WHERE "paymentStatus" NOT IN ('unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'voided')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: Order.paymentStatus contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "OrderItem" WHERE "status" NOT IN ('pending', 'preparing', 'ready', 'served', 'cancelled')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: OrderItem.status contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "Employee" WHERE "role" NOT IN ('owner', 'admin', 'manager', 'cashier', 'server', 'cook', 'bartender', 'host', 'inventory_manager', 'analyst', 'staff')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: Employee.role contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "RestaurantTable" WHERE "status" NOT IN ('open', 'seated', 'ordered', 'served', 'paid', 'cleaning', 'reserved')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: RestaurantTable.status contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "RestaurantTable" WHERE "shape" NOT IN ('square', 'round')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: RestaurantTable.shape contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "Reservation" WHERE "status" NOT IN ('confirmed', 'seated', 'completed', 'cancelled', 'no_show')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: Reservation.status contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "WaitlistEntry" WHERE "status" NOT IN ('waiting', 'notified', 'seated', 'cancelled', 'no_show')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: WaitlistEntry.status contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "CashDrawerEntry" WHERE "type" NOT IN ('payin', 'payout', 'drop', 'sale', 'refund', 'adjustment', 'opening_float', 'closing_adjustment')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: CashDrawerEntry.type contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "KitchenScreen" WHERE "screenType" NOT IN ('prep', 'expo', 'all')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: KitchenScreen.screenType contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "KitchenScreen" WHERE "layoutType" NOT IN ('grid', 'compact')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: KitchenScreen.layoutType contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "DynamicPricing" WHERE "type" NOT IN ('happy_hour', 'lunch_special', 'surge')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: DynamicPricing.type contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "PaymentEvent" WHERE "eventType" NOT IN ('capture', 'refund', 'void', 'adjustment')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: PaymentEvent.eventType contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "PaymentEvent" WHERE "method" NOT IN ('cash', 'card', 'split')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: PaymentEvent.method contains an unknown value';
  END IF;
  IF EXISTS (SELECT 1 FROM "PaymentEvent" WHERE "status" NOT IN ('pending', 'succeeded', 'failed', 'voided')) THEN
    RAISE EXCEPTION 'P1 enum migration blocked: PaymentEvent.status contains an unknown value';
  END IF;
END $$;

CREATE TYPE "OrderType" AS ENUM ('dine_in', 'takeout', 'delivery');
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');
CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'preparing', 'ready', 'served', 'cancelled');
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'split');
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'voided');
CREATE TYPE "StaffRole" AS ENUM ('owner', 'admin', 'manager', 'cashier', 'server', 'cook', 'bartender', 'host', 'inventory_manager', 'analyst', 'staff');
CREATE TYPE "TableStatus" AS ENUM ('open', 'seated', 'ordered', 'served', 'paid', 'cleaning', 'reserved');
CREATE TYPE "TableShape" AS ENUM ('square', 'round');
CREATE TYPE "ReservationStatus" AS ENUM ('confirmed', 'seated', 'completed', 'cancelled', 'no_show');
CREATE TYPE "WaitlistStatus" AS ENUM ('waiting', 'notified', 'seated', 'cancelled', 'no_show');
CREATE TYPE "CashMovementType" AS ENUM ('payin', 'payout', 'drop', 'sale', 'refund', 'adjustment', 'opening_float', 'closing_adjustment');
CREATE TYPE "KdsScreenType" AS ENUM ('prep', 'expo', 'all');
CREATE TYPE "KdsLayoutType" AS ENUM ('grid', 'compact');
CREATE TYPE "DynamicPricingType" AS ENUM ('happy_hour', 'lunch_special', 'surge');
CREATE TYPE "PaymentEventType" AS ENUM ('capture', 'refund', 'void', 'adjustment');
CREATE TYPE "PaymentEventStatus" AS ENUM ('pending', 'succeeded', 'failed', 'voided');

ALTER TABLE "Order" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "type" TYPE "OrderType" USING ("type"::text::"OrderType");
ALTER TABLE "Order" ALTER COLUMN "type" SET DEFAULT 'dine_in'::"OrderType";

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::text::"OrderStatus");
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'pending'::"OrderStatus";

ALTER TABLE "Order" ALTER COLUMN "paymentMethod" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING ("paymentMethod"::text::"PaymentMethod");
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET DEFAULT 'cash'::"PaymentMethod";

ALTER TABLE "Order" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus" USING ("paymentStatus"::text::"PaymentStatus");
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" SET DEFAULT 'unpaid'::"PaymentStatus";

ALTER TABLE "OrderItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OrderItem" ALTER COLUMN "status" TYPE "OrderItemStatus" USING ("status"::text::"OrderItemStatus");
ALTER TABLE "OrderItem" ALTER COLUMN "status" SET DEFAULT 'pending'::"OrderItemStatus";

ALTER TABLE "Employee" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN "role" TYPE "StaffRole" USING ("role"::text::"StaffRole");
ALTER TABLE "Employee" ALTER COLUMN "role" SET DEFAULT 'staff'::"StaffRole";

ALTER TABLE "RestaurantTable" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RestaurantTable" ALTER COLUMN "status" TYPE "TableStatus" USING ("status"::text::"TableStatus");
ALTER TABLE "RestaurantTable" ALTER COLUMN "status" SET DEFAULT 'open'::"TableStatus";

ALTER TABLE "RestaurantTable" ALTER COLUMN "shape" DROP DEFAULT;
ALTER TABLE "RestaurantTable" ALTER COLUMN "shape" TYPE "TableShape" USING ("shape"::text::"TableShape");
ALTER TABLE "RestaurantTable" ALTER COLUMN "shape" SET DEFAULT 'square'::"TableShape";

ALTER TABLE "Reservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "status" TYPE "ReservationStatus" USING ("status"::text::"ReservationStatus");
ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'confirmed'::"ReservationStatus";

ALTER TABLE "WaitlistEntry" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WaitlistEntry" ALTER COLUMN "status" TYPE "WaitlistStatus" USING ("status"::text::"WaitlistStatus");
ALTER TABLE "WaitlistEntry" ALTER COLUMN "status" SET DEFAULT 'waiting'::"WaitlistStatus";

ALTER TABLE "CashDrawerEntry" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "CashDrawerEntry" ALTER COLUMN "type" TYPE "CashMovementType" USING ("type"::text::"CashMovementType");
ALTER TABLE "CashDrawerEntry" ALTER COLUMN "type" SET DEFAULT 'payin'::"CashMovementType";

ALTER TABLE "KitchenScreen" ALTER COLUMN "screenType" DROP DEFAULT;
ALTER TABLE "KitchenScreen" ALTER COLUMN "screenType" TYPE "KdsScreenType" USING ("screenType"::text::"KdsScreenType");
ALTER TABLE "KitchenScreen" ALTER COLUMN "screenType" SET DEFAULT 'prep'::"KdsScreenType";

ALTER TABLE "KitchenScreen" ALTER COLUMN "layoutType" DROP DEFAULT;
ALTER TABLE "KitchenScreen" ALTER COLUMN "layoutType" TYPE "KdsLayoutType" USING ("layoutType"::text::"KdsLayoutType");
ALTER TABLE "KitchenScreen" ALTER COLUMN "layoutType" SET DEFAULT 'grid'::"KdsLayoutType";

ALTER TABLE "DynamicPricing" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "DynamicPricing" ALTER COLUMN "type" TYPE "DynamicPricingType" USING ("type"::text::"DynamicPricingType");
ALTER TABLE "DynamicPricing" ALTER COLUMN "type" SET DEFAULT 'happy_hour'::"DynamicPricingType";

ALTER TABLE "PaymentEvent" ALTER COLUMN "eventType" TYPE "PaymentEventType" USING ("eventType"::text::"PaymentEventType");

ALTER TABLE "PaymentEvent" ALTER COLUMN "method" TYPE "PaymentMethod" USING ("method"::text::"PaymentMethod");

ALTER TABLE "PaymentEvent" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PaymentEvent" ALTER COLUMN "status" TYPE "PaymentEventStatus" USING ("status"::text::"PaymentEventStatus");
ALTER TABLE "PaymentEvent" ALTER COLUMN "status" SET DEFAULT 'succeeded'::"PaymentEventStatus";
