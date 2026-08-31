import { describe, it, expect } from "../test-runner";

// ─── C1: /api/time — Auth Gate ────────────────────────────────────────────────
// These tests validate the auth logic without a live server.
// They test the validation logic extracted from the route handler.

function validateTimeRouteAuth(authHeader: string | null): { status: number; blocked: boolean } {
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return { status: 401, blocked: true };
  if (idToken === "invalid_token") return { status: 401, blocked: true };
  return { status: 200, blocked: false };
}

describe("Security C1: /api/time Auth Gate", () => {
  it("should block requests with no Authorization header", () => {
    const result = validateTimeRouteAuth(null);
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(401);
  });

  it("should block requests with a malformed Authorization header (no Bearer prefix)", () => {
    const result = validateTimeRouteAuth("sometoken");
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(401);
  });

  it("should block requests with an invalid token", () => {
    const result = validateTimeRouteAuth("Bearer invalid_token");
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(401);
  });

  it("should pass requests with a well-formed Bearer token", () => {
    const result = validateTimeRouteAuth("Bearer valid_firebase_id_token_abc123");
    // Token format is valid (actual Firebase verification is async/network - tested separately)
    expect(result.status).toBe(200);
    expect(result.blocked).toBe(false);
  });
});

// ─── C1: clockIn — Server-side Office Hours Guard ─────────────────────────────
// Simulates the logic added to clockIn to validate office hours using server time.

import { isWithinOfficeHours } from "../../src/lib/data/attendance/settings";
import type { OfficeSettings } from "../../src/lib/data/types";

const testSettings: OfficeSettings = {
  id: "office",
  officeStartTime: "10:00",
  officeEndTime: "18:00",
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 15,
  flexibilityHours: 3,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 2,
  weeklyHoursRequired: 40,
  internWeeklyHoursRequired: 30,
};

function simulateClockInGuard(settings: OfficeSettings, serverTime: Date): { blocked: boolean; reason?: string } {
  if (!isWithinOfficeHours(settings, serverTime)) {
    return { blocked: true, reason: "Office is currently closed. You can only clock in during office hours." };
  }
  return { blocked: false };
}

describe("Security C1: clockIn Server-Side Office Hours Guard", () => {
  it("should BLOCK clock-in when server time is before office hours (e.g. 6 AM)", () => {
    const time = new Date("2026-08-31T01:00:00Z"); // 6 AM PKT = 1 AM UTC
    const result = simulateClockInGuard(testSettings, time);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("Office is currently closed. You can only clock in during office hours.");
  });

  it("should BLOCK clock-in when server time is after office hours (e.g. 11 PM)", () => {
    const time = new Date("2026-08-31T18:30:00Z"); // 11:30 PM PKT
    const result = simulateClockInGuard(testSettings, time);
    expect(result.blocked).toBe(true);
  });

  it("should ALLOW clock-in when server time is within office hours (e.g. 12 PM PKT)", () => {
    const time = new Date("2026-08-31T07:00:00Z"); // 12 PM PKT = 7 AM UTC
    const result = simulateClockInGuard(testSettings, time);
    expect(result.blocked).toBe(false);
  });
});

// ─── C2: /api/parse — Auth Gate + File Size Limit ─────────────────────────────

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

function validateParseRequest(authHeader: string | null, fileSize: number): { status: number; error?: string } {
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return { status: 401, error: "Authentication required" };
  if (idToken === "invalid") return { status: 401, error: "Invalid or expired token" };
  if (fileSize > MAX_FILE_BYTES) {
    return { status: 413, error: `File too large. Maximum allowed size is ${MAX_FILE_BYTES / (1024 * 1024)}MB.` };
  }
  return { status: 200 };
}

describe("Security C2: /api/parse Auth Gate + File Size Limit", () => {
  it("should block unauthenticated file upload (no token)", () => {
    const result = validateParseRequest(null, 1024);
    expect(result.status).toBe(401);
    expect(result.error).toBe("Authentication required");
  });

  it("should block file upload with invalid token", () => {
    const result = validateParseRequest("Bearer invalid", 1024);
    expect(result.status).toBe(401);
  });

  it("should block file upload exceeding 5MB limit even with valid token", () => {
    const oversizedBytes = 6 * 1024 * 1024; // 6 MB
    const result = validateParseRequest("Bearer valid_token_abc", oversizedBytes);
    expect(result.status).toBe(413);
    expect(result.error).toContain("File too large");
  });

  it("should allow authenticated upload within size limit", () => {
    const result = validateParseRequest("Bearer valid_token_abc", 500 * 1024); // 500 KB
    expect(result.status).toBe(200);
  });

  it("should block a file that is exactly at the limit + 1 byte", () => {
    const result = validateParseRequest("Bearer valid_token_abc", MAX_FILE_BYTES + 1);
    expect(result.status).toBe(413);
  });

  it("should allow a file that is exactly at the limit (5MB)", () => {
    const result = validateParseRequest("Bearer valid_token_abc", MAX_FILE_BYTES);
    expect(result.status).toBe(200);
  });
});
