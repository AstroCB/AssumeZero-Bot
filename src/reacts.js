/*
    Handles reactions placed on messages in the chat, which the bot uses to
    record responses to events and take other actions on specific messages.
*/

const utils = require("./utils");
const config = require("./config");

exports.handleReacts = (message, info, api) => {
    const react = message.reaction;

    if (message.senderID === config.bot.id) {
        // Reacts we only want to handle on the bot's messages
        switch (react) {
            case "👍":
            case "👎":
                return recordEventRSVP((react === "👍"), message, info, api);
            case "❌":
            case "🗑":
                return api.unsendMessage(message.messageID);
        }
    }

    // Reacts we want to handle on all messages
    switch (react) {
        case "🐛":
            return reportBug(message, info, api);
    }
};

function recordEventRSVP(isGoing, message, info, api) {
    const eventMidMap = Object.keys(info.events).reduce((events, e) => {
        const event = info.events[e];
        events[event.mid] = event;
        return events;
    }, {});

    const event = eventMidMap[message.messageID];
    if (event) {
        const rsvpr = message.userID;
        api.getUserInfo(rsvpr, (err, uinfo) => {
            if (!err) {
                const data = uinfo[rsvpr];

                // Remove any pre-existing responses from that user
                event.going = event.going.filter(user => user.id != rsvpr);
                event.not_going = event.not_going.filter(user => user.id != rsvpr);

                const resp_list = isGoing ? event.going : event.not_going;
                resp_list.push({
                    "id": rsvpr,
                    "name": data.firstName
                });
                utils.setGroupProperty("events", info.events, info);
            }
        });
    }
}

function reportBug(reactMsg, info, api) {
    const reporter = info.names[reactMsg.userID];

    // Confirm receipt with react
    api.setMessageReaction("✨", reactMsg.messageID);

    const onFailure = (err) => {
        // Change message reaction to indicate failure
        api.setMessageReaction("❌", reactMsg.messageID);
        console.error(err);
    };

    api.getMessage(reactMsg.threadID, reactMsg.messageID, (err, msg) => {
        if (!err) {
            const text = msg.body;
            api.getUserInfo(msg.senderID, (err, userInfo) => {
                if (!err) {
                    const sender = userInfo[msg.senderID].name;
                    utils.createGitHubIssue(sender, reporter, text, 'bug', info, (err, url, num) => {
                        if (!err) {
                            // Send the confirmation with a link
                            api.sendMessage({
                                url,
                                body: `Created ${config.ghRepo.repo}#${num}`
                            }, reactMsg.threadID, () => { }, reactMsg.messageID);
                        } else {
                            onFailure("Failed to create issue: ", err);
                        }
                    });
                } else {
                    onFailure(`Unable to retrieve details about user ${msg.senderID}`);
                }
            });
        } else {
            onFailure("Failed to retrieve reacji'd message: ", err);
        }
    });
}