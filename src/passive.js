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
        "regex": /https?:\/\/twitter\.com\/.+\/status\/.+/,
        "handler": handleTweet
    },
    {
        "regex": /https?:\/\/en\.wikipedia\.org\/wiki\/.+/,
        "handler": handleWiki
    }, {
        "regex": /@@(.+)/,
        "handler": handlePings
    }
];

exports.handlePassive = (messageObj, groupInfo, api) => {
    const message = messageObj.body;

    getPassiveTypes(message, type => {
        // Call generic handler and pass in all message info (handler can
        // decide whether they want to use it selectively via parameters)
        const match = message.match(type.regex);
        type.handler(match, groupInfo, messageObj, api);
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

function handleTweet(match, groupInfo) {
    const url = match[0];

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

            utils.sendMessage(`${author} (@${handle}) tweeted: \n> ${text}`,
                groupInfo.threadId);
        }
    });
}

const titleXPath = "//*[@id='firstHeading']";
const paragraphXPath = "//*[@id='mw-content-text']/div/p";

function handleWiki(match, groupInfo) {
    const url = match[0];

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

function handlePings(_, info, messageObj) {
    const body = messageObj.body;
    const senderId = messageObj.senderID;
    const pingData = utils.parsePing(body, senderId, info);
    const pingUsers = pingData.users;
    const pingMessage = pingData.message;

    if (pingUsers) {
        for (let i = 0; i < pingUsers.length; i++) {
            const sender = info.nicknames[senderId] || info.names[senderId] || "A user";
            let message = `${sender} summoned you in ${info.name}`;
            if (pingMessage.length > 0) { // Message left after pings removed – pass to receiver
                message = `"${pingMessage}" – ${sender} in ${info.name}`;
            }
            message += ` at ${utils.getTimeString()}` // Time stamp
            // Send message with links to chat/sender
            utils.sendMessageWithMentions(message, [{
                "tag": sender,
                "id": senderId
            }, {
                "tag": info.name,
                "id": info.threadId
            }], info.members[pingUsers[i]]);
        }
    }
}