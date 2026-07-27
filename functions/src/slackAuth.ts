import { onRequest } from "firebase-functions/v2/https";

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { WebClient } from "@slack/web-api";

// Initialize Slack App OAuth Flow
export const slackAuth = onRequest((req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    res.status(500).send("Slack credentials not configured.");
    return;
  }

  // Redirect to Slack's OAuth v2 authorize page
  const scopes = ["chat:write", "channels:read", "groups:read", "im:read", "mpim:read", "users:read", "users:read.email", "chat:write.public"];
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes.join(",")}&redirect_uri=${redirectUri}`;
  
  res.redirect(authUrl);
});

export const slackAuthCallback = onRequest(async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    res.status(400).send(`OAuth Error: ${error}`);
    return;
  }
  if (!code) {
    res.status(400).send("No code provided.");
    return;
  }

  try {
    const web = new WebClient();
    const result = await web.oauth.v2.access({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.SLACK_REDIRECT_URI!
    });

    if (result.ok) {
      // Store the access token in Firestore
      await getFirestore().collection("integrations").doc("slack").set({
        accessToken: result.access_token,
        teamId: result.team?.id,
        teamName: result.team?.name,
        connectedAt: FieldValue.serverTimestamp(),
      });
      
      res.send(`
        <html>
          <body>
            <h1>Slack Connected Successfully!</h1>
            <p>You can close this tab and return to the dashboard.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    } else {
      res.status(400).send(`Failed to connect: ${result.error}`);
    }
  } catch (err: any) {
    res.status(500).send(`Error: ${err.message}`);
  }
});
