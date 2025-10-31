/**
 * Clerk webhook payload types
 * Used for user creation events
 */

/**
 * Clerk email address structure
 */
export interface ClerkEmailAddress {
  id: string;
  email_address: string;
  created_at?: number;
  updated_at?: number;
  verification?: {
    status?: string;
    strategy?: string;
  };
}

/**
 * Clerk user data structure
 * Based on fixtures: only fields we actually use
 */
export interface ClerkUserData {
  id: string;
  primary_email_address_id?: string;
  email_addresses: ClerkEmailAddress[];
  first_name?: string;
  last_name?: string;
  username?: string;
  created_at?: number;
  updated_at?: number;
}

/**
 * Clerk webhook event structure
 */
export interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserData;
  object?: string;
  timestamp?: number;
  instance_id?: string;
  event_attributes?: Record<string, unknown>;
}

/**
 * Type guard to validate Clerk webhook event structure
 */
export function isValidClerkEvent(event: unknown): event is ClerkWebhookEvent {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return false;
  }
  
  const e = event as Record<string, unknown>;
  
  // Validate type
  if (typeof e.type !== "string") {
    return false;
  }
  
  // Validate data
  if (!e.data || typeof e.data !== "object" || Array.isArray(e.data)) {
    return false;
  }
  
  const data = e.data as Record<string, unknown>;
  
  // Validate required fields
  if (typeof data.id !== "string") {
    return false;
  }
  
  // Validate email_addresses array
  if (data.email_addresses !== undefined) {
    if (!Array.isArray(data.email_addresses)) {
      return false;
    }
    // Validate each email address has required fields
    for (const email of data.email_addresses) {
      if (typeof email !== "object" || email === null || Array.isArray(email)) {
        return false;
      }
      const emailObj = email as Record<string, unknown>;
      if (typeof emailObj.id !== "string" || typeof emailObj.email_address !== "string") {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Parse and validate Clerk webhook payload
 * @returns Validated payload or error message
 */
export function parseClerkPayload(
  event: unknown
): { success: true; data: ClerkWebhookEvent } | { success: false; error: string } {
  if (!isValidClerkEvent(event)) {
    return { success: false, error: "Invalid event structure" };
  }

  // Validate required fields
  if (!event.data.id) {
    return { success: false, error: "Missing user id" };
  }

  return { success: true, data: event };
}

/**
 * Sample Clerk user.created event for testing
 */
export const sampleClerkUserCreatedEvent: ClerkWebhookEvent = {
  type: "user.created",
  data: {
    id: "user_test123",
    primary_email_address_id: "email_test123",
    email_addresses: [
      {
        id: "email_test123",
        email_address: "test@example.com",
      },
    ],
    first_name: "Test",
    last_name: "User",
    username: "testuser",
  },
};

