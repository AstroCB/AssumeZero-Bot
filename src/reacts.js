const utils = require("./utils");
const config = require("./config");

exports.handleReacts = (message, info, api) => {
    if (message.senderID !== config.bot.id) {
        return; // Don't handle reacts to other users' messages
    }

    const react = message.reaction;
    switch (react) {
        case "👍":
        case "👎":
            return recordEventRSVP((react === "👍"), message, info, api);
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