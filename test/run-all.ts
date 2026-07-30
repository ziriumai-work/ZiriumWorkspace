import "./attendance-settings.test";
import "./attendance-grace-flex.test";
import "./intern-vs-employee.test";
import "./attendance-auto-clockout.test";

import { runAllSuites } from "./test-runner";

runAllSuites().then((success) => {
  process.exit(success ? 0 : 1);
});
