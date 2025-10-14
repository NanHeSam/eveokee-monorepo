import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const TestComponent = ({ message }: { message: string }) => (
  <button type="button">{message}</button>
);

describe("test environment", () => {
  it("renders components with testing library", () => {
    render(<TestComponent message="hello world" />);

    expect(screen.getByRole("button", { name: /hello world/i })).toBeVisible();
  });
});
