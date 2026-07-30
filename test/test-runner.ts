import assert from "node:assert/strict";

type TestFn = () => void | Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
}

const suites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

export function describe(name: string, fn: () => void) {
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  fn();
  currentSuite = null;
}

export function it(name: string, fn: TestFn) {
  if (!currentSuite) {
    throw new Error("it() must be called inside describe()");
  }
  currentSuite.tests.push({ name, fn });
}

export function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeTruthy() {
      assert.ok(actual);
    },
    toBeFalsy() {
      assert.ok(!actual);
    },
    toBeGreaterThan(expected: number) {
      assert.ok(typeof actual === "number" && actual > expected, `Expected ${actual} > ${expected}`);
    },
    toBeLessThanOrEqual(expected: number) {
      assert.ok(typeof actual === "number" && actual <= expected, `Expected ${actual} <= ${expected}`);
    }
  };
}

export async function runAllSuites(): Promise<boolean> {
  let totalSuites = 0;
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  console.log("\n=======================================================");
  console.log("   🧪 RUNNING ZIRIUM ATTENDANCE & WORKSPACE TEST SUITE");
  console.log("=======================================================\n");

  const startTime = Date.now();

  for (const suite of suites) {
    totalSuites++;
    console.log(`📦 Suite: ${suite.name}`);
    for (const test of suite.tests) {
      totalTests++;
      try {
        await test.fn();
        passedTests++;
        console.log(`   ✅ PASS: ${test.name}`);
      } catch (err: unknown) {
        failedTests++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`   ❌ FAIL: ${test.name}`);
        console.log(`      -> ${errMsg}`);
      }
    }
    console.log("");
  }

  const elapsedMs = Date.now() - startTime;

  console.log("=======================================================");
  console.log(`   📊 TEST SUMMARY:`);
  console.log(`      Suites: ${totalSuites}`);
  console.log(`      Tests:  ${totalTests} total | ✅ ${passedTests} passed | ❌ ${failedTests} failed`);
  console.log(`      Time:   ${elapsedMs}ms`);
  console.log("=======================================================\n");

  return failedTests === 0;
}
