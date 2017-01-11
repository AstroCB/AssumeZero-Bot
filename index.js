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

                    // Handle message body
                    if (m) {
                        // Handle pings
                        var pingData = parsePing(m);
                        var pingUsers = pingData.users;
                        var pingMessage = pingData.message;
                        var groupId = ids.group;
                        api.getThreadInfo(groupId, function(err, data) {
                            for (var i = 0; i < pingUsers.length; i++) { // Loop doesn't run if no ping matches
                                if (!err) {
                                    var sender = data.nicknames[senderId];
                                    var message = `${sender} summoned you in ${data.name}`;
                                    if (pingMessage.length > 0) { // Message left after pings removed – pass to receiver
                                        message = `"${pingMessage}" – ${sender} in ${data.name}`;
                                    }
                                    message += ` at ${(new Date()).toLocaleDateString()}` // Time stamp
                                    api.sendMessage(message, ids.members[groupId][pingUsers[i]]);
                                }
                            }
                        });

                        // Pass to commands testing for trigger word
                        var cindex = m.toLowerCase().indexOf(config.trigger);
                        if (cindex > -1) { // Trigger command mode
                            handleCommand(m.substring(cindex + config.trigger.length), senderId);
                        }
                        // Check for Easter eggs
                        handleEasterEggs(m, senderId);
                    }
                    // Handle attachments
                    for (var i = 0; i < attachments.length; i++) {
                        if (attachments[i].type == "animated_image" && !attachments[i].filename) { // Should have filename if OC
                            kick(senderId, config.banTime, function() {
                                sendMessage("You have been kicked for violating the group chat GIF policy: only OC is allowed.")
                            });
                        }
                    }
                } else if (message.threadID != ids.group) { // Not from main group (static group mode)
                    api.sendMessage("Multi-chat mode is off", message.threadID);
                }
            }
        }
    });
}

function handleCommand(command, fromUserId, api = gapi) {
    // Evaluate commands
    const co = commands.commands; // Short var names since I'll be typing them a lot
    for (var c in co) {
        if (co.hasOwnProperty(c)) {
            // Set match vals
            if (co[c].user_input) { // Requires a match from the members dict
                co[c].m = matchesWithUser(co[c].regex, command);
            } else {
                co[c].m = command.match(co[c].regex);
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
            var info = getHelpEntry(input, co);
            if (info) {
                sendMessage(`Entry for command "${info.pretty_name}":\n${info.description}\n\nSyntax: ${config.trigger} ${info.syntax}${info.experimental ? "\n\n(This command is experimental)" : ""}`);
            } else {
                sendError(`Help entry not found for ${input}`);
            }
        } else {
            // No command passed; give overview of all of them
            var mess = "Quick help for AØBøt:\n\n";
            for (var c in co) {
                if (co.hasOwnProperty(c)) {
                    var entry = co[c];
                    mess += `${entry.syntax}: ${entry.short_description}\n`
                }
            }
            mess += `\nTip: for more detailed descriptions, use "${config.trigger} help (command)"`;
            sendMessage(mess);
        }
    } else if (co["kick"].m && co["kick"].m[1]) {
        var user = co["kick"].m[1].toLowerCase();
        try {
            kick(ids.members[ids.group][user]);
        } catch (e) {
            sendError(`User ${user} not recognized`);
        }
    } else if (co["xkcd"].m) {
        if (co["xkcd"].m[1]) { // Parameter specified
            const query = co["xkcd"].m[2];
            const param = co["xkcd"].m[1].split(query).join("").trim(); // Param = 1st match - 2nd
            const threadId = ids.group;
            if (query && param == "search") {
                // Perform search using Google Custom Search API (provide API key / custom engine in config.js)
                const url = `https://www.googleapis.com/customsearch/v1?key=${config.xkcd.key}&cx=${config.xkcd.engine}&q=${encodeURIComponent(query)}`;
                request(url, function(err, res, body) {
                    if (!err && res.statusCode == 200) {
                        const results = JSON.parse(body).items;
                        if (results.length > 0) {
                            api.sendMessage({
                                "url": results[0].formattedUrl // Best match
                            }, threadId);
                        } else {
                            api.sendMessage("Error: No results found", threadId);
                        }
                    } else {
                        console.log(err);
                    }
                });
            } else if (param) { // If param != search, it should be either a number or valid sub-URL for xkcd.com
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
                    });
                }
            });
        }
    } else if (co["addsearch"].m && co["addsearch"].m[1] && co["addsearch"].m[2]) {
        var threadId = ids.group;
        var user = co["addsearch"].m[2]
        try {
            api.getUserID(user, function(err, data) {
                if (!err) {
                    var bestMatch = data[0]; // Hopefully the right person
                    if (co["addsearch"].m[1].toLowerCase() == "search") {
                        api.sendMessage(bestMatch.profileUrl, threadId); // Best match
                    } else {
                        // Add user to group and update log of member IDs
                        addUser(bestMatch.userID, threadId);
                    }
                } else {
                    if (err.error) {
                        // Fix typo
                        api.sendMessage(`Error: ${err.error.replace("Bes", "Best")}`, threadId);
                    }
                }
            });
        } catch (e) {
            sendError(`User ${user} not recognized`);
        }
    } else if (co["order66"].m) {
        // Remove everyone from the chat for configurable amount of time (see config.js)
        sendMessage("I hate you all.");
        const groupId = ids.group; // Store in case it changes later (very important)
        setTimeout(function() {
            var callbackset = false;
            for (var m in ids.members[groupId]) {
                // Bot should never be in members list, but this is a safeguard
                //(ALSO VERY IMPORTANT so that group isn't completely emptied)
                if (ids.members[groupId].hasOwnProperty(m) && ids.members[groupId][m] != ids.bot) {
                    if (!callbackset) { // Only want to send the message once
                        kick(ids.members[groupId][m], config.order66Time, groupId, function() {
                            api.sendMessage("Balance is restored to the Force.", groupId);
                        });
                        callbackset = true;
                    } else {
                        kick(ids.members[groupId][m], config.order66Time);
                    }
                }
            }
        }, 2000); // Make sure people see the message (and impending doom)
    } else if (co["resetcolor"].m) {
        api.changeThreadColor(config.defaultColor, ids.group);
    } else if (co["setcolor"].m && co["setcolor"].m[1]) {
        const threadId = ids.group;
        api.getThreadInfo(threadId, function(err, data) {
            if (!err) {
                const ogColor = data.color; // Will be null if no custom color set
                api.changeThreadColor(co["setcolor"].m[1], threadId, function(err, data) {
                    if (!err) {
                        api.sendMessage(`Last color was ${ogColor}`, threadId);
                    }
                });
            }
        });
    } else if (co["hitlights"].m) {
        const colors = ["#6179af", "#7550eb", "#85a9cb", "#1a87de", "#8573db", "#42f1f2", "#07ef63"]; // TODO: randomize colors
        const threadId = ids.group; // Store in case it changes
        api.getThreadInfo(threadId, function(err, data) {
            if (!err) {
                const ogColor = data.color; // Will be null if no custom color set
                const delay = 500; // Delay between color changes (half second is a good default)
                for (let i = 0; i < colors.length; i++) { // Need block scoping for timeout
                    setTimeout(function() {
                        api.changeThreadColor(colors[i], threadId);
                        if (i == (colors.length - 1)) { // Set back to original
                            setTimeout(function() {
                                api.changeThreadColor(ogColor, threadId);
                            }, delay);
                        }
                    }, delay + (i * delay)); // Queue color changes
                }
            }
        });
    } else if (co["resetnick"].m && co["resetnick"].m[1]) {
        var user = co["resetnick"].m[1].toLowerCase();
        api.changeNickname("", ids.group, ids.members[ids.group][user]);
    } else if (co["setnick"].m && co["setnick"].m[1]) {
        var user = co["setnick"].m[1].toLowerCase();
        var newname = co["setnick"].m.input.split(co["setnick"].m[0]).join("").trim(); // Get rid of match to find rest of message
        api.changeNickname(newname, ids.group, ids.members[ids.group][user]);
    } else if (co["wakeup"].m && co["wakeup"].m[1]) {
        var user = co["wakeup"].m[1].toLowerCase();
        var members = ids.members[ids.group]; // Save in case it changes
        for (var i = 0; i < config.wakeUpTimes; i++) {
            setTimeout(function() {
                api.sendMessage("Wake up", members[user]);
            }, 500 + (500 * i));
        }
        sendMessage(`Messaged ${user.substring(0, 1).toUpperCase()}${user.substring(1)} ${config.wakeUpTimes} times`);
    } else if (co["randmess"].m) {
        const threadId = ids.group;
        // Get thread length
        api.getThreadInfo(threadId, function(err, data) {
            if (!err) {
                const count = data.messageCount;
                var randMessage = Math.floor(Math.random() * (count + 1));
                api.getThreadHistory(ids.group, 0, count, (new Date()).getTime(), function(err, data) {
                    if (err) {
                        console.log(err);
                        api.sendMessage("Error: Message could not be found", threadId);
                    } else {
                        var m = data[randMessage];
                        while (!(m && m.body)) {
                            randMessage = Math.floor(Math.random() * (count + 1));
                            m = data[randMessage];
                        }
                        var b = m.body,
                            name = m.senderName,
                            time = new Date(m.timestamp);
                        api.sendMessage(`${b} - ${name} (${time.toLocaleDateString()})`, threadId);
                    }
                });
            }
        });
    } else if (co["alive"].m) {
        sendEmoji(ids.group);
    } else if (co["resetemoji"].m) {
        api.changeThreadEmoji(config.defaultEmoji, ids.group);
    } else if (co["setemoji"].m && co["setemoji"].m[1]) {
        try {
            api.changeThreadEmoji(co["setemoji"].m[1], ids.group);
        } catch (e) {
            // Backup
            api.changeThreadEmoji(config.defaultEmoji, ids.group);
        }
    } else if (co["echo"].m && co["echo"].m[1] && co["echo"].m[2]) {
        var id = ids.group;
        var command = co["echo"].m[1].toLowerCase();
        var message = `${co["echo"].m[2]}`;
        if (command == "echo") {
            sendMessage(message);
        } else {
            api.getUserInfo(fromUserId, function(err, data) {
                if (!err) {
                    message = `"${message}" – ${data[fromUserId].name}`;
                    api.sendMessage(message, id);
                }
            });
        }
    }
}

// Check for commands that don't require a trigger (Easter eggs)
// Some commands may require additional configuration (and most only make sense for
// the original chat it was built for), so should be off by default
function handleEasterEggs(message, fromUserId, api = gapi) {
    if (config.easterEggs) {
        const threadId = message.threadID; // For async functions
        if (message.match(/genius/i)) {
            // Requires a photo called "genius.jpg" in the media subdirectory of root
            sendFile("media/genius.jpg");
        }
        if (message.match(/kys|cuck(?:ed)?|maga/i)) {
            sendMessage("Delete your account.")
        }
        if (message.match(/(?:problem |p)set/i)) {
            // Requires a text file under media
            fs.readFile("media/monologue.txt", "utf-8", function(err, text) {
                if (!err) {
                    api.sendMessage(text, threadId);
                }
            });
        }
        if (message.match(/^i mean$/i)) {
            // Requires "imean.png" under media
            sendFile("media/imean.png");
        }
    }
}

// Utility functions

function matchesWithUser(command, message, sep = " ") {
    return message.match(new RegExp(command + sep + config.userRegExp, "i"));
}

function sendMessage(m, api = gapi) {
    try {
        api.sendMessage(m, ids.group);
    } catch (e) { // For debug mode
        console.log(m);
    }
}

function sendError(m) {
    sendMessage("Error: " + m);
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
    api.removeUserFromGroup(userId, groupId);
    delete ids.members[groupId][userId]; // Remove from members obj
    if (time) {
        setTimeout(function() {
            addUser(userId, groupId);
            if (callback) {
                callback();
            }
        }, time * 1000);
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
            var user = data[id];
            api.sendMessage(`Welcome to ${config.groupName}, ${user.firstName}!`, groupId);
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
    var msg = {
        "body": message,
        "attachment": fs.createReadStream(`${__dirname}/${filename}`)
    }
    api.sendMessage(msg, threadId);
}
