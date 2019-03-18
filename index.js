// Dependencies
const messenger = require("facebook-chat-api"); // Chat API
const config = require("./config"); // Config file
const utils = require("./utils"); // Utility functions
const commands = require("./commands"); // Command documentation/configuration
const runner = require("./runcommand"); // For command handling code
const _ = require("./server"); // Server configuration (just needs to be loaded)
const easter = require("./easter"); // Easter eggs
var credentials;
try {
    // Login creds from local dir
    credentials = require("./credentials");
} catch (e) {
    // Deployed to Heroku or config file is missing
    credentials = process.env;
}
// External storage API (Memcachier) (requires credentials)
const mem = require("memjs").Client.create(credentials.MEMCACHIER_SERVERS, {
    "username": credentials.MEMCACHIER_USERNAME,
    "password": credentials.MEMCACHIER_PASSWORD
});
// Spotify API (requires credentials)
const spotify = new (require("spotify-web-api-node"))({
    "clientId": credentials.SPOTIFY_CLIENTID,
    "clientSecret": credentials.SPOTIFY_CLIENTSECRET
}); // Spotify API
var gapi; // Global API for external functions (set on login)

// Log in
if (require.main === module) { // Called directly; login immediately
    login(main);
}

function login(callback) {
    function withAppstate(appstate, callback) {
        console.log("Logging in with saved appstate...");
        messenger({
            appState: JSON.parse(appstate)
        }, (err, api) => {
            if (err) {
                withCreds(callback);
            } else {
                callback(err, api);
            }
        });
    }
    function withCreds(callback) {
        console.log("Logging in with credentials...");
        messenger({
            email: credentials.EMAIL,
            password: credentials.PASSWORD
        }, (err, api) => {
            mem.set("appstate", JSON.stringify(api.getAppState()), {}, merr => {
                if (err) {
                    return console.error(merr);
                } else {
                    callback(err, api);
                }
            });
        });
    }
    // Logging message with config details
    console.log(`Bot ${config.bot.id} logging in ${process.env.EMAIL ? "remotely" : "locally"} with trigger "${config.trigger}".`);
    mem.get("appstate", (err, val) => {
        if (!err && val) {
            withAppstate(val, callback);
        } else {
            withCreds(callback);
        }
    });
}
exports.login = login; // Export for external use

// Listen for commands
function main(err, api) {
    if (err) return console.error(err);
    gapi = api; // Initialize global API variable
    api.listen(handleMessage);
}

// Processes incoming messages
// Passed as callback to API's listen, but can also be called externally
// (function is exported as a part of this module)
function handleMessage(err, message, external = false, api = gapi) { // New message received from listen()
    if (message && !err) {
        // Update info of group where message came from in the background (unless it's an external call)
        if (!external && message.type == "message") {
            utils.updateGroupInfo(message.threadID, message);
        }
        // Load existing group data
        utils.getGroupInfo(message.threadID, (err, info) => {
            if (err || !info) {
                console.log(err);
            } else {
                // Handle messages
                const senderId = message.senderID;
                if (message.type == "message" && senderId != config.bot.id && !utils.isBanned(senderId, info)) { // Sender is not banned and is not the bot
                    const m = message.body;
                    const attachments = message.attachments;
                    // Handle message body
                    if (m) {
                        // Handle user pings
                        handlePings(m, senderId, info);
                        // Pass to commands testing for trigger word
                        const cindex = m.toLowerCase().indexOf(config.trigger);
                        if (cindex > -1) { // Trigger command mode
                            utils.handleCommand(m.substring(cindex + config.trigger.length), senderId, info, message); // Pass full message obj in case it's needed in a command
                        }
                        // Check for Easter eggs
                        easter.handleEasterEggs(message, senderId, attachments, info, api);
                    }
                }
            }
        });
    }
}
exports.handleMessage = handleMessage;

/*
  This is the main body of the bot; it handles whatever comes after the trigger word
  in the received message body and looks for matches of commands listed in the commands.js
  file, and then processes them accordingly.
*/
function handleCommand(command, fromUserId, groupInfo, messageLiteral, api = gapi) {
    const attachments = messageLiteral.attachments; // For commands that take attachments
    // Command preprocessing to compare command grammars against input and check for matches
    const co = commands.commands; // Short var names since I'll be typing them a lot
    for (let c in co) {
        if (co.hasOwnProperty(c)) {
            // Check whether command is sudo-protected and, if so, whether the user is the owner
            if (!co[c].sudo || (co[c].sudo && fromUserId == config.owner.id)) {
                // Set match vals
                if (co[c].user_input.accepts) { // Takes a match from the members dict
                    if (Array.isArray(co[c].regex)) { // Also has a regex suffix (passed as length 2 array)
                        co[c].m = utils.matchesWithUser(co[c].regex[0], command, fromUserId, groupInfo, co[c].user_input.optional, " ", co[c].regex[1]);
                    } else { // Just a standard regex prefex as a string + name
                        co[c].m = utils.matchesWithUser(co[c].regex, command, fromUserId, groupInfo, co[c].user_input.optional);
                    }
                } else {
                    co[c].m = command.match(co[c].regex);
                }
            } else { // User not authorized
                // Set match to null to prevent checking issues
                co[c].m = null;
            }
            // Update usage statistics if command is matched
            if (co[c].m) {
                utils.updateStats(c, fromUserId);
            }
        }
    }
    debugCommandOutput(false);
    // Check commands for matches & eval
    runner.run(api, co, groupInfo, fromUserId, attachments);
}
exports.handleCommand = handleCommand; // Export for external use

function debugCommandOutput(flag) {
    if (flag) {
        const co = commands.commands;
        console.log(Object.keys(co).map((c) => {
            return `${c}: ${co[c].m}`
        }));
    }
}

// Parses a sent message for pings, removes them from the message,
// and extracts the intended users from the ping to send the message to them
function parsePing(m, fromUserId, groupInfo) {
    let users = [];
    const allMatch = m.match(/@@(all|everyone|channel)/i);
    if (allMatch && allMatch[1]) { // Alert everyone
        users = Object.keys(groupInfo.members);
        // Remove sending user from recipients
        users.splice(users.indexOf(groupInfo.names[fromUserId].toLowerCase()), 1);
        m = m.split("@@" + allMatch[1]).join("");
    } else {
        let matches = utils.matchesWithUser("@@", m, fromUserId, groupInfo, false, "");
        while (matches && matches[1]) {
            users.push(matches[1].toLowerCase());
            const beforeSplit = m;
            m = m.split(`@@${matches[1]}`).join(""); // Remove discovered match from string
            if (m == beforeSplit) { // Discovered match was "me" or alias
                m = m.split("@@me").join("");
                const alias = groupInfo.aliases[matches[1]];
                if (alias) {
                    m = m.split(`@@${alias}`).join("");
                }
            }
            matches = utils.matchesWithUser("@@", m, fromUserId, groupInfo, false, "");
        }
        // After loop, m will contain the message without the pings (the message to be sent)
    }
    return {
        /* Return array of names to ping, but remove sending user */
        "users": users.filter(e => (e != groupInfo.names[fromUserId].toLowerCase())),
        "message": m.trim() // Remove leading/trailing whitespace
    };
}

function handlePings(msg, senderId, info) {
    const pingData = parsePing(msg, senderId, info);
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