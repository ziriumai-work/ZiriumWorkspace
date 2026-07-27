"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSlackChannels = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const web_api_1 = require("@slack/web-api");
exports.getSlackChannels = (0, https_1.onCall)({ cors: true, invoker: "public" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in.");
    }
    try {
        const doc = await (0, firestore_1.getFirestore)().collection("integrations").doc("slack").get();
        if (!doc.exists) {
            return { channels: [], colleagues: [], connected: false, teamName: null };
        }
        const data = doc.data() || {};
        const token = data.accessToken;
        const teamName = data.teamName || null;
        if (!token) {
            return { channels: [], colleagues: [], connected: false, teamName: null };
        }
        const web = new web_api_1.WebClient(token);
        let channels = [];
        let colleagues = [];
        let error = null;
        const allChannelsMap = new Map();
        try {
            const result = await web.conversations.list({
                types: "public_channel,private_channel,im,mpim",
                exclude_archived: true,
                limit: 1000
            });
            if (result.ok && result.channels) {
                result.channels.forEach(c => {
                    if (c.id)
                        allChannelsMap.set(c.id, c.name || c.user || "channel");
                });
            }
            else if (result.error) {
                error = result.error;
            }
        }
        catch (err) {
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
        }
        catch (err) {
            console.error("Slack users.conversations error:", err);
        }
        channels = Array.from(allChannelsMap.entries()).map(([id, name]) => ({ id, name }));
        try {
            const usersRes = await web.users.list({ limit: 1000 });
            if (usersRes.ok && usersRes.members) {
                colleagues = usersRes.members
                    .filter(u => !u.is_bot && !u.deleted && u.id !== "USLACKBOT")
                    .map(u => {
                    var _a, _b, _c;
                    return ({
                        id: u.id,
                        name: u.real_name || u.name || ((_a = u.profile) === null || _a === void 0 ? void 0 : _a.real_name) || "Unknown User",
                        email: ((_b = u.profile) === null || _b === void 0 ? void 0 : _b.email) || "",
                        avatar: ((_c = u.profile) === null || _c === void 0 ? void 0 : _c.image_24) || ""
                    });
                });
            }
        }
        catch (err) {
            console.error("Slack users.list error:", err);
        }
        return { channels, colleagues, connected: true, teamName, error };
    }
    catch (error) {
        console.error("Error fetching Slack info:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
//# sourceMappingURL=slackChannels.js.map