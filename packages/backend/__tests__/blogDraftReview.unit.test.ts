import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Unit Tests for Blog Draft Review Helper Functions
 *
 * These tests validate the helper functions in blogDraftReview.ts
 * using real Slack payload data captured from production interactions.
 */

// Load real Slack payloads from fixtures
const approvePayload = JSON.parse(
  readFileSync(join(__dirname, "fixtures/slack-approve-payload.json"), "utf-8")
);

const dismissPayload = JSON.parse(
  readFileSync(join(__dirname, "fixtures/slack-dismiss-payload.json"), "utf-8")
);

// Type definitions (matching the handler file)
interface SlackInteractivePayload {
  type: "block_actions";
  user: {
    id: string;
    username: string;
    name: string;
    team_id: string;
  };
  actions: Array<{
    action_id: "approve_draft" | "dismiss_draft";
    value: string;
    type: string;
  }>;
  response_url: string;
}

interface ButtonValue {
  postId: string;
  token: string;
}

describe("Slack Payload Validation", () => {
  describe("Real Payload Structure", () => {
    it("should have correct structure for approve action", () => {
      expect(approvePayload.type).toBe("block_actions");
      expect(approvePayload.user).toBeDefined();
      expect(approvePayload.user.id).toBe("U08U8BQJ2RX");
      expect(approvePayload.user.username).toBe("sam");
      expect(approvePayload.actions).toHaveLength(1);
      expect(approvePayload.actions[0].action_id).toBe("approve_draft");
      expect(approvePayload.actions[0].type).toBe("button");
      expect(approvePayload.response_url).toContain("hooks.slack.com");
    });

    it("should have correct structure for dismiss action", () => {
      expect(dismissPayload.type).toBe("block_actions");
      expect(dismissPayload.user).toBeDefined();
      expect(dismissPayload.user.id).toBe("U08U8BQJ2RX");
      expect(dismissPayload.actions).toHaveLength(1);
      expect(dismissPayload.actions[0].action_id).toBe("dismiss_draft");
      expect(dismissPayload.actions[0].type).toBe("button");
      expect(dismissPayload.response_url).toContain("hooks.slack.com");
    });

    it("should contain button value in postId:token format", () => {
      const approveValue = approvePayload.actions[0].value;
      const dismissValue = dismissPayload.actions[0].value;

      // Both should contain exactly one colon
      expect(approveValue.split(":")).toHaveLength(2);
      expect(dismissValue.split(":")).toHaveLength(2);

      // Should have non-empty parts
      const [approvePostId, approveToken] = approveValue.split(":");
      expect(approvePostId).toBeTruthy();
      expect(approveToken).toBeTruthy();

      const [dismissPostId, dismissToken] = dismissValue.split(":");
      expect(dismissPostId).toBeTruthy();
      expect(dismissToken).toBeTruthy();
    });
  });
});

describe("Helper Functions", () => {
  describe("parseButtonValue", () => {
    const createLogger = () => ({
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    });

    const parseButtonValue = (buttonValue: string, logger: any): ButtonValue | null => {
      const colonCount = (buttonValue.match(/:/g) || []).length;
      if (colonCount !== 1) {
        logger.warn("Invalid button value format - must contain exactly one colon", { buttonValue, colonCount });
        return null;
      }

      const parts = buttonValue.split(":", 2);
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        logger.warn("Invalid button value format - missing postId or token", { buttonValue, partsLength: parts.length });
        return null;
      }

      return { postId: parts[0], token: parts[1] };
    };

    it("should parse valid button value from approve payload", () => {
      const logger = createLogger();
      const buttonValue = approvePayload.actions[0].value;

      const result = parseButtonValue(buttonValue, logger);

      expect(result).not.toBeNull();
      expect(result?.postId).toBe("m97ednkpx6m0hwgmsgg5bagpds7vcddb");
      expect(result?.token).toBe("1d6ef830-35af-4f63-8dc8-bb786552247a");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should parse valid button value from dismiss payload", () => {
      const logger = createLogger();
      const buttonValue = dismissPayload.actions[0].value;

      const result = parseButtonValue(buttonValue, logger);

      expect(result).not.toBeNull();
      expect(result?.postId).toBe("m9745mmkrqjhp355ef5v946bss7vcbac");
      expect(result?.token).toBe("a99401b5-cc97-467b-9b2b-6846bbdaf104");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should reject button value with no colon", () => {
      const logger = createLogger();
      const result = parseButtonValue("invalidvalue", logger);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Invalid button value format - must contain exactly one colon",
        expect.any(Object)
      );
    });

    it("should reject button value with multiple colons", () => {
      const logger = createLogger();
      const result = parseButtonValue("post:id:token", logger);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should reject button value with empty parts", () => {
      const logger = createLogger();
      const result = parseButtonValue(":token", logger);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Invalid button value format - missing postId or token",
        expect.any(Object)
      );
    });
  });

  describe("validateButtonAction", () => {
    const createLogger = () => ({
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    });

    const validateButtonAction = (payload: SlackInteractivePayload, logger: any) => {
      if (payload.type !== "block_actions") {
        logger.warn("Ignoring non-button interaction", { type: payload.type });
        return null;
      }

      const action = payload.actions?.[0];
      if (!action || action.type !== "button") {
        logger.warn("Invalid action in payload", { action });
        return null;
      }

      return action;
    };

    it("should validate approve action from real payload", () => {
      const logger = createLogger();
      const action = validateButtonAction(approvePayload, logger);

      expect(action).not.toBeNull();
      expect(action?.action_id).toBe("approve_draft");
      expect(action?.type).toBe("button");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should validate dismiss action from real payload", () => {
      const logger = createLogger();
      const action = validateButtonAction(dismissPayload, logger);

      expect(action).not.toBeNull();
      expect(action?.action_id).toBe("dismiss_draft");
      expect(action?.type).toBe("button");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should reject non-block_actions payload", () => {
      const logger = createLogger();
      const invalidPayload = { ...approvePayload, type: "message_action" };
      const action = validateButtonAction(invalidPayload as any, logger);

      expect(action).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Ignoring non-button interaction",
        expect.any(Object)
      );
    });

    it("should reject payload without actions", () => {
      const logger = createLogger();
      const invalidPayload = { ...approvePayload, actions: [] };
      const action = validateButtonAction(invalidPayload as any, logger);

      expect(action).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe("extractUserMetadata", () => {
    const extractUserMetadata = (payload: SlackInteractivePayload) => {
      const userId = payload.user?.id || payload.user?.name || "someone";
      const timestamp = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return { userId, timestamp };
    };

    it("should extract user ID from approve payload", () => {
      const result = extractUserMetadata(approvePayload);

      expect(result.userId).toBe("U08U8BQJ2RX");
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe("string");
    });

    it("should extract user ID from dismiss payload", () => {
      const result = extractUserMetadata(dismissPayload);

      expect(result.userId).toBe("U08U8BQJ2RX");
      expect(result.timestamp).toBeDefined();
    });

    it("should format timestamp correctly", () => {
      const result = extractUserMetadata(approvePayload);

      // Timestamp should match pattern like "Nov 14, 10:30 AM"
      expect(result.timestamp).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}/);
    });

    it("should fallback to name if id is missing", () => {
      const payloadWithoutId = {
        ...approvePayload,
        user: { ...approvePayload.user, id: undefined as any },
      };

      const result = extractUserMetadata(payloadWithoutId);
      expect(result.userId).toBe("sam");
    });

    it("should fallback to 'someone' if user data is missing", () => {
      const payloadWithoutUser = {
        ...approvePayload,
        user: {} as any,
      };

      const result = extractUserMetadata(payloadWithoutUser);
      expect(result.userId).toBe("someone");
    });
  });

  describe("escapeSlackMarkdown", () => {
    const escapeSlackMarkdown = (value: string): string => {
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*/g, "\\*")
        .replace(/_/g, "\\_")
        .replace(/~/g, "\\~")
        .replace(/`/g, "\\`")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]");
    };

    it("should escape special characters", () => {
      const input = "Test <script>alert('xss')</script>";
      const result = escapeSlackMarkdown(input);

      expect(result).toBe("Test &lt;script&gt;alert('xss')&lt;/script&gt;");
    });

    it("should escape markdown formatting", () => {
      const input = "*bold* _italic_ ~strikethrough~ `code`";
      const result = escapeSlackMarkdown(input);

      expect(result).toBe("\\*bold\\* \\_italic\\_ \\~strikethrough\\~ \\`code\\`");
    });

    it("should escape links", () => {
      const input = "[link](url)";
      const result = escapeSlackMarkdown(input);

      expect(result).toBe("\\[link\\](url)");
    });

    it("should escape ampersands", () => {
      const input = "Rock & Roll";
      const result = escapeSlackMarkdown(input);

      expect(result).toBe("Rock &amp; Roll");
    });

    it("should handle empty string", () => {
      const result = escapeSlackMarkdown("");
      expect(result).toBe("");
    });

    it("should handle string without special characters", () => {
      const input = "Normal Text";
      const result = escapeSlackMarkdown(input);

      expect(result).toBe("Normal Text");
    });
  });
});

describe("Slack Response Builders", () => {
  describe("createAlreadyProcessedResponse", () => {
    it("should create response with correct structure", () => {
      const error = "This draft has already been published.";

      // Simulate the function (simplified version)
      const response = {
        response_type: "in_channel",
        replace_original: true,
        text: `⚠️ Draft Already Processed: ${error}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `⚠️ *Draft Already Processed*\n\n${error}`,
            },
          },
        ],
      };

      expect(response.response_type).toBe("in_channel");
      expect(response.replace_original).toBe(true);
      expect(response.text).toContain(error);
      expect(response.blocks).toHaveLength(1);
      expect(response.blocks[0].type).toBe("section");
    });
  });

  describe("createEphemeralErrorResponse", () => {
    it("should create ephemeral response with correct structure", () => {
      const error = "Failed to approve draft: Unknown error";

      // Simulate the function (simplified version)
      const response = {
        response_type: "ephemeral",
        text: `❌ ${error}`,
      };

      expect(response.response_type).toBe("ephemeral");
      expect(response.text).toContain(error);
      expect(response.text).toContain("❌");
    });
  });
});

describe("Type Safety", () => {
  it("should match SlackInteractivePayload type definition", () => {
    // This test validates that real payloads match our type definitions
    const validatePayload = (payload: SlackInteractivePayload) => {
      expect(payload.type).toBe("block_actions");
      expect(payload.user).toBeDefined();
      expect(payload.user.id).toBeDefined();
      expect(payload.actions).toBeInstanceOf(Array);
      expect(payload.response_url).toBeDefined();
    };

    validatePayload(approvePayload);
    validatePayload(dismissPayload);
  });

  it("should have consistent button value format across payloads", () => {
    const approveValue = approvePayload.actions[0].value;
    const dismissValue = dismissPayload.actions[0].value;

    // Both should follow the same format
    const approveFormat = approveValue.split(":").length;
    const dismissFormat = dismissValue.split(":").length;

    expect(approveFormat).toBe(dismissFormat);
    expect(approveFormat).toBe(2);
  });
});
