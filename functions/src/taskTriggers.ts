import { onDocumentUpdated } from "firebase-functions/v2/firestore";

import { getFirestore } from "firebase-admin/firestore";
import { WebClient } from "@slack/web-api";

export const onTaskStatusChanged = onDocumentUpdated(
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
      } catch (error) {
        console.error(`Failed to send Slack message for task ${event.params.taskId}:`, error);
      }
    }
  });
