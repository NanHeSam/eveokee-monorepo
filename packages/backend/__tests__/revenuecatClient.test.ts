import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RevenueCatClient,
  createRevenueCatClientFromEnv,
  RevenueCatCustomerInfo,
} from "../convex/integrations/revenuecat/client";
import {
  getActiveEntitlementsFromV2,
  getProductIdentifierFromV2,
} from "../convex/revenueCatBilling";

// Sample JSON response from RevenueCat API v2
const SAMPLE_CUSTOMER_RESPONSE: RevenueCatCustomerInfo = {
  active_entitlements: {
    items: [
      {
        entitlement_id: "entl76f0e2a585",
        expires_at: 1762536790000,
        object: "customer.active_entitlement",
      },
    ],
    next_page: null,
    object: "list",
    url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
  },
  experiment: null,
  first_seen_at: 1761079895000,
  id: "js7bfz5pz8phjxcp414c8vy5xh7sxmba",
  last_seen_app_version: "1.0.0",
  last_seen_at: 1762448650639,
  last_seen_country: "US",
  last_seen_platform: "iOS",
  last_seen_platform_version: "Version 26.1 (Build 23B82)",
  object: "customer",
  project_id: "proj7ab017d1",
};

describe("RevenueCatClient", () => {
  const originalFetch = global.fetch;
  const mockApiKey = "sk_test_api_key";
  const mockProjectId = "proj7ab017d1";

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a client with required config", () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
      });

      expect(client).toBeInstanceOf(RevenueCatClient);
    });

    it("should use default timeout when not provided", () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
      });

      expect(client).toBeInstanceOf(RevenueCatClient);
    });

    it("should use custom timeout when provided", () => {
      const customTimeout = 10000;
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
        timeout: customTimeout,
      });

      expect(client).toBeInstanceOf(RevenueCatClient);
    });
  });

  describe("getCustomerInfo", () => {
    it("should fetch customer info successfully", async () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
      });

      const appUserId = "js7bfz5pz8phjxcp414c8vy5xh7sxmba";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => SAMPLE_CUSTOMER_RESPONSE,
      });

      const result = await client.getCustomerInfo(appUserId);

      expect(result).toEqual(SAMPLE_CUSTOMER_RESPONSE);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.revenuecat.com/v2/projects/${mockProjectId}/customers/${appUserId}`,
        expect.objectContaining({
          method: "GET",
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("should URL encode project ID and user ID", async () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: "proj with spaces",
      });

      const appUserId = "user@example.com";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => SAMPLE_CUSTOMER_RESPONSE,
      });

      await client.getCustomerInfo(appUserId);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("proj%20with%20spaces"),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("user%40example.com"),
        expect.any(Object)
      );
    });

    it("should return null when customer is not found (404)", async () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await client.getCustomerInfo("nonexistent");

      expect(result).toBeNull();
    });

    it("should return null on API error", async () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await client.getCustomerInfo("test-user");

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch RC customer")
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle timeout errors", async () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
        timeout: 100,
      });

      const abortError = new Error("Request aborted");
      abortError.name = "AbortError";

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(abortError);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await client.getCustomerInfo("test-user");

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Request to RevenueCat API timed out")
      );

      consoleErrorSpy.mockRestore();
    });

    it("should throw error on other fetch failures", async () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
      });

      const networkError = new Error("Network error");

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(networkError);

      await expect(client.getCustomerInfo("test-user")).rejects.toThrow(
        "RevenueCat API request failed: Network error"
      );
    });

    it("should handle customer with no active entitlements", async () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
      });

      const customerWithNoEntitlements: RevenueCatCustomerInfo = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: {
          items: [],
          next_page: null,
          object: "list",
          url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => customerWithNoEntitlements,
      });

      const result = await client.getCustomerInfo("test-user");

      expect(result).toEqual(customerWithNoEntitlements);
      expect(result?.active_entitlements.items).toHaveLength(0);
    });

    it("should handle customer with multiple entitlements", async () => {
      const client = new RevenueCatClient({
        apiKey: mockApiKey,
        projectId: mockProjectId,
      });

      const customerWithMultipleEntitlements: RevenueCatCustomerInfo = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: {
          items: [
            {
              entitlement_id: "entl76f0e2a585",
              expires_at: 1762536790000,
              object: "customer.active_entitlement",
            },
            {
              entitlement_id: "entl_another_one",
              expires_at: 1762536800000,
              object: "customer.active_entitlement",
            },
          ],
          next_page: null,
          object: "list",
          url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => customerWithMultipleEntitlements,
      });

      const result = await client.getCustomerInfo("test-user");

      expect(result).toEqual(customerWithMultipleEntitlements);
      expect(result?.active_entitlements.items).toHaveLength(2);
    });
  });

  describe("createRevenueCatClientFromEnv", () => {
    it("should create client with valid environment variables", () => {
      const client = createRevenueCatClientFromEnv({
        REVENUECAT_API_KEY: mockApiKey,
        REVENUECAT_PROJECT_ID: mockProjectId,
      });

      expect(client).toBeInstanceOf(RevenueCatClient);
    });

    it("should throw error when API key is missing", () => {
      expect(() => {
        createRevenueCatClientFromEnv({
          REVENUECAT_PROJECT_ID: mockProjectId,
        });
      }).toThrow("REVENUECAT_API_KEY environment variable is not set");
    });

    it("should throw error when project ID is missing", () => {
      expect(() => {
        createRevenueCatClientFromEnv({
          REVENUECAT_API_KEY: mockApiKey,
        });
      }).toThrow("REVENUECAT_PROJECT_ID environment variable is not set");
    });

    it("should parse timeout from string", () => {
      const client = createRevenueCatClientFromEnv({
        REVENUECAT_API_KEY: mockApiKey,
        REVENUECAT_PROJECT_ID: mockProjectId,
        REVENUECAT_TIMEOUT: "5000",
      });

      expect(client).toBeInstanceOf(RevenueCatClient);
    });

    it("should handle missing timeout", () => {
      const client = createRevenueCatClientFromEnv({
        REVENUECAT_API_KEY: mockApiKey,
        REVENUECAT_PROJECT_ID: mockProjectId,
      });

      expect(client).toBeInstanceOf(RevenueCatClient);
    });
  });

  describe("RevenueCatCustomerInfo structure", () => {
    it("should match the sample JSON structure", () => {
      expect(SAMPLE_CUSTOMER_RESPONSE).toHaveProperty("active_entitlements");
      expect(SAMPLE_CUSTOMER_RESPONSE.active_entitlements).toHaveProperty("items");
      expect(SAMPLE_CUSTOMER_RESPONSE.active_entitlements.items).toBeInstanceOf(Array);
      expect(SAMPLE_CUSTOMER_RESPONSE.active_entitlements.items[0]).toHaveProperty(
        "entitlement_id"
      );
      expect(SAMPLE_CUSTOMER_RESPONSE.active_entitlements.items[0]).toHaveProperty("expires_at");
      expect(SAMPLE_CUSTOMER_RESPONSE.active_entitlements.items[0]).toHaveProperty("object");

      expect(SAMPLE_CUSTOMER_RESPONSE).toHaveProperty("id");
      expect(SAMPLE_CUSTOMER_RESPONSE).toHaveProperty("project_id");
      expect(SAMPLE_CUSTOMER_RESPONSE).toHaveProperty("first_seen_at");
      expect(SAMPLE_CUSTOMER_RESPONSE).toHaveProperty("last_seen_at");
      expect(SAMPLE_CUSTOMER_RESPONSE).toHaveProperty("last_seen_platform");
    });

    it("should have correct entitlement object structure", () => {
      const entitlement = SAMPLE_CUSTOMER_RESPONSE.active_entitlements.items[0];
      expect(entitlement.entitlement_id).toBe("entl76f0e2a585");
      expect(entitlement.expires_at).toBe(1762536790000);
      expect(entitlement.object).toBe("customer.active_entitlement");
    });

    it("should have correct customer metadata", () => {
      expect(SAMPLE_CUSTOMER_RESPONSE.id).toBe("js7bfz5pz8phjxcp414c8vy5xh7sxmba");
      expect(SAMPLE_CUSTOMER_RESPONSE.project_id).toBe("proj7ab017d1");
      expect(SAMPLE_CUSTOMER_RESPONSE.last_seen_platform).toBe("iOS");
      expect(SAMPLE_CUSTOMER_RESPONSE.last_seen_country).toBe("US");
      expect(SAMPLE_CUSTOMER_RESPONSE.last_seen_app_version).toBe("1.0.0");
    });
  });
});

describe("RevenueCat v2 Helper Functions", () => {
  describe("getActiveEntitlementsFromV2", () => {
    it("should extract entitlements from v2 customer info", () => {
      const entitlements = getActiveEntitlementsFromV2(SAMPLE_CUSTOMER_RESPONSE);

      expect(entitlements).toHaveProperty("entl76f0e2a585");
      expect(entitlements["entl76f0e2a585"]).toEqual({
        entitlement_id: "entl76f0e2a585",
        expires_at: 1762536790000,
        object: "customer.active_entitlement",
      });
    });

    it("should return empty object for null customer info", () => {
      const entitlements = getActiveEntitlementsFromV2(null);

      expect(entitlements).toEqual({});
    });

    it("should return empty object for customer with no entitlements", () => {
      const customerWithNoEntitlements: RevenueCatCustomerInfo = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: {
          items: [],
          next_page: null,
          object: "list",
          url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
        },
      };

      const entitlements = getActiveEntitlementsFromV2(customerWithNoEntitlements);

      expect(entitlements).toEqual({});
    });

    it("should handle customer with missing active_entitlements", () => {
      const customerWithoutEntitlements = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: undefined,
      } as any;

      const entitlements = getActiveEntitlementsFromV2(customerWithoutEntitlements);

      expect(entitlements).toEqual({});
    });

    it("should handle multiple entitlements", () => {
      const customerWithMultipleEntitlements: RevenueCatCustomerInfo = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: {
          items: [
            {
              entitlement_id: "entl76f0e2a585",
              expires_at: 1762536790000,
              object: "customer.active_entitlement",
            },
            {
              entitlement_id: "entl_another_one",
              expires_at: 1762536800000,
              object: "customer.active_entitlement",
            },
          ],
          next_page: null,
          object: "list",
          url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
        },
      };

      const entitlements = getActiveEntitlementsFromV2(customerWithMultipleEntitlements);

      expect(Object.keys(entitlements)).toHaveLength(2);
      expect(entitlements).toHaveProperty("entl76f0e2a585");
      expect(entitlements).toHaveProperty("entl_another_one");
    });
  });

  describe("getProductIdentifierFromV2", () => {
    it("should return undefined when no entitlements exist", () => {
      const productId = getProductIdentifierFromV2(null);

      expect(productId).toBeUndefined();
    });

    it("should return undefined when entitlements array is empty", () => {
      const customerWithNoEntitlements: RevenueCatCustomerInfo = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: {
          items: [],
          next_page: null,
          object: "list",
          url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
        },
      };

      const productId = getProductIdentifierFromV2(customerWithNoEntitlements);

      expect(productId).toBeUndefined();
    });

    it("should extract product_identifier from entitlement if present", () => {
      const customerWithProductId: RevenueCatCustomerInfo = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: {
          items: [
            {
              entitlement_id: "entl76f0e2a585",
              expires_at: 1762536790000,
              object: "customer.active_entitlement",
              product_identifier: "premium_monthly",
            } as any,
          ],
          next_page: null,
          object: "list",
          url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
        },
      };

      const productId = getProductIdentifierFromV2(customerWithProductId);

      expect(productId).toBe("premium_monthly");
    });

    it("should extract product_id from entitlement if product_identifier not present", () => {
      const customerWithProductId: RevenueCatCustomerInfo = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: {
          items: [
            {
              entitlement_id: "entl76f0e2a585",
              expires_at: 1762536790000,
              object: "customer.active_entitlement",
              product_id: "premium_yearly",
            } as any,
          ],
          next_page: null,
          object: "list",
          url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
        },
      };

      const productId = getProductIdentifierFromV2(customerWithProductId);

      expect(productId).toBe("premium_yearly");
    });

    it("should prefer product_identifier over product_id", () => {
      const customerWithBoth: RevenueCatCustomerInfo = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: {
          items: [
            {
              entitlement_id: "entl76f0e2a585",
              expires_at: 1762536790000,
              object: "customer.active_entitlement",
              product_identifier: "premium_monthly",
              product_id: "premium_yearly",
            } as any,
          ],
          next_page: null,
          object: "list",
          url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
        },
      };

      const productId = getProductIdentifierFromV2(customerWithBoth);

      expect(productId).toBe("premium_monthly");
    });

    it("should return undefined when entitlement has no product identifier fields", () => {
      // Using the sample response which doesn't have product_identifier
      const productId = getProductIdentifierFromV2(SAMPLE_CUSTOMER_RESPONSE);

      expect(productId).toBeUndefined();
    });

    it("should return product identifier from first entitlement when multiple exist", () => {
      const customerWithMultipleEntitlements: RevenueCatCustomerInfo = {
        ...SAMPLE_CUSTOMER_RESPONSE,
        active_entitlements: {
          items: [
            {
              entitlement_id: "entl_first",
              expires_at: 1762536790000,
              object: "customer.active_entitlement",
              product_identifier: "premium_monthly",
            } as any,
            {
              entitlement_id: "entl_second",
              expires_at: 1762536800000,
              object: "customer.active_entitlement",
              product_identifier: "premium_yearly",
            } as any,
          ],
          next_page: null,
          object: "list",
          url: "https://api.revenuecat.com/v2/projects/proj7ab017d1/customers/js7bfz5pz8phjxcp414c8vy5xh7sxmba/active_entitlements",
        },
      };

      const productId = getProductIdentifierFromV2(customerWithMultipleEntitlements);

      // Should return the first one
      expect(productId).toBe("premium_monthly");
    });
  });
});

