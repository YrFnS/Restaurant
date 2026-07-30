import { describe, expect, test } from "bun:test";
import {
  evaluateBrowserMutation,
  parseAllowedOrigins,
} from "../../src/lib/security/request-policy";

describe("parseAllowedOrigins", () => {
  test("normalizes, filters, and de-duplicates configured origins", () => {
    expect(
      parseAllowedOrigins(
        "https://admin.example.com/path, invalid, https://admin.example.com"
      )
    ).toEqual(["https://admin.example.com"]);
  });
});

describe("evaluateBrowserMutation", () => {
  const requestOrigin = "https://restaurant.example.com";

  test("allows safe methods without mutation checks", () => {
    expect(
      evaluateBrowserMutation({
        method: "GET",
        requestOrigin,
        originHeader: "https://attacker.example",
        fetchSite: "cross-site",
      })
    ).toEqual({ allowed: true });
  });

  test("allows same-origin JSON mutations", () => {
    expect(
      evaluateBrowserMutation({
        method: "POST",
        requestOrigin,
        originHeader: requestOrigin,
        fetchSite: "same-origin",
        contentType: "application/json; charset=utf-8",
        hasBody: true,
      })
    ).toEqual({ allowed: true });
  });

  test("blocks cross-site browser mutations", () => {
    expect(
      evaluateBrowserMutation({
        method: "PATCH",
        requestOrigin,
        originHeader: requestOrigin,
        fetchSite: "cross-site",
        contentType: "application/json",
        hasBody: true,
      })
    ).toMatchObject({
      allowed: false,
      status: 403,
      code: "CROSS_SITE_REQUEST_BLOCKED",
    });
  });

  test("blocks an unlisted Origin header", () => {
    expect(
      evaluateBrowserMutation({
        method: "DELETE",
        requestOrigin,
        originHeader: "https://attacker.example",
        fetchSite: "same-site",
      })
    ).toMatchObject({
      allowed: false,
      status: 403,
      code: "ORIGIN_NOT_ALLOWED",
    });
  });

  test("allows an explicitly configured administration origin", () => {
    expect(
      evaluateBrowserMutation({
        method: "PUT",
        requestOrigin,
        originHeader: "https://admin.example.com",
        fetchSite: "same-site",
        contentType: "application/json",
        hasBody: true,
        allowedOrigins: ["https://admin.example.com"],
      })
    ).toEqual({ allowed: true });
  });

  test("rejects form-style bodies for JSON APIs", () => {
    expect(
      evaluateBrowserMutation({
        method: "POST",
        requestOrigin,
        originHeader: requestOrigin,
        fetchSite: "same-origin",
        contentType: "application/x-www-form-urlencoded",
        hasBody: true,
      })
    ).toMatchObject({
      allowed: false,
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  test("allows non-browser clients without Origin or Fetch Metadata", () => {
    expect(
      evaluateBrowserMutation({
        method: "DELETE",
        requestOrigin,
      })
    ).toEqual({ allowed: true });
  });
});
