/**
 * Clerk webhook payload types
 * Used for user creation events
 */

export interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    primary_email_address_id?: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
    }>;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
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

