/*
    Check for certain message types that can be expanded to more rich content
    from a link.
*/
const request = require("request"); // For HTTP requests
const xpath = require("xpath"); // For HTML parsing
const dom = require("xmldom").DOMParser; // For HTML parsing
const utils = require("./utils"); // For util funcs

// Passive type URL regexes and their corresponding handlers
const passiveTypes = [
    {
        "regex": /https?:\/\/twitter\.com\/.+\/status\/.+/,
        "handler": handleTweet
    }
];

exports.handlePassive = (messageObj, fromUserId, attachments, groupInfo, api) => {
    const message = messageObj.body;
    const type = getPassiveType(message);
    if (type) {
        type.handler(message.match(type.regex), groupInfo);
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
        if (res.statusCode == 200) {
            const doc = new dom({
                locator: {},
                errorHandler: {
                    warning: function (w) { },
                    error: function (e) { },
                    fatalError: function (e) { console.error(e) }
                }
            }).parseFromString(body);
            
            const author = xpath.select(authorXPath, doc)[0].nodeValue;
            const handle = xpath.select(handleXPath, doc)[0].nodeValue;
            const tweet = xpath.select(tweetXPath, doc)[0].nodeValue;

            utils.sendMessage(`${author} (@${handle}) tweeted: \n> ${tweet}`, groupInfo.threadId);
        }
    });
}

