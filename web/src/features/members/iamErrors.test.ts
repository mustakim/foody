import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/blocks/client", () => ({ blocksClient: {} }));
vi.mock("../profile/useCurrentUser", () => ({ userRoles: () => [] }));

const { iamErrorText } = await import("./membersApi");

describe("iamErrorText", () => {
  it("reads ASP.NET validation errors", () => {
    expect(iamErrorText({ errors: { UserId: ["The UserId field is required."] }, status: 400, title: "One or more validation errors occurred." }))
      .toBe("UserId: The UserId field is required. · One or more validation errors occurred.");
  });

  it("reads Blocks base responses and plain text", () => {
    expect(iamErrorText({ errors: { email: "Not found" }, isSuccess: false })).toBe("email: Not found");
    expect(iamErrorText("Not Found")).toBe("Not Found");
    expect(iamErrorText(undefined)).toBe("");
  });
});
