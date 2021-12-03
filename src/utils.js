const fs = require("fs"); // File system
const request = require("request"); // For HTTP requests
const jimp = require("jimp"); // For image processing
const chrono = require("chrono-node"); // For NL date parsing
const entities = new (require('html-entities').XmlEntities)(); // For parsing HTML strings
const humanize = require("humanize-duration"); // For creating readable time durations
const rss = new (require("rss-parser"))(); // For parsing RSS feeds
const { Octokit } = require("@octokit/rest"); // For interacting with GitHub
const { createAppAuth } = require("@octokit/auth-app"); // For authorizing Octokit

const config = require("./config");
const utils = require("./configutils");
const commands = require("./commands");

let gapi;
let mem;
let credentials;
let lockedThreads = [];
let octokitInit;

// We have to lazily initialize octokit because it requires credentials, which won't
// be initialized until after this file is loaded into memory. Instead of creating
// a function that initializes and returns an instance every time, we can initialize
// it once and cache its value for subsequent calls.
const getOctokit = () => {
    return octokitInit ? octokitInit
        : (() => {
            octokitInit = new Octokit({
                authStrategy: createAppAuth,
                auth: {
                    appId: credentials.GITHUB_APP_ID,
                    privateKey: credentials.GITHUB_PRIVATE_KEY,
                    installationId: credentials.GITHUB_INSTALLATION_ID,
                    clientId: credentials.GITHUB_CLIENT_ID,
                    clientSecret: credentials.GITHUB_CLIENT_SECRET
                }
            });

            return octokitInit;
        })();
};

// Initialize the global variables in this module
// MUST be called before other functions in this module
// Values to be initialized: api instance, memjs instance,
// credentials object
exports.setglobals = (api, gmem, gcreds) => {
    gapi = api;
    mem = gmem;
    credentials = gcreds;
};

// Assorted utility functions

/*
This is used in place of (or in conjunction with) a regex for command matching.
It combines any passed regular expressions with a capturing group that looks for
a username (or alias) match and returns a regex match object containing the username
of the person matched (even if an alias was used – the function handles aliases on its
own and converts them back to usernames) in the order described below.

It takes a `command` (a regex object to be matched *before* the username), the `message` to be
searched, the `fromUserId` of the sender (for converting "me" to a username), the group's
`groupData` object, whether the username match should be `optional` (default `false`), any
separator `sep` to be placed between the prefix match and the username (default 1 space), and
any `suffix` match to be matched *after* the username match.

Returns a RegExp match object containing the matches in the following order:
1. {prefix match(es)}
2. {username match}
3. {suffix match(es)}
*/
exports.matchesWithUser = (command, message, fromUserId, groupData, optional = false, sep = " ", suffix = "") => {
    // Construct regex string
    let match = message.match(new RegExp(`${command.source}${optional ? "(?:" : ""}${sep}${groupData.userRegExp}${optional ? ")?" : ""}${suffix}`, "i"));
    if (match) {
        // Preserve properties
        const index = match.index;
        const input = match.input;
        for (let i = 1; i < match.length; i++) { // Start offset one to skip full match at [0]
            let m = match[i];
            if (m) { // Make sure only modifying the user field (no aliases here)
                // Any post-match changes that need to be made
                let fixes = this.parseNameReplacements(m, fromUserId, groupData);
                match[i] = fixes;
                if (m != fixes) {
                    /*
                    NOTE: If a username has been replaced, no more changes are needed
                    The username change should always be the first (and only) change
                    to trigger this block, but it may not always be (esp. for future commands)
                    so be careful and revisit this if a better solution can be found (nothing else
                    has worked thus far).

                    For instance, I had to update the "score" command after implementing this since it
                    had an erroneous capturing group that contained a username before the main username field.
                    */
                    break;
                }
            }
        }
        match.index = index;
        match.input = input;
    }
    return match;
};

/*
Wrapper function for sending messages easily
Isn't that much simpler than the actual message function, but it
allows for an optional thread parameter (default is currently stored ID)
and for outputting messages to stdout when the API isn't available (e.g. before login)

Accepts either a simple string or a message object with URL/attachment fields.

Probably a good idea to use this wrapper for all sending instances for debug purposes
and consistency.
*/
exports.sendMessage = (m, threadId, callback = () => { }, replyId = null, api = gapi) => {
    if (!m || !threadId) {
        return callback(new Error("Must provide message and threadId."));
    }

    try {
        api.sendMessage(m, threadId, (err, minfo) => {
            if (err) {
                console.error("Failed to send message:", m, "with error:", err);
            }
            callback(err, minfo);

            // Save last message ID sent
            this.getGroupInfo(threadId, (err, info) => {
                if (minfo && info) {
                    if (err) return console.error(err);

                    this.setGroupProperty("lastBotMessageID", minfo.messageID, info);
                }
            });
        }, replyId);
    } catch (e) { // For debug mode (API not available)
        console.log(`${threadId}: ${m}`);
        callback();
    }
};

// Wrapper function for sending error messages to chat (uses sendMessage wrapper)
exports.sendError = (m, threadId) => {
    this.sendMessage(`Error: ${m}`, threadId);
};

/*
Wrapper function for using mentions
Mentions parameter is an array of dictionaries for each mention
Each dict contains "tag" and "id" keys that should be set to
the text and the id of the mention respectively
*/
exports.sendMessageWithMentions = (message, mentions, threadId, replyId = null) => {
    this.sendMessage({
        "body": message,
        "mentions": mentions,
    }, threadId, () => { }, replyId);
};

// Kick user for an optional length of time in seconds (default indefinitely)
// Also accepts optional callback parameter if length is specified
exports.kick = (userId, kickerId, info, time, callback = () => { }, api = gapi) => {
    if (userId != config.bot.id) { // Never allow bot to be kicked
        api.removeUserFromGroup(userId, info.threadId, err => {
            if (err) {
                if (info.isGroup) {
                    this.sendError(`The bot must be an admin to kick members from the chat. ${this.getPromoteString(kickerId, info)}`, info.threadId);
                } else {
                    this.sendError("Cannot kick user from private chat.", info.threadId);
                }
            } else {
                if (time) {
                    setTimeout(() => {
                        this.addUser(userId, info, false); // Don't welcome if they're not new to the group
                        callback();
                    }, time * 1000);
                }
                this.updateGroupInfo(info.threadId);
            }
        });
    }
};

// Same as kick, but for a list of users
exports.kickMultiple = (userIds, kickerId, info, time, callback = () => { }) => {
    // Check if kicking is possible first to avoid duplicate error messages
    if (!info.isGroup) {
        this.sendError("Cannot kick user from private chat.", info.threadId);
    } else if (info.admins.indexOf(config.bot.id) < 0) {
        this.sendError(`The bot must be an admin to kick members from the chat. ${this.getPromoteString(kickerId, info)}`, info.threadId);
    } else {
        let callbackset = false;
        for (let i = 0; i < userIds.length; i++) {
            // Stagger the kicks so it doesn't look as much like a bot
            setTimeout(() => {
                // Bot should never be in members list, but this is a safeguard
                // (ALSO VERY IMPORTANT so that group isn't completely emptied)
                if (userIds[i] != config.bot.id) {
                    if (!callbackset) { // Only want to send the message once
                        this.kick(userIds[i], kickerId, info, time, callback);
                        callbackset = true;
                    } else {
                        this.kick(userIds[i], kickerId, info, time);
                    }
                }
            }, i * 1000);
        }
    }
};

/*
Adds user to group and updates members list
Optional parameter to welcome new user to the group
Buffer limit controls number of times it will attempt to add the user to the group
Optional parameter to control whether it should retry adding if it fails initially
if not successful on the first attempt (default 5)
*/
exports.addUser = (id, info, welcome = true, callback = () => { }, retry = true, currentBuffer = 0, api = gapi) => {
    api.addUserToGroup(id, info.threadId, err => {
        if (!err) {
            this.updateGroupInfo(info.threadId, null, (err, info) => {
                if (!err && welcome) {
                    if (info.names[id]) {
                        this.welcomeToChat(info.names[id], info);
                    } else {
                        api.getUserInfo(id, (err, uinfo) => {
                            if (!err && uinfo.name) {
                                this.sendMessage(`${uinfo.name} will be added to ${info.name} pending admin approval.`, info.threadId);
                            }
                        });
                    }
                }
            });
            callback();
        } else if (err && (currentBuffer < config.addBufferLimit)) {
            if (retry) {
                this.addUser(id, info, welcome, callback, retry, (currentBuffer + 1));
            } else {
                callback(err);
            }
        } else {
            callback(err);
        }
    });
};

// Utility func for welcoming users to the chat
exports.welcomeToChat = (name, groupInfo) => {
    let msg = `Welcome to ${groupInfo.name}, ${name}!`;
    if (groupInfo.pinned) {
        const introPin = groupInfo.pinned[config.introPin];
        if (introPin) {
            msg += `\nHere's some information about this chat:\n\n${this.stringifyPin(introPin)}`;
        }
    }

    this.sendMessage(msg, groupInfo.threadId);
};

/*
Update stored info about groups after every message in the background
Takes an optional message object when called by the update subroutine,
but can be ignored when called from anywhere else.

Using callback is discouraged as the idea of this function is to update in
the background to decrease lag, but it may be useful if updates are required
to continue.
*/
exports.updateGroupInfo = (threadId, message, callback = () => { }, sendsInit = true, api = gapi) => {
    this.getGroupInfo(threadId, (err, existingInfo) => {
        this.getGroupInfo(config.owner.id, (ownerErr, ownerData) => {
            if (!err && !ownerErr) {
                // If the dbFailSilently flag is turned on, only send the init
                // message if the owner thread exists in the database. Also
                // allow caller to override this functionality with sendsInit.
                const shouldSendMessage = (!config.dbFailSilently || ownerData) && sendsInit;

                let isNew = false;
                if (!existingInfo) {
                    const n = config.bot.names; // Bot name info

                    // Group not yet registered
                    isNew = true;


                    if (shouldSendMessage) {
                        this.sendMessage(`Hello! I'm ${n.long}${n.short ? `, but you can call me ${n.short}` : ""}. Give me a moment to collect some information about this chat before you use any commands.`, threadId);

                        // Add bot's nickname if available
                        api.changeNickname(n.short, threadId, config.bot.id); // Won't do anything if undefined
                    }

                    api.muteThread(threadId, -1); // Mute chat
                }
                // groupInfo schema definition
                api.getThreadInfo(threadId, (err, data) => {
                    if (data) {
                        let info = existingInfo || {};
                        info.threadId = threadId;
                        info.lastMessage = message;
                        info.name = data.threadName || config.defaultTitle;
                        info.emoji = data.emoji;
                        info.image = data.imageSrc;
                        info.color = data.color ? `#${data.color}` : null;
                        if (data.nicknames && data.nicknames[config.bot.id]) { // Don't add bot to nicknames list
                            delete data.nicknames[config.bot.id];
                        }
                        info.nicknames = data.nicknames || {};
                        info.admins = data.adminIDs ? data.adminIDs.map(u => u["id"]) : [];
                        if (isNew) {
                            // These properties only need to be initialized once
                            info.muted = true;
                            info.playlists = {};
                            info.aliases = {};
                            info.pinned = {};
                            info.events = {};
                            info.mentionGroups = {};
                            info.following = {};
                            info.feeds = {};
                            info.isGroup = data.isGroup;
                            info.richContent = true;
                        }
                        api.getUserInfo(data.participantIDs, (err, userData) => {
                            if (!err) {
                                info.members = {};
                                info.names = {};
                                for (let id in userData) {
                                    if (userData.hasOwnProperty(id) && id != config.bot.id) { // Very important to not add bot to participants list
                                        info.members[userData[id].firstName.toLowerCase()] = id;
                                        info.names[id] = userData[id].firstName;
                                    }
                                }
                                // Set regex to search for member first names and any included aliases
                                const aliases = Object.keys(info.aliases).map(n => {
                                    return info.aliases[n];
                                });
                                const matches = Object.keys(info.members);
                                info.userRegExp = utils.getRegexFromMembers(matches.concat(aliases));
                                // Attempt to give chat a more descriptive name than "Unnamed chat" if possible
                                if (info.name == config.defaultTitle) {
                                    let names = Object.keys(info.names).map(n => {
                                        return info.names[n];
                                    });
                                    info.name = names.join("/") || "Unnamed chat";
                                }

                                if (isNew && shouldSendMessage) {
                                    // Alert owner now that chat name is available
                                    this.sendMessage(`Bot added to new chat: "${info.name}".`, config.owner.id);
                                }
                            }
                            this.setGroupInfo(info, err => {
                                if (!existingInfo && shouldSendMessage) {
                                    this.sendMessage(`All done! Use '${config.trigger} help' to see what I can do.`, threadId);
                                }
                                callback(err, info);
                            });
                        });
                    } else {
                        // Errors are logged here despite being a utility func b/c errors here are critical
                        console.log(new Error(`Thread info not found for ${threadId}`));
                        console.log(err);
                        callback(err);
                    }
                });
            } else {
                console.log(err);
                callback(err);
            }
        });
    });
};

// Gets stored information about a group
exports.getGroupInfo = (threadId, callback) => {
    this.getGroupData((err, groupData) => {
        if (err) {
            // Error retrieving data
            callback(err);
        } else {
            // No errors and groups are retrieved
            const group = groupData[threadId];
            if (group) {
                callback(null, group);
            } else {
                // No errors, but group not in list; pass null for both
                callback();
            }
        }
    });
};

// Wrapper function for retrieving all groups from memory
exports.getGroupData = callback => {
    mem.get(`groups`, (err, groups) => {
        if (err) {
            // Error retrieving data
            callback(err);
        } else {
            // No errors and groups are retrieved
            const groupData = (groups && groups.length) ? JSON.parse(groups) : {};
            callback(null, groupData);
        }
    });
};

// Updates stored information about a group
exports.setGroupInfo = (info, callback = () => { }) => {
    this.getGroupData((err, groupData) => {
        if (!err) {
            groupData[info.threadId] = info;
            mem.set(`groups`, JSON.stringify(groupData), {}, (err, success) => {
                callback(success ? null : err);
            });
        }
    });
};

// Wrapper for updating a group property
exports.setGroupProperty = (key, value, info, callback = () => { }) => {
    if (!lockedThreads.includes(info.threadId)) {
        info[key] = value;
        lockedThreads.push(info.threadId);
        setTimeout(() => {
            this.setGroupInfo(info, err => {
                lockedThreads = lockedThreads.filter(t => t != info.threadId);
                callback(err);
            });
        }, 1500);
    }
    // NOTE: temporary arbitrary delay until I can figure out how to prevent
    // the background update calls from overwriting these property changes (async/await?)
};

// Searches help for a given entry and returns an object containing the entry
// and its key if found
exports.getHelpEntry = input => {
    const co = commands.commands;
    for (let c in co) {
        if (co.hasOwnProperty(c)) {
            const names = co[c].display_names;
            for (let i = 0; i < names.length; i++) {
                if (input == names[i]) {
                    return {
                        "key": c,
                        "entry": co[c]
                    };
                }
            }
        }
    }
};
// Searches help for a given category and returns an object containing the
// entry and its key if found
exports.getHelpCategory = input => {
    const cat = commands.categories;
    for (let c in cat) {
        if (cat.hasOwnProperty(c)) {
            const catEntry = cat[c];
            if (catEntry.display_name && input == cat[c].display_name.toLowerCase()) {
                return catEntry;
            }
        }
    }
};

// Wrapper for sending an emoji to the group quickly
exports.sendGroupEmoji = (groupInfo, size = "medium") => {
    this.sendEmoji(groupInfo.emoji || config.defaultEmoji, groupInfo.threadId, size);
};

// Specify size as a string: "small", "medium", or "large"
exports.sendEmoji = (emoji, threadId, size = "small") => {
    this.sendMessage({
        "emoji": emoji,
        "emojiSize": size
    }, threadId);
};


// Sends file(s) where each filename is a relative path to the file from root
// Accepts a string filename or an array of filename strings, and optional
// message body parameter, callback, and a message ID (for replying)
exports.sendFile = (filenames, threadId, message = "", callback = () => { }, replyId = null) => {
    if (typeof (filenames) == "string") { // If only one is passed
        filenames = [filenames];
    }
    for (let i = 0; i < filenames.length; i++) {
        filenames[i] = fs.createReadStream(`${__dirname}/${filenames[i]}`);
    }
    const msg = {
        "body": message,
        "attachment": filenames
    };
    this.sendMessage(msg, threadId, callback, replyId);
};

// Returns a string of the current time in EST
exports.getTimeString = () => {
    const d = new Date();
    return d.toLocaleTimeString('en-US', { 'timeZone': config.timeZone });
};

// Wrapper for formatted date at current time
exports.getDateString = () => {
    return (new Date()).toLocaleDateString();
};

// Given a date, return a nicely-formatted string (with time)
exports.getPrettyDateString = (date, withTime = true) => {
    const options = {
        'weekday': 'long',
        'year': 'numeric',
        'month': 'long',
        'day': 'numeric'
    };

    if (withTime) {
        options['hour'] = 'numeric';
        options['minute'] = 'numeric';
        options['timeZone'] = config.timeZone;
        options['hour12'] = true;
    }

    return date.toLocaleString('en-US', options);
};

/*
Sends a file to the group from a URL by temporarily downloading it
and re-uploading it as part of the message (useful for images on Facebook
domains, which are blocked by Facebook for URL auto-detection)
Accepts url, optional file download location/name, optional message, and optional
threadId parameters
*/
exports.sendFilesFromUrl = (urls, threadId, message = "") => {
    if (typeof (urls) == "string") { // If only one is passed
        urls = [urls];
    }

    const downloaded = [];
    download(urls, () => {
        if (downloaded.length == urls.length) {
            // All downloads complete

            // If download errored, null value in list
            const valid = downloaded.filter(download => download);
            // Sort according to original order
            const ordered = valid.sort((a, b) => urls.indexOf(a.url) - urls.indexOf(b.url));

            const attachments = ordered.map(download => fs.createReadStream(download.path));
            this.sendMessage({
                "body": message,
                "attachment": attachments
            }, threadId, () => {
                downloaded.forEach(download => fs.unlink(download.path, () => { }));
            });
        }
    });

    function download(urls, cb) {
        urls.forEach(url => {
            const shortName = encodeURIComponent(url).slice(0, config.MAXPATH);
            const path = `${__dirname}/../media/${shortName}.jpg`;
            request(url).pipe(fs.createWriteStream(path)).on('close', err => {
                downloaded.push(err ? null : { "url": url, "path": path });
                cb();
            });
        });
    }
};

// Gets a random hex color from the list of supported values (now that Facebook has restricted it to
// a certain subset of them; more specifically, the lowercase hex values of colors in the palette UI)
exports.getRandomColor = (api = gapi) => {
    const colors = Object.keys(api.threadColors).map(n => api.threadColors[n]);
    return colors[Math.floor(Math.random() * colors.length)];
};

// Restarts the bot (requires deploying to Heroku – see config)
// Includes optional callback
exports.restart = (callback = () => { }) => {
    request.delete({
        "url": `https://api.heroku.com/apps/${config.appName}/dynos/web`,
        "headers": {
            "Accept": "application/vnd.heroku+json; version=3",
            "Authorization": `Bearer ${credentials.TOKEN}` // Requires Heroku OAuth token for authorization
        }
    });
    callback();
};

// Constructs a string of artists when passed a track object from the Spotify API
exports.getArtists = track => {
    const artists = track.artists;
    let artistStr = "";
    for (let i = 0; i < artists.length; i++) {
        artistStr += artists[i].name;
        if (i != artists.length - 1) {
            artistStr += "/";
        }
    }
    return artistStr;
};

// Logs into Spotify API & sets the appropriate credentials
exports.loginSpotify = (spotify, callback = () => { }) => {
    spotify.clientCredentialsGrant({}, (err, data) => {
        if (!err) {
            spotify.setAccessToken(data.body.access_token);
            callback();
        } else {
            callback(err);
        }
    });
};

// Sends the contents of a given file (works best with text files)
exports.sendContentsOfFile = (file, threadId) => {
    fs.readFile(`${__dirname}/${file}`, "utf-8", (err, text) => {
        if (!err) {
            this.sendMessage(text, threadId);
        } else {
            console.log(err);
        }
    });
};

// Functions for getting/setting user scores (doesn't save much in terms of
// code/DRY, but wraps the functions so that it's easy to change how they're stored)
exports.setScore = (userId, score, callback) => {
    mem.set(`userscore_${userId}`, score, {}, callback);
};

exports.getScore = (userId, callback) => {
    mem.get(`userscore_${userId}`, callback);
};

// Updates the user's score either by (if isAdd) increasing or (otherwise) decreasing
// the user's score by the default value set in config, or 5 points if not set
// Returns a callback with error, success, and a value equal to the user's new score
exports.updateScore = (isAdd, userId, callback) => {
    this.getScore(userId, (err, val) => {
        if (err) {
            callback(err);
        }
        // Convert from buffer & grab current score (set 0 if it doesn't yet exist)
        const score = val ? parseInt(val.toString()) : 0;

        // Can be easily customized to accept a score parameter if so desired
        const points = config.votePoints || 5; // Default to five points
        const newScore = isAdd ? (score + points) : (score - points);
        this.setScore(userId, `${newScore}`, (err, success) => {
            callback(err, success, newScore);
        });
    });
};

exports.getAllScores = (groupInfo, callback = () => { }) => {
    const members = groupInfo.names;
    let results = [];
    const now = (new Date()).getTime();
    let current = now;

    function updateResults(value) {
        results.push(value);
        const success = (results.length == Object.keys(members).length);

        current = (new Date()).getTime();
        if (success || (current - now) >= config.asyncTimeout) {
            callback(success, results);
        }
    }

    for (let m in members) {
        if (members.hasOwnProperty(m)) {
            this.getScore(m, (err, val) => {
                updateResults({
                    "name": members[m],
                    "score": parseInt(val) || "0"
                });
            });
        }
    }
};

// Sets group image to image found at given URL
// Accepts url, threadId, and optional error message parameter to be displayed if changing the group image fails
exports.setGroupImageFromUrl = (url, threadId, errMsg = "Photo couldn't download properly", api = gapi) => {
    // Download file and pass to chat API (see config for details)
    const path = `../media/${encodeURIComponent(url).slice(0, config.MAXPATH)}.png`;
    const fullpath = `${__dirname}/${path}`;
    request(url).pipe(fs.createWriteStream(fullpath)).on('close', err => {
        if (!err) {
            api.changeGroupImage(fs.createReadStream(fullpath), threadId, err => {
                fs.unlink(fullpath);
                if (err) {
                    this.sendError(errMsg, threadId);
                }
            });
        } else {
            this.sendError("Image not found at that URL");
        }
    });
};

// Processes an image or images by sifting between URL input and attachments and downloading
// Returns a JIMP image object and filename where the image was stored
exports.processImage = (url, attachments, info, callback = () => { }) => {
    const threadId = info.threadId;
    const root = `../media`;
    if (url) { // URL passed
        const filename = `${root}/${encodeURIComponent(url)}.png`;
        const path = `${__dirname}/${filename}`;
        jimp.read(url, (err, file) => {
            if (err) {
                this.sendError("Unable to retrieve image from that URL", threadId);
            } else {
                callback(file, filename, path);
            }
        });
    } else if (attachments || (info.lastMessage && info.lastMessage.attachments.length > 0)) {
        const attaches = attachments || info.lastMessage.attachments; // Either current message or last
        for (let i = 0; i < attaches.length; i++) {
            if (attaches[i].type == "photo") {
                const filename = `${root}/${attaches[i].name}.png`;
                const path = `${__dirname}/${filename}`;
                jimp.read(attaches[i].largePreviewUrl, (err, file) => {
                    if (err) {
                        this.sendError("Invalid file", threadId);
                    } else {
                        callback(file, filename, path);
                    }
                });
            } else {
                this.sendError(`Sorry, but ${attaches[i].name} is not an acceptable file type`, threadId);
            }
        }
    } else {
        this.sendError("You must provide either a URL or a valid image attachment", threadId);
    }
};

// Gets dimensions of text for centering it on an image
exports.measureText = (font, text) => {
    let x = 0;
    let y = 0;
    for (let i = 0; i < text.length; i++) {
        if (font.chars[text[i]]) {
            x += font.chars[text[i]].xoffset +
                (font.kernings[text[i]] && font.kernings[text[i]][text[i + 1]] ? font.kernings[text[i]][text[i + 1]] : 0) +
                (font.chars[text[i]].xadvance || 0);
            const width = font.chars[text[i]].yoffset;
            if (width > y) {
                y = width;
            }
        }
    }
    return [x, y];
};

// Sends a message to all of the chats that the bot is currenty in (use sparingly)
exports.sendToAll = msg => {
    this.getGroupData((err, groupData) => {
        if (!err && groupData) {
            for (let g in groupData) {
                if (groupData[g].isGroup) {
                    this.sendMessage(msg, g);
                }
            }
        }
    });
};

// Sends all files in a directory (relative to root)
exports.sendFilesFromDir = (dir, threadId) => {
    fs.readdir(`${__dirname}/${dir}`, (err, filenames) => {
        if (!err) {
            this.sendFile(filenames.map(f => {
                return `${dir}/${f}`;
            }), threadId);
        } else {
            console.log(err);
        }
    });
};

/*
Retrieve usage stats for a command from memory
Takes a command string, a fullData flag, and optional callback
The callback passes an object containing the count for that command,
the total number of commands and, if the fullData flag is true, a log of
all the command's uses with an "at" timestamp and the "user" of the invoker
for each command as an array of dictionaries with these properties
*/
exports.getStats = (command, fullData, callback) => {
    mem.get(`usage_total_${command}`, (err, count) => {
        mem.get(`usage_total_all`, (err, total) => {
            if (!err) {
                let stats = {
                    "count": (parseInt(count) || 0),
                    "total": (parseInt(total) || 0)
                };
                if (fullData) {
                    mem.get(`usage_record_${command}`, (err, record) => {
                        if (!err) {
                            stats.record = (JSON.parse(record) || []);
                            callback(null, stats);
                        } else {
                            callback(err);
                        }
                    });
                } else {
                    callback(null, stats);
                }
            } else {
                callback(err);
            }
        });
    });
};

// Updates the usage stats for a command in memory
// Takes a command string and a stats object with `count`, `total`, and
// `record` fields (i.e. the output from `getStats()` with the `fullData`
// flag set to true)
exports.setStats = (command, stats, callback = () => { }) => {
    mem.set(`usage_total_all`, `${stats.total}`, {}, t_err => {
        mem.set(`usage_total_${command}`, `${stats.count}`, {}, c_err => {
            mem.set(`usage_record_${command}`, `${JSON.stringify(stats.record)}`, {}, u_err => {
                callback(t_err, c_err, u_err);
            });
        });
    });
};

exports.getAllStats = callback => {
    const co = commands.commands;
    const names = Object.keys(co).filter(c => {
        return (co[c].display_names.length > 0); // Don't show secret commands
    });
    let results = [];
    const now = (new Date()).getTime();
    let current = now;

    function updateResults(value) {
        results.push(value);

        const success = (results.length == names.length);
        current = (new Date()).getTime();

        if (success || (current - now) >= config.asyncTimeout) {
            callback(success, results);
        }
    }

    for (let i = 0; i < names.length; i++) {
        let key = names[i];
        this.getStats(key, true, (err, stats) => {
            if (!err) {
                updateResults({
                    "key": key,
                    "pretty_name": co[key].pretty_name,
                    "stats": stats
                });
            }
        });
    }
};

// Updates the usage statistics for a particular command (takes command name and
// sending user's ID)
exports.updateStats = (command, senderID, callback = () => { }) => {
    this.getStats(command, true, (err, stats) => {
        if (!err) {
            stats.count++;
            stats.total++;
            stats.record.push({
                "at": (new Date()).toISOString(),
                "user": senderID
            });
            this.setStats(command, stats, callback);
        } else {
            callback(err);
        }
    });
};

// Clears the stats to start over
exports.resetStats = () => {
    const co = commands.commands;
    for (let c in co) {
        if (co.hasOwnProperty(c)) {
            this.setStats(c, {
                "count": 0,
                "total": 0,
                "record": []
            });
        }
    }
};

// Outputs the statistics data for debugging/analysis
exports.logStats = () => {
    const co = commands.commands;
    for (let c in co) {
        if (co.hasOwnProperty(c)) {
            this.getStats(c, true, (err, stats) => {
                console.log(`${c}: ${stats.count}/${stats.total}`);
                for (let i = 0; i < stats.record.length; i++) {
                    console.log(stats.record[i]);
                }
            });
        }
    }
};

// Returns the passed list of record objects narrowed to those within the
// specified time period
exports.narrowedWithinTime = (record, marker) => {
    return record.filter(val => {
        return (new Date(val.at) > marker);
    });
};

// Gets the most active user of a given command using its passed records
exports.getHighestUser = record => {
    let usageMap = {}; // Map userIDs to number of invocations
    for (let i = 0; i < record.length; i++) {
        const id = record[i].user;
        if (!usageMap[id]) {
            usageMap[id] = 0;
        }
        usageMap[id]++;
    }

    let maxNum = 0;
    let maxUser;
    for (let u in usageMap) {
        if (usageMap.hasOwnProperty(u)) {
            if (usageMap[u] > maxNum) {
                maxNum = usageMap[u];
                maxUser = u;
            }
        }
    }
    return maxUser;
};
/* Given a stats object, it adds a `usage` field containing the following:
  `perc`: Percentage of total usage
  `day`: # of times used in the last day
  `month`: # of times used in the last month
*/
exports.getComputedStats = stats => {
    const usage = {};
    usage.perc = (((stats.count * 1.0) / stats.total) * 100) || 0;

    // Time scopes
    const dayMarker = new Date();
    dayMarker.setDate(dayMarker.getDate() - 1); // Last day
    const monthMarker = new Date();
    monthMarker.setMonth(monthMarker.getMonth() - 1); // Last month

    const dateRecords = this.narrowedWithinTime(stats.record, dayMarker); // All command calls within the last day
    const monthRecords = this.narrowedWithinTime(stats.record, monthMarker); // All command calls within the last month

    usage.day = dateRecords ? dateRecords.length : 0;
    usage.month = monthRecords ? monthRecords.length : 0;

    stats.usage = usage;
    return stats;
};

// Allows the bot to react to a message given a message ID (from listen)
// Possible reactions: 'love', 'funny', 'wow', 'sad', 'angry', 'like', and 'dislike'
exports.reactToMessage = (messageId, reaction = "like", api = gapi) => {
    const reactions = {
        "love": "😍",
        "funny": "😆",
        "wow": "😮",
        "sad": "😢",
        "angry": "😠",
        "like": "👍",
        "dislike": "👎"
    };
    api.setMessageReaction(reactions[reaction], messageId);
};

/*
Parses a given message and makes the necessary shortcut replacements, which currently include
changing "me" to the current user and any aliases to the corresponding user based on the current
group.

Returns the parsed and replaced string.
*/
exports.parseNameReplacements = (message, fromUserId, groupInfo) => {
    let fixes = message;
    // "Me" -> calling user
    fixes = fixes.replace(/(^| )me(?:[^A-z0-9]|$)/i, "$1" + groupInfo.names[fromUserId].toLowerCase());
    // {alias} -> corresponding user
    for (let a in groupInfo.aliases) {
        if (groupInfo.aliases.hasOwnProperty(a)) {
            fixes = fixes.replace(new RegExp(`(^| )${groupInfo.aliases[a]}(?:[^A-z0-9]|$)`, "i"), "$1" + a);
        }
    }
    return fixes;
};

// Deletes a pinned message from the chat
exports.deletePin = (pin, groupInfo, threadId) => {
    if (pin && groupInfo.pinned[pin]) {
        delete groupInfo.pinned[pin];
        this.setGroupProperty("pinned", groupInfo.pinned, groupInfo, err => {
            if (!err) {
                this.sendMessage(`Successfully deleted "${pin}".`, threadId);
            } else {
                this.sendError(`Unable to delete "${pin}".`, threadId);
            }
        });
    } else {
        this.sendError("Please specify an existing pin to delete.", threadId);
    }
};

// Renames a pinned message from the chat
exports.renamePin = (pinArgs, groupInfo, threadId) => {
    const args = pinArgs ? pinArgs.split(" ") : [];
    if (args.length != 2) {
        this.sendError("Please specify a valid pin to rename and new name.", threadId);
        return;
    }

    const [oldPin, newPin] = args;
    if (oldPin && newPin && groupInfo.pinned[oldPin]) {
        if (groupInfo.pinned[newPin]) {
            this.sendMessage(`Cannot rename "${oldPin}" to "${newPin}" as it would override an existing pin.`, threadId);
        } else {
            groupInfo.pinned[newPin] = groupInfo.pinned[oldPin];
            delete groupInfo.pinned[oldPin];
            this.setGroupProperty("pinned", groupInfo.pinned, groupInfo, err => {
                if (!err) {
                    this.sendMessage(`Successfully renamed "${oldPin}" to "${newPin}".`, threadId);
                } else {
                    this.sendError(`Unable to rename "${oldPin}".`, threadId);
                }
            });
        }
    } else {
        this.sendError("Please specify an existing pin to rename.", threadId);
    }
};

// Adds a pinned message to the chat
exports.addPin = (msg, pinName, date, sender, groupInfo) => {
    const pin = {
        "msg": msg,
        "sender": sender,
        "date": date
    };
    const oldPin = groupInfo.pinned[pinName];

    // Add pin to db
    groupInfo.pinned[pinName] = pin;
    this.setGroupProperty("pinned", groupInfo.pinned, groupInfo, err => {
        if (!err) {
            const pinMsg = `Pinned new message for pin "${pinName}" to the chat.${oldPin ? ` Previous message:\n\n"${oldPin.msg}"` : ""}`;
            this.sendMessage(pinMsg, groupInfo.threadId);
        } else {
            this.sendError("Unable to pin message to the chat.", groupInfo.threadId);
        }
    });
};

exports.stringifyPin = pin => {
    const dateStr = this.getPrettyDateString(new Date(pin.date), false);
    return `"${pin.msg}" – ${pin.sender} on ${dateStr}`;
};

exports.appendPin = (content, existing, date, sender, groupInfo) => {
    const pin = groupInfo.pinned[existing];
    if (pin) {
        // Append new content to pin and update metadata
        groupInfo.pinned[existing] = {
            "msg": `${pin.msg}\n${content}`,
            "sender": sender,
            "date": date
        };
        // Commit changes to db
        this.setGroupProperty("pinned", groupInfo.pinned, groupInfo, err => {
            if (!err) {
                this.sendMessage(`Updated pin "${existing}".`, groupInfo.threadId);
            } else {
                this.sendError("Unable to append that pin; please try again.", groupInfo.threadId);
            }
        });
    } else {
        this.sendError(`"${existing}" doesn't seem to exist. Please specify a valid existing pin to append to.`, groupInfo.threadId);
    }
};

exports.getEventTimeMetadata = (date) => {
    const now = new Date();

    const eventTime = date.getTime();
    const prettyTime = this.getPrettyDateString(date);

    let earlyReminderTime = new Date(date.getTime() - (config.reminderTime * 60000));
    if (earlyReminderTime <= now) {
        // Too late to give an early reminder
        earlyReminderTime = null;
    }

    return {
        eventTime,
        prettyTime,
        earlyReminderTime
    };
};

// Adds an event to the chat
exports.addEvent = (title, at, sender, groupInfo, threadId) => {
    const keyTitle = title.trim().toLowerCase();
    if (groupInfo.events[keyTitle]) {
        this.sendError(`An event already exists called "${title}". Please delete it if you wish to make a new one.`, threadId);
        return;
    }

    const now = new Date();
    const timestamp = chrono.parseDate(at, now, { 'forwardDate': true });
    if (timestamp) {
        const { eventTime, prettyTime, earlyReminderTime } = this.getEventTimeMetadata(timestamp);
        let msg = `
Event "${title}" created for ${prettyTime}. To RSVP, upvote or downvote this message. \
To delete this event, use "${config.trigger} event delete ${title}" (only the owner can do this). \
\n\nI'll remind you at the time of the event`;

        if (!earlyReminderTime) {
            // Too late to give an early reminder
            msg += ".";
        } else {
            msg += `, and ${config.reminderTime} minutes early.`;
        }

        this.sendMessage(msg, threadId, (err, mid) => {
            // Grab mid from sent message to monitor messages for RSVPs
            if (!err) {
                const event = {
                    "type": "event",
                    "title": title,
                    "key_title": keyTitle,
                    "timestamp": eventTime,
                    "owner": sender,
                    "threadId": threadId,
                    "pretty_time": prettyTime,
                    "remind_time": earlyReminderTime,
                    "mid": mid.messageID,
                    "going": [],
                    "not_going": [],
                    "repeats_every": 0
                };

                groupInfo.events[keyTitle] = event;
                this.setGroupProperty("events", groupInfo.events, groupInfo);
            }
        });
    } else {
        this.sendError("Couldn't understand that event's time.", threadId);
    }
};

// Delete an event from the chat
exports.deleteEvent = (rawTitle, sender, groupInfo, threadId, sendConfirmation = true) => {
    const keyTitle = rawTitle.trim().toLowerCase();
    if (groupInfo.events[keyTitle]) {
        const event = groupInfo.events[keyTitle];
        if (event.owner == sender) {
            delete groupInfo.events[keyTitle];
            this.setGroupProperty("events", groupInfo.events, groupInfo, err => {
                if (err) {
                    this.sendError("Sorry, couldn't delete the event.", threadId);
                } else if (sendConfirmation) {
                    this.sendMessage(`Successfully deleted "${event.title}".`, threadId);
                }
            });
        } else {
            this.sendError(`Sorry, you are not the owner of this event.`, threadId);
        }
    } else {
        this.sendError(`Couldn't find an event called ${rawTitle}.`, threadId);
    }
};

// List event(s) in the chat
exports.listEvents = (rawTitle, groupInfo, threadId) => {
    if (rawTitle) {
        // Details for specific event
        const keyTitle = rawTitle.trim().toLowerCase();
        const event = groupInfo.events[keyTitle];
        if (event) {
            const goList = event.going.map(u => u.name);
            const notGoList = event.not_going.map(u => u.name);
            let msg = `*${event.title}*\n_${event.pretty_time}_`;

            if (event.repeats_every) {
                const interval = nameForInterval(event.repeats_every);
                if (interval) {
                    msg += ` (repeats ${interval})`;
                }
            }
            msg += '\n';

            if (goList.length > 0) {
                msg += `Going: ${goList.join('/')}\n`;
            }
            if (notGoList.length > 0) {
                msg += `Not going: ${notGoList.join('/')}\n`;
            }
            msg += "\nTo RSVP, upvote or downvote the original event message linked above.";

            this.sendMessage(msg, threadId, () => { }, event.mid);
        } else {
            this.sendError(`Couldn't find an event called ${rawTitle}.`, threadId);
        }
    } else {
        // Overview
        const events = Object.keys(groupInfo.events).reduce((evts, e) => {
            const event = groupInfo.events[e];
            if (event.type == "event") {
                evts[e] = groupInfo.events[e];
            }
            return evts;
        }, {});
        if (Object.keys(events).length > 0) {
            let msg = "Events for this group: \n";
            for (const e in events) {
                if (events.hasOwnProperty(e)) {
                    const event = events[e];

                    msg += `\n– ${event.title}`;
                    if (event.going.length > 0) {
                        msg += ` (${event.going.length} going)`;
                    }
                    msg += `: ${event.pretty_time}`;
                }
            }
            this.sendMessage(msg, threadId);
        } else {
            this.sendMessage("There are no events set in this chat.", threadId);
        }
    }
};

exports.prettyList = (list, separator = "and") => {
    let total = list.length;
    let msg = '';

    list.forEach((item, i) => {
        if (i < total - 1 || total == 1) {
            msg += item;
            if (total > 2) {
                msg += ", ";
            } else {
                msg += " ";
            }
        } else {
            msg += `${separator} ${item}`;
        }
    });

    return msg;
};

const DAY = 60 * 60 * 24 * 1000; // Day in milliseconds
const intervalLengths = {
    "daily": DAY,
    "weekly": 7 * DAY,
    "monthly": 30 * DAY,
    "yearly": 365 * DAY,
    "never": null
};
const acceptedIntervals = Object.keys(intervalLengths);
const nameForInterval = (interval) => {
    for (let i = 0; i < acceptedIntervals.length; i++) {
        const name = acceptedIntervals[i];
        if (intervalLengths[name] === interval) {
            return name;
        }
    }
    return null;
};

exports.repeatEvent = (rawInterval, eventID, groupInfo, threadId) => {
    const interval = rawInterval.toLowerCase().trim();
    const length = intervalLengths[interval];
    if (length === undefined) {
        this.sendError(`Unrecognized interval "${rawInterval}"; try ${this.prettyList(acceptedIntervals, "or")}.`, threadId);
        return;
    }

    const eventName = Object.keys(groupInfo.events).find(name => groupInfo.events[name].mid === eventID);
    if (!eventName) {
        this.sendError("Couldn't find an event associated with that message. Try finding the original event confirmation.", threadId);
        return;
    }

    groupInfo.events[eventName].repeats_every = length;
    this.setGroupPropertyAndHandleErrors("events", groupInfo,
        "Failed to update that event; please try again.",
        `Successfully updated the event; it will now repeat ${interval}. ${length ? `To stop repeating, use "${config.trigger} event repeat never".` : ''}`
    );
};

// Add a reminder to the chat
exports.addReminder = (userId, reminderStr, timeStr, groupInfo, threadId, messageId) => {
    gapi.getUserInfo(userId, (err, uinfo) => {
        if (!err && uinfo[userId]) {
            const timestamp = chrono.parseDate(timeStr, new Date(), { 'forwardDate': true });
            if (timestamp) {
                const time = timestamp.getTime();
                const prettyTime = this.getPrettyDateString(timestamp);
                const keyTitle = `r${userId}_${threadId}_${time}`; // Attempt to create a unique key
                const userName = uinfo[userId].firstName;

                const reminder = {
                    "type": "reminder",
                    "reminder": reminderStr,
                    "key_title": keyTitle,
                    "timestamp": time,
                    "owner": userId,
                    "owner_name": userName,
                    "threadId": threadId,
                    "replyId": messageId
                };

                groupInfo.events[keyTitle] = reminder;
                this.setGroupProperty("events", groupInfo.events, groupInfo, err => {
                    if (!err) {
                        this.sendMessage(`Created a reminder for ${groupInfo.names[userId]} for ${prettyTime}.`, threadId);
                    } else {
                        this.sendMessage("Unable to create the reminder. Please try again.", threadId);
                    }
                });
            } else {
                this.sendError("Couldn't understand that reminder's time.", threadId);
            }
        } else {
            this.sendError("Couldn't get that user's info.", threadId);
        }
    });
};

// Get information about current status of COVID-19
exports.getCovidData = (rawType, rawQuery, threadId) => {
    function buildMessage(data, useDetailedData, historical) {
        let msg = `Active cases: ${data.active.toLocaleString()}\nNew cases today: ${data.todayCases.toLocaleString()}`;
        if (useDetailedData) {
            const [yesterdayCases] = getYesterdayNumbers(historical);
            msg += `${yesterdayCases}\nCritical cases: ${data.critical.toLocaleString()}\nCurrent cases per million: ${data.casesPerOneMillion.toLocaleString()}`;
        }

        msg += `\nTotal cases: ${data.cases.toLocaleString()}\n\nTotal tests: ${data.tests.toLocaleString()}`;

        if (useDetailedData) {
            msg += `\nTests per million: ${data.testsPerOneMillion.toLocaleString()}`;
        }

        msg += `\n\nDeaths today: ${data.todayDeaths.toLocaleString()}`;

        if (useDetailedData) {
            const [, yesterdayDeaths] = getYesterdayNumbers(historical);
            msg += `${yesterdayDeaths}`;
        }

        msg += `\nTotal deaths: ${data.deaths.toLocaleString()}`;

        if (useDetailedData) {
            msg += `\nDeaths per million: ${data.deathsPerOneMillion ? data.deathsPerOneMillion.toLocaleString() : 0}`;
        }

        const inferRecov = (data.cases - data.active - data.deaths);
        const recovered = data.recovered ? `Recovered: ${data.recovered.toLocaleString()}` : `${inferRecov > -1 ? `Recovered: ${inferRecov.toLocaleString()} (inferred)` : ""}`;
        msg += `\n${recovered}`;

        if (useDetailedData) {
            const updated = exports.getPrettyDateString(new Date(data.updated));
            msg += `\n\n_Last updated: ${updated}_`;
        }

        return msg;
    }

    function getDateKey(date) {
        return `${date.getMonth() + 1}/${date.getDate()}/${`${date.getFullYear()}`.slice(-2)}`;
    }

    function getYesterdayNumbers(hist) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const yKey = getDateKey(yesterday);
        const twoKey = getDateKey(twoDaysAgo);

        const yCases = hist.cases[yKey] ? hist.cases[yKey] : -1;
        const twoCases = hist.cases[twoKey] ? hist.cases[twoKey] : -1;

        const yDeaths = hist.deaths[yKey] ? hist.deaths[yKey] : -1;
        const twoDeaths = hist.deaths[twoKey] ? hist.deaths[twoKey] : -1;

        const yCasesStr = yCases >= 0 ? `\nNew cases yesterday: ${(yCases - twoCases).toLocaleString()}` : "";
        const yDeathsStr = yDeaths >= 0 ? `\nDeaths yesterday: ${(yDeaths - twoDeaths).toLocaleString()}` : "";

        return [yCasesStr, yDeathsStr];
    }

    function reportData(region, deaths, recovered) {
        let msg = "";
        const dates = Object.keys(region).map(key => new Date(key)).filter(date => date != "Invalid Date").sort((a, b) => b - a);
        if (dates.length > 0) {
            const recent = dates[0];
            const recentKey = `${recent.getMonth() + 1}/${recent.getDate()}/${`${recent.getFullYear()}`.slice(-2)}`;
            const confirmed = region[recentKey];
            if (confirmed > 0) {
                const regDeaths = deaths.find(reg => reg.country_Region == region.country_Region
                    && reg.province_State == region.province_State);
                const regRec = recovered.find(reg => reg.country_Region == region.country_Region
                    && reg.province_State == region.province_State);
                const name = region.province_State || region.country_Region;
                msg += `\n${name}: ${confirmed} confirmed, ${regDeaths[recentKey]} dead, ${regRec[recentKey]} recovered`;
            }
        }
        return msg;
    }

    function getVaccString(vhist) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const yKey = getDateKey(yesterday);
        const twoKey = getDateKey(twoDaysAgo);

        const yVacc = vhist[yKey] ? vhist[yKey] : -1;
        const twoVacc = vhist[twoKey] ? vhist[twoKey] : -1;

        const yVaccStr = yVacc >= 0 ? `\nVaccinations yesterday: ${(yVacc - twoVacc).toLocaleString()}` : "";

        return yVaccStr > 0 ? `${yVaccStr}\n\n` : "";
    }

    function buildTodayStr(cur, hist, vhist) {
        const [yCasesStr, yDeathsStr] = getYesterdayNumbers(hist);
        const vaccString = getVaccString(vhist);

        let msg = `New cases today: ${cur.todayCases.toLocaleString()}${yCasesStr}\nTotal cases: ${cur.cases.toLocaleString()}\n\n`;
        msg += `Deaths today: ${cur.todayDeaths.toLocaleString()}${yDeathsStr}\nTotal deaths: ${cur.deaths.toLocaleString()}\n\n`;
        msg += vaccString;
        msg += `Total recovered: ${cur.recovered.toLocaleString()}`;

        return msg;
    }

    if (!rawType) {
        // Display total stats
        request.get("https://corona.lmao.ninja/v2/all", {}, (err, _, all) => {
            request.get(`https://corona.lmao.ninja/v2/historical/all`, {}, (herr, hres, hdata) => {
                if (herr || hres.statusCode != 200) {
                    hdata = { "cases": {}, "deaths": {} };
                } else {
                    hdata = JSON.parse(hdata);
                }
                if (!err) {
                    const data = JSON.parse(all);
                    const msg = `*Worldwide data*\n\nAffected countries: ${data.affectedCountries}\n${buildMessage(data, true, hdata)}`;
                    this.sendMessage(msg, threadId);
                } else {
                    this.sendError("Couldn't retrieve data.", threadId);
                }
            });
        });
    } else {
        const type = rawType.trim().toLowerCase();
        const query = rawQuery.trim().toLowerCase();
        if (type == "country") {
            request.get(`https://corona.lmao.ninja/v2/countries/${encodeURIComponent(query)}`, {}, (err, res, info) => {
                request.get(`https://corona.lmao.ninja/v2/historical/${query}`, {}, (herr, hres, hdata) => {
                    if (herr || hres.statusCode != 200) {
                        hdata = { "timeline": { "cases": {}, "deaths": {} } };
                    } else {
                        hdata = JSON.parse(hdata);
                    }

                    if (!err && res.statusCode == 200 && info != "Country not found") {
                        const data = JSON.parse(info);
                        this.sendMessage(`*${data.country}*\n\n${buildMessage(data, true, hdata["timeline"])}`, threadId);
                    } else {
                        request.get(`https://corona.lmao.ninja/v2/countries/`, {}, (err, res, info) => {
                            if (!err && res.statusCode == 200) {
                                const data = JSON.parse(info);
                                const countries = data.map(country => country.country).sort().join(", ");
                                this.sendMessage(`Couldn't find data for ${rawQuery}. Here are the countries I have available:\n\n${countries}`, threadId);
                            } else {
                                this.sendError("Couldn't retrieve data.", threadId);
                            }
                        });
                    }
                });
            });
        } else if (type == "state") {
            request.get(`https://corona.lmao.ninja/v2/states/`, {}, (err, res, info) => {
                if (!err && res.statusCode == 200) {
                    const data = JSON.parse(info);
                    const state = data.find(state => state.state.toLowerCase() == query);

                    if (state) {
                        this.sendMessage(`*${state.state}*\n\n${buildMessage(state, false)}`, threadId);
                    } else {
                        const states = data.map(state => state.state).sort().join(", ");
                        this.sendMessage(`Couldn't find data for ${rawQuery}. Here are the states I have available:\n\n${states}`, threadId);
                    }
                } else {
                    this.sendError("Couldn't retrieve data.", threadId);
                }
            });
        } else if (type == "province") {
            request.get("https://api.opencovid19.com/v1/confirmed", null, (cerr, cres, casesData) => {
                request.get("https://api.opencovid19.com/v1/deaths", null, (derr, dres, deathsData) => {
                    request.get("https://api.opencovid19.com/v1/recovered", null, (rerr, rres, recoveredData) => {
                        if (!cerr && cres.statusCode == 200 && !derr && dres.statusCode == 200 && !rerr && rres.statusCode == 200) {
                            const cases = JSON.parse(casesData);
                            const deaths = JSON.parse(deathsData);
                            const recovered = JSON.parse(recoveredData);

                            const province = cases.find(region => region.province_State && region.province_State.toLowerCase() == query);
                            if (province) {
                                this.sendMessage(reportData(province, deaths, recovered), threadId);
                            } else {
                                this.sendError(`There is no data currently being reported for ${rawQuery}.`, threadId);
                            }
                        } else {
                            this.sendError("Couldn't retrieve data.", threadId);
                        }
                    });
                });
            });
        } else if (type == "top") {
            const n = parseInt(rawQuery);
            const LIMIT = 20;
            if (n) {
                if (n <= LIMIT) {
                    request.get(`https://corona.lmao.ninja/v2/countries/`, {}, (err, res, info) => {
                        if (!err && res.statusCode == 200) {
                            const data = JSON.parse(info);
                            const sorted = data.sort((a, b) => b.cases - a.cases);
                            const top = sorted.slice(0, n);

                            const msg = top.map((c, i) =>
                                `${i + 1}) ${c.country}: ${c.cases.toLocaleString()} cases/${c.deaths.toLocaleString()} deaths/${c.recovered.toLocaleString()} recovered`)
                                .join("\n");
                            this.sendMessage(msg, threadId);
                        } else {
                            this.sendError("Couldn't retrieve data.", threadId);
                        }
                    });
                } else {
                    this.sendError(`Please choose a number ${LIMIT} or smaller for message length reasons.`, threadId);
                }
            } else {
                this.sendError(`"${rawQuery}" is not a valid number.`, threadId);
            }
        } else if (type == "today") {
            request.get(`https://corona.lmao.ninja/v2/historical/${query}`, {}, (herr, _, hdata) => {
                if (herr) {
                    hdata = { "timeline": { "cases": {}, "deaths": {} } };
                } else {
                    hdata = JSON.parse(hdata);
                }

                if (query == "all") {
                    request.get("https://disease.sh/v3/covid-19/all", {}, (err, _, all) => {
                        if (!err) {
                            const cdata = JSON.parse(all);
                            request.get("https://disease.sh/v3/covid-19/vaccine/coverage", (err, _, data) => {
                                const vdata = err ? {} : JSON.parse(data);
                                const msg = `*Today's worldwide summary*\n\n${buildTodayStr(cdata, hdata, vdata)}`;
                                this.sendMessage(msg, threadId);
                            });
                        } else {
                            this.sendError("Couldn't retrieve data.", threadId);
                        }
                    });
                } else {
                    request.get(`https://disease.sh/v3/covid-19/countries/${query}`, {}, (err, _, data) => {
                        if (!err) {
                            const cdata = JSON.parse(data);
                            request.get(`https://disease.sh/v3/covid-19/vaccine/coverage/countries/${query}`, (err, _, data) => {
                                const vdata = err ? { "timeline": {} } : JSON.parse(data);
                                const msg = `*Today's summary for ${cdata.country}*\n\n${buildTodayStr(cdata, hdata["timeline"], vdata["timeline"])}`;
                                this.sendMessage(msg, threadId);
                            });
                        } else {
                            this.sendError("Couldn't retrieve data.", threadId);
                        }
                    });
                }
            });
        } else if (type == "vaccine") {
            request.get(`https://disease.sh/v3/covid-19/vaccine`, {}, (verr, _, vdata) => {
                if (!verr) {
                    const data = JSON.parse(vdata);
                    if (query == "all") {
                        let msg = `Total candidates: ${data.totalCandidates}\n\nBy phase:`;
                        data.phases.forEach(phase => {
                            msg += `\n${phase.phase} —> ${phase.candidates} (${(phase.candidates / data.totalCandidates * 100).toFixed(1)}%)`;
                        });

                        this.sendMessage(msg, threadId);
                    } else {
                        const matches = [];
                        for (let i = 0; i < data.data.length; i++) {
                            const info = data.data[i];
                            const fields = [info.candidate, info.trialPhase, info.institutions, info.sponsors].flat();
                            // Naive substring search
                            const matchingFields = fields.filter(field => field && field.toLowerCase().indexOf(query) > -1);
                            if (matchingFields.length > 0) {
                                matches.push(info);
                            }
                        }

                        if (matches.length > 0) {
                            let msg = "";
                            matches.forEach(match => {
                                const header = "=".repeat(match.candidate.length);
                                msg += `\n${header}\n${match.candidate}\n${header}\n`;
                                msg += `Status: ${match.trialPhase}\n`;
                                msg += `Sponsor${match.sponsors.length == 1 ? '' : 's'}: ${this.concatNames(match.sponsors)}\n`;
                                msg += `Institution${match.institutions.length == 1 ? '' : 's'}: ${this.concatNames(match.institutions)}\n`;
                                msg += `\n${entities.decode(match.details)}\n`;
                            });

                            this.sendMessage(msg, threadId);
                        } else {
                            this.sendError("Couldn't find any vaccine candidate matches from that search.", threadId);
                        }
                    }
                } else {
                    this.sendError("Couldn't retrieve data.", threadId);
                }
            });
        }
    }
};

exports.getStockData = (symbol, callback) => {
    const params = {
        "symbol": symbol.toUpperCase(),
        "apikey": config.stocksKey
    };

    // Alpha Vantage API endpoint for company metadata
    const metadataParams = new URLSearchParams({ ...params, "function": "OVERVIEW" });
    request.get(`https://www.alphavantage.co/query?${metadataParams.toString()}`, {}, (err, res, body) => {
        let name, exchange, type, marketCap;
        if (!err && res.statusCode == 200) {
            const data = JSON.parse(body);
            name = data["Name"];
            exchange = data["Exchange"];
            type = data["AssetType"];
            marketCap = parseInt(data["MarketCapitalization"]);
        }

        // Alpha Vantage API endpoint for stock quote data
        const quoteParams = new URLSearchParams({ ...params, "function": "GLOBAL_QUOTE" });
        request.get(`https://www.alphavantage.co/query?${quoteParams.toString()}`, {}, (err, res, body) => {
            if (!err && res.statusCode == 200) {
                const data = JSON.parse(body);
                if (data["Error Message"]) {
                    callback("No stock matching that symbol was found.");
                } else {
                    // Construct a more detailed results object with company metadata
                    const result = {
                        ...data["Global Quote"],
                        name,
                        exchange,
                        type,
                        marketCap
                    };
                    callback(null, result);
                }
            } else {
                callback(err);
            }
        });
    });
};

// Parses a sent message for pings, removes them from the message,
// and extracts the intended users from the ping to send the message to them
exports.parsePing = (m, fromUserId, groupInfo) => {
    let users = [];

    let matches = this.matchesWithUser(new RegExp("@@"), m, fromUserId, groupInfo, false, "");
    while (matches && matches[1]) {
        const match = matches[1];
        users.push(match.toLowerCase());
        const beforeSplit = m;
        m = m.split(`@@${match}`).join(""); // Remove discovered match from string
        if (m == beforeSplit) { // Discovered match was "me" or alias
            m = m.split("@@me").join("");
            const alias = groupInfo.aliases[match];
            if (alias) {
                m = m.split(`@@${alias}`).join("");
            }
        }
        matches = this.matchesWithUser(new RegExp("@@"), m, fromUserId, groupInfo, false, "");
    }
    // After loop, m will contain the message without the pings (the message to be sent)
    return {
        "users": users, // Return array of names to ping
        "message": m.trim() // Remove leading/trailing whitespace
    };
};

// Ping individual users or the entire group
exports.handlePings = (body, senderId, info) => {
    const pingData = this.parsePing(body, senderId, info);
    const pingUsers = pingData.users;
    const pingMessage = pingData.message;

    if (pingUsers && pingUsers.length > 0) {
        for (let i = 0; i < pingUsers.length; i++) {
            const sender = info.nicknames[senderId] || info.names[senderId] || "A user";
            let message = `${sender} summoned you in ${info.name}`;
            if (pingMessage.length > 0) { // Message left after pings removed – pass to receiver
                message = `"${pingMessage}" – ${sender} in ${info.name}`;
            }
            message += ` at ${this.getTimeString()}`; // Time stamp
            // Send message with links to chat/sender
            this.sendMessageWithMentions(message, [{
                "tag": sender,
                "id": senderId
            }, {
                "tag": info.name,
                "id": info.threadId
            }], info.members[pingUsers[i]]);
        }
        return true;
    }
    return false;
};

// Wrapper func for common error handling cases with property updates
exports.setGroupPropertyAndHandleErrors = (property, groupInfo, errMsg, successMsg) => {
    this.setGroupProperty(property, groupInfo[property], groupInfo, err => {
        if (err) {
            this.sendError(errMsg, groupInfo.threadId);
        } else {
            this.sendMessage(successMsg, groupInfo.threadId);
        }
    });
};

exports.createMentionGroup = (name, userIds, groupInfo) => {
    groupInfo.mentionGroups[name] = userIds;

    const memberNames = userIds.map(user => groupInfo.names[user]).join("/");
    const memberString = userIds.length > 0 ? ` with member${userIds.length == 1 ? "" : "s"} ${memberNames}` : "";

    this.setGroupPropertyAndHandleErrors("mentionGroups", groupInfo,
        "Unable to create the group.",
        `Successfully created group "${name}"${memberString}.`
    );
};

exports.deleteMentionGroup = (name, groupInfo) => {
    delete groupInfo.mentionGroups[name];

    this.setGroupPropertyAndHandleErrors("mentionGroups", groupInfo,
        "Unable to delete the group.",
        `Successfully deleted group "${name}".`
    );
};

exports.subToMentionGroup = (name, userIds, groupInfo) => {
    if (userIds.length < 1) { return; }

    let members = groupInfo.mentionGroups[name];
    if (members) {
        members = members.concat(userIds);
        groupInfo.mentionGroups[name] = this.pruneDuplicates(members);

        const memberNames = userIds.map(user => groupInfo.names[user]).join("/");
        this.setGroupPropertyAndHandleErrors("mentionGroups", groupInfo,
            "Unable to subscribe to the group.",
            `${memberNames} successfully subscribed to group "${name}".`
        );
    } else {
        this.sendError("Please provide a valid group to add members.");
    }
};

exports.unsubFromMentionGroup = (name, userIds, groupInfo) => {
    if (userIds.length < 1) { return; }

    let members = groupInfo.mentionGroups[name];
    if (members) {
        members = members.filter(id => !userIds.includes(id));
        groupInfo.mentionGroups[name] = members;

        const memberNames = userIds.map(user => groupInfo.names[user]).join("/");
        this.setGroupPropertyAndHandleErrors("mentionGroups", groupInfo,
            "Unable to unsubscribe from the group.",
            `${memberNames} successfully unsubscribed from group "${name}".`
        );
    } else {
        this.sendError("Please provide a valid group to remove members.");
    }
};

exports.pruneDuplicates = list => {
    return list.filter((item, ind) => list.indexOf(item) == ind);
};

exports.listMentionGroups = (name, groupInfo) => {
    const groups = groupInfo.mentionGroups;

    let msg;
    if (groups[name]) { // Group name provided; list members
        const names = groups[name].map(id => groupInfo.names[id]).join("/");
        msg = `Group: ${name}\n`;
        if (names.length > 0) {
            msg += `Members: ${names}`;
        } else {
            msg += `No members currently subscribed.`;
        }
        msg += `\n\nMention this group with @@${name}`;
    } else { // List all groups
        const names = Object.keys(groups);
        if (names.length > 0) {
            msg = `Available mention groups:\n\n${names.map(n => `– ${n}`).join("\n")}`;
        } else {
            msg = `No available mention groups. Try adding one with "${config.trigger} group create".`;
        }
    }
    this.sendMessage(msg, groupInfo.threadId);
};

// Nicely formats a list of names
exports.concatNames = names => {
    let str = "";
    switch (names.length) {
        case 1: str = names[0]; break;
        case 2: str = `${names[0]} and ${names[1]}`; break;
        default: {
            const last = names[names.length - 1];
            names[names.length - 1] = `and ${last}`;
            str = names.join(", ");
        }
    }
    return str;
};

// Gets a contextually-aware string asking to promote the bot based on whether
// the caller can do so
exports.getPromoteString = (fromUserId, groupInfo) => {
    // The bot shouldn't technically end up here if it's in the admins list, but the list is cached,
    // so if it gets called immediately after removing it as an admin, it might still be in there
    const admins = groupInfo.admins.filter(id => id != config.bot.id).map(id => groupInfo.names[id]);
    const promoteStr = groupInfo.admins.includes(fromUserId) ? "promoting" : `asking ${admins.join("/")} to promote`;

    return `Try ${promoteStr} the bot!`;
};

exports.fancyDuration = (from, to) => {
    return humanize(to - from);
};

exports.twitterGET = (path, callback) => {
    const url = `https://api.twitter.com/2${path}`;
    request.get(url, { "headers": { "authorization": `Bearer ${credentials.TWITTER_TOKEN}` } }, (err, res, body) => {
        if (!err && res.statusCode == 200) {
            const data = JSON.parse(body);
            callback(null, data);
        } else {
            callback(new Error("Couldn't retrieve data from that endpoint"));
        }
    });
};

exports.sendTweetMsg = (id, threadId, includeLink = false) => {
    const expansions = "?expansions=attachments.media_keys,referenced_tweets.id,author_id&media.fields=url";

    this.twitterGET(`/tweets/${id}${expansions}`, (err, tweetData) => {
        if (err) return;

        const { data, includes } = tweetData;

        const authorId = data.author_id;
        const author = includes.users.find(user => user.id === authorId);
        const { name, username } = author;

        // If there are newlines, put a new quote marker at the beginning
        const text = entities.decode(data.text.split("\n").join("\n> "));
        let msg = `${name} (@${username}) tweeted: \n> ${text}`;

        if (includeLink) {
            msg += `\n\nhttps://twitter.com/${username}/status/${id}`;
        }

        // See if any media can be found
        if (includes.media) {
            const imgs = includes.media
                .filter(media => media.type === "photo")
                .map(img => img.url);
            if (imgs.length > 0) {
                return this.sendFilesFromUrl(imgs, threadId, msg);
            }
        }

        this.sendMessage(msg, threadId);
    });
};

exports.getLatestTweetID = (handle, callback) => {
    const expansions = "?user.fields=protected";
    this.twitterGET(`/users/by/username/${handle}${expansions}`, (err, userData) => {
        if (err) return callback(new Error("Can't find this user."));

        const { data: userInfo } = userData;
        if (userInfo.protected) {
            callback(new Error("Can't fetch this user's tweets because their account is protected."));
        } else {
            this.twitterGET(`/tweets/search/recent?query=from:${handle}`, (err, tweetData) => {
                if (err) return callback(new Error("Encountered an error fetching this user's tweets."));

                const { meta, data: tweets } = tweetData;
                // If the user doesn't have any recent tweets, just return empty strings since we only
                // care about being able to detect when they post new ones by diffing the IDs
                const id = meta.result_count > 0 ? tweets[0].id : "";
                callback(null, id, userInfo);
            });
        }
    });
};

exports.getLatestFeedItems = (feedURL, groupInfo, callback) => {
    const lastCheck = groupInfo.feeds[feedURL] ? new Date(groupInfo.feeds[feedURL]) : new Date();

    rss.parseURL(feedURL, (err, feed) => {
        if (err) return callback(err);

        const newItems = feed.items ? feed.items.filter(item => new Date(item.pubDate) > lastCheck) : [];
        callback(null, newItems, feed);
    });
};

// Creates a new GitHub issue in the configured repo
// Takes a reporter (name of person filing the report),
// creator (name of person creating the ticket), and a text body describing the issue
// Lastly, takes a callback with parameters for 1) an error (if fails) and
// (if successful) 2) the created issue's URL and 3) number
exports.createGitHubIssue = async (sender, reporter, text, type, groupInfo, callback) => {
    const isBug = type === 'bug';
    const createdAt = this.getPrettyDateString(new Date());
    const issueType = isBug ? "Report" : "Request";
    const title = `[@${reporter} please change the title] ${issueType} in ${groupInfo.name} at ${createdAt}`;
    const body = `${sender} at ${createdAt}:\n> ${text.replace(/\n/g, "\n> ")}`;
    const labels = isBug ? ['bug'] : ['new-feature'];

    try {
        const octokit = getOctokit();
        const response = await octokit.issues.create({
            ...config.ghRepo,
            title,
            body,
            labels
        });
        const num = response.data.number;
        const url = `https://github.com/${config.ghRepo.owner}/${config.ghRepo.repo}/issues/${num}`;
        callback(null, url, num);
    } catch (err) {
        callback(err);
    }
};

const isLowerCase = str => {
    if (str.match(/[A-z]+/)) {
        // This only works if it has letters
        return str === str.toLowerCase();
    }
    return false;
};

exports.spongeify = text => [...text].reduce((str, cur) => {
    if (str.length == 0) {
        return cur.toLowerCase();
    }

    const lastChar = str[str.length - 1];
    if (isLowerCase(lastChar)) {
        return str.concat(cur.toUpperCase());
    }
    return str.concat(cur.toLowerCase());
}, "");