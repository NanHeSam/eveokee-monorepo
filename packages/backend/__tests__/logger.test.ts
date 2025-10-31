import { describe, expect, it } from "vitest";
import { sanitizeForConvex } from "../convex/utils/logger";

describe("sanitizeForConvex", () => {
  it("should rename fields starting with $ to x_$", () => {
    const input = {
      normalField: "value",
      $attConsentStatus: "authorized",
      $anotherReservedField: 123,
    };

    const result = sanitizeForConvex(input);

    expect(result).toEqual({
      normalField: "value",
      "x_$attConsentStatus": "authorized",
      "x_$anotherReservedField": 123,
    });
  });

  it("should rename fields starting with _ to x__", () => {
    const input = {
      normalField: "value",
      _internalField: "internal",
      _id: "some-id",
    };

    const result = sanitizeForConvex(input);

    expect(result).toEqual({
      normalField: "value",
      "x__internalField": "internal",
      "x__id": "some-id",
    });
  });

  it("should handle nested objects recursively", () => {
    const input = {
      level1: {
        $reservedField: "value",
        level2: {
          _privateField: "nested",
          normalField: "ok",
        },
      },
    };

    const result = sanitizeForConvex(input);

    expect(result).toEqual({
      level1: {
        "x_$reservedField": "value",
        level2: {
          "x__privateField": "nested",
          normalField: "ok",
        },
      },
    });
  });

  it("should handle arrays with objects containing reserved fields", () => {
    const input = {
      items: [
        { $field: "value1", normal: "a" },
        { _field: "value2", normal: "b" },
      ],
    };

    const result = sanitizeForConvex(input);

    expect(result).toEqual({
      items: [
        { "x_$field": "value1", normal: "a" },
        { "x__field": "value2", normal: "b" },
      ],
    });
  });

  it("should handle the actual RevenueCat webhook payload structure", () => {
    // This is a simplified version of the actual payload that caused the error
    const revenueCatPayload = {
      event: {
        type: "INITIAL_PURCHASE",
        app_user_id: "user123",
        product_id: "eveokee_premium_monthly",
        subscriber_attributes: {
          $attConsentStatus: "authorized",
          $email: {
            value: "user@example.com",
            updated_at_ms: 1234567890,
          },
          $displayName: {
            value: "Test User",
            updated_at_ms: 1234567890,
          },
        },
        entitlements: {
          premium: {
            expires_date: "2024-11-28T12:00:00Z",
            product_identifier: "eveokee_premium_monthly",
          },
        },
      },
    };

    const result = sanitizeForConvex(revenueCatPayload);

    // Check that reserved fields are renamed
    expect(result).toHaveProperty("event.subscriber_attributes.x_$attConsentStatus");
    expect(result).toHaveProperty("event.subscriber_attributes.x_$email");
    expect(result).toHaveProperty("event.subscriber_attributes.x_$displayName");

    // Check that normal fields are preserved
    expect(result).toHaveProperty("event.type", "INITIAL_PURCHASE");
    expect(result).toHaveProperty("event.app_user_id", "user123");
    expect(result).toHaveProperty("event.product_id", "eveokee_premium_monthly");

    // Check that nested values are preserved
    const sanitized = result as any;
    expect(sanitized.event.subscriber_attributes["x_$email"].value).toBe("user@example.com");
    expect(sanitized.event.subscriber_attributes["x_$displayName"].value).toBe("Test User");
  });

  it("should handle null and undefined values", () => {
    const input = {
      nullField: null,
      undefinedField: undefined,
      $reservedNull: null,
      _reservedUndefined: undefined,
    };

    const result = sanitizeForConvex(input);

    expect(result).toEqual({
      nullField: null,
      undefinedField: undefined,
      "x_$reservedNull": null,
      "x__reservedUndefined": undefined,
    });
  });

  it("should handle primitive values without modification", () => {
    expect(sanitizeForConvex("string")).toBe("string");
    expect(sanitizeForConvex(123)).toBe(123);
    expect(sanitizeForConvex(true)).toBe(true);
    expect(sanitizeForConvex(null)).toBe(null);
    expect(sanitizeForConvex(undefined)).toBe(undefined);
  });

  it("should handle arrays of primitives", () => {
    const input = ["a", "b", "c"];
    const result = sanitizeForConvex(input);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("should handle deeply nested structures with reserved fields", () => {
    const input = {
      level1: {
        $reserved1: {
          level2: {
            _reserved2: {
              level3: {
                $reserved3: "deep value",
                normal: "ok",
              },
            },
          },
        },
      },
    };

    const result = sanitizeForConvex(input);

    expect(result).toEqual({
      level1: {
        "x_$reserved1": {
          level2: {
            "x__reserved2": {
              level3: {
                "x_$reserved3": "deep value",
                normal: "ok",
              },
            },
          },
        },
      },
    });
  });

  it("should not modify the original object", () => {
    const input = {
      $field: "value",
      nested: {
        _field: "nested value",
      },
    };

    const original = JSON.stringify(input);
    sanitizeForConvex(input);
    const afterSanitize = JSON.stringify(input);

    expect(original).toBe(afterSanitize);
  });
});
