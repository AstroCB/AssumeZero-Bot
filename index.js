const messenger = require("facebook-chat-api");
const ids = require("./ids"); // Various IDs stored for easy access
const config = require("./config"); // Config file
const credentials = require("./credentials"); // Login creds
var gapi; // Global API for external functions (set on login)

messenger({
    email: credentials.EMAIL,
    password: credentials.PASSWORD
}, function callback(err, api) {
    if (err) return console.error(err);
    gapi = api; // Set global API
    api.listen(function callback(err, message) {
        if (message && !err) {
            // console.log(message);
            if (message.threadID == ids.assume && message.type == "message" && message.senderId != ids.bot) { // Is from AØBP but not from bot
                var m = message.body;
                var senderId = message.senderID;

                // Handle new users
                if (!ids.contains(senderId) && senderId) { // New user
                    addNewUser(senderId, message);
                }

                //Handle pings
                var pingData = parsePing(m);
                var pingUsers = pingData.users;
                var pingMessage = pingData.message;
                api.getThreadInfo(ids.assume, function(err, data) {
                    for (var i = 0; i < pingUsers.length; i++) { // Loop doesn't run if no ping matches
                        if (!err) {
                            var message = "You have been summoned in Assume Zero Brain Power by " + data.nicknames[senderId];
                            if (pingMessage.length > 0) { // Message left after pings removed
                                message += " with the following message: \"" + pingMessage + "\"";
                            } else {
                                message += "."
                            }
                            api.sendMessage(message, ids.members[pingUsers[i]]);
                        }
                    }
                });

                // Pass to commands testing for trigger word
                var cindex = m.toLowerCase().indexOf(config.trigger);
                if (cindex > -1) { // Trigger command mode
                    handleCommand(m.substring(cindex + config.trigger.length), senderId);
                }
            }
        }
    });
});

function addNewUser(id, message, api = gapi) {
    api.getUserInfo(id, function(err, data) {
        if (!err) {
            var user = data[id];
            sendMessage("Welcome to Assume Zero Brain Power, " + user.firstName + " (user " + id + ")!", ids.assume);
        }
    });
}

function handleCommand(command, fromUserId, api = gapi) {
    // COMMANDS
    if (matchesWithUser("kick", command)) {
        var matches = matchesWithUser("kick", command);
        if (matches && matches[1]) {
            var user = matches[1].toLowerCase();
            switch (user) {
                default: try {
                    api.removeUserFromGroup(ids.members[user], ids.assume);
                } catch (e) {
                    sendError("User " + user + " not recognized");
                }
                break;
            }
        }
    } else if (command.match(/execute order 66/i)) {
        // Remove everyone from the chat for 15 seconds
        sendMessage("I hate you all.");
        setTimeout(function() {
            for (var m in ids.members) {
                if (ids.members.hasOwnProperty(m)) {
                    api.removeUserFromGroup(ids.members[m], ids.assume);
                }
            }
            setTimeout(function() {
                for (var m in ids.members) {
                    if (ids.members.hasOwnProperty(m)) {
                        api.addUserToGroup(ids.members[m], ids.assume);
                    }
                }
                sendMessage("Balance is restored to the Force.")
            }, 15000);
        }, 2000);
    } else if (command.match(/set color to (#(?:[a-f]|\d){6})/i)) {
        const match = command.match(/set color to (#(?:[a-f]|\d){6})/i);
        if (match && match[1]) {
            api.getThreadInfo(ids.assume, function(err, data) {
                if (!err) {
                    var ogColor = data.color; // Will be null if no custom color set
                    api.changeThreadColor(match[1], ids.assume, function() {
                        sendMessage("Last color was " + ogColor);
                    });
                }
            });
        }
    } else if (command.match(/hit the lights/i)) {
        const colors = ["#6179af", "#7550eb", "#85a9cb", "#1a87de", "#8573db", "#42f1f2", "#07ef63"];
        api.getThreadInfo(ids.assume, function(err, data) {
            if (!err) {
                const ogColor = data.color; // Will be null if no custom color set
                const delay = 500;
                for (let i = 0; i < colors.length; i++) {
                    setTimeout(function() {
                        api.changeThreadColor(colors[i], ids.assume, function() {});
                        if (i == (colors.length - 1)) { // Set back to original
                            setTimeout(function() {
                                api.changeThreadColor(ogColor, ids.assume, function() {});
                            }, delay);
                        }
                    }, delay + (i * delay)); // Queue color changes
                }
            }
        });
    }
}

const users = "(cam|larry|yiyi|jonah|colin|anton)";

function matchesWithUser(command, message, sep = " ") {
    return message.match(new RegExp(command + sep + users, "i"));
}

function sendMessage(m, api = gapi) {
    api.sendMessage(m, ids.assume);
}

function sendError(m) {
    sendMessage("Error: " + m);
}

function parsePing(m) {
    var users = [];
    var allMatch = m.match(/@(all|everyone)/i);
    if (allMatch && allMatch[1]) { // Alert everyone
        users = Object.keys(ids.members);
        m = m.split("@" + allMatch[1]).join("");
    } else {
        var matches = matchesWithUser("@", m, "");
        while (matches && matches[1]) {
            users.push(matches[1].toLowerCase());
            m = m.split("@" + matches[1]).join(""); // Remove discovered match from string
            matches = matchesWithUser("@", m, "");
        }
        // After loop, m will contain the message without the pings (the message to be sent)
    }
    return {
        "users": users,
        "message": m.trim() // Remove leading/trailing whitespace
    };
}
