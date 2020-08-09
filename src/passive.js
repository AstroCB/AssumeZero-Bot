/*
    Listen for certain messages that can be acted upon without an explicit
    trigger word – usually links that can be expanded to more rich content.
*/
const request = require("request"); // For HTTP requests
const xpath = require("xpath"); // For HTML parsing
const domParser = require("xmldom").DOMParser; // For HTML parsing
const utils = require("./utils"); // For util funcs
const config = require("./config"); // For configuration

const dom = new domParser({
    locator: {},
    errorHandler: {
        warning: function (w) { },
        error: function (e) { },
        fatalError: function (e) { console.error(e) }
    }
});

// Passive type URL regexes and their corresponding handlers
const passiveTypes = [
    {
        "regex": /https?:\/\/(mobile\.)?twitter\.com\/.+\/status\/.+/,
        "handler": handleTweet
    },
    {
        "regex": /https?:\/\/en(\.m)?\.wikipedia\.org\/wiki\/.+/,
        "handler": handleWiki
    },
    {
        "regex": /@@([^\s]+)/g,
        "handler": handleMention
    },
    {
        "regex": /https?:\/\/www\.google\.com\/amp\/s\/(.+)/,
        "handler": handleAmp
    }
];

exports.handlePassive = (messageObj, groupInfo, api) => {
    const message = messageObj.body;

    getPassiveTypes(message, type => {
        // Call generic handler and pass in all message info (handler can
        // decide whether they want to use it selectively via parameters)
        const match = message.match(type.regex);
        type.handler(match, groupInfo, messageObj, type.regex, api);
    });
};

function getPassiveTypes(text, cb) {
    passiveTypes.forEach(type => {
        if (text.match(type.regex)) {
            cb(type);
        }
    });
}

/*
    Handler functions
    
    Take (up to) the following arguments:
    match, groupInfo, messageObj, api
*/

const authorXPath =
    "//div[contains(@class, 'permalink-tweet-container')]//strong[contains(@class, 'fullname')]/text()";
const handleXPath =
    "//div[contains(@class, 'permalink-tweet-container')]//span[contains(@class, 'username')]//b/text()";
const tweetXPath =
    "//div[contains(@class, 'permalink-tweet-container')]//p[contains(@class, 'tweet-text')]//text()";
const imgXPath =
    "//meta[contains(@property, 'og:image')]/@content";

const imgRegex = /pbs.twimg.com\/media\//;

function handleTweet(match, groupInfo) {
    let url = match[0];

    if (match[1]) {
        // If mobile link, convert to regular link
        url = url.replace("mobile.twitter.", "twitter.");
    }

    // Scrape tweets because the Twitter API is annoying
    // and requires a 5-page application with essays
    request.get(url, { "headers": { "User-Agent": config.scrapeAgent } }, (err, res, body) => {
        if (!err && res.statusCode == 200) {
            const doc = dom.parseFromString(body);

            const author = xpath.select(authorXPath, doc)[0].nodeValue;
            const handle = xpath.select(handleXPath, doc)[0].nodeValue;

            // Tweets can be in multiple tags
            const tweetNodes = xpath.select(tweetXPath, doc);
            const tweetText = tweetNodes.map(t => t.nodeValue);
            // Remove some weird characters and make space for retweet/pic links
            const prettyText = tweetText.filter(t => t != "&nbsp;" && t != "…")
                .reduce((prev, cur) => {
                    if (prev.length > 0 && cur.match(/pic|https?/)) {
                        return prev + " " + cur;
                    } else {
                        return prev + cur;
                    }
                }, "");
            // If there are newlines, put a new quote marker at the beginning
            const text = prettyText.split("\n").join("\n> ");

            const msg = `${author} (@${handle}) tweeted: \n> ${text}`;

            // See if an image can be pulled from the metadata
            const imgResults = xpath.select(imgXPath, doc);
            if (imgResults.length > 0) {
                const img = imgResults[0].nodeValue;
                if (img && img.match(imgRegex)) {
                    return utils.sendFileFromUrl(img, "../media/temp.jpg", msg, groupInfo.threadId);
                }
            }

            utils.sendMessage(msg, groupInfo.threadId);
        }
    });
}

const titleXPath = "//*[@id='firstHeading']";
const paragraphXPath = "//*[@id='mw-content-text']/div/p";

function handleWiki(match, groupInfo) {
    let url = match[0];

    if (match[1]) {
        // If mobile link, convert to regular link
        url = url.replace(".m.wikipedia", ".wikipedia");
    }

    request.get(url, {}, (err, res, body) => {
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

    return { "body": msg, "mentions": mentions };
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

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const members = groupInfo.mentionGroups[group];

        if (members) {
            // Found a group to mention (either stored or global)
            members.forEach(member => users.add(member));
        } else {
            // Check for old-style individual pings
            utils.handlePings(body, senderId, groupInfo);
        }
    }

    if (users.size > 0) {
        const mentions = mentionify(Array.from(users), groupInfo);
        utils.sendMessage(mentions, groupInfo.threadId);
    } else {
        const err = `There aren't any members in ${groups.length == 1 ? "that group" : "those groups"}.`;
        utils.sendError(err, groupInfo.threadId);
    }
}

function handleAmp(match, groupInfo) {
    const actualUrl = `https://${match[1]}`;
    utils.sendMessage(`De-AMPed URL: ${actualUrl}`, groupInfo.threadId);
}