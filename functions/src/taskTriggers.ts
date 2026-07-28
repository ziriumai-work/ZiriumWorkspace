import { onDocumentUpdated } from "firebase-functions/v2/firestore";

import { getFirestore } from "firebase-admin/firestore";
import { WebClient } from "@slack/web-api";

function getLiveBaseUrl(appUrlFromDb?: string): string {
  const candidates = [
    process.env.APP_URL,
    appUrlFromDb,
    process.env.NEXT_PUBLIC_APP_URL,
    "https://zirium.vercel.app",
  ];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim() !== "" && !c.toLowerCase().includes("localhost")) {
      let url = c.trim();
      if (url.endsWith("/")) url = url.slice(0, -1);
      if (!url.startsWith("http")) url = `https://${url}`;
      return url;
    }
  }
  return "https://zirium.vercel.app";
}

export const onTaskCompletionSlackAlert = onDocumentUpdated(
  "tasks/{taskId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Only trigger if status changed to 'done'
    if (before.status !== "done" && after.status === "done") {
      const projectId = after.projectId;
      if (!projectId) return;

      // Get project details to check for slackChannelId
      const projectDoc = await getFirestore().collection("projects").doc(projectId).get();
      if (!projectDoc.exists) return;
      
      const project = projectDoc.data();
      if (!project?.slackChannelId) return;

      // Get Slack integration token
      const slackDoc = await getFirestore().collection("integrations").doc("slack").get();
      if (!slackDoc.exists) return;
      
      const token = slackDoc.data()?.accessToken;
      if (!token) return;

      // Build message
      const web = new WebClient(token);
      
      const assigneeName = after.assignees && after.assignees.length > 0 
        ? `assigned developers` // Could fetch names if needed
        : "a developer";
        
      const taskName = after.title || "Unknown Task";
      const projectName = project.name || "Unknown Project";

      const settingsSnap = await getFirestore().collection("office_settings").doc("default").get();
      const baseUrl = getLiveBaseUrl(settingsSnap.data()?.appUrl);
      const projectUrl = `${baseUrl}/projects/${projectId}`;

      try {
        await web.chat.postMessage({
          channel: project.slackChannelId,
          text: `✅ Task completed in ${projectName} by ${assigneeName}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `✅ *Task Completed*\n*Task:* ${taskName}\n*Project:* <${projectUrl}|${projectName}>\n*By:* ${assigneeName}`
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
      } catch (error) {
        console.error(`Failed to send Slack message for task ${event.params.taskId}:`, error);
      }
    }
  });

export const onProjectTableUpdateSlackAlert = onDocumentUpdated(
  "projects/{projectId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;
    const slackChannelId = after.slackChannelId;
    if (!slackChannelId) return;

    const beforeRows: Array<any> = before.rows || [];
    const afterRows: Array<any> = after.rows || [];
    const columns: Array<any> = after.columns || [];

    const statusCols = columns.filter((c: any) => c.type === "status" || c.type === "select" || c.name?.toLowerCase().includes("status"));
    if (statusCols.length === 0) return;

    const titleCol = columns.find((c: any) => c.type === "text" || c.name?.toLowerCase().includes("name") || c.name?.toLowerCase().includes("task") || c.name?.toLowerCase().includes("title")) || columns[0];

    const beforeRowMap = new Map(beforeRows.map((r: any) => [r.id, r]));

    for (const afterRow of afterRows) {
      const beforeRow = beforeRowMap.get(afterRow.id);
      if (!beforeRow) continue;

      for (const col of statusCols) {
        const oldVal = beforeRow.cells?.[col.id];
        const newVal = afterRow.cells?.[col.id];

        if (oldVal !== newVal && newVal !== undefined && newVal !== null) {
          const resolveLabel = (val: any) => {
            if (!val) return "None";
            const opt = col.options?.find((o: any) => o.id === val || o.value === val || o.label === val);
            return opt ? opt.label : String(val);
          };

          const oldLabel = resolveLabel(oldVal);
          const newLabel = resolveLabel(newVal);

          if (oldLabel === newLabel) continue;

          let taskTitle = "Untitled Task";
          if (titleCol && afterRow.cells?.[titleCol.id]) {
            taskTitle = String(afterRow.cells[titleCol.id]);
          }

          const projectName = after.title || after.name || "Project";
          const settingsSnap = await getFirestore().collection("office_settings").doc("default").get();
          const baseUrl = getLiveBaseUrl(settingsSnap.data()?.appUrl);
          const projectUrl = `${baseUrl}/projects/${event.params.projectId}`;

          const updaterName = after.lastUpdatedBy?.name || "A team member";
          const updaterAvatar = after.lastUpdatedBy?.avatar;

          const slackDoc = await getFirestore().collection("integrations").doc("slack").get();
          if (!slackDoc.exists) return;
          const token = slackDoc.data()?.accessToken;
          if (!token) return;

          const web = new WebClient(token);
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
                      type: "image" as const,
                      image_url: updaterAvatar,
                      alt_text: updaterName
                    }] : []),
                    {
                      type: "mrkdwn" as const,
                      text: `*Updated by:* ${updaterName} • <${projectUrl}|Open Project Table>`
                    }
                  ]
                }
              ]
            });
            console.log(`Slack alert sent for row ${afterRow.id} in project ${event.params.projectId}`);
          } catch (err) {
            console.error(`Failed to send Slack alert for project ${event.params.projectId}:`, err);
          }
        }
      }
    }
  }
);
