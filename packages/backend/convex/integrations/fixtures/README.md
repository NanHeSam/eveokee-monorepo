# Webhook Fixtures

This directory contains sample JSON payloads for different webhook providers and use cases. Use these fixtures for testing, documentation, and debugging.

## Directory Structure

```
fixtures/
├── clerk/
│   ├── user.created.json
│   └── failed-cases/
│       ├── missing-email.json
│       └── invalid-structure.json
├── revenuecat/
│   ├── INITIAL_PURCHASE.json
│   ├── RENEWAL.json
│   └── failed-cases/
│       ├── invalid-user-id.json
│       └── missing-product-id.json
├── suno/
│   ├── complete.json
│   └── failed-cases/
│       ├── missing-task-id.json
│       └── error-callback.json
└── vapi/
    ├── end-of-call-report.json
    └── failed-cases/
        ├── missing-call-id.json
        └── missing-artifact.json
```

## Guidelines

- Add successful webhook payloads to the provider's root directory
- Add failed/edge case payloads to `failed-cases/` subdirectory
- Use descriptive filenames that indicate the scenario
- Sanitize any sensitive data (user IDs, emails, tokens, etc.)
- Document any special context or known issues in the JSON or filename

