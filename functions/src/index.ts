import * as admin from "firebase-admin";
admin.initializeApp();

export { slackAuth, slackAuthCallback } from "./slackAuth";
export { getSlackChannels } from "./slackChannels";
export { onTaskStatusChanged } from "./taskTriggers";
