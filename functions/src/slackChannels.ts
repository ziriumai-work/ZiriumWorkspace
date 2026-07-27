import { onCall, HttpsError } from "firebase-functions/v2/https";

import { getFirestore } from "firebase-admin/firestore";
import { WebClient } from "@slack/web-api";

export const getSlackChannels = onCall({ cors: true, invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  try {
    const doc = await getFirestore().collection("integrations").doc("slack").get();
    if (!doc.exists) {
      return { channels: [], colleagues: [], connected: false, teamName: null };
    }
    
    const data = doc.data() || {};
    const token = data.accessToken;
    const teamName = data.teamName || null;
    if (!token) {
      return { channels: [], colleagues: [], connected: false, teamName: null };
    }

    const web = new WebClient(token);
    
    let channels: { id: string; name: string }[] = [];
    let colleagues: { id: string; name: string; email?: string; avatar?: string }[] = [];
    let error: string | null = null;

    const allChannelsMap = new Map<string, string>();
    try {
      const result = await web.conversations.list({
        types: "public_channel,private_channel,im,mpim",
        exclude_archived: true,
        limit: 1000
      });
      if (result.ok && result.channels) {
        result.channels.forEach(c => {
          if (c.id) allChannelsMap.set(c.id, c.name || c.user || "channel");
        });
      } else if (result.error) {
        error = result.error;
      }
    } catch (err: any) {
      console.error("Slack conversations.list error:", err);
      error = err.message || "Failed to fetch channels";
    }

    try {
      const userConv = await web.users.conversations({
        types: "public_channel,private_channel,im,mpim",
        exclude_archived: true,
        limit: 1000
      });
      if (userConv.ok && userConv.channels) {
        userConv.channels.forEach(c => {
          if (c.id && !allChannelsMap.has(c.id)) {
            allChannelsMap.set(c.id, c.name || c.user || "channel");
          }
        });
      }
    } catch (err: any) {
      console.error("Slack users.conversations error:", err);
    }

    channels = Array.from(allChannelsMap.entries()).map(([id, name]) => ({ id, name }));

    try {
      const usersRes = await web.users.list({ limit: 1000 });
      if (usersRes.ok && usersRes.members) {
        colleagues = usersRes.members
          .filter(u => !u.is_bot && !u.deleted && u.id !== "USLACKBOT")
          .map(u => ({
            id: u.id!,
            name: u.real_name || u.name || u.profile?.real_name || "Unknown User",
            email: u.profile?.email || "",
            avatar: u.profile?.image_24 || ""
          }));
      }
    } catch (err: any) {
      console.error("Slack users.list error:", err);
    }

    return { channels, colleagues, connected: true, teamName, error };
  } catch (error: any) {
    console.error("Error fetching Slack info:", error);
    throw new HttpsError("internal", error.message);
  }
});
