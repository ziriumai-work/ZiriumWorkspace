import { onCall, HttpsError } from "firebase-functions/v2/https";

import { getFirestore } from "firebase-admin/firestore";
import { WebClient } from "@slack/web-api";

export const getSlackChannels = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  try {
    const doc = await getFirestore().collection("integrations").doc("slack").get();
    if (!doc.exists) {
      return { channels: [], connected: false };
    }
    
    const token = doc.data()?.accessToken;
    if (!token) {
      return { channels: [], connected: false };
    }

    const web = new WebClient(token);
    const result = await web.conversations.list({ types: "public_channel,private_channel", exclude_archived: true, limit: 1000 });
    
    if (result.ok) {
      const channels = result.channels?.map(c => ({
        id: c.id,
        name: c.name
      })) || [];
      return { channels, connected: true };
    } else {
      console.error("Slack API error:", result.error);
      return { channels: [], connected: true, error: result.error };
    }
  } catch (error: any) {
    console.error("Error fetching Slack channels:", error);
    throw new HttpsError("internal", error.message);
  }
});
