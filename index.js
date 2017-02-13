// Dependencies
const messenger = require("facebook-chat-api"); // Chat API
const fs = require("fs"); // File system
const exec = require("child_process").exec;
const request = require("request"); // For HTTP requests
const image = require("jimp"); // For image processing
const ids = require("./ids"); // Various IDs stored for easy access
const config = require("./config"); // Config file
const utils = require("./configutils"); // Utility functions
const commands = require("./commands"); // Command documentation/configuration
const server = require("./server"); // Server configuration
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
const spotify = new(require("spotify-web-api-node"))({
    "clientId": credentials.SPOTIFY_CLIENTID,
    "clientSecret": credentials.SPOTIFY_CLIENTSECRET
}); // Spotify API
var gapi; // Global API for external functions (set on login)

// Log in
if (require.main === module) { // Called directly; login immediately
    login((err, api) => {
        main(err, api);
    });
}

function login(callback) {
    // Logging message with config details
    console.log(`Bot ${ids.bot} logging in ${process.env.EMAIL ? "remotely" : "locally"} with dynamic mode ${config.dynamic ? "on" : "off"}, with trigger "${config.trigger}", and with Easter eggs ${config.easterEggs ? "on" : "off"}.`);
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
}
exports.login = login; // Export for external use

// Listen for commands
function main(err, api) {
    if (err) return console.error(err);
    gapi = api; // Initialize global API variable
    api.listen(handleMessage);
}

function handleMessage(err, message, api = gapi) { // New message received from listen()
    if (config.dynamic) { // See config for explanation
        setEnvironmentVariables(message);
    }
    if (message && !err) {
        // Handle messages
        if (message.type == "message" && message.senderID != ids.bot && !isBanned(message.senderID)) { // Is from AØBP but not from bot
            if (message.threadID == ids.group) { // Message from main group (or current group, if in dynamic mode)
                const m = message.body;
                const attachments = message.attachments;
                const senderId = message.senderID;
                const groupId = ids.group;
                // Handle message body
                if (m) {
                    // Handle pings
                    const pingData = parsePing(m, senderId, groupId);
                    const pingUsers = pingData.users;
                    const pingMessage = pingData.message;
                    if (pingUsers) {
                        api.getUserInfo(senderId, (err, userData) => {
                            const nameBackup = userData[senderId].firstName;
                            api.getThreadInfo(groupId, (err, data) => {
                                const members = ids.members[groupId];
                                if (members) {
                                    for (var i = 0; i < pingUsers.length; i++) {
                                        if (!err) {
                                            const sender = data.nicknames[senderId] || nameBackup;
                                            var message = `${sender} summoned you in ${data.name}`;
                                            if (pingMessage.length > 0) { // Message left after pings removed – pass to receiver
                                                message = `"${pingMessage}" – ${sender} in ${data.name}`;
                                            }
                                            message += ` at ${getTimeString()}` // Time stamp
                                            sendMessage(message, members[pingUsers[i]]);
                                        }
                                    }
                                } else {
                                    console.log("Members not yet loaded for ping");
                                }
                            });
                        });
                    }

                    // Pass to commands testing for trigger word
                    const cindex = m.toLowerCase().indexOf(config.trigger);
                    if (cindex > -1) { // Trigger command mode
                        handleCommand(m.substring(cindex + config.trigger.length), senderId, message); // Pass full message obj in case it's needed in a command
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
            } else if (message.threadID != ids.group) {
                // Not from main group (static group mode)
            }
        }
    }
}
exports.handleMessage = handleMessage;

/*
  This is the main body of the program; it handles whatever comes after the trigger word
  in the received message body and looks for matches of commands listed in the commands.js
  file, and then processes them accordingly.
*/
function handleCommand(command, fromUserId, messageLiteral, api = gapi) {
    const threadId = ids.group; // For async callbacks
    const attachments = messageLiteral.attachments; // For commands that take attachments
    // Evaluate commands
    const co = commands.commands; // Short var names since I'll be typing them a lot
    for (let c in co) {
        if (co.hasOwnProperty(c)) {
            // Check whether command is sudo-protected and, if so, whether the user is the admin
            if ((co[c].sudo && fromUserId == ids.owner) || !co[c].sudo) {
                // Set match vals
                if (co[c].user_input.accepts) { // Takes a match from the members dict
                    if (Array.isArray(co[c].regex)) { // Also has a regex suffix (passed as length 2 array)
                        co[c].m = matchesWithUser(co[c].regex[0], command, fromUserId, co[c].user_input.optional, threadId, " ", co[c].regex[1]);
                    } else { // Just a standard regex prefex as a string + name
                        co[c].m = matchesWithUser(co[c].regex, command, fromUserId, co[c].user_input.optional, threadId);
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
                sendMessage(`Entry for command "${info.pretty_name}":\n${info.description}\n\nSyntax: ${config.trigger} ${info.syntax}${info.attachments ? "\n\n(This command accepts attachments)" : ""}${info.sudo ? "\n\n(This command requires admin privileges)" : ""}${info.experimental ? "\n\n(This command is experimental)" : ""}`, threadId);
            } else {
                sendError(`Help entry not found for ${input}`, threadId);
            }
        } else {
            // No command passed; give overview of all of them
            let mess = `Quick help for AØBøt:\n\nPrecede these commands with "${config.trigger}":\n`;
            for (var c in co) {
                if (co.hasOwnProperty(c)) {
                    const entry = co[c];
                    // Only display short description if one exists
                    mess += `${entry.syntax}${entry.short_description ? `: ${entry.short_description}` : ""}\n`
                    mess += "------------------\n"; // Suffix for separating commands
                }
            }
            mess += `The bot goes to sleep every night from ~3 AM - 9 AM ET. Contact Cameron Bernhardt with any questions.\n\nTip: for more detailed descriptions, use "${config.trigger} help (command)"`;
            sendMessage(mess, threadId);
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
    } else if (co["xkcd"].m) { // Check before regular search to prevent clashes
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
                }, threadId);
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
    } else if (co["spotsearch"].m && co["spotsearch"].m[1] && co["spotsearch"].m[2]) {
        logInSpotify((err, data) => {
            if (!err) {
                const query = co["spotsearch"].m[2];
                if (co["spotsearch"].m[1].toLowerCase() == "artist") {
                    // Artist search
                    spotify.searchArtists(query, {}, (err, data) => {
                        if (!err && data.body) {
                            const bestMatch = data.body.artists.items[0];
                            const id = bestMatch.id;
                            if (id) {
                                spotify.getArtistTopTracks(id, "US", (err, data) => {
                                    if (!err) {
                                        const tracks = data.body.tracks;
                                        const link = bestMatch.external_urls.spotify;
                                        const image = bestMatch.images[0];
                                        const popularity = bestMatch.popularity;
                                        let message = `Best match: ${bestMatch.name}\nPopularity: ${popularity}%\n\nTop tracks:\n`
                                        for (let i = 0; i < config.spotifySearchLimit; i++) {
                                            if (tracks[i]) {
                                                message += `${tracks[i].name}${tracks[i].explicit ? " (Explicit)" : ""} (from ${tracks[i].album.name})${(i != config.spotifySearchLimit - 1) ? "\n" : ""}`;
                                            }
                                        }

                                        if (image) {
                                            // Send image of artist
                                            sendFileFromUrl(image, "media/artist.png", message, threadId);
                                        } else if (link) {
                                            // Just send link
                                            sendMessage({
                                                "body": message,
                                                "url": bestMatch
                                            }, threadId);
                                        } else {
                                            // Just send message
                                            sendMessage(message, threadId);
                                        }
                                    }
                                });
                            } else {
                                sendError(`No results found for query "${query}"`, threadId);
                            }
                        } else {
                            sendError(err, threadId)
                        }
                    });
                } else {
                    // Song search
                    spotify.searchTracks(query, {}, (err, data) => {
                        if (!err) {
                            const bestMatch = data.body.tracks.items[0];
                            if (bestMatch) {
                                const message = `Best match: ${bestMatch.name} by ${getArtists(bestMatch)} (from ${bestMatch.album.name})${bestMatch.explicit ? " (Explicit)" : ""}`;
                                const url = bestMatch.external_urls.spotify;
                                const preview = bestMatch.preview_url;

                                if (preview) {
                                    // Upload preview
                                    sendFileFromUrl(preview, "media/preview.mp3", message, threadId);
                                } else {
                                    // Just send Spotify URL
                                    sendMessage({
                                        "body": message,
                                        "url": url
                                    }), threadId;
                                }
                            } else {
                                sendError(`No results found for query "${query}"`, threadId);
                            }
                        } else {
                            sendError(err, threadId);
                        }
                    });
                }
            } else {
                console.log(err);
            }
        });
    } else if (co["spotadd"].m && co["spotadd"].m[1]) {
        logInSpotify((err, data) => {
            if (!err) {
                const query = co["spotadd"].m[1];
                spotify.searchTracks(query, {}, (err, data) => {
                    if (!err) {
                        const bestMatch = data.body.tracks.items[0];

                        if (bestMatch) {
                            console.log(bestMatch.uri)
                            spotify.addTracksToPlaylist(config.groupPlaylist.user, config.groupPlaylist.uri, [bestMatch.uri], (err) => {
                                if (!err) {
                                    sendMessage(`Added ${bestMatch.name} by ${getArtists(bestMatch)} to ${config.groupPlaylist.name}'s playlist'`, threadId);
                                } else {
                                    sendError(`Couldn't add ${bestMatch.name} to playlist`, threadId);
                                }
                            });
                        } else {
                            sendError(`Song not found for query ${query}`, threadId);
                        }
                    } else {
                        sendError(err, threadId);
                    }
                })
            } else {
                console.log(err);
            }
        });
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
        sendMessage("I hate you all.", threadId);
        setTimeout(() => {
            let callbackset = false;
            for (let m in ids.members[threadId]) {
                // Bot should never be in members list, but this is a safeguard
                // (ALSO VERY IMPORTANT so that group isn't completely emptied)
                if (ids.members[threadId].hasOwnProperty(m) && ids.members[threadId][m] != ids.bot) {
                    if (!callbackset) { // Only want to send the message once
                        kick(ids.members[threadId][m], config.order66Time, threadId, () => {
                            sendMessage("Balance is restored to the Force.", threadId);
                        });
                        callbackset = true;
                    } else {
                        kick(ids.members[threadId][m], config.order66Time, threadId);
                    }
                }
            }
        }, 2000); // Make sure people see the message (and impending doom)
    } else if (co["setcolor"].m) {
        if (co["setcolor"].m[1]) { // Reset
            api.changeThreadColor(config.defaultColor, threadId);
        } else if (co["setcolor"].m[2]) {
            const colorToSet = (co["setcolor"].m[2].match(/rand(om)?/i)) ? getRandomColor() : co["setcolor"].m[2];
            api.getThreadInfo(threadId, function(err, data) {
                if (!err) {
                    const ogColor = data.color; // Will be null if no custom color set
                    api.changeThreadColor(colorToSet, threadId, function(err, data) {
                        if (!err) {
                            sendMessage(`Last color was ${ogColor}`, threadId);
                        }
                    });
                }
            });
        }
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
        sendMessage(`Messaged ${user.substring(0, 1).toUpperCase()}${user.substring(1)} ${config.wakeUpTimes} times`, threadId);
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
    } else if (co["setemoji"].m) {
        if (co["setemoji"].m[1]) {
            // Reset
            api.changeThreadEmoji(config.defaultEmoji, threadId, (err) => {
                if (err) {
                    console.log(err);
                }
            });
        } else if (co["setemoji"].m[2]) {
            // Set
            api.changeThreadEmoji(co["setemoji"].m[2], threadId, (err) => {
                if (err) {
                    // Set to default as backup if errors
                    api.changeThreadEmoji(config.defaultEmoji, threadId);
                }
            });
        }
    } else if (co["echo"].m && co["echo"].m[1] && co["echo"].m[2]) {
        const command = co["echo"].m[1].toLowerCase();
        var message = `${co["echo"].m[2]}`;
        if (command == "echo") {
            // Just an echo – repeat message
            sendMessage(message, threadId);
        } else {
            // Quote - use name
            api.getUserInfo(fromUserId, function(err, data) {
                if (!err) {
                    // Date formatting
                    const now = new Date();
                    const date = now.getDate();
                    const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
                    const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][now.getMonth()];
                    const year = now.getFullYear();

                    message = `"${message}" – ${data[fromUserId].name}\n${day}, ${month} ${date}, ${year}`;
                    sendMessage(message, threadId);
                }
            });
        }
    } else if (co["ban"].m && co["ban"].m[2]) {
        const user = co["ban"].m[2].toLowerCase();
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
    } else if (co["dynamic"].m && co["dynamic"].m[1]) {
        const setting = co["dynamic"].m[1].toLowerCase();
        const isEnabled = (setting == "on");
        sendMessage(`Turning dynamic mode ${setting} and restarting; give me a moment`, threadId);

        if (process.env.EMAIL) { // Heroku
            request.patch({
                "url": "https://api.heroku.com/apps/assume-bot/config-vars",
                "form": {
                    "DYNAMIC": isEnabled
                },
                "headers": {
                    "Accept": "application/vnd.heroku+json; version=3",
                    "Authorization": `Bearer ${credentials.TOKEN}` // Requires Heroku OAuth token for modifying config vars
                }
            }); // Should trigger auto-restart on Heroku
        } else { // Local
            config.dynamic = isEnabled;
            if (!isEnabled) {
                // Set back to defaults
                setEnvironmentVariables({
                    "threadID": ids.defaultGroup
                });
            }
        }
    } else if (co["vote"].m && co["vote"].m[1] && co["vote"].m[2]) {
        const user = co["vote"].m[2].toLowerCase();
        const userId = ids.members[threadId][user];
        const user_cap = user.substring(0, 1).toUpperCase() + user.substring(1);
        const getCallback = (isAdd) => {
            return (err, success, newScore) => {
                if (success) {
                    sendMessage(`${user_cap}'s current score is now ${newScore}.`, threadId);
                } else {
                    sendError("Score update failed.", threadId);
                }
            };
        };
        if (userId) {
            if (co["vote"].m[1] == ">") {
                // Upvote
                updateScore(true, userId, getCallback(true));
            } else {
                // Downvote
                updateScore(false, userId, getCallback(false));
            }
        } else {
            sendError(`User ${user_cap} not found`, threadId);
        }
    } else if (co["score"].m && co["score"].m[2]) {
        const user = co["score"].m[2].toLowerCase();
        const userId = ids.members[threadId][user];
        const user_cap = user.substring(0, 1).toUpperCase() + user.substring(1);
        if (userId) {
            const new_score = co["score"].m[1];
            if (new_score || new_score == "0") { // Set to provided score if valid (0 is falsey)
                setScore(userId, new_score, (err, success) => {
                    if (success) {
                        sendMessage(`${user_cap}'s score updated to ${new_score}.`, threadId);
                    } else {
                        sendError(err, threadId);
                    }
                });
            } else { // No value provided; just display score
                getScore(`userId`, (err, val) => {
                    if (!err) {
                        const stored_score = val.toString() || 0;
                        sendMessage(`${user_cap}'s current score is ${stored_score}.`, threadId);
                    } else {
                        console.log(err);
                    }
                });
            }
        } else {
            sendError(`User ${user_cap} not found`, threadId);
        }
    } else if (co["restart"].m) {
        restart(() => {
            sendMessage("Restarting...", threadId);
        });
    } else if (co["song"].m) {
        spotify.clientCredentialsGrant({}, (err, data) => {
            if (!err) {
                spotify.setAccessToken(data.body.access_token);
                const user = co["song"].m[1] ? co["song"].m[1].toLowerCase() : null;
                const userId = ids.members[threadId][user];
                const playlists = config.spotifyPlaylists; // Provide data in config
                let playlist;
                if (user && userId) {
                    // User specified
                    const users = playlists.map((plst) => {
                        return plst.id;
                    });
                    if (users.indexOf(userId) > -1) {
                        // User has a playlist
                        playlist = playlists[users.indexOf(userId)];
                    } else {
                        playlist = config.defaultPlaylist;
                        sendMessage(`User ${user.substring(0,1).toUpperCase() + user.substring(1)} does not have a stored playlist; using ${playlist.name}'s instead`, threadId);
                    }
                } else {
                    // No playlist specified; grab random one
                    playlist = playlists[Math.floor(Math.random() * playlists.length)];
                }

                spotify.getPlaylist(playlist.user, playlist.uri, {}, (err, data) => {
                    if (!err) {
                        const name = data.body.name;
                        const songs = data.body.tracks.items;
                        const track = songs[Math.floor(Math.random() * songs.length)].track;
                        sendMessage(`Grabbing a song from ${playlist.name}'s playlist, "${name}"...`, threadId);
                        const msg = `How about ${track.name} (from "${track.album.name}") by ${getArtists(track)}${track.explicit ? " (Explicit)" : ""}?`;
                        if (track.preview_url) {
                            // Send preview MP3 to chat if exists
                            sendFileFromUrl(track.preview_url, "media/preview.mp3", msg, threadId);
                        } else {
                            sendMessage({
                                "body": msg,
                                "url": track.external_urls.spotify // Should always exist
                            }, threadId);
                        }

                    } else {
                        console.log(err);
                    }
                });
            }
        });
    } else if (co["photo"].m) {
        // Set group photo to photo at provided URL
        const url = co["photo"].m[1];
        if (url) {
            // Use passed URL
            setGroupImageFromUrl(url, threadId, "Can't set group image for this chat");
        } else if (attachments && attachments[0]) {
            if (attachments[0].type == "photo") {
                // Use photo attachment
                setGroupImageFromUrl(attachments[0].previewUrl, threadId, "Attachment is invalid");
            } else {
                sendError("This command only accepts photo attachments", threadId);
            }
        } else {
            sendError("This command requires either a valid image URL or a photo attachment", threadId);
        }
    } else if (co["title"].m && co["title"].m[1]) {
        const title = co["title"].m[1];
        api.setTitle(title, threadId, (err) => {
            if (err) {
                sendError("Cannot set title for non-group chats", threadId);
            }
        });
    } else if (co["answer"].m) {
        sendMessage(config.answerResponses[Math.floor(Math.random() * config.answerResponses.length)], threadId);
    } else if (co["rng"].m) {
        let lowerBound, upperBound;
        if (co["rng"].m[2]) {
            lowerBound = parseInt(co["rng"].m[1]); // Assumed to exist if upperBound was passed
            upperBound = parseInt(co["rng"].m[2]);
        } else { // No last parameter
            lowerBound = config.lowerBoundDefault;
            if (co["rng"].m[1]) { // Only parameter passed becomes upper bound
                upperBound = parseInt(co["rng"].m[1]);
            } else { // No params passed at all
                upperBound = config.upperBoundDefault;
            }
        }
        const rand = Math.floor(Math.random() * (upperBound - lowerBound + 1)) + lowerBound;
        const chance = Math.abs(((1.0 / (upperBound - lowerBound + 1)) * 100).toFixed(2));
        sendMessage(`${rand}\n\nWith bounds of (${lowerBound}, ${upperBound}), the chances of receiving this result were ${chance}%`, threadId);
    } else if (co["bw"].m) {
        const url = co["bw"].m[1];
        if (url) { // URL passed
            const filename = `media/${encodeURIComponent(url)}.png`;
            image.read(url, (err, file) => {
                if (err) {
                    sendError("Unable to retreive image from that URL", threadId);
                } else {
                    file.greyscale().write(filename, (err) => {
                        if (!err) {
                            sendFile(filename, threadId, "", () => {
                                fs.unlink(filename);
                            });
                        }
                    });
                }
            });
        } else if (attachments) {
            for (let i = 0; i < attachments.length; i++) {
                if (attachments[i].type == "photo") {
                    const filename = `media/${attachments[i].name}.png`;
                    image.read(attachments[i].previewUrl, (err, file) => {
                        if (err) {
                            sendError("Invalid file", threadId);
                        } else {
                            file.greyscale().write(filename, (err) => {
                                if (!err) {
                                    sendFile(filename, threadId, "", () => {
                                        fs.unlink(filename);
                                    });
                                }
                            });
                        }
                    });
                } else {
                    sendError(`Sorry, but ${attachments[i].name} is not an acceptable file type`, threadId);
                }
            }
        } else {
            sendError("You must provide either a URL or a valid image attachment", threadId);
        }
    } else if (co["flip"].m) {
        const url = co["flip"].m[1];
        if (url) { // URL passed
            const filename = `media/${encodeURIComponent(url)}.png`;
            image.read(url, (err, file) => {
                if (err) {
                    sendError("Unable to retreive image from that URL", threadId);
                } else {
                    file.flip().write(filename, (err) => {
                        if (!err) {
                            sendFile(filename, threadId, "", () => {
                                fs.unlink(filename);
                            });
                        }
                    });
                }
            });
        } else if (attachments) {
            for (let i = 0; i < attachments.length; i++) {
                if (attachments[i].type == "photo") {
                    const filename = `media/${attachments[i].name}.png`;
                    image.read(attachments[i].previewUrl, (err, file) => {
                        if (err) {
                            sendError("Invalid file", threadId);
                        } else {
                            file.flip().write(filename, (err) => {
                                if (!err) {
                                    sendFile(filename, threadId, "", () => {
                                        fs.unlink(filename);
                                    });
                                }
                            });
                        }
                    });
                } else {
                    sendError(`Sorry, but ${attachments[i].name} is not an acceptable file type`, threadId);
                }
            }
        } else {
            sendError("You must provide either a URL or a valid image attachment", threadId);
        }
    }
}
exports.handleCommand = handleCommand; // Export for external use

// Check for commands that don't require a trigger (Easter eggs)
// Some commands may require additional configuration (and most only make sense for
// the original chat it was built for), so should be off by default
function handleEasterEggs(message, threadId, fromUserId, api = gapi) {
    if (config.easterEggs) {
        if (message.match(/genius/i)) {
            sendFile("media/genius.jpg", threadId);
        }
        if (message.match(/kys|cuck(?:ed)?|maga/i)) {
            sendMessage("Delete your account.", threadId)
        }
        if (message.match(/(?:problem |p)set(?:s)?/i)) {
            sendContentsOfFile("media/monologue.txt", threadId);
        }
        if (message.match(/umd/i)) {
            sendFile("media/umd.png", threadId);
        }
        if (message.match(/cornell/i)) {
            sendMessage({
                "url": "https://www.youtube.com/watch?v=yBUz4RnoWSM"
            }, threadId);
        }
        if (message.match(/swarthmore/i)) {
            sendFile("media/jonah.png", threadId);
        }
        if (message.match(/purdue/i)) {
            sendMessage("I hear they have good chicken", threadId);
        }
        if (message.match(/nyu/i)) {
            sendMessage("We don't speak of it", threadId);
        }
        if (message.match(/commit seppuku/i)) {
            sendMessage("RIP", threadId);
        }
        if (message.match(/physics c(?:[^A-z]|$)/i)) {
            sendMessage({
                "url": "https://www.youtube.com/watch?v=HydsTDvEINo"
            }, threadId);
        }
        if (message.match(/(?:\s|^)mechanics|electricity|magnetism|pulley|massless|friction|acceleration|torque|impulse/i)) {
            sendFile("media/shaw.png", threadId);
        }
        const bac = matchesWithUser("(?:get|measure) bac(?:[^k]|$)", message, fromUserId, true, threadId, "");
        if (bac) {
            const name = bac[1] || "Yiyi";
            sendMessage(`${name.substring(0,1).toUpperCase() + name.substring(1)}'s BAC is far above healthy levels`, threadId);
        }
        if (message.match(new RegExp(`${config.trigger} .* cam$`, "i"))) {
            sendMessage("eron", threadId);
        }
        if (message.match(/socialis(?:t|m)/i)) {
            sendFile("media/anton.png", threadId);
        }
        if (message.match(/pre(?:-|\s)?med/i)) {
            sendFile("media/premed.png", threadId);
        }
        if (message.match(/(\s|^)sleep/i)) {
            sendMessage("Have I got a story to tell you about various fruits...", threadId);
        }
        if (message.match(/good(?:\s)?night(?:\, )?bot/i)) {
            sendMessage("Night!", threadId);
        }
        if (message.match(/public funds/i)) {
            sendFile("media/dirks.png", threadId);
        }
        if (message.match(/darth plagueis/i)) {
            sendContentsOfFile("media/plagueis.txt", threadId);
        }
        if (message.match(/(\s|^)lit([^A-z0-9]|$)/i)) {
            sendMessage("🔥", threadId);
        }
        if (message.match(/pozharski(y)?/i)) {
            sendFile("media/pozharskiy.mp4", threadId);
        }
        if (message.match(/money/i)) {
            sendFile("media/money.png", threadId);
        }
        if (message.match(/rest of the country/i)) {
            sendMessage({
                "url": "https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap16_physics_c_mech_sg.pdf"
            }, threadId);
        }
        if (message.match(/(^|\s)drug/i)) {
            sendFile("media/drugs.png", threadId);
        }
        if (message.match(/(^|\s)how(\?|$)/i)) {
            sendFile("media/speedforce.mp4", threadId);
        }
        if (message.match(/(^|\s)frat/i)) {
            sendFile("media/frat.jpg", threadId);
        }
    }
}

// Utility functions

function matchesWithUser(command, message, fromUserId, optional = false, threadId = ids.group, sep = " ", suffix = "") {
    // Construct regex string
    let match = message.match(new RegExp(`${command}${optional ? "(?:" : ""}${sep}${config.userRegExp}${optional ? ")?" : ""}${suffix}`, "i"));
    // Now look for instances of "me" in the command and replace with the calling user
    if (match) {
        // Preserve properties
        const index = match.index;
        const input = match.input;
        match = match.map((m) => {
            if (m) {
                return m.replace(/(^| )me(?:[^A-z0-9]|$)/i, "$1" + getNameFromId(fromUserId, threadId));
            }
        });
        match.index = index;
        match.input = input;
    }
    return match;
}

// Wrapper function for sending messages easily
// Isn't that much simpler than the actual message function, but it
// allows for an optional thread parameter (default is currently stored ID)
// and for outputting messages to stdout when the API isn't available (e.g. before login)
// Accepts either a simple string or a message object with URL/attachment fields
// Probably a good idea to use this wrapper for all sending instances for debug purposes
// and consistency
function sendMessage(m, threadId = ids.group, callback = () => {}, api = gapi) {
    try {
        api.sendMessage(m, threadId, callback);
    } catch (e) { // For debug mode (API not available)
        console.log(`${threadId}: ${m}`);
        callback();
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

function parsePing(m, fromUserId, threadId) {
    let users = [];
    const allMatch = m.match(/@@(all|everyone)/i);
    if (allMatch && allMatch[1]) { // Alert everyone
        users = Object.keys(ids.members[ids.group]);
        m = m.split("@@" + allMatch[1]).join("");
    } else {
        let matches = matchesWithUser("@@", m, fromUserId, false, threadId, "");
        while (matches && matches[1]) {
            users.push(matches[1].toLowerCase());
            const beforeSplit = m;
            m = m.split("@@" + matches[1]).join(""); // Remove discovered match from string
            if (m == beforeSplit) { // Discovered match was "me"
                m = m.split("@@me").join("");
            }
            matches = matchesWithUser("@@", m, fromUserId, false, threadId, "");
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
        api.removeUserFromGroup(userId, groupId, (err) => {
            if (err) {
                sendError("Cannot kick user from private chat", groupId);
            } else {
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
        });
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
// Buffer limit controls number of times it will attempt to add the user to the group
// if not successful on the first attempt (default 5)
function addUser(id, threadId = ids.group, welcome = true, currentBuffer = 0, api = gapi) {
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
            } else if (err && (currentBuffer < config.addBufferLimit)) {
                addUser(id, threadId, welcome, (currentBuffer + 1));
            }
        });
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
            api.getUserInfo(data.participantIDs, function(err, data) {
                if (!err) {
                    ids.members[message.threadID] = []; // Clear old members
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
            sendMessage(data.emoji ? data.emoji.emoji : config.defaultEmoji, threadId);
        }
    });
}

function isBanned(senderId) {
    return (config.banned.indexOf(senderId) > -1);
}

// Sends file where filename is a relative path to the file from root
// Accepts an optional message body parameter and callback
function sendFile(filename, threadId = ids.group, message = "", callback = () => {}, api = gapi) {
    const msg = {
        "body": message,
        "attachment": fs.createReadStream(`${__dirname}/${filename}`)
    }
    sendMessage(msg, threadId, callback);
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
    const graphUrl = `https://graph.facebook.com/${userId}/picture?type=large&redirect=false&width=400&height=400`;
    request.get(graphUrl, (err, res, body) => {
        if (res.statusCode == 200) {
            const url = JSON.parse(body).data.url; // Photo URL from Graph API
            const photoUrl = `media/profiles/${userId}.jpg`; // Location of downloaded file
            if (url) {
                sendFileFromUrl(url, photoUrl, desc, threadId);
            } else {
                sendMessage(desc, threadId);
            }
        }
    });
}

// Sends a file to the group from a URL by temporarily downloading it
// and re-uploading it as part of the message (useful for images on Facebook
// domains, which are blocked by Facebook for URL auto-detection)
// Accepts url, optional file download location/name, optional message, and optional
// threadId parameters
function sendFileFromUrl(url, path = "media/temp.jpg", message = "", threadId = ids.group, api = gapi) {
    request.head(url, (err, res, body) => {
        // Download file and pass to chat API
        if (!err) {
            request(url).pipe(fs.createWriteStream(path)).on('close', (err, data) => {
                if (!err) {
                    // Use API's official sendMessage here for callback functionality
                    sendMessage({
                        "body": message,
                        "attachment": fs.createReadStream(`${__dirname}/${path}`)
                    }, threadId, (err, data) => {
                        // Delete downloaded propic
                        fs.unlink(path);
                    });
                } else {
                    sendMessage(message, threadId);
                }
            });
        } else {
            // Just send the description if photo can't be downloaded
            sendMessage(message, threadId);
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

// Obtains a name from a given ID in the members object
function getNameFromId(id, thread) {
    const users = ids.members[thread];
    for (let m in users) {
        if (users.hasOwnProperty(m)) {
            if (users[m] == id) {
                return m;
            }
        }
    }
}

// Restarts the bot (requires deploying to Heroku)
// Includes optional callback
function restart(callback = () => {}) {
    request.delete({
        "url": "https://api.heroku.com/apps/assume-bot/dynos/web",
        "headers": {
            "Accept": "application/vnd.heroku+json; version=3",
            "Authorization": `Bearer ${credentials.TOKEN}` // Requires Heroku OAuth token for authorization
        }
    });
    callback();
}

// Constructs a string of artists when passed a track object from the Spotify API
function getArtists(track) {
    const artists = track.artists;
    artistStr = "";
    for (let i = 0; i < artists.length; i++) {
        artistStr += artists[i].name;
        if (i != artists.length - 1) {
            artistStr += "/";
        }
    }
    return artistStr;
}

// Logs into Spotify API & sets the appropriate credentials
function logInSpotify(callback = () => {}) {
    spotify.clientCredentialsGrant({}, (err, data) => {
        if (!err) {
            spotify.setAccessToken(data.body.access_token);
            callback();
        } else {
            callback(err);
        }

    });
}

// Sends the contents of a given file (works best with text files)
function sendContentsOfFile(file, threadId = ids.group) {
    fs.readFile(file, "utf-8", (err, text) => {
        if (!err) {
            sendMessage(text, threadId);
        } else {
            console.log(err);
        }
    })
}

// Functions for getting/setting user scores (doesn't save much in terms of
// code/DRY, but wraps the functions so that it's easy to change how they're stored)
function setScore(userId, score, callback) {
    mem.set(`userscore_${userId}`, score, callback);
}

function getScore(userId, callback) {
    mem.get(`userscore_${userId}`, callback);
}

// Updates the user's score either by (if isAdd) increasing or (otherwise) decreasing
// the user's score by the default value set in config, or 5 points if not set
// Returns a callback with error, success, and a value equal to the user's new score
function updateScore(isAdd, userId, callback) {
    getScore(userId, (err, val) => {
        if (err) {
            callback(err);
        }
        // Convert from buffer & grab current score (set 0 if it doesn't yet exist)
        const score = val ? parseInt(val.toString()) : 0;

        // Can be easily customized to accept a score parameter if so desired
        const points = config.votePoints || 5; // Default to five points
        const newScore = isAdd ? (score + points) : (score - points);
        setScore(userId, `${newScore}`, (err, success) => {
            callback(err, success, newScore);
        });
    });
}

// Sets group image to image found at given URL
// Accepts url, threadId, and optional error message parameter to be displayed if changing the group image fails
function setGroupImageFromUrl(url, threadId = ids.group, errMsg = "Photo couldn't download properly", api = gapi) {
    // Download file and pass to chat API
    const path = `media/${encodeURIComponent(url)}.png`;
    request(url).pipe(fs.createWriteStream(path)).on('close', (err, data) => {
        if (!err) {
            api.changeGroupImage(fs.createReadStream(`${__dirname}/${path}`), threadId, (err) => {
                fs.unlink(path);
                if (err) {
                    sendError(errMsg, threadId);
                }
            });
        } else {
            sendError("Image not found at that URL");
        }
    });
}
