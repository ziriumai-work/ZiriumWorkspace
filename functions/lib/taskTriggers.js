"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onProjectTableUpdateSlackAlert = exports.onTaskCompletionSlackAlert = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const web_api_1 = require("@slack/web-api");
exports.onTaskCompletionSlackAlert = (0, firestore_1.onDocumentUpdated)("tasks/{taskId}", async (event) => {
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
exports.onProjectTableUpdateSlackAlert = (0, firestore_1.onDocumentUpdated)("projects/{projectId}", async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    const slackChannelId = after.slackChannelId;
    if (!slackChannelId)
        return;
    const beforeRows = before.rows || [];
    const afterRows = after.rows || [];
    const columns = after.columns || [];
    const statusCols = columns.filter((c) => { var _a; return c.type === "status" || c.type === "select" || ((_a = c.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes("status")); });
    if (statusCols.length === 0)
        return;
    const titleCol = columns.find((c) => { var _a, _b, _c; return c.type === "text" || ((_a = c.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes("name")) || ((_b = c.name) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes("task")) || ((_c = c.name) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes("title")); }) || columns[0];
    const beforeRowMap = new Map(beforeRows.map((r) => [r.id, r]));
    for (const afterRow of afterRows) {
        const beforeRow = beforeRowMap.get(afterRow.id);
        if (!beforeRow)
            continue;
        for (const col of statusCols) {
            const oldVal = (_c = beforeRow.cells) === null || _c === void 0 ? void 0 : _c[col.id];
            const newVal = (_d = afterRow.cells) === null || _d === void 0 ? void 0 : _d[col.id];
            if (oldVal !== newVal && newVal !== undefined && newVal !== null) {
                const resolveLabel = (val) => {
                    var _a;
                    if (!val)
                        return "None";
                    const opt = (_a = col.options) === null || _a === void 0 ? void 0 : _a.find((o) => o.id === val || o.value === val || o.label === val);
                    return opt ? opt.label : String(val);
                };
                const oldLabel = resolveLabel(oldVal);
                const newLabel = resolveLabel(newVal);
                if (oldLabel === newLabel)
                    continue;
                let taskTitle = "Untitled Task";
                if (titleCol && ((_e = afterRow.cells) === null || _e === void 0 ? void 0 : _e[titleCol.id])) {
                    taskTitle = String(afterRow.cells[titleCol.id]);
                }
                const projectName = after.title || after.name || "Project";
                const baseUrl = process.env.APP_URL || "http://localhost:3000";
                const projectUrl = `${baseUrl}/projects/${event.params.projectId}`;
                const updaterName = ((_f = after.lastUpdatedBy) === null || _f === void 0 ? void 0 : _f.name) || "A team member";
                const updaterAvatar = (_g = after.lastUpdatedBy) === null || _g === void 0 ? void 0 : _g.avatar;
                const slackDoc = await (0, firestore_2.getFirestore)().collection("integrations").doc("slack").get();
                if (!slackDoc.exists)
                    return;
                const token = (_h = slackDoc.data()) === null || _h === void 0 ? void 0 : _h.accessToken;
                if (!token)
                    return;
                const web = new web_api_1.WebClient(token);
                try {
                    await web.chat.postMessage({
                        channel: slackChannelId,
                        text: `🔄 Task "${taskTitle}" status changed from "~${oldLabel}~" to "${newLabel}" by ${updaterName}`,
                        blocks: [
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: `🔄 *Notion Table Status Changed*\n*Project:* <${projectUrl}|${projectName}>\n*Task:* ${taskTitle}\n*Status:* ~${oldLabel}~ ➔ *\`${newLabel}\`*`
                                }
                            },
                            {
                                type: "context",
                                elements: [
                                    ...(updaterAvatar && updaterAvatar.startsWith("http") ? [{
                                            type: "image",
                                            image_url: updaterAvatar,
                                            alt_text: updaterName
                                        }] : []),
                                    {
                                        type: "mrkdwn",
                                        text: `*Updated by:* ${updaterName} • <${projectUrl}|Open Project Table>`
                                    }
                                ]
                            }
                        ]
                    });
                    console.log(`Slack alert sent for row ${afterRow.id} in project ${event.params.projectId}`);
                }
                catch (err) {
                    console.error(`Failed to send Slack alert for project ${event.params.projectId}:`, err);
                }
            }
        }
    }
});
//# sourceMappingURL=taskTriggers.js.map