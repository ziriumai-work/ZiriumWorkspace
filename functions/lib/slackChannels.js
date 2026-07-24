"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSlackChannels = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const web_api_1 = require("@slack/web-api");
exports.getSlackChannels = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in.");
    }
    try {
        const doc = await (0, firestore_1.getFirestore)().collection("integrations").doc("slack").get();
        if (!doc.exists) {
            return { channels: [], connected: false };
        }
        const token = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.accessToken;
        if (!token) {
            return { channels: [], connected: false };
        }
        const web = new web_api_1.WebClient(token);
        const result = await web.conversations.list({ types: "public_channel,private_channel", exclude_archived: true, limit: 1000 });
        if (result.ok) {
            const channels = ((_b = result.channels) === null || _b === void 0 ? void 0 : _b.map(c => ({
                id: c.id,
                name: c.name
            }))) || [];
            return { channels, connected: true };
        }
        else {
            console.error("Slack API error:", result.error);
            return { channels: [], connected: true, error: result.error };
        }
    }
    catch (error) {
        console.error("Error fetching Slack channels:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
//# sourceMappingURL=slackChannels.js.map