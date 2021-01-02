/*
    Listen for certain messages that can be acted upon without an explicit
    trigger word – usually links that can be expanded to more rich content.
*/
const request = require("request"); // For HTTP requests
const xpath = require("xpath"); // For HTML parsing
const domParser = require("xmldom").DOMParser; // For HTML parsing
const utils = require("./utils"); // For util funcs
const config = require("./config"); // For configuration

const dom = new domParser({
    locator: {},
    errorHandler: {
        warning: () => { },
        error: () => { },
        fatalError: e => { console.error(e); }
    }
});

// Passive type URL regexes and their corresponding handlers
const passiveTypes = [
    {
        "regex": /https?:\/\/(?:mobile\.)?twitter\.com\/.+\/status\/(\d+)/,
        "handler": handleTweet
    },
    {
        "regex": /https?:\/\/en(\.m)?\.wikipedia\.org\/wiki\/.+/,
        "handler": handleWiki
    },
    {
        "regex": /@@([\w]+)/g,
        "handler": handleMention
    },
    {
        "regex": /https?:\/\/www\.google\.com\/amp\/s\/(.+)/,
        "handler": handleAmp
    }
];

exports.handlePassive = (messageObj, groupInfo, api) => {
    if (groupInfo.richContent) { // Don't check for passives if rich content is disabled
        getPassiveTypes(messageObj, (type, match) => {
            // Call generic handler and pass in all message info (handler can
            // decide whether they want to use it selectively via parameters)
            type.handler(match, groupInfo, messageObj, type.regex, api);
        });
    }
};

function getPassiveTypes(msg, cb) {
    const { body, attachments } = msg;
    passiveTypes.forEach(type => {
        const match = body.match(type.regex);
        if (match) {
            cb(type, match);
        } else {
            // If there isn't a match in the body, we can also check the attachments
            attachments
                .filter(attachment => attachment.type === "share" && attachment.url)
                .map(attachment => {
                    // Sometimes, Facebook futzes with the URL for redirects,
                    // so we need to decode it before checking for a match
                    const encodedURLMatch = attachment.url.match(/l\.facebook\.com\/l\.php\?u=([^&]+)/i);
                    if (encodedURLMatch) {
                        return { ...attachment, "url": decodeURIComponent(encodedURLMatch[1]) };
                    }
                    return attachment;
                })
                .forEach(attachment => {
                    const attachmentMatch = attachment.url.match(type.regex);
                    if (attachmentMatch) {
                        cb(type, attachmentMatch);
                    }
                });
        }
    });
}

/*
    Handler functions
    
    Take (up to) the following arguments:
    match, groupInfo, messageObj, api
*/

function handleTweet(match, groupInfo) {
    const tweetId = match[1];
    utils.sendTweetMsg(tweetId, groupInfo.threadId);
}

const titleXPath = "//*[@id='firstHeading']";
const paragraphXPath = "//*[@id='mw-content-text']/div/p";

function handleWiki(match, groupInfo) {
    let url = match[0];

    if (match[1]) {
        // If mobile link, convert to regular link
        url = url.replace(".m.wikipedia", ".wikipedia");
    }

    request.get(url, { "headers": { "User-Agent": config.scrapeAgent } }, (err, res, body) => {
        if (!err && res.statusCode == 200) {
            const doc = dom.parseFromString(body);

            const title = xpath.select(titleXPath, doc)[0].textContent;
            // Filter out empty paragraphs
            const paragraphs = xpath.select(paragraphXPath, doc);
            const paragraph = paragraphs.map(p => p.textContent.trim())
                .filter(p => p.length > 1)[0];

            utils.sendMessage(`*${title}*\n\n${paragraph}`, groupInfo.threadId);
        }
    });
}

function mentionify(members, groupInfo) {
    const mentions = members.map(id => {
        return {
            "tag": `@${groupInfo.names[id]}`,
            "id": id
        };
    });

    const msg = mentions.map(mention => mention.tag).join(" ");
    // Facebook bug disallows searching from position 0 for mentions, so we
    // have to insert a zero-width space at the beginning before our tags
    const body = `\u200B${msg}`;

    return { "body": body, "mentions": mentions };
}

function handleMention(_, groupInfo, messageObj, regex) {
    const body = messageObj.body;
    const senderId = messageObj.senderID;
    const users = new Set();

    // Two types of mentions: channel-wide and stored groups
    const allMatch = body.match(config.channelMentionRegex);
    if (allMatch) {
        // Alert everyone in the group
        const members = Object.keys(groupInfo.names);
        // Remove sending user from recipients
        members.splice(members.indexOf(senderId), 1);
        members.forEach(member => users.add(member));
    }

    // Stored groups
    const groups = [];
    let match;
    while ((match = regex.exec(body)) !== null) {
        groups.push(match[1]);
    }

    let failedAGroup = false;
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const members = groupInfo.mentionGroups[group];

        if (members) {
            // Found a group to mention (either stored or global)
            members.forEach(member => users.add(member));
        } else {
            failedAGroup = true;
        }
    }

    // Fallback to old-style pings if any failures to match a new-style group
    const fallbackSucceeded = failedAGroup ? utils.handlePings(body, senderId, groupInfo) : false;

    if (users.size > 0) {
        const mentions = mentionify(Array.from(users), groupInfo);
        utils.sendMessage(mentions, groupInfo.threadId);
    } else if (!fallbackSucceeded) {
        // If it didn't find any new-style groups or old-style pings, send an error
        const err = `There aren't any members in ${groups.length == 1 ? "that group" : "those groups"}.`;
        utils.sendError(err, groupInfo.threadId);
    }
}

function handleAmp(match, groupInfo) {
    const actualUrl = `https://${match[1]}`;
    utils.sendMessage(`De-AMPed URL: ${actualUrl}`, groupInfo.threadId);
}