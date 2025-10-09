# Clerk Webhook Setup

This document explains how to set up the Clerk webhook to automatically create users in your Convex database when they register.

## Webhook Endpoint

The webhook endpoint is available at:
```
POST /webhooks/clerk
```

## Environment Variables

You need to set the following environment variable in your Convex deployment:

```bash
CLERK_WEBHOOK_SIGNING_SECRET=your_clerk_webhook_signing_secret_here
```

## Setting up the Webhook in Clerk Dashboard

1. Go to your Clerk Dashboard
2. Navigate to "Webhooks" in the sidebar
3. Click "Add Endpoint"
4. Set the endpoint URL to: `https://your-convex-deployment-url.convex.site/webhooks/clerk`
5. Select the "user.created" event
6. Copy the webhook signing secret and add it to your Convex environment variables as `CLERK_WEBHOOK_SIGNING_SECRET`

## Webhook Security

The webhook uses the official Clerk SDK's `verifyWebhook` function from `@clerk/backend/webhooks` to verify webhook signatures. This provides robust security by validating the webhook payload against the signing secret provided by Clerk using proper HMAC verification as recommended in the [Clerk documentation](https://clerk.com/docs/reference/backend/verify-webhook).

## Webhook Payload

The webhook expects Clerk's standard user.created event payload:

```json
{
  "data": {
    "backup_code_enabled": false,
    "banned": false,
    "create_organization_enabled": true,
    "create_organizations_limit": null,
    "created_at": 1716883200000,
    "delete_self_enabled": true,
    "email_addresses": [
      {
        "email_address": "user@example.com",
        "id": "idn_2g7np7Hrk0SN6kj5EDMLDaKNL0S"
      }
    ],
    "enterprise_accounts": [],
    "external_accounts": [],
    "external_id": null,
    "first_name": "John",
    "has_image": true,
    "id": "user_2g7np7Hrk0SN6kj5EDMLDaKNL0S",
    "image_url": "https://img.clerk.com/xxxxxx",
    "last_active_at": 1716883200000,
    "last_name": "Doe",
    "last_sign_in_at": 1716883200000,
    "legal_accepted_at": 1716883200000,
    "locked": false,
    "lockout_expires_in_seconds": null,
    "mfa_disabled_at": null,
    "mfa_enabled_at": null,
    "object": "user",
    "passkeys": [],
    "password_enabled": true,
    "phone_numbers": [],
    "primary_email_address_id": "idn_2g7np7Hrk0SN6kj5EDMLDaKNL0S",
    "primary_phone_number_id": null,
    "primary_web3_wallet_id": null,
    "private_metadata": null,
    "profile_image_url": "https://img.clerk.com/xxxxxx",
    "public_metadata": {},
    "saml_accounts": [],
    "totp_enabled": false,
    "two_factor_enabled": false,
    "unsafe_metadata": {},
    "updated_at": 1716883200000,
    "username": null,
    "verification_attempts_remaining": null,
    "web3_wallets": []
  },
  "event_attributes": {
    "http_request": {
      "client_ip": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    }
  },
  "instance_id": "ins_2g7np7Hrk0SN6kj5EDMLDaKNL0S",
  "object": "event",
  "timestamp": 1716883200,
  "type": "user.created"
}
```

## User Creation

When a user is created via the webhook, the following data is stored in your Convex database:

- `clerkId`: The Clerk user ID
- `email`: Primary email address (if available)
- `name`: Full name (first + last) or username as fallback
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

## Testing

You can test the webhook using curl:

```bash
curl -X POST https://your-convex-deployment-url.convex.site/webhooks/clerk \
  -H "Content-Type: application/json" \
  -H "svix-signature: v1,base64_signature" \
  -H "svix-timestamp: 1234567890" \
  -d '{
    "data": {
      "id": "user_test123",
      "email_addresses": [{"email_address": "test@example.com", "id": "email_test123"}],
      "first_name": "Test",
      "last_name": "User",
      "username": "testuser",
      "primary_email_address_id": "email_test123",
      "created_at": 1234567890,
      "updated_at": 1234567890,
      "image_url": null,
      "profile_image_url": null
    },
    "event_attributes": {
      "http_request": {
        "client_ip": "127.0.0.1",
        "user_agent": "test-agent"
      }
    },
    "instance_id": "ins_test123",
    "object": "event",
    "timestamp": 1234567890,
    "type": "user.created"
  }'
```

## Error Handling

The webhook returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid JSON, missing headers)
- `401`: Unauthorized (invalid signature)
- `405`: Method Not Allowed (non-POST request)
- `500`: Internal Server Error (database error)

## Monitoring

Check your Convex logs to monitor webhook activity and any errors that occur during user creation.
