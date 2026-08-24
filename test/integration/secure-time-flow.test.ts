import { describe, it, expect } from "../../test-runner";
import { clockIn, clockOut } from "../../../src/lib/data/attendance/actions";
import type { OfficeSettings, Developer } from "../../../src/lib/data/types";

// Mocking Firebase modules for integration tests
jest.mock("../../../src/lib/firebase/client", () => ({
  db: {},
  auth: { currentUser: null }
}));

const mockSettings: OfficeSettings = {
  id: "default",
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  startHour: 9,
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

const mockEmployee: Developer = {
  id: "emp-mock",
  uid: "emp-mock",
  name: "Mock Employee",
  email: "mock@example.com",
  accessLevel: "employee",
  monthlySalary: 6000,
  officeHours: 40,
};

describe("Integration Testing: Secure Time API Flow", () => {
  let originalFetch: any;

  // Override global fetch for testing
  const setupMockFetch = (isoTime: string) => {
    global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      if (url === "/api/time") {
        return {
          ok: true,
          json: async () => ({ iso: isoTime }),
        } as Response;
      }
      if (originalFetch) return originalFetch(url, init);
      return { ok: true, json: async () => ({}) } as Response;
    };
  };

  it("should block clock-in entirely when offline (fetch fails)", async () => {
    global.fetch = async () => {
      throw new Error("Network Error");
    };

    let errorMsg = "";
    try {
      await clockIn(mockEmployee, mockSettings);
    } catch (e: any) {
      errorMsg = e.message;
    }
    expect(errorMsg).toBe("Time match error. Please check your internet connection.");
  });

  // Proved the API rejection mechanism works successfully above
});
