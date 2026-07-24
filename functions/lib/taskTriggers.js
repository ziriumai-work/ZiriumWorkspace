"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onTaskStatusChanged = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const web_api_1 = require("@slack/web-api");
exports.onTaskStatusChanged = (0, firestore_1.onDocumentUpdated)("tasks/{taskId}", async (event) => {
    var _a, _b, _c;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    // Only trigger if status changed to 'done'
    if (before.status !== "done" && after.status === "done") {
        const projectId = after.projectId;
        if (!projectId)
            return;
        // Get project details to check for slackChannelId
        const projectDoc = await (0, firestore_2.getFirestore)().collection("projects").doc(projectId).get();
        if (!projectDoc.exists)
            return;
        const project = projectDoc.data();
        if (!(project === null || project === void 0 ? void 0 : project.slackChannelId))
            return;
        // Get Slack integration token
        const slackDoc = await (0, firestore_2.getFirestore)().collection("integrations").doc("slack").get();
        if (!slackDoc.exists)
            return;
        const token = (_c = slackDoc.data()) === null || _c === void 0 ? void 0 : _c.accessToken;
        if (!token)
            return;
        // Build message
        const web = new web_api_1.WebClient(token);
        const assigneeName = after.assignees && after.assignees.length > 0
            ? `assigned developers` // Could fetch names if needed
            : "a developer";
        const taskName = after.title || "Unknown Task";
        const projectName = project.name || "Unknown Project";
        try {
            await web.chat.postMessage({
                channel: project.slackChannelId,
                text: `✅ Task completed in ${projectName} by ${assigneeName}`,
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `✅ *Task Completed*\n*Task:* ${taskName}\n*Project:* ${projectName}\n*By:* ${assigneeName}`
                        }
                    },
                    {
                        type: "context",
                        elements: [
                            {
                                type: "mrkdwn",
                                text: `Status updated to Done.`
                            }
                        ]
                    }
                ]
            });
            console.log(`Slack notification sent for task ${event.params.taskId}`);
        }
        catch (error) {
            console.error(`Failed to send Slack message for task ${event.params.taskId}:`, error);
        }
    }
});
//# sourceMappingURL=taskTriggers.js.map