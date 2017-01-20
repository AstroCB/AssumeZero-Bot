const messenger = require("facebook-chat-api");
const fs = require("fs");
const request = require("request");
const ids = require("./ids"); // Various IDs stored for easy access
const config = require("./config"); // Config file
const utils = require("./configutils");
const commands = require("./commands");
const heroku = require("./heroku");
var credentials;
try {
    // Login creds from local dir
    credentials = require("./credentials");
} catch (e) {
    // Deployed to Heroku or config file is missing
    credentials = process.env;
}
var gapi; // Global API for external functions (set on login)

// Log in
try {
    messenger({
        appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
    }, main);
} catch (e) { // No app state saved
    messenger({
        email: credentials.EMAIL,
        password: credentials.PASSWORD
    }, function callback(err, api) {
        fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
        main(err, api);
    });
}

// Listen for commands
function main(err, api) {
    if (err) return console.error(err);
    gapi = api; // Set global API

    api.listen(function callback(err, message) {
        if (config.dynamic) { // See config for explanation
            setEnvironmentVariables(message);
        }
        if (message && !err) {
            // Handle messages
            if (message.type == "message" && message.senderID != ids.bot && !isBanned(message.senderID)) { // Is from AØBP but not from bot
                if (message.threadID == ids.group) { // Message from main group (or current group, if in dynamic mode)
                    var m = message.body;
                    var attachments = message.attachments;
                    var senderId = message.senderID;
                    var groupId = ids.group;
                    // Handle message body
                    if (m) {
                        // Handle pings
                        var pingData = parsePing(m);
                        var pingUsers = pingData.users;
                        var pingMessage = pingData.message;
                        api.getThreadInfo(groupId, function(err, data) {
                            for (var i = 0; i < pingUsers.length; i++) { // Loop doesn't run if no ping matches
                                if (!err) {
                                    var sender = data.nicknames[senderId];
                                    var message = `${sender} summoned you in ${data.name}`;
                                    if (pingMessage.length > 0) { // Message left after pings removed – pass to receiver
                                        message = `"${pingMessage}" – ${sender} in ${data.name}`;
                                    }
                                    message += ` at ${getTimeString()}` // Time stamp
                                    sendMessage(message, ids.members[groupId][pingUsers[i]]);
                                }
                            }
                        });

                        // Pass to commands testing for trigger word
                        var cindex = m.toLowerCase().indexOf(config.trigger);
                        if (cindex > -1) { // Trigger command mode
                            handleCommand(m.substring(cindex + config.trigger.length), senderId);
                        }
                        // Check for Easter eggs
                        handleEasterEggs(m, groupId, senderId);
                    }
                    // Handle attachments
                    for (var i = 0; i < attachments.length; i++) {
                        if (attachments[i].type == "animated_image" && !attachments[i].filename) { // Should have filename if OC
                            kick(senderId, config.banTime, groupId, function() {
                                sendMessage("You have been kicked for violating the group chat GIF policy: only OC is allowed.", groupId);
                            });
                        }
                    }
                } else if (message.threadID != ids.group) { // Not from main group (static group mode)
                    sendMessage("Multi-chat mode is off", message.threadID);
                }
            }
        }
    });
}

function handleCommand(command, fromUserId, api = gapi) {
    const threadId = ids.group; // For async callbacks
    // Evaluate commands
    const co = commands.commands; // Short var names since I'll be typing them a lot
    for (var c in co) {
        if (co.hasOwnProperty(c)) {
            // Check whether command is sudo-protected and, if so, whether the user is the admin
            if ((co[c].sudo && fromUserId == ids.owner) || !co[c].sudo) {
                // Set match vals
                if (co[c].user_input) { // Requires a match from the members dict
                    if (Array.isArray(co[c].regex)) { // Also has a regex suffix (passed as length 2 array)
                        co[c].m = matchesWithUser(co[c].regex[0], command, " ", co[c].regex[1]);
                    } else { // Just a standard regex prefex as a string + name
                        co[c].m = matchesWithUser(co[c].regex, command);
                    }
                } else {
                    co[c].m = command.match(co[c].regex);
                }
            } else { // User not authorized
                // Set match to null to prevent checking issues
                co[c].m = null;
            }
        }
    }
    debugCommandOutput(false);
    // Check commands for matches & eval
    if (co["help"].m) { // Check help first to avoid command conflicts
        var input;
        if (co["help"].m[1]) {
            input = co["help"].m[1].trim().toLowerCase();
        }
        if (input && input.length > 0) {
            // Give details of specific command
            const info = getHelpEntry(input, co);
            if (info) {
                sendMessage(`Entry for command "${info.pretty_name}":\n${info.description}\n\nSyntax: ${config.trigger} ${info.syntax}${info.sudo ? "\n\n(This command requires admin privileges)" : ""}${info.experimental ? "\n\n(This command is experimental)" : ""}`);
            } else {
                sendError(`Help entry not found for ${input}`);
            }
        } else {
            // No command passed; give overview of all of them
            var mess = "Quick help for AØBøt:\n\n";
            for (var c in co) {
                if (co.hasOwnProperty(c)) {
                    const entry = co[c];
                    mess += `${entry.syntax}: ${entry.short_description}\n`
                }
            }
            mess += `\nTip: for more detailed descriptions, use "${config.trigger} help (command)"`;
            sendMessage(mess);
        }
    } else if (co["kick"].m && co["kick"].m[1]) {
        const user = co["kick"].m[1].toLowerCase();
        const optTime = co["kick"].m[2] ? parseInt(co["kick"].m[2]) : undefined;
        try {
            // Make sure already in group
            if (ids.members[threadId][user]) {
                // Kick with optional time specified in call only if specified in command
                kick(ids.members[threadId][user], optTime);
            } else {
                throw new Error(`User ${user} not recognized`);
            }
        } catch (e) {
            sendError(e);
        }
    } else if (co["xkcd"].m) { // Check second to prevent clashes with search command
        if (co["xkcd"].m[1]) { // Parameter specified
            const query = co["xkcd"].m[2];
            const param = co["xkcd"].m[1].split(query).join("").trim(); // Param = 1st match - 2nd
            if (query && param == "search") {
                // Perform search using Google Custom Search API (provide API key / custom engine in config.js)
                const url = `https://www.googleapis.com/customsearch/v1?key=${config.xkcd.key}&cx=${config.xkcd.engine}&q=${encodeURIComponent(query)}`;
                request(url, function(err, res, body) {
                    if (!err && res.statusCode == 200) {
                        const results = JSON.parse(body).items;
                        if (results.length > 0) {
                            sendMessage({
                                "url": results[0].formattedUrl // Best match
                            }, threadId);
                        } else {
                            sendMessage("Error: No results found", threadId);
                        }
                    } else {
                        console.log(err);
                    }
                });
            } else if (param == "new") { // Get most recent (but send as permalink for future reference)
                request("http://xkcd.com/info.0.json", function(err, res, body) {
                    if (!err && res.statusCode == 200) {
                        const num = parseInt(JSON.parse(body).num); // Number of most recent xkcd
                        sendMessage({
                            "url": `http://xkcd.com/${num}`
                        }, threadId);
                    } else {
                        // Just send to homepage for newest as backup
                        sendMessage({
                            "url": "http://xkcd.com/"
                        }, threadId);
                    }
                });
            } else if (param) { // If param != search or new, it should be either a number or valid sub-URL for xkcd.com
                sendMessage({
                    "url": `http://xkcd.com/${param}`
                });
            }
        } else { // No parameter passed; send random xkcd
            // Get info of most current xkcd to find out the number of existing xkcd (i.e. the rand ceiling)
            request("http://xkcd.com/info.0.json", function(err, res, body) {
                if (!err && res.statusCode == 200) {
                    const num = parseInt(JSON.parse(body).num); // Number of most recent xkcd
                    const randxkcd = Math.floor(Math.random() * num) + 1;
                    sendMessage({
                        "url": `http://xkcd.com/${randxkcd}`
                    }, threadId);
                }
            });
        }
    } else if (co["addsearch"].m && co["addsearch"].m[1] && co["addsearch"].m[3]) {
        // Fields 1 & 3 are are for the command and the user, respectively
        // Field 2 is for an optional number parameter specifying the number of search results
        // for a search command (default is 1)
        const user = co["addsearch"].m[3];
        const command = co["addsearch"].m[1].split(" ")[0].toLowerCase(); // Strip opt parameter from match if present
        try {
            api.getUserID(user, function(err, data) {
                if (!err) {
                    const bestMatch = data[0]; // Hopefully the right person
                    const numResults = parseInt(co["addsearch"].m[2]) || 1; // Number of results to display
                    if (command == "search") { // Is a search command
                        // Output search results / propic
                        for (var i = 0; i < numResults; i++) {
                            // Passes number of match to indicate level (closeness to top)
                            searchForUser(data[i], threadId, i);
                        }
                    } else { // Is an add command
                        // Add best match to group and update log of member IDs
                        addUser(bestMatch.userID, threadId);
                    }
                } else {
                    if (err.error) {
                        // Fix typo in API error message
                        sendError(`${err.error.replace("Bes", "Best")}`, threadId);
                    }
                }
            });
        } catch (e) {
            sendError(`User ${user} not recognized`);
        }
    } else if (co["order66"].m) {
        // Remove everyone from the chat for configurable amount of time (see config.js)
        // Use stored threadId in case it changes later (very important)
        sendMessage("I hate you all.");
        setTimeout(function() {
            var callbackset = false;
            for (var m in ids.members[threadId]) {
                // Bot should never be in members list, but this is a safeguard
                //(ALSO VERY IMPORTANT so that group isn't completely emptied)
                if (ids.members[threadId].hasOwnProperty(m) && ids.members[threadId][m] != ids.bot) {
                    if (!callbackset) { // Only want to send the message once
                        kick(ids.members[threadId][m], config.order66Time, threadId, function() {
                            sendMessage("Balance is restored to the Force.", threadId);
                        });
                        callbackset = true;
                    } else {
                        kick(ids.members[threadId][m], config.order66Time);
                    }
                }
            }
        }, 2000); // Make sure people see the message (and impending doom)
    } else if (co["resetcolor"].m) {
        api.changeThreadColor(config.defaultColor, threadId);
    } else if (co["setcolor"].m && co["setcolor"].m[1]) {
        api.getThreadInfo(threadId, function(err, data) {
            if (!err) {
                const ogColor = data.color; // Will be null if no custom color set
                api.changeThreadColor(co["setcolor"].m[1], threadId, function(err, data) {
                    if (!err) {
                        sendMessage(`Last color was ${ogColor}`, threadId);
                    }
                });
            }
        });
    } else if (co["hitlights"].m) {
        api.getThreadInfo(threadId, function(err, data) {
            if (!err) {
                const ogColor = data.color || config.defaultColor; // Will be null if no custom color set
                const delay = 500; // Delay between color changes (half second is a good default)
                for (let i = 0; i < config.numColors; i++) { // Need block scoping for timeout
                    setTimeout(function() {
                        api.changeThreadColor(getRandomColor(), threadId);
                        if (i == (config.numColors - 1)) { // Set back to original color on last
                            setTimeout(function() {
                                api.changeThreadColor(ogColor, threadId);
                            }, delay);
                        }
                    }, delay + (i * delay)); // Queue color changes
                }
            }
        });
    } else if (co["resetnick"].m && co["resetnick"].m[1]) {
        const user = co["resetnick"].m[1].toLowerCase();
        api.changeNickname("", threadId, ids.members[threadId][user]);
    } else if (co["setnick"].m && co["setnick"].m[1]) {
        const user = co["setnick"].m[1].toLowerCase();
        const newname = co["setnick"].m.input.split(co["setnick"].m[0]).join("").trim(); // Get rid of match to find rest of message
        api.changeNickname(newname, threadId, ids.members[threadId][user]);
    } else if (co["wakeup"].m && co["wakeup"].m[1]) {
        const user = co["wakeup"].m[1].toLowerCase();
        const members = ids.members[threadId]; // Save in case it changes
        for (var i = 0; i < config.wakeUpTimes; i++) {
            setTimeout(function() {
                sendMessage("Wake up", members[user]);
            }, 500 + (500 * i));
        }
        sendMessage(`Messaged ${user.substring(0, 1).toUpperCase()}${user.substring(1)} ${config.wakeUpTimes} times`);
    } else if (co["randmess"].m) {
        // Get thread length
        api.getThreadInfo(threadId, function(err, data) {
            if (!err) {
                const count = data.messageCount;
                var randMessage = Math.floor(Math.random() * (count + 1));
                api.getThreadHistory(threadId, 0, count, (new Date()).getTime(), function(err, data) {
                    if (err) {
                        console.log(err);
                        sendMessage("Error: Message could not be found", threadId);
                    } else {
                        var m = data[randMessage];
                        while (!(m && m.body)) {
                            randMessage = Math.floor(Math.random() * (count + 1));
                            m = data[randMessage];
                        }
                        var b = m.body,
                            name = m.senderName,
                            time = new Date(m.timestamp);
                        sendMessage(`${b} - ${name} (${time.toLocaleDateString()})`, threadId);
                    }
                });
            }
        });
    } else if (co["alive"].m) {
        sendEmoji(threadId);
    } else if (co["resetemoji"].m) {
        api.changeThreadEmoji(config.defaultEmoji, threadId, (err) => {

        });
    } else if (co["setemoji"].m && co["setemoji"].m[1]) {
        api.changeThreadEmoji(co["setemoji"].m[1], threadId, (err) => {
            if (err) {
                // Set to default as backup if errors
                api.changeThreadEmoji(config.defaultEmoji, threadId);
            }
        });
    } else if (co["echo"].m && co["echo"].m[1] && co["echo"].m[2]) {
        const command = co["echo"].m[1].toLowerCase();
        var message = `${co["echo"].m[2]}`;
        if (command == "echo") {
            sendMessage(message);
        } else {
            api.getUserInfo(fromUserId, function(err, data) {
                if (!err) {
                    message = `"${message}" – ${data[fromUserId].name}`;
                    sendMessage(message, threadId);
                }
            });
        }
    } else if (co["ban"].m && co["ban"].m[2]) {
        const user = co["ban"].m[2];
        const userId = ids.members[threadId][user];
        const callback = (err, users, status) => {
            if (err) {
                sendError(err, threadId);
            } else {
                config.banned = users;
                sendMessage(`User successfully ${status}`, threadId);
            }
        }
        if (user) {
            if (co["ban"].m[1]) { // Unban
                utils.removeBannedUser(userId, callback);
            } else { // Ban
                utils.addBannedUser(userId, callback);
            }
        } else {
            sendError(`User ${user} not found`);
        }
    }
}

// Check for commands that don't require a trigger (Easter eggs)
// Some commands may require additional configuration (and most only make sense for
// the original chat it was built for), so should be off by default
function handleEasterEggs(message, threadId, fromUserId, api = gapi) {
    if (config.easterEggs) {
        if (message.match(/genius/i)) {
            sendFile("media/genius.jpg");
        }
        if (message.match(/kys|cuck(?:ed)?|maga/i)) {
            sendMessage("Delete your account.")
        }
        if (message.match(/(?:problem |p)set(?:s)?/i)) {
            fs.readFile("media/monologue.txt", "utf-8", function(err, text) {
                if (!err) {
                    sendMessage(text, threadId);
                }
            });
        }
        if (message.match(/umd/i)) {
            sendFile("media/umd.png");
        }
        if (message.match(/cornell/i)) {
            sendMessage({
                "url": "https://www.youtube.com/watch?v=yBUz4RnoWSM"
            });
        }
        if (message.match(/swarthmore/i)) {
            sendFile("media/jonah.png");
        }
        if (message.match(/purdue/i)) {
            sendMessage("I hear they have good chicken");
        }
        if (message.match(/nyu/i)) {
            sendMessage("We don't speak of it");
        }
        if (message.match(/commit seppuku/i)) {
            sendMessage("RIP");
        }
        if (message.match(/physics c(?:[^A-z]|$)/i)) {
            sendMessage({
                "url": "https://www.youtube.com/watch?v=HydsTDvEINo"
            });
        }
        if (message.match(/(?:\s|^)shaw/i)) {
            sendFile("media/shaw.png");
        }
        if (message.match(/(?:physics )?(?:get|measure) bac/i)) {
            sendMessage("Yiyi's BAC is far above healthy levels")
        }
    }
}

// Utility functions

function matchesWithUser(command, message, sep = " ", suffix = "") {
    return message.match(new RegExp(`${command}${sep}${config.userRegExp}${suffix}`, "i"));
}

// Wrapper function for sending messages easily
// Isn't that much simpler than the actual message function, but it
// allows for an optional thread parameter (default is currently stored ID)
// and for outputting messages to stdout when the API isn't available (e.g. before login)
// Accepts either a simple string or a message object with URL/attachment fields
// Probably a good idea to use this wrapper for all sending instances for debug purposes
// and consistency unless a callback is needed
function sendMessage(m, threadId = ids.group, api = gapi) {
    try {
        api.sendMessage(m, threadId);
    } catch (e) { // For debug mode (API not available)
        console.log(`${threadId}: ${m}`);
    }
}

// Wrapper function for sending error messages to chat (uses sendMessage wrapper)
function sendError(m, threadId = ids.group) {
    sendMessage(`Error: ${m}`, threadId);
}

function debugCommandOutput(flag) {
    if (flag) {
        var co = commands.commands;
        console.log(Object.keys(co).map(function(c) {
            return `${c}: ${co[c].m}`
        }));
    }
}

function parsePing(m) {
    var users = [];
    var allMatch = m.match(/@@(all|everyone)/i);
    if (allMatch && allMatch[1]) { // Alert everyone
        users = Object.keys(ids.members[ids.group]);
        m = m.split("@@" + allMatch[1]).join("");
    } else {
        var matches = matchesWithUser("@@", m, "");
        while (matches && matches[1]) {
            users.push(matches[1].toLowerCase());
            m = m.split("@@" + matches[1]).join(""); // Remove discovered match from string
            matches = matchesWithUser("@@", m, "");
        }
        // After loop, m will contain the message without the pings (the message to be sent)
    }
    return {
        "users": users,
        "message": m.trim() // Remove leading/trailing whitespace
    };
}

// Kick user for an optional length of time in seconds (default indefinitely)
// Also accepts optional callback parameter if length is specified
function kick(userId, time, groupId = ids.group, callback, api = gapi) {
    if (userId != ids.bot) { // Never allow bot to be kicked
        api.removeUserFromGroup(userId, groupId);
        deleteUserFromId(userId, groupId);
        config.userRegExp = utils.setRegexFromMembers();
        if (time) {
            setTimeout(function() {
                addUser(userId, groupId, false); // Don't welcome if they're not new to the group
                if (callback) {
                    callback();
                }
            }, time * 1000);
        }
    }
}

// Removes the specified user from members dict
// (with user ID – can do it directly w/o function if you have key already)
function deleteUserFromId(userId, groupId) {
    for (var m in ids.members[groupId]) {
        if (ids.members[groupId].hasOwnProperty(m)) {
            if (ids.members[groupId][m] == userId) {
                delete ids.members[groupId][m];
            }
        }
    }
}

// Adds user to group and updates members list
// Optional parameter to welcome new user to the group
function addUser(id, threadId = ids.group, welcome = true, api = gapi) {
    api.getUserInfo(id, function(err, info) {
        api.addUserToGroup(id, threadId, function(err, data) {
            if (!err && info) {
                // Add to members obj
                ids.members[threadId][info[id].firstName.toLowerCase()] = id;
                // Update regex command checking
                config.userRegExp = utils.setRegexFromMembers(threadId);

                if (welcome) {
                    welcomeNewUser(id, threadId);
                }
            }
        })
    });
}

function welcomeNewUser(id, groupId = ids.group, api = gapi) {
    api.getUserInfo(id, function(err, data) {
        if (!err) {
            const user = data[id];
            sendMessage(`Welcome to ${config.groupName}, ${user.firstName}!`, groupId);
        }
    });
}

// If the bot is in dynamic mode, it needs to reset its config variables
// every time it receives a message; this function is called on every listen ping
function setEnvironmentVariables(message, api = gapi) {
    ids.group = message.threadID;
    api.getThreadInfo(ids.group, function(err, data) {
        if (data) {
            config.groupName = data.name || "Unnamed chat";
            config.defaultEmoji = data.emoji ? data.emoji.emoji : config.defaultEmoji;
            config.defaultColor = data.color;
            ids.members[message.threadID] = []; // Clear old members
            api.getUserInfo(data.participantIDs, function(err, data) {
                if (!err) {
                    for (var id in data) {
                        if (data.hasOwnProperty(id) && id != ids.bot) {
                            ids.members[message.threadID][data[id].firstName.toLowerCase()] = id;
                        }
                    }
                    config.userRegExp = utils.setRegexFromMembers(message.threadID);
                }
            });
        }
    });
}

function getHelpEntry(input, log) {
    for (var c in log) {
        if (log.hasOwnProperty(c)) {
            var names = log[c].display_names;
            for (var i = 0; i < names.length; i++) {
                if (input == names[i]) {
                    return log[c];
                }
            }
        }
    }
}

function sendEmoji(threadId, api = gapi) {
    api.getThreadInfo(threadId, function(err, data) {
        if (!err) {
            sendMessage(data.emoji ? data.emoji.emoji : config.defaultEmoji);
        }
    });
}

function isBanned(senderId) {
    return (config.banned.indexOf(senderId) > -1);
}

// Sends file where filename is a relative path to the file from root
// Accepts an optional message body parameter
function sendFile(filename, message = "", threadId = ids.group, api = gapi) {
    const msg = {
        "body": message,
        "attachment": fs.createReadStream(`${__dirname}/${filename}`)
    }
    sendMessage(msg, threadId);
}

// Returns a string of the current time in EST
function getTimeString() {
    const offset = -5; // Eastern
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 600000); // UTC milliseconds since 1970
    const eastern = new Date(utc + (offset * 60 * 60000));
    return eastern.toLocaleTimeString();
}

// Creates a description for a user search result given the match's data from the chat API
// Also performs a Graph API search for a high-res version of the user's profile picture
// and uploads it with the description if it finds one
// Optional parameter to specify which level of match it is (1st, 2nd, 3rd, etc.)
function searchForUser(match, threadId, num = 0, api = gapi) {
    const desc = `${(num == 0) ? "Best match" : "Match " + (num+1)}: ${match.name}\n${match.profileUrl}\nRank: ${match.score}`;

    // Try to get large propic URL from Facebook Graph API using user ID
    // If propic exists, combine it with the description
    const userId = match.userID;
    const photoUrl = `media/profiles/${userId}.jpg`; // Location of downloaded file
    const graphUrl = `https://graph.facebook.com/${userId}/picture?type=large&redirect=false&width=400&height=400`;
    request.get(graphUrl, (err, res, body) => {
        if (res.statusCode == 200) {
            const url = JSON.parse(body).data.url; // Photo URL from Graph API
            if (url) {
                request.head(url, (err, res, body) => {
                    // Download propic and pass to chat API
                    if (!err) {
                        request(url).pipe(fs.createWriteStream(photoUrl)).on('close', (err, data) => {
                            if (!err) {
                                // Use API's official sendMessage here for callback functionality
                                api.sendMessage({
                                    "body": desc,
                                    "attachment": fs.createReadStream(`${__dirname}/${photoUrl}`)
                                }, threadId, (err, data) => {
                                    // Delete downloaded propic
                                    fs.unlink(photoUrl);
                                });
                            } else {
                                sendMessage(desc, threadId);
                            }
                        });
                    } else {
                        // Just send the description if photo can't be downloaded
                        sendMessage(desc, threadId);
                    }
                });
            } else {
                sendMessage(desc, threadId);
            }
        }
    });
}


// Gets a random hex color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) { // Hex
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}
