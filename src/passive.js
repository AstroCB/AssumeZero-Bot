/*
    Check for certain message types that can be expanded to more rich content
    from a link.
*/
const request = require("request"); // For HTTP requests
const xpath = require("xpath"); // For HTML parsing
const domParser = require("xmldom").DOMParser; // For HTML parsing
const utils = require("./utils"); // For util funcs

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
    }
];

exports.handlePassive = (messageObj, fromUserId, attachments, groupInfo, api) => {
    const message = messageObj.body;
    const messageId = messageObj.messageID;

    const type = getPassiveType(message);
    if (type) {
        type.handler(message.match(type.regex), groupInfo, messageId);
    }
};

function getPassiveType(text) {
    for (let i = 0; i < passiveTypes.length; i++) {
        if (text.match(passiveTypes[i].regex)) {
            return passiveTypes[i];
        }
    }
    return null;
}

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
    request.get(url, {}, (err, res, body) => {
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
