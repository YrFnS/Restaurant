import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const previousOrderSecret = process.env.AUTH_ORDER_ACCESS_SECRET;
const previousCustomerSecret = process.env.AUTH_CUSTOMER_ACCESS_SECRET;

beforeAll(() => {
  process.env.AUTH_ORDER_ACCESS_SECRET =
    "unit-test-order-secret-0123456789abcdef0123456789abcdef";
  process.env.AUTH_CUSTOMER_ACCESS_SECRET =
    "unit-test-customer-secret-0123456789abcdef0123456789abcdef";
});

afterAll(() => {
  if (previousOrderSecret === undefined) delete process.env.AUTH_ORDER_ACCESS_SECRET;
  else process.env.AUTH_ORDER_ACCESS_SECRET = previousOrderSecret;

  if (previousCustomerSecret === undefined) {
    delete process.env.AUTH_CUSTOMER_ACCESS_SECRET;
  } else {
    process.env.AUTH_CUSTOMER_ACCESS_SECRET = previousCustomerSecret;
  }
});

describe("signed access tokens", () => {
  test("order access tokens are scoped to one order", async () => {
    const {
      createOrderAccessToken,
      verifyOrderAccessToken,
    } = await import("../../src/lib/orders/access");

    const token = createOrderAccessToken("order_a");
    expect(verifyOrderAccessToken("order_a", token)).toBe(true);
    expect(verifyOrderAccessToken("order_b", token)).toBe(false);
    expect(verifyOrderAccessToken("order_a", `${token}x`)).toBe(false);
  });

  test("idempotency keys map deterministically to distinct internal order IDs", async () => {
    const { orderIdFromIdempotencyKey } = await import(
      "../../src/lib/orders/access"
    );

    const first = orderIdFromIdempotencyKey("checkout-key-00000001");
    const replay = orderIdFromIdempotencyKey("checkout-key-00000001");
    const second = orderIdFromIdempotencyKey("checkout-key-00000002");

    expect(first).toBe(replay);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^ord_[a-f0-9]{32}$/);
  });

  test("customer resource tokens cannot cross resource kinds or IDs", async () => {
    const {
      createCustomerAccessToken,
      verifyCustomerAccessToken,
    } = await import("../../src/lib/customer-access");

    const token = createCustomerAccessToken("reservation", "reservation_a");
    expect(
      verifyCustomerAccessToken("reservation", "reservation_a", token)
    ).toBe(true);
    expect(
      verifyCustomerAccessToken("reservation", "reservation_b", token)
    ).toBe(false);
    expect(verifyCustomerAccessToken("waitlist", "reservation_a", token)).toBe(
      false
    );
  });
});