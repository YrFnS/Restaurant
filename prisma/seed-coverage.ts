import {
  CashMovementType,
  GiftCardTransactionType,
  LoyaltyPointEventType,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentEventStatus,
  PaymentEventType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  PurchaseOrderStatus,
  ReservationSource,
  ReservationStatus,
  StaffRole,
  TableStatus,
  WaitlistStatus,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { postPurchaseReceipt, reversePurchaseReceipt } from "../src/lib/inventory/purchasing";
import { addTimeAdjustment, clockEmployee } from "../src/lib/timekeeping/timekeeping";

const uid = () => randomUUID().slice(0, 12);
const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000);
const pastDate = (days: number) => new Date(Date.now() - days * 86_400_000);
const addMinutes = (value: Date, minutes: number) => new Date(value.getTime() + minutes * 60_000);
const micros = (value: number) => BigInt(Math.round(value * 1_000_000));
const minor = (value: number) => BigInt(Math.round(value * 100));
const transactionOptions = { maxWait: 30_000, timeout: 120_000 };

type SeedActor = { id: string; name: string; role: StaffRole };

export async function seedOperationalCoverage(db: PrismaClient) {
  const missingEmployees = [
    { name: "Olivia Owner", pin: "9090", role: StaffRole.owner, wage: 35, email: "owner@restaurant.com" },
    { name: "Carla Cashier", pin: "7777", role: StaffRole.cashier, wage: 14, email: "cashier@restaurant.com" },
    { name: "Inez Inventory", pin: "8888", role: StaffRole.inventory_manager, wage: 18, email: "inventory@restaurant.com" },
    { name: "Amal Analyst", pin: "9898", role: StaffRole.analyst, wage: 19, email: "analyst@restaurant.com" },
    { name: "Sam Staff", pin: "1212", role: StaffRole.staff, wage: 10, email: "staff@restaurant.com" },
    { name: "Inactive Staff", pin: "1313", role: StaffRole.staff, wage: 10, email: "inactive@restaurant.com", isActive: false },
  ];
  for (const entry of missingEmployees) {
    const employee = await db.employee.create({
      data: { name: entry.name, pin: entry.pin, role: entry.role, hourlyWage: entry.wage, email: entry.email, isActive: entry.isActive ?? true },
    });
    for (let day = 1; day <= 6; day++) {
      await db.schedule.create({ data: { employeeId: employee.id, dayOfWeek: day, startTime: "09:00", endTime: "17:00", role: entry.role } });
    }
  }
  const employees = await db.employee.findMany({ where: { isActive: true } });
  const actor = (role: StaffRole): SeedActor => {
    const employee = employees.find((item) => item.role === role);
    if (!employee) throw new Error(`Missing seed employee for ${role}`);
    return { id: employee.id, name: employee.name, role: employee.role };
  };
  const owner = actor(StaffRole.owner);
  const manager = actor(StaffRole.manager);
  const cashier = actor(StaffRole.cashier);
  const server = actor(StaffRole.server);
  const cook = actor(StaffRole.cook);

  const menuItem = await db.menuItem.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const createStateOrder = (status: OrderStatus, paymentStatus: PaymentStatus) => {
    const total = menuItem.price;
    return db.order.create({
      data: {
        orderNumber: `#SEED-${status.toUpperCase()}`,
        type: status === OrderStatus.cancelled ? OrderType.delivery : OrderType.takeout,
        status,
        customerName: `Seed ${status}`,
        subtotal: total,
        taxAmount: total * 0.1,
        total: total * 1.1,
        paymentMethod: PaymentMethod.card,
        paymentStatus,
        serverName: server.name,
        completedAt: status === OrderStatus.completed ? new Date() : null,
        items: {
          create: {
            menuItemId: menuItem.id,
            quantity: 1,
            unitPrice: total,
            totalPrice: total,
            status: status === OrderStatus.completed ? OrderItemStatus.served : OrderItemStatus.cancelled,
            stationSlug: "prep",
          },
        },
      },
    });
  };
  const completedOrder = await createStateOrder(OrderStatus.completed, PaymentStatus.refunded);
  const cancelledOrder = await createStateOrder(OrderStatus.cancelled, PaymentStatus.voided);
  const orders = await db.order.findMany();
  const orderFor = (status: OrderStatus) => {
    const order = orders.find((item) => item.status === status) || (status === OrderStatus.completed ? completedOrder : cancelledOrder);
    if (!order) throw new Error(`Missing seed order for ${status}`);
    return order;
  };
  await db.orderItem.updateMany({ where: { orderId: orderFor(OrderStatus.ready).id }, data: { status: OrderItemStatus.ready } });
  const preparingOrders = orders.filter((item) => item.status === OrderStatus.preparing);
  if (preparingOrders[0]) await db.order.update({ where: { id: preparingOrders[0].id }, data: { paymentStatus: PaymentStatus.partially_paid } });
  if (preparingOrders[1]) await db.order.update({ where: { id: preparingOrders[1].id }, data: { paymentStatus: PaymentStatus.partially_refunded } });

  const tableStates = [TableStatus.ordered, TableStatus.served, TableStatus.paid, TableStatus.cleaning];
  const tables = await db.restaurantTable.findMany({ orderBy: { number: "asc" } });
  for (const [index, status] of tableStates.entries()) {
    await db.restaurantTable.update({ where: { id: tables[7 + index].id }, data: { status } });
  }
  const seatedWaitlistTable = tables[13];
  await db.restaurantTable.update({
    where: { id: seatedWaitlistTable.id },
    data: { status: TableStatus.seated, seatedAt: new Date(), serverName: server.name },
  });

  for (const [index, status] of [ReservationStatus.cancelled, ReservationStatus.no_show].entries()) {
    const dateTime = pastDate(index + 2);
    await db.reservation.create({
      data: {
        customerName: `Seed ${status}`,
        customerPhone: `+964750900000${index}`,
        partySize: index + 2,
        dateTime,
        durationMinutes: 90,
        turnoverMinutes: 15,
        endsAt: addMinutes(dateTime, 90),
        releaseAt: addMinutes(dateTime, 105),
        status,
        source: ReservationSource.staff,
        cancelledAt: status === ReservationStatus.cancelled ? dateTime : null,
        noShowAt: status === ReservationStatus.no_show ? dateTime : null,
        notes: "Seeded reservation lifecycle state",
      },
    });
  }
  for (const [index, status] of [WaitlistStatus.seated, WaitlistStatus.cancelled, WaitlistStatus.no_show].entries()) {
    await db.waitlistEntry.create({
      data: {
        customerName: `Seed ${status}`,
        customerPhone: `+964750910000${index}`,
        partySize: index + 2,
        status,
        estimatedWait: 10 + index * 5,
        source: ReservationSource.staff,
        tableId: status === WaitlistStatus.seated ? seatedWaitlistTable.id : null,
        estimatedSeatAt: pastDate(0),
        estimateCalculatedAt: pastDate(0),
        seatedAt: status === WaitlistStatus.seated ? new Date() : null,
        cancelledAt: status === WaitlistStatus.cancelled ? new Date() : null,
        noShowAt: status === WaitlistStatus.no_show ? new Date() : null,
        notes: "Seeded waitlist lifecycle state",
      },
    });
  }
  await db.reservationClosure.createMany({
    data: [
      { startsAt: futureDate(14), endsAt: futureDate(15), reason: "Scheduled maintenance", createdById: manager.id, createdByName: manager.name },
      { startsAt: pastDate(14), endsAt: pastDate(13), reason: "Past private event", createdById: owner.id, createdByName: owner.name },
    ],
  });

  const ingredients = await db.ingredient.findMany();
  const ingredient = (name: string) => {
    const result = ingredients.find((item) => item.name === name);
    if (!result) throw new Error(`Missing seed ingredient ${name}`);
    return result;
  };
  const chicken = ingredient("Chicken Breast");
  const lemons = ingredient("Lemons");
  await db.ingredientUnitConversion.createMany({
    data: [
      { id: `seed_conversion_${uid()}`, ingredientId: chicken.id, unit: "g", toBaseMicros: 1000n },
      { id: `seed_conversion_${uid()}`, ingredientId: lemons.id, unit: "dozen", toBaseMicros: micros(12) },
    ],
  });
  const hummus = await db.menuItem.findFirstOrThrow({ where: { nameEn: "Hummus Beiruti" } });
  const modifier = await db.modifierOption.findFirst({ where: { group: { menuItemId: hummus.id } } });
  const oldRecipe = await db.recipe.create({
    data: { id: `seed_recipe_${uid()}`, creationKey: `seed-recipe-old:${hummus.id}`, menuItemId: hummus.id, version: 1, isActive: false, supersededAt: pastDate(1), createdById: owner.id, createdByName: owner.name },
  });
  const activeRecipe = await db.recipe.create({
    data: { id: `seed_recipe_${uid()}`, creationKey: `seed-recipe-active:${hummus.id}`, menuItemId: hummus.id, version: 2, createdById: owner.id, createdByName: owner.name },
  });
  await db.recipeComponent.createMany({
    data: [
      { id: `seed_component_${uid()}`, recipeId: oldRecipe.id, ingredientId: lemons.id, quantityMicros: micros(0.1) },
      { id: `seed_component_${uid()}`, recipeId: activeRecipe.id, ingredientId: lemons.id, quantityMicros: micros(0.08) },
      { id: `seed_component_${uid()}`, recipeId: activeRecipe.id, ingredientId: chicken.id, modifierOptionId: modifier?.id, quantityMicros: micros(0.2) },
    ],
  });

  const purchaseOrders = await db.purchaseOrder.findMany();
  const chickenOrder = purchaseOrders.find((item) => item.notes === "Weekly chicken order")!;
  const produceOrder = purchaseOrders.find((item) => item.notes === "Fresh produce delivery")!;
  const supplier = await db.supplier.findFirstOrThrow({ where: { code: "BAGHDAD-POULTRY" } });
  const createSimplePurchaseOrder = async (notes: string, submitted: boolean) => {
    const id = `seed_po_${uid()}`;
    const order = await db.purchaseOrder.create({
      data: {
        id,
        orderNumber: `PO-SEED-${uid().toUpperCase()}`,
        creationKey: `seed-purchase-order:${id}`,
        supplierId: supplier.id,
        supplierCode: supplier.code,
        supplier: supplier.name,
        notes,
        status: PurchaseOrderStatus.draft,
        totalCost: 0,
        totalCostMinor: 0n,
        createdById: owner.id,
        createdByName: owner.name,
        lines: {
          create: {
            id: `seed_po_line_${uid()}`,
            lineNumber: 1,
            ingredientId: chicken.id,
            ingredientName: chicken.name,
            baseUnit: chicken.unit,
            purchaseUnit: chicken.unit,
            conversionToBaseMicros: micros(1),
            orderedPurchaseQuantityMicros: micros(5),
            orderedBaseQuantityMicros: micros(5),
            purchaseUnitCostMicros: micros(chicken.costPerUnit),
            baseUnitCostMicros: micros(chicken.costPerUnit),
            lineTotalMinor: minor(5 * chicken.costPerUnit),
          },
        },
      },
    });
    if (submitted) {
      return db.purchaseOrder.update({
        where: { id: order.id },
        data: { status: PurchaseOrderStatus.submitted, submittedById: owner.id, submittedByName: owner.name, submittedAt: new Date() },
      });
    }
    return order;
  };
  const reversedOrder = await createSimplePurchaseOrder("Receipt reversal example", true);
  const cancelledPurchaseOrder = await createSimplePurchaseOrder("Cancelled order example", false);
  await db.purchaseOrder.update({
    where: { id: cancelledPurchaseOrder.id },
    data: { status: PurchaseOrderStatus.cancelled, cancelledById: owner.id, cancelledByName: owner.name, cancelledAt: new Date(), cancellationReason: "Seeded cancelled-order state" },
  });
  const receiptLines = async (purchaseOrderId: string) => db.purchaseOrderLine.findMany({ where: { purchaseOrderId } });
  const chickenLines = await receiptLines(chickenOrder.id);
  const produceLines = await receiptLines(produceOrder.id);
  await db.$transaction((tx) => postPurchaseReceipt(tx, chickenOrder.id, {
    idempotencyKey: "seed-receipt-chicken-partial",
    lines: chickenLines.map((line) => ({ purchaseOrderLineId: line.id, quantity: 10 })),
    notes: "Partial receipt coverage",
    actor: owner,
  }), transactionOptions);
  await db.$transaction((tx) => postPurchaseReceipt(tx, produceOrder.id, {
    idempotencyKey: "seed-receipt-produce-full",
    lines: produceLines.map((line) => ({ purchaseOrderLineId: line.id, quantity: Number(line.orderedPurchaseQuantityMicros) / 1_000_000 })),
    notes: "Full receipt coverage",
    actor: owner,
  }), transactionOptions);
  const reversalLines = await receiptLines(reversedOrder.id);
  const postedForReversal = await db.$transaction((tx) => postPurchaseReceipt(tx, reversedOrder.id, {
    idempotencyKey: "seed-receipt-to-reverse",
    lines: reversalLines.map((line) => ({ purchaseOrderLineId: line.id, quantity: 5 })),
    notes: "Receipt reversal coverage",
    actor: owner,
  }), transactionOptions);
  await db.$transaction((tx) => reversePurchaseReceipt(tx, reversedOrder.id, {
    receiptId: postedForReversal.receipt.id,
    idempotencyKey: "seed-receipt-reversal-complete",
    reason: "Seeded supplier correction",
    actor: owner,
  }), transactionOptions);

  const register = await db.cashRegister.create({
    data: { id: "seed_register_main", code: "POS-01", name: "Main Register", deviceId: "seed-pos-main", location: "Front counter", discrepancyApprovalThresholdMinor: 100n },
  });
  await db.cashRegister.create({
    data: { id: "seed_register_inactive", code: "POS-OLD", name: "Retired Register", deviceId: "seed-pos-retired", isActive: false },
  });
  const registerSession = await db.cashRegisterSession.create({
    data: { id: "seed_register_session_closed", registerId: register.id, openKey: "seed-open-main", openingFloatMinor: 20000n, openedById: cashier.id, openedByName: cashier.name, openedAt: pastDate(1) },
  });
  const readyOrder = orderFor(OrderStatus.ready);
  const pendingOrder = orderFor(OrderStatus.pending);
  const confirmedOrder = orderFor(OrderStatus.confirmed);
  const preparingOrder = orderFor(OrderStatus.preparing);
  const capture = await db.paymentEvent.create({
    data: { idempotencyKey: "seed-payment-capture-cash", orderId: readyOrder.id, eventType: PaymentEventType.capture, method: PaymentMethod.cash, status: PaymentEventStatus.succeeded, amountCents: 5000, tenderedCents: 6000, changeCents: 1000, actorId: cashier.id, actorName: cashier.name, registerSessionId: registerSession.id },
  });
  const refund = await db.paymentEvent.create({
    data: { idempotencyKey: "seed-payment-refund-cash", orderId: readyOrder.id, eventType: PaymentEventType.refund, method: PaymentMethod.cash, status: PaymentEventStatus.succeeded, amountCents: 500, actorId: manager.id, actorName: manager.name, registerSessionId: registerSession.id, parentEventId: capture.id, reasonCode: "customer_request", reason: "Seeded partial refund" },
  });
  const completedCapture = await db.paymentEvent.create({
    data: { idempotencyKey: "seed-payment-capture-card", orderId: completedOrder.id, eventType: PaymentEventType.capture, method: PaymentMethod.card, status: PaymentEventStatus.succeeded, amountCents: Math.round(completedOrder.total * 100), actorId: cashier.id, actorName: cashier.name, registerSessionId: registerSession.id },
  });
  const completedRefund = await db.paymentEvent.create({
    data: { idempotencyKey: "seed-payment-refund-card", orderId: completedOrder.id, eventType: PaymentEventType.refund, method: PaymentMethod.card, status: PaymentEventStatus.succeeded, amountCents: 100, actorId: manager.id, actorName: manager.name, registerSessionId: registerSession.id, parentEventId: completedCapture.id, reasonCode: "quality_issue", reason: "Seeded quality refund" },
  });
  const voidCapture = await db.paymentEvent.create({
    data: { idempotencyKey: "seed-payment-capture-voided", orderId: cancelledOrder.id, eventType: PaymentEventType.capture, method: PaymentMethod.card, status: PaymentEventStatus.succeeded, amountCents: 2500, actorId: cashier.id, actorName: cashier.name, registerSessionId: registerSession.id },
  });
  await db.paymentEvent.create({
    data: { idempotencyKey: "seed-payment-void", orderId: cancelledOrder.id, eventType: PaymentEventType.void, method: PaymentMethod.card, status: PaymentEventStatus.succeeded, amountCents: 2500, actorId: manager.id, actorName: manager.name, registerSessionId: registerSession.id, parentEventId: voidCapture.id, reasonCode: "order_cancelled", reason: "Seeded cancelled order void" },
  });
  await db.paymentEvent.createMany({ data: [
    { idempotencyKey: "seed-payment-pending", orderId: pendingOrder.id, eventType: PaymentEventType.capture, method: PaymentMethod.card, status: PaymentEventStatus.pending, amountCents: 1000, actorId: cashier.id, actorName: cashier.name },
    { idempotencyKey: "seed-payment-failed", orderId: confirmedOrder.id, eventType: PaymentEventType.capture, method: PaymentMethod.card, status: PaymentEventStatus.failed, amountCents: 1200, actorId: cashier.id, actorName: cashier.name },
  ] });
  await db.cashDrawerEntry.createMany({ data: [
    { type: CashMovementType.opening_float, amount: 200, note: "Session opening float", createdBy: cashier.name, registerSessionId: registerSession.id },
    { type: CashMovementType.sale, amount: 50, note: "Seed cash capture", createdBy: cashier.name, registerSessionId: registerSession.id },
    { type: CashMovementType.refund, amount: 5, note: "Seed cash refund", createdBy: manager.name, registerSessionId: registerSession.id },
  ] });
  await db.cashRegisterSession.update({ where: { id: registerSession.id }, data: { status: "closed", closedAt: new Date() } });
  await db.cashRegisterClose.create({
    data: { id: "seed_register_close_balanced", sessionId: registerSession.id, closeKey: "seed-close-main", expectedCashMinor: 24500n, countedCashMinor: 24500n, discrepancyMinor: 0n, thresholdMinor: 100n, closedById: cashier.id, closedByName: cashier.name, note: "Balanced seeded close" },
  });
  const openRegister = await db.cashRegister.create({
    data: { id: "seed_register_open", code: "POS-02", name: "Patio Register", deviceId: "seed-pos-patio", location: "Patio", discrepancyApprovalThresholdMinor: 100n },
  });
  await db.cashRegisterSession.create({
    data: { id: "seed_register_session_open", registerId: openRegister.id, openKey: "seed-open-patio", openingFloatMinor: 10000n, openedById: cashier.id, openedByName: cashier.name },
  });

  const loyaltyCustomer = await db.customer.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const earned = await db.loyaltyPointEvent.create({
    data: { id: `seed_loyalty_${uid()}`, idempotencyKey: "seed-loyalty-earn", customerId: loyaltyCustomer.id, eventType: LoyaltyPointEventType.earn, pointsDelta: 10, orderId: readyOrder.id, paymentEventId: capture.id, actorId: cashier.id, actorName: cashier.name, actorRole: cashier.role },
  });
  await db.loyaltyPointEvent.create({
    data: { id: `seed_loyalty_${uid()}`, idempotencyKey: "seed-loyalty-earn-reversal", customerId: loyaltyCustomer.id, eventType: LoyaltyPointEventType.earn_reversal, pointsDelta: -10, orderId: readyOrder.id, paymentEventId: refund.id, parentEventId: earned.id, actorId: manager.id, actorName: manager.name, actorRole: manager.role },
  });
  const redeemed = await db.loyaltyPointEvent.create({
    data: { id: `seed_loyalty_${uid()}`, idempotencyKey: "seed-loyalty-redeem", customerId: loyaltyCustomer.id, eventType: LoyaltyPointEventType.redeem, pointsDelta: -50, orderId: completedOrder.id, paymentEventId: completedCapture.id, actorId: cashier.id, actorName: cashier.name, actorRole: cashier.role },
  });
  await db.loyaltyPointEvent.create({
    data: { id: `seed_loyalty_${uid()}`, idempotencyKey: "seed-loyalty-redeem-restore", customerId: loyaltyCustomer.id, eventType: LoyaltyPointEventType.redeem_restore, pointsDelta: 50, orderId: completedOrder.id, paymentEventId: completedRefund.id, parentEventId: redeemed.id, actorId: manager.id, actorName: manager.name, actorRole: manager.role },
  });
  await db.loyaltyPointEvent.create({
    data: { id: `seed_loyalty_${uid()}`, idempotencyKey: "seed-loyalty-adjustment", customerId: loyaltyCustomer.id, eventType: LoyaltyPointEventType.adjustment, pointsDelta: 25, actorId: owner.id, actorName: owner.name, actorRole: owner.role, reasonCode: "service_recovery", reason: "Seeded service recovery adjustment" },
  });

  const giftPayment = await db.paymentEvent.create({
    data: { idempotencyKey: "seed-payment-gift-card", orderId: preparingOrder.id, eventType: PaymentEventType.capture, method: PaymentMethod.gift_card, status: PaymentEventStatus.succeeded, amountCents: 1000, actorId: cashier.id, actorName: cashier.name },
  });
  const createCoverageCard = async (label: string, amountMinor: bigint, expiresAt: Date | null = null) => {
    const secret = `SEED-${label}-${uid()}`.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const card = await db.giftCard.create({
      data: { code: `GC-${label}-${uid()}`, redemptionCodeHash: createHash("sha256").update(secret).digest("hex"), redemptionCodeLast4: secret.slice(-4), amount: Number(amountMinor) / 100, amountMinor, balance: 0, balanceMinor: 0n, purchaserName: "Seed", recipientName: `${label} recipient`, template: "classic", currency: "USD", expiresAt, issuedById: owner.id, issuedByName: owner.name },
    });
    await db.giftCardTransaction.create({
      data: { id: `seed_gift_tx_${uid()}`, idempotencyKey: `seed-gift-${label}-issue`, giftCardId: card.id, transactionType: GiftCardTransactionType.issue, amountMinor, actorId: owner.id, actorName: owner.name, actorRole: owner.role },
    });
    return card;
  };
  const exhaustedCard = await createCoverageCard("EXHAUSTED", 1000n);
  await db.giftCardTransaction.create({
    data: { id: `seed_gift_tx_${uid()}`, idempotencyKey: "seed-gift-exhausted-redeem", giftCardId: exhaustedCard.id, transactionType: GiftCardTransactionType.redeem, amountMinor: -1000n, orderId: preparingOrder.id, paymentEventId: giftPayment.id, actorId: cashier.id, actorName: cashier.name, actorRole: cashier.role },
  });
  const voidedCard = await createCoverageCard("VOIDED", 2500n);
  await db.giftCardTransaction.create({
    data: { id: `seed_gift_tx_${uid()}`, idempotencyKey: "seed-gift-voided", giftCardId: voidedCard.id, transactionType: GiftCardTransactionType.void, amountMinor: -2500n, actorId: owner.id, actorName: owner.name, actorRole: owner.role, reasonCode: "operator_error", reason: "Seeded voided gift card" },
  });
  const expiredCard = await createCoverageCard("EXPIRED", 1500n, pastDate(1));
  await db.giftCardTransaction.create({
    data: { id: `seed_gift_tx_${uid()}`, idempotencyKey: "seed-gift-expired", giftCardId: expiredCard.id, transactionType: GiftCardTransactionType.expiration, amountMinor: -1500n, actorId: owner.id, actorName: owner.name, actorRole: owner.role, reasonCode: "expired", reason: "Seeded expired gift card" },
  });

  const shiftStart = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const timeActor = { id: manager.id, name: manager.name, role: manager.role };
  for (const event of [
    { action: "clock_in" as const, occurredAt: shiftStart, source: "import" as const },
    { action: "break_start" as const, occurredAt: addMinutes(shiftStart, 240), source: "manager" as const },
    { action: "break_end" as const, occurredAt: addMinutes(shiftStart, 270), source: "manager" as const },
    { action: "clock_out" as const, occurredAt: addMinutes(shiftStart, 480), source: "system" as const },
  ]) {
    await db.$transaction((tx) => clockEmployee(tx, {
      idempotencyKey: `seed-time-${server.id}-${event.action}`,
      employeeId: server.id,
      action: event.action,
      source: event.source,
      actor: timeActor,
      occurredAt: event.occurredAt,
      reasonCode: "seed_import",
      reason: "Seeded timekeeping coverage",
    }), transactionOptions);
  }
  const closedShift = await db.employeeShift.findFirstOrThrow({ where: { employeeId: server.id, status: "closed" } });
  await db.$transaction((tx) => addTimeAdjustment(tx, {
    idempotencyKey: "seed-time-adjustment",
    shiftId: closedShift.id,
    paidMinutesDelta: 15,
    reasonCode: "missed_prep",
    reason: "Seeded manager time correction",
    actor: timeActor,
  }), transactionOptions);
  await db.$transaction((tx) => clockEmployee(tx, {
    idempotencyKey: `seed-time-${cook.id}-clock-in`,
    employeeId: cook.id,
    action: "clock_in",
    source: "import",
    actor: timeActor,
    occurredAt: addMinutes(new Date(), -60),
    reasonCode: "seed_import",
    reason: "Seeded open shift coverage",
  }), transactionOptions);

  await db.staffSession.createMany({ data: [
    { id: "seed_session_expired", employeeId: owner.id, tokenHash: createHash("sha256").update("seed-expired-session").digest("hex"), expiresAt: pastDate(1), lastSeenAt: pastDate(2) },
    { id: "seed_session_revoked", employeeId: manager.id, tokenHash: createHash("sha256").update("seed-revoked-session").digest("hex"), expiresAt: futureDate(1), revokedAt: new Date() },
  ] });
  await db.rateLimitCounter.createMany({ data: [
    { key: "seed:active", scope: "seed-demo", count: 2, expiresAt: futureDate(1) },
    { key: "seed:expired", scope: "seed-demo", count: 99, expiresAt: pastDate(1) },
  ] });
  await db.kdsOutboxEvent.createMany({ data: [
    { eventType: "seed:pending", screenSlugs: ["grill"], payload: { orderId: readyOrder.id }, attempts: 0, nextAttemptAt: new Date() },
    { eventType: "seed:delivered", screenSlugs: ["expo"], payload: { orderId: completedOrder.id }, attempts: 1, nextAttemptAt: pastDate(1), deliveredAt: new Date() },
    { eventType: "seed:retry", screenSlugs: ["prep"], payload: { orderId: cancelledOrder.id }, attempts: 3, nextAttemptAt: futureDate(1), lastError: "Seeded transient delivery failure" },
  ] });
  await db.auditEvent.createMany({ data: [
    { actorId: owner.id, actorName: owner.name, actorRole: owner.role, action: "seed.database.reset", entityType: "RestaurantSettings", entityId: "1", metadata: { seed: true } },
    { actorId: manager.id, actorName: manager.name, actorRole: manager.role, action: "seed.lifecycle.coverage", entityType: "Order", entityId: completedOrder.id, metadata: { seed: true } },
    { actorId: cashier.id, actorName: cashier.name, actorRole: cashier.role, action: "seed.payment.coverage", entityType: "PaymentEvent", entityId: capture.id, metadata: { seed: true } },
  ] });
  await db.menuItem.update({ where: { id: (await db.menuItem.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).id }, data: { isAvailable: false } });
  await db.dynamicPricing.update({ where: { id: (await db.dynamicPricing.findFirstOrThrow()).id }, data: { isActive: false } });
  await db.promoCode.create({ data: { code: "EXPIRED5", discountPercent: 5, isActive: false, validFrom: pastDate(30), validUntil: pastDate(1) } });
  await db.feedback.create({ data: { name: "Boundary Rating", rating: 1, comment: "Seeded minimum rating edge case" } });
  console.log("  ✓ Operational coverage for every model, role, and lifecycle state");
}
