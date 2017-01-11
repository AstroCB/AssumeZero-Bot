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
    api.setOptions({
        updatePresence: true
    });

    api.listen(function callback(err, message) {
        if (config.dynamic) { // See config for explanation
            setEnvironmentVariables(message);
        }
        if (message && !err) {
            // Handle messages
            // console.log(message);
            if (message.type == "message" && message.senderId != ids.bot && !isBanned(message.senderId)) { // Is from AØBP but not from bot
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
                        } else {
                            // Check for Easter eggs
                            handleEasterEggs(m, senderId);
                        }
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
            // Handle presence notifications
            if (message.type == "presence") {
                var name = ids.members[ids.group][message.userID];
                if (name) {
                    api.sendMessage("Welcome back, " + name.charAt(0).toUpperCase() + name.substring(1), ids.assume);
                }
            }
        }
    });
}

function addNewUser(id, message, api = gapi) {
    api.getUserInfo(id, function(err, data) {
        if (!err) {
            var user = data[id];
            sendMessage("Welcome to" + config.groupName + ", " + user.firstName + " (user " + id + ")!", ids.group);
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
            sendError("User " + user + " not recognized");
        }
    } else if (co["addsearch"].m && co["addsearch"].m[1] && co["addsearch"].m[2]) {
        var threadId = ids.group;
        var user = co["addsearch"].m[2]
        try {
            api.getUserID(user, function(err, data) {
                if (!err) {
                    var bestMatch = data[0]; // Hopefully the right person
                    if (co["addsearch"].m[1].toLowerCase() == "search") {
                        sendMessage(bestMatch.profileUrl); // Best match
                    } else {
                        // Add user to group and update log of member IDs
                        addUser(bestMatch.userID, threadId);
                        api.getUserInfo(bestMatch.userID, function(err, info) {
                            if (!err) {
                                var fn = info[bestMatch.userID].firstName || bestMatch.name.split()[0] // Backup
                                if (!ids.members[threadId][fn.toLowerCase()]) {
                                    ids.members[threadId][fn.toLowerCase()] = bestMatch.userID;
                                    config.userRegExp = utils.setRegexFromMembers(threadId);
                                }
                            }
                        });
                    }
                } else {
                    api.sendMessage(`Error: ${err.error}`, threadId);
                }
            });
        } catch (e) {
            sendError(`User ${user} not recognized`);
        }
    } else if (co["order66"].m) {
        // Remove everyone from the chat for 15 seconds
        sendMessage("I hate you all.");
        var groupId = ids.group; // Store in case it changes later
        setTimeout(function() {
            var callbackset = false;
            for (var m in ids.members[groupId]) {
                // Bot should never be in members list, but this is a safeguard
                if (ids.members[groupId].hasOwnProperty(m) && ids.members[groupId][m] != ids.bot) {
                    if (!callbackset) { // Only want to send the message once
                        kick(ids.members[groupId][m], config.order66Time, groupId, function() {
                            api.sendMessage("Balance is restored to the Force.", groupId);
                        });
                        callbackset = true;
                    } else {
                        kick(ids.members[groupId][m], 15);
                    }
                }
            }
        }, 2000);
    } else if (co["resetcolor"].m) {
        api.changeThreadColor(config.defaultColor, ids.group);
    } else if (co["setcolor"].m && co["setcolor"].m[1]) {
        api.getThreadInfo(ids.group, function(err, data) {
            if (!err) {
                const ogColor = data.color; // Will be null if no custom color set
                api.changeThreadColor(co["setcolor"].m[1], ids.group, function() {
                    sendMessage("Last color was " + ogColor);
                });
            }
        });
    } else if (co["hitlights"].m) {
        const colors = ["#6179af", "#7550eb", "#85a9cb", "#1a87de", "#8573db", "#42f1f2", "#07ef63"];
        api.getThreadInfo(ids.group, function(err, data) {
            if (!err) {
                const ogColor = data.color; // Will be null if no custom color set
                const delay = 500;
                var groupId = ids.group; // Store in case it changes
                for (let i = 0; i < colors.length; i++) {
                    setTimeout(function() {
                        api.changeThreadColor(colors[i], groupId);
                        if (i == (colors.length - 1)) { // Set back to original
                            setTimeout(function() {
                                api.changeThreadColor(ogColor, groupId);
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
        sendMessage("Messaged " + user.substring(0, 1).toUpperCase() + user.substring(1) + " " + config.wakeUpTimes + " times");
    } else if (co["randmess"].m) {
        // Get thread length
        api.getThreadInfo(ids.group, function(err, data) {
            if (!err) {
                var count = data.messageCount;
                var randMessage = Math.floor(Math.random() * (count + 1));
                api.getThreadHistory(ids.group, 0, count, (new Date()).getTime(), function(err, data) {
                    if (err) {
                        console.log(err);
                        sendError("Message could not be found");
                    } else {
                        var m = data[randMessage];
                        while (!(m && m.body)) {
                            randMessage = Math.floor(Math.random() * (count + 1));
                            m = data[randMessage];
                        }
                        var b = m.body,
                            name = m.senderName,
                            time = new Date(m.timestamp);
                        sendMessage(b + " - " + name + " (" + time.toLocaleDateString() + ")");
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
    } else if (co["xkcd"].m && co["xkcd"].m[1]) {
        var command = co["xkcd"].m[1];
        var query = co["xkcd"].m[2];
        var threadId = ids.group;
        if (query) {
            // Perform search using Google Custom Search API (provide API key / custom engine in config.js)
            const url = `https://www.googleapis.com/customsearch/v1?key=${config.xkcd.key}&cx=${config.xkcd.engine}&q=${encodeURIComponent(query)}`;
            request(url, function(err, res, body) {
                if (!err && res.statusCode == 200) {
                    var results = JSON.parse(body).items;
                    if (results.length > 0) {
                        api.sendMessage({
                            "url": results[0].formattedUrl // Best match
                        }, threadId);
                    } else {
                        sendError("No results found");
                    }
                } else {
                    console.log(err);
                }
            });
        } else {
            sendMessage({
                "url": `http://xkcd.com/${command}`
            });
        }
    }
}

// Check for commands that don't require a trigger (Easter eggs)
// Some commands may require additional configuration
function handleEasterEggs(message, senderId) {
    if (message.match(/genius/i)) {
        // Requires a photo called "genius.jpg" in a media subdirectory of root
        sendFile("media/genius.jpg");
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

function addUser(id, groupId = ids.group, api = gapi) {
    api.getUserInfo(id, function(err, info) {
        api.addUserToGroup(id, groupId, function(err, data) {
            if (!err && info) {
                // Add back to members obj
                ids.members[groupId][info[id].firstName.toLowerCase()] = id;
            }
        })
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
