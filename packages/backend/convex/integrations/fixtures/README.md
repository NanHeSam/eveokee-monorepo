# Webhook Fixtures

This directory contains sample JSON payloads for different webhook providers and use cases. Use these fixtures for testing, documentation, and debugging.

## Directory Structure

```
fixtures/
├── clerk/
│   ├── sample-user-create.json
│   └── failed-cases/
├── revenuecat/
│   ├── sub-initial-purchase.json
│   ├── sub-renew.json
│   └── failed-cases/
├── suno/
│   ├── complete-event.json
│   ├── first-event.json
│   ├── text-event.json
│   └── failed-cases/
└── vapi/
    ├── end-of-call-report.json
    └── failed-cases/
```

## Guidelines

- Add successful webhook payloads to the provider's root directory
- Add failed/edge case payloads to `failed-cases/` subdirectory
- Use descriptive filenames that indicate the scenario
- Sanitize any sensitive data (user IDs, emails, tokens, etc.)
- Document any special context or known issues in the JSON or filename

