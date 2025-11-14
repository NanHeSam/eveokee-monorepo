# Test Fixtures

This directory contains real payload data captured from production Slack interactions, used for testing the blog draft review webhook handlers.

## Files

### `slack-approve-payload.json`
Real Slack interactive payload captured when a user clicks the "Approve & Publish" button in Slack.

**Key fields:**
- `type`: `"block_actions"` - Indicates a button interaction
- `actions[0].action_id`: `"approve_draft"` - The button that was clicked
- `actions[0].value`: `"postId:previewToken"` - Contains the post ID and preview token
- `user`: User information (ID, username, name)
- `response_url`: Slack webhook URL for async updates

**Example button value:**
```text
"m97ednkpx6m0hwgmsgg5bagpds7vcddb:1d6ef830-35af-4f63-8dc8-bb786552247a"
```

### `slack-dismiss-payload.json`
Real Slack interactive payload captured when a user clicks the "Dismiss" button in Slack.

**Key fields:**
- `type`: `"block_actions"` - Indicates a button interaction
- `actions[0].action_id`: `"dismiss_draft"` - The button that was clicked
- `actions[0].value`: `"postId:previewToken"` - Contains the post ID and preview token
- `user`: User information (ID, username, name)
- `response_url`: Slack webhook URL for async updates

**Example button value:**
```text
"m9745mmkrqjhp355ef5v946bss7vcbac:a99401b5-cc97-467b-9b2b-6846bbdaf104"
```

## Usage

These fixtures are used in `blogDraftReview.unit.test.ts` to:

1. **Validate TypeScript types** - Ensure our type definitions match real Slack payloads
2. **Test helper functions** - Test parsing, validation, and response building functions
3. **Regression testing** - Prevent breaking changes to payload handling

## Capturing New Fixtures

If Slack changes their payload format, capture new fixtures by:

1. Add temporary logging to `parseSlackPayload()` in `convex/webhooks/handlers/blogDraftReview.ts`:
   ```typescript
   logger.info("Received Slack interactive payload", { payload });
   ```

2. Trigger a button click in Slack (approve or dismiss)

3. Copy the logged payload from Convex logs

4. Format and save to the appropriate JSON file

5. Remove the temporary logging

## Notes

- Sensitive data like tokens and URLs are from development environment
- User IDs and team IDs are real but from a private workspace
- These payloads represent the actual structure Slack sends (as of November 2024)
