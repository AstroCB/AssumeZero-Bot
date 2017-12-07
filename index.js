// Dependencies
const messenger = require("facebook-chat-api"); // Chat API
const fs = require("fs"); // File system
const exec = require("child_process").exec; // For command line access
const request = require("request"); // For HTTP requests
const jimp = require("jimp"); // For image processing
const config = require("./config"); // Config file
const utils = require("./configutils"); // Utility functions
const commands = require("./commands"); // Command documentation/configuration
const server = require("./server"); // Server configuration
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
    // Logging message with config details
    console.log(`Bot ${config.bot.id} logging in ${process.env.EMAIL ? "remotely" : "locally"} with trigger "${config.trigger}".`);
    try {
        messenger({
            appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
        }, callback);
    } catch (e) { // No app state saved
        messenger({
            email: credentials.EMAIL,
            password: credentials.PASSWORD
        }, (err, api) => {
            fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
            callback(err, api);
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

// Processes incoming messages
// Passed as callback to API's listen, but can also be called externally
// (function is exported as a part of this module)
function handleMessage(err, message, external = false, api = gapi) { // New message received from listen()
    if (message && !err) {
        // Update info of group where message came from in the background (unless it's an external call)
        if (!external && message.type == "message") {
            updateGroupInfo(message.threadID, message);
        }
        // Load existing group data
        getGroupInfo(message.threadID, (err, info) => {
            if (err || !info) {
                console.log(err);
            } else {
                // Handle messages
                const senderId = message.senderID;
                if (message.type == "message" && senderId != config.bot.id && !isBanned(senderId, info)) { // Sender is not banned and is not the bot
                    const m = message.body;
                    const attachments = message.attachments;
                    // Handle message body
                    if (m) {
                        // Handle user pings
                        handlePings(m, senderId, info);
                        // Pass to commands testing for trigger word
                        const cindex = m.toLowerCase().indexOf(config.trigger);
                        if (cindex > -1) { // Trigger command mode
                            handleCommand(m.substring(cindex + config.trigger.length), senderId, info, message); // Pass full message obj in case it's needed in a command
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
    const threadId = groupInfo.threadId; // For async callbacks
    const attachments = messageLiteral.attachments; // For commands that take attachments
    // Evaluate commands
    const co = commands.commands; // Short var names since I'll be typing them a lot
    for (let c in co) {
        if (co.hasOwnProperty(c)) {
            // Check whether command is sudo-protected and, if so, whether the user is the owner
            if ((co[c].sudo && fromUserId == config.owner.id) || !co[c].sudo) {
                // Set match vals
                if (co[c].user_input.accepts) { // Takes a match from the members dict
                    if (Array.isArray(co[c].regex)) { // Also has a regex suffix (passed as length 2 array)
                        co[c].m = matchesWithUser(co[c].regex[0], command, fromUserId, groupInfo, co[c].user_input.optional, " ", co[c].regex[1]);
                    } else { // Just a standard regex prefex as a string + name
                        co[c].m = matchesWithUser(co[c].regex, command, fromUserId, groupInfo, co[c].user_input.optional);
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
                updateStats(c, fromUserId);
            }
        }
    }
    debugCommandOutput(false);
    // Check commands for matches & eval
    if (co["help"].m) { // Check help first to avoid command conflicts
        let input;
        if (co["help"].m[1]) {
            input = co["help"].m[1].trim().toLowerCase();
        }
        if (input && input.length > 0) {
            // Give details of specific command
            const entry = getHelpEntry(input, co);
            if (entry) {
                const info = entry.entry;

                const example = {}; // Fill example data (sometimes array; sometimes string)
                if (Array.isArray(info.example)) {
                    example.header = "Examples:\n";
                    example.body = info.example.map((e) => {
                        return `${config.trigger} ${e}`; // Add trigger to example
                    }).join("\n");
                } else if (info.example.length > 0) {
                    example.header = "Example: ";
                    example.body = `${config.trigger} ${info.example}`;
                }

                const helpMsg = `Entry for command "${info.pretty_name}":\n${info.description}\n\nSyntax: ${config.trigger} ${info.syntax}${example.header ? `\n\n${example.header}${example.body}` : ""}`;
                const addenda = `${info.attachments ? "\n\n(This command accepts attachments)" : ""}${info.sudo ? "\n\n(This command requires admin privileges)" : ""}${info.experimental ? "\n\n(This command is experimental)" : ""}`;
                getStats(entry.key, false, (err, stats) => {
                    if (err) { // Couldn't retrieve stats; just show help message
                        sendMessage(`${helpMsg}${addenda}`, threadId);
                    } else {
                        const perc = (((stats.count * 1.0) / stats.total) * 100) || 0;
                        sendMessage(`${helpMsg}\n\nThis command has been used ${stats.count} ${stats.count == 1 ? "time" : "times"}, representing ${perc.toFixed(3)}% of all invocations.${addenda}`, threadId);
                    }
                });
            } else {
                sendError(`Help entry not found for "${input}"`, threadId);
            }
        } else {
            // No command passed; give overview of all of them
            let mess = `Quick help for ${config.bot.names.short || config.bot.names.long}:\n\nPrecede these commands with "${config.trigger}":\n`;
            for (let c in co) {
                if (co.hasOwnProperty(c)) {
                    const entry = co[c];
                    if (entry.display_names.length > 0) { // Don't display if no display names (secret command)
                        // Only display short description if one exists
                        mess += `${entry.syntax}${entry.short_description ? `: ${entry.short_description}` : ""}${entry.sudo ? " [ADMIN]" : ""}\n`;
                        mess += "------------------\n"; // Suffix for separating commands
                    }
                }
            }
            mess += `Contact ${config.owner.names.long} with any questions, or use "${config.trigger} bug" to report bugs directly.\n\nTip: for more detailed descriptions, use "${config.trigger} help {command}"`;
            sendMessage(mess, threadId);
        }
    } else if (co["stats"].m) {
        const command = co["stats"].m[1];
        getStats(command, true, (err, stats) => {
            let input;
            if (co["stats"].m[1]) {
                input = co["stats"].m[1].trim().toLowerCase();
            }
            if (input && input.length > 0) {
                // Give details of specific command
                const entry = getHelpEntry(input, co);
                if (entry) {
                    const key = entry.key;
                    const info = entry.entry;
                    getStats(key, true, (err, stats) => {
                        if (!err) {
                            stats = getComputedStats(stats);
                            let m = `'${info.pretty_name}' has been used ${stats.count} ${stats.count == 1 ? "time" : "times"} out of a total of ${stats.total} ${stats.total == 1 ? "call" : "calls"}, representing ${stats.usage.perc.toFixed(3)}% of all bot invocations.`;
                            m += `\n\nIt was used ${stats.usage.day} ${stats.usage.day == 1 ? "time" : "times"} within the last day and ${stats.usage.month} ${stats.usage.month == 1 ? "time" : "times"} within the last month.`;

                            const user = getHighestUser(stats.record);
                            if (user) { // Found a user with highest usage
                                const name = groupInfo.names[user] || "not in this chat";
                                m += `\n\nIts most prolific user is ${name}.`;
                            }

                            sendMessage(m, threadId);
                        }
                    });
                } else {
                    sendError(`Entry not found for ${input}`, threadId);
                }
            } else {
                // No command passed; show all
                getAllStats((success, data) => {
                    if (!success) {
                        console.log("Failed to retrieve all stats");
                    }
                    for (let i = 0; i < data.length; i++) {
                        data[i].stats = getComputedStats(data[i].stats); // Get usage stats for sorting
                    }
                    data = data.sort((a, b) => {
                        return (b.stats.usage.perc - a.stats.usage.perc); // Sort greatest to least
                    });

                    let msg = "Command: % of total usage | # today | # this month\n";

                    data.forEach((co) => {
                        msg += `\n${co.pretty_name}: ${co.stats.usage.perc.toFixed(3)}% | ${co.stats.usage.day} | ${co.stats.usage.month}`;
                    });

                    sendMessage(msg, threadId);
                });
            }
        });
    } else if (co["psa"].m) { // This needs to be high up so that I can actually put commands in the PSA without triggering them
        sendToAll(`"${co["psa"].m[1]}"\n\nThis has been a public service announcement from ${config.owner.names.short}.`);
    } else if (co["bug"].m) {
        sendMessage(`-------BUG-------\nMessage: ${co["bug"].m[1]}\nSender: ${groupInfo.names[fromUserId]}\nTime: ${getTimeString()} (${getDateString()})\nGroup: ${groupInfo.name}\nID: ${groupInfo.threadId}\nInfo: ${JSON.stringify(groupInfo)}`, config.owner.id, (err) => {
            if (!err) {
                if (groupInfo.isGroup && !utils.contains(config.owner.id, groupInfo.members)) { // If is a group and owner is not in it, add
                    sendMessage(`Report sent. Adding ${config.owner.names.short} to the chat for debugging purposes...`, groupInfo.threadId, () => {
                        addUser(config.owner.id, groupInfo, false);
                    });
                } else { // Otherwise, just send confirmation
                    sendMessage(`Report sent to ${config.owner.names.short}.`, groupInfo.threadId);
                }
            } else {
                sendMessage(`Report could not be sent; please message ${config.owner.names.short} directly.`, groupInfo.threadId);
            }
        });
    } else if (co["kick"].m) {
        const user = co["kick"].m[1].toLowerCase();
        const optTime = co["kick"].m[2] ? parseInt(co["kick"].m[2]) : undefined;
        try {
            // Make sure already in group
            if (groupInfo.members[user]) {
                // Kick with optional time specified in call only if specified in command
                kick(groupInfo.members[user], groupInfo, optTime);
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
                request(url, (err, res, body) => {
                    if (!err && res.statusCode == 200) {
                        const results = JSON.parse(body).items;
                        if (results.length > 0) {
                            sendMessage({
                                "url": results[0].formattedUrl // Best match
                            }, threadId);
                        } else {
                            sendError("No results found", threadId);
                        }
                    } else {
                        console.log(err);
                    }
                });
            } else if (param == "new") { // Get most recent (but send as permalink for future reference)
                request("http://xkcd.com/info.0.json", (err, res, body) => {
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
            request("http://xkcd.com/info.0.json", (err, res, body) => {
                if (!err && res.statusCode == 200) {
                    const num = parseInt(JSON.parse(body).num); // Number of most recent xkcd
                    const randxkcd = Math.floor(Math.random() * num) + 1;
                    sendMessage({
                        "url": `http://xkcd.com/${randxkcd}`
                    }, threadId);
                }
            });
        }
    } else if (co["wiki"].m) {
        const query = co["wiki"].m[1];
        // Perform search using Google Custom Search API (provide API key / custom engine in config.js)
        const url = `https://www.googleapis.com/customsearch/v1?key=${config.wiki.key}&cx=${config.wiki.engine}&q=${encodeURIComponent(query)}`;
        request(url, (err, res, body) => {
            if (!err && res.statusCode == 200) {
                const results = JSON.parse(body).items;
                if (results.length > 0) {
                    sendMessage({
                        "url": results[0].formattedUrl // Best match
                    }, threadId);
                } else {
                    sendError("No results found", threadId);
                }
            } else {
                console.log(err);
            }
        });
    } else if (co["spotsearch"].m) {
        logInSpotify((err) => {
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
                                        let message = `Best match: ${bestMatch.name}\nPopularity: ${popularity}%\n\nTop tracks:\n`;
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
                            sendError(err, threadId);
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
                                    }, threadId);
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
    } else if (co["song"].m) {
        logInSpotify((err) => {
            if (!err) {
                const user = co["song"].m[1] ? co["song"].m[1].toLowerCase() : null;
                const userId = groupInfo.members[user];
                const playlists = groupInfo.playlists;
                const ids = Object.keys(playlists);

                let playlist; // Determine which to use
                if (playlists && ids.length > 0) { // At least 1 playlist stored
                    // Find random playlist in case one isn't specified or can't be found
                    const randPlaylist = playlists[ids[Math.floor(Math.random() * ids.length)]];
                    if (user && userId) {
                        // User specified
                        if (playlists[userId]) {
                            // User has a playlist
                            playlist = playlists[userId];
                        } else {
                            // User doesn't have playlist; use random one
                            playlist = randPlaylist;
                            sendMessage(`User ${groupInfo.names[userId]} does not have a stored playlist; using ${playlist.name}'s instead.`, threadId);
                        }
                    } else {
                        // No playlist specified; grab random one from group
                        playlist = randPlaylist;
                    }
                } else {
                    playlist = config.defaultPlaylist;
                    sendMessage(`No playlists found for this group. To add one, use "${config.trigger} playlist" (see help for more info).\nFor now, using the default playlist.`, threadId);
                }

                spotify.getPlaylist(playlist.user, playlist.uri, {}, (err, data) => {
                    if (!err) {
                        const name = data.body.name;
                        const songs = data.body.tracks.items;
                        let track = songs[Math.floor(Math.random() * songs.length)].track;
                        let buffer = 0;
                        while (!track.preview_url && buffer < songs.length) { // Don't use songs without previews if possible
                            track = songs[Math.floor(Math.random() * songs.length)].track;
                            buffer++;
                        }
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
    } else if (co["playlist"].m) {
        const playlists = groupInfo["playlists"];
        if (co["playlist"].m[1]) { // User provided
            if (co["playlist"].m[2]) { // Data provided
                const user = co["playlist"].m[1].toLowerCase();
                const userId = groupInfo.members[user];
                const name = groupInfo.names[userId];
                const newPlaylist = {
                    "name": name,
                    "id": userId,
                    "user": co["playlist"].m[3],
                    "uri": co["playlist"].m[4]
                };
                playlists[userId] = newPlaylist;
                setGroupProperty("playlists", playlists, groupInfo, (err) => {
                    if (!err) {
                        logInSpotify((err) => {
                            if (!err) {
                                spotify.getPlaylist(newPlaylist.user, newPlaylist.uri, {}, (err, data) => {
                                    if (!err) {
                                        let message = `Playlist "${data.body.name}" added to the group. Here are some sample tracks:\n`;
                                        const songs = data.body.tracks.items;
                                        for (let i = 0; i < config.spotifySearchLimit; i++) {
                                            if (songs[i]) {
                                                let track = songs[i].track;
                                                message += `– ${track.name}${track.explicit ? " (Explicit)" : ""} (from ${track.album.name})${(i != config.spotifySearchLimit - 1) ? "\n" : ""}`;
                                            }
                                        }
                                        sendMessage(message, threadId);
                                    } else {
                                        sendError("Playlist couldn't be added; check the URI and make sure that you've set the playlist to public.", threadId);
                                    }
                                });
                            } else {
                                console.log(err);
                            }
                        });
                    }
                });
            } else {
                sendError("Please include a Spotify URI to add a playlist (see help for more info)", threadId);
            }
        } else { // No user provided; just display current playlists
            const pArr = Object.keys(playlists).map((p) => {
                return playlists[p];
            });
            if (pArr.length === 0) {
                sendMessage(`No playlists for this group. To add one, use "${config.trigger} playlist" (see help).`, threadId);
            } else {
                logInSpotify((err) => {
                    if (!err) {
                        let results = [];
                        let now = current = (new Date()).getTime();

                        function updateResults(value) {
                            results.push(value);

                            const success = (results.length == pArr.length);
                            current = (new Date()).getTime();

                            if (success || (current - now) >= config.asyncTimeout) {
                                const descs = results.map((p) => {
                                    return `"${p.name}" by ${p.user} (${p.length} songs)`;
                                });
                                sendMessage(`Playlists for this group:\n${descs.join("\n— ")}`, threadId);
                            }
                        }

                        for (let i = 0; i < pArr.length; i++) {
                            spotify.getPlaylist(pArr[i].user, pArr[i].uri, {}, (err, data) => {
                                if (!err) {
                                    updateResults({
                                        "name": data.body.name,
                                        "user": pArr[i].name,
                                        "length": data.body.tracks.items.length
                                    });
                                }
                            });
                        }
                    }
                });
            }
        }
    } else if (co["pin"].m) {
        const msg = co["pin"].m[1];
        if (!msg) { // No new message; display current
            sendMessage(groupInfo.pinned ? groupInfo.pinned : "No pinned messages in this chat.", threadId);
        } else { // Pin new message
            const pin = `"${msg}" – ${groupInfo.names[fromUserId]} on ${getDateString()}`;
            setGroupProperty("pinned", pin, groupInfo);
            sendMessage(`Pinned new message to the chat: "${msg}"`, threadId);
        }
    } else if (co["tab"].m) {
        const op = co["tab"].m[1];
        const amt = parseFloat(co["tab"].m[2]) || 1;
        const cur = groupInfo.tab || 0;
        const numMembers = Object.keys(groupInfo.members).length;
        if (!op) { // No operation – just display total
            sendMessage(`$${cur.toFixed(2)} ($${(cur / numMembers).toFixed(2)} per person in this group)`, threadId);
        } else if (op == "split") {
            const num = parseFloat(co["tab"].m[2]) || numMembers;
            sendMessage(`$${cur.toFixed(2)}: $${(cur / num).toFixed(2)} per person for ${num} ${(num == 1) ? "person" : "people"}`, threadId);
        } else if (op == "clear") { // Clear tab
            setGroupProperty("tab", 0, groupInfo, (err) => {
                if (!err) { sendMessage("Tab cleared.", threadId); }
            });
        } else {
            const newTab = (op == "add") ? (cur + amt) : (cur - amt);
            setGroupProperty("tab", newTab, groupInfo, (err) => {
                if (!err) { sendMessage(`Tab updated to $${newTab.toFixed(2)}.`, threadId); }
            });
        }
    } else if (co["addsearch"].m) {
        // Fields 1 & 3 are are for the command and the user, respectively
        // Field 2 is for an optional number parameter specifying the number of search results
        // for a search command (default is 1)
        const user = co["addsearch"].m[3];
        const command = co["addsearch"].m[1].split(" ")[0].toLowerCase(); // Strip opt parameter from match if present
        try {
            api.getUserID(user, (err, data) => {
                if (!err) {
                    const bestMatch = data[0]; // Hopefully the right person
                    const numResults = parseInt(co["addsearch"].m[2]) || 1; // Number of results to display
                    if (command == "search") { // Is a search command
                        // Output search results / propic
                        for (let i = 0; i < numResults; i++) {
                            // Passes number of match to indicate level (closeness to top)
                            searchForUser(data[i], threadId, i);
                        }
                    } else { // Is an add command
                        // Add best match to group and update log of member IDs
                        addUser(bestMatch.userID, groupInfo);
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
        if (groupInfo.isGroup) {
            sendMessage("I hate you all.", threadId);
            setTimeout(() => {
                let callbackset = false;
                for (let m in groupInfo.members) {
                    // Bot should never be in members list, but this is a safeguard
                    // (ALSO VERY IMPORTANT so that group isn't completely emptied)
                    if (groupInfo.members.hasOwnProperty(m) && groupInfo.members[m] != config.bot.id) {
                        if (!callbackset) { // Only want to send the message once
                            kick(groupInfo.members[m], groupInfo, config.order66Time, () => {
                                sendMessage("Balance is restored to the Force.", threadId);
                            });
                            callbackset = true;
                        } else {
                            kick(groupInfo.members[m], groupInfo, config.order66Time);
                        }
                    }
                }
            }, 2000); // Make sure people see the message (and impending doom)
        } else {
            sendMessage("Cannot execute Order 66 on a non-group chat. Safe for now, you are, Master Jedi.", threadId);
        }
    } else if (co["color"].m) {
        // Extract input and pull valid colors from API
        const colorToSet = ((co["color"].m[1].match(/rand(om)?/i)) ? getRandomColor() : co["color"].m[1]).toLowerCase();
        const apiColors = api.threadColors;

        // Construct a lowercased-key color dictionary to make input case insensitive
        const colors = {};
        for (let color in apiColors) {
            if (apiColors.hasOwnProperty(color)) {
                colors[color.toLowerCase()] = apiColors[color];
            }
        }

        // Extract color values
        const hexVals = Object.keys(colors).map(n => colors[n]);
        const usableVal = hexVals.includes(colorToSet) ? colorToSet : colors[colorToSet];

        if (usableVal === undefined) { // Explicit equality check b/c it might be null (i.e. MessengerBlue)
            sendError("Couldn't find this color. See help for accepted values.", threadId);
        } else {
            const hexToName = Object.keys(apiColors).reduce((obj, key) => { obj[apiColors[key]] = key; return obj; }, {}); // Flip the map
            const ogColor = hexToName[groupInfo.color ? groupInfo.color.toLowerCase() : groupInfo.color]; // Will be null if no custom color set
            api.changeThreadColor(usableVal, threadId, (err) => {
                if (!err) {
                    sendMessage(`Last color was ${ogColor}.`, threadId);
                }
            });
        }
    } else if (co["hitlights"].m) {
        const ogColor = groupInfo.color || config.defaultColor; // Will be null if no custom color set
        const delay = 500; // Delay between color changes (half second is a good default)
        for (let i = 0; i < config.numColors; i++) { // Need block scoping for timeout
            setTimeout(() => {
                api.changeThreadColor(getRandomColor(), threadId);
                if (i == (config.numColors - 1)) { // Set back to original color on last
                    setTimeout(() => {
                        api.changeThreadColor(ogColor, threadId);
                    }, delay);
                }
            }, delay + (i * delay)); // Queue color changes
        }
    } else if (co["clearnick"].m) {
        const user = co["clearnick"].m[1].toLowerCase();
        api.changeNickname("", threadId, groupInfo.members[user]);
    } else if (co["setnick"].m) {
        const user = co["setnick"].m[1].toLowerCase();
        const newName = co["setnick"].m[2];
        api.changeNickname(newName, threadId, groupInfo.members[user]);
    } else if (co["wakeup"].m) {
        const user = co["wakeup"].m[1].toLowerCase();
        const members = groupInfo.members; // Save in case it changes
        for (let i = 0; i < config.wakeUpTimes; i++) {
            setTimeout(() => {
                sendMessage("Wake up", members[user]);
            }, 500 + (500 * i));
        }
        sendMessage(`Messaged ${user.substring(0, 1).toUpperCase()}${user.substring(1)} ${config.wakeUpTimes} times`, threadId);
    } else if (co["randmess"].m) {
        // Get thread length
        api.getThreadInfo(threadId, (err, data) => {
            if (!err) {
                const count = data.messageCount; // Probably isn't that accurate
                let randMessage = Math.floor(Math.random() * (count + 1));
                api.getThreadHistory(threadId, (count / 4), null, (err, data) => { // Most recent quarter to prevent overload
                    if (err) {
                        sendMessage("Error: Messages could not be loaded", threadId);
                    } else {
                        let m = data[randMessage];
                        while (!(m && m.body)) {
                            randMessage = Math.floor(Math.random() * (count + 1));
                            m = data[randMessage];
                        }
                        let b = m.body,
                            name = m.senderName,
                            time = new Date(m.timestamp);
                        sendMessage(`${b} - ${name} (${time.toLocaleDateString()})`, threadId);
                    }
                });
            }
        });
    } else if (co["alive"].m) {
        sendGroupEmoji(groupInfo, "large"); // Send emoji and react to message in response
    } else if (co["emoji"].m) {
        api.changeThreadEmoji(co["emoji"].m[1], threadId, (err) => {
            if (err) {
                // Set to default as backup if errors
                api.changeThreadEmoji(groupInfo.emoji, threadId);
            }
        });
        updateGroupInfo(threadId); // Update emoji
    } else if (co["echo"].m) {
        const command = co["echo"].m[1].toLowerCase();
        let message = `${co["echo"].m[2]}`;
        if (command == "echo") {
            // Just an echo – repeat message
            sendMessage(message, threadId);
        } else {
            // Quote - use name
            api.getUserInfo(fromUserId, (err, data) => {
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
    } else if (co["ban"].m) {
        const user = co["ban"].m[2].toLowerCase();
        const userId = groupInfo.members[user];
        const callback = (err, users, status) => {
            if (err) {
                sendError(err, threadId);
            } else {
                config.banned = users;
                sendMessage(`${groupInfo.names[userId]} successfully ${status}.`, threadId);
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
    } else if (co["vote"].m) {
        const user = co["vote"].m[2].toLowerCase();
        const userId = groupInfo.members[user];
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
    } else if (co["score"].m) {
        if (co["score"].m[1]) { // Display scoreboard
            getAllScores(groupInfo, (success, scores) => {
                if (success) {
                    scores = scores.sort((a, b) => {
                        return (b.score - a.score); // Sort greatest to least
                    });

                    let message = `Rankings for ${groupInfo.name}:`;
                    for (let i = 0; i < scores.length; i++) {
                        message += `\n${i + 1}. ${scores[i].name}: ${scores[i].score}`;
                    }
                    sendMessage(message, threadId);
                } else {
                    sendError("Scores couldn't be retrieved for this group.", threadId);
                }
            });
        } else if (co["score"].m[2]) {
            const user = co["score"].m[2].toLowerCase();
            const userId = groupInfo.members[user];
            const user_cap = user.substring(0, 1).toUpperCase() + user.substring(1);
            if (userId) {
                const new_score = co["score"].m[3];
                if (new_score || new_score == "0") { // Set to provided score if valid (0 is falsey)
                    setScore(userId, new_score, (err, success) => {
                        if (success) {
                            sendMessage(`${user_cap}'s score updated to ${new_score}.`, threadId);
                        } else {
                            sendError(err, threadId);
                        }
                    });
                } else { // No value provided; just display score
                    getScore(`${userId}`, (err, val) => {
                        if (!err) {
                            const stored_score = val ? val.toString() : 0;
                            sendMessage(`${user_cap}'s current score is ${stored_score}.`, threadId);
                        } else {
                            console.log(err);
                        }
                    });
                }
            } else {
                sendError(`User ${user_cap} not found`, threadId);
            }
        }
    } else if (co["restart"].m) {
        restart(() => {
            sendMessage("Restarting...", threadId);
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
                setGroupImageFromUrl(attachments[0].largePreviewUrl, threadId, "Attachment is invalid");
            } else {
                sendError("This command only accepts photo attachments", threadId);
            }
        } else {
            sendError("This command requires either a valid image URL or a photo attachment", threadId);
        }
    } else if (co["poll"].m) {
        const title = co["poll"].m[1];
        const opts = co["poll"].m[2];
        let optsObj = {};
        if (opts) {
            const items = opts.split(",");
            for (let i = 0; i < items.length; i++) {
                optsObj[items[i]] = false; // Initialize options to unselected in poll
            }
        }
        api.createPoll(title, threadId, optsObj, (err) => { // I contributed this func to the API!
            if (err) {
                sendError("Cannot create a poll in a non-group chat.", threadId);
            }
        });
    } else if (co["title"].m) {
        const title = co["title"].m[1];
        api.setTitle(title, threadId, (err) => {
            if (err) {
                sendError("Cannot set title for non-group chats.", threadId);
            }
        });
    } else if (co["answer"].m) {
        sendMessage(config.answerResponses[Math.floor(Math.random() * config.answerResponses.length)], threadId);
    } else if (co["space"].m) {
        const search = co["space"].m[2];
        request.get(`https://images-api.nasa.gov/search?q=${encodeURIComponent(search)}&media_type=image`, (err, res, body) => {
            if (!err) {
                const results = JSON.parse(body).collection.items;
                if (results && results.length > 0) {
                    const chosen = co["space"].m[1] ? Math.floor(Math.random() * results.length) : 0; // If rand not specified, use top result
                    const link = results[chosen].links[0].href;
                    const data = results[chosen].data[0];
                    sendFileFromUrl(link, `media/${data.nasa_id}.jpg`, `"${data.title}"\n${data.description}`, threadId);
                } else {
                    sendError(`No results found for ${search}`, threadId);
                }
            } else {
                sendError(`No results found for ${search}`, threadId);
            }
        });
    } else if (co["rng"].m) {
        let lowerBound, upperBound;
        if (co["rng"].m[2]) {
            lowerBound = parseInt(co["rng"].m[1]); // Assumed to exist if upperBound was passed
            upperBound = parseInt(co["rng"].m[2]);
        } else { // No last parameter
            lowerBound = config.defaultRNGBounds[0];
            if (co["rng"].m[1]) { // Only parameter passed becomes upper bound
                upperBound = parseInt(co["rng"].m[1]);
            } else { // No params passed at all
                upperBound = config.defaultRNGBounds[1];
            }
        }
        const rand = Math.floor(Math.random() * (upperBound - lowerBound + 1)) + lowerBound;
        const chance = Math.abs(((1.0 / (upperBound - lowerBound + 1)) * 100).toFixed(2));
        sendMessage(`${rand}\n\nWith bounds of (${lowerBound}, ${upperBound}), the chances of receiving this result were ${chance}%`, threadId);
    } else if (co["bw"].m) {
        const url = co["bw"].m[1];
        processImage(url, attachments, groupInfo, (img, filename) => {
            img.greyscale().write(filename, (err) => {
                if (!err) {
                    sendFile(filename, threadId, "", () => {
                        fs.unlink(filename);
                    });
                }
            });
        });
    } else if (co["sepia"].m) {
        const url = co["sepia"].m[1];
        processImage(url, attachments, groupInfo, (img, filename) => {
            img.sepia().write(filename, (err) => {
                if (!err) {
                    sendFile(filename, threadId, "", () => {
                        fs.unlink(filename);
                    });
                }
            });
        });
    } else if (co["flip"].m) {
        const horiz = (co["flip"].m[1].toLowerCase().indexOf("horiz") > -1); // Horizontal or vertical
        const url = co["flip"].m[2];
        processImage(url, attachments, groupInfo, (img, filename) => {
            img.flip(horiz, !horiz).write(filename, (err) => {
                if (!err) {
                    sendFile(filename, threadId, "", () => {
                        fs.unlink(filename);
                    });
                }
            });
        });
    } else if (co["invert"].m) {
        const url = co["invert"].m[1];
        processImage(url, attachments, groupInfo, (img, filename) => {
            img.invert().write(filename, (err) => {
                if (!err) {
                    sendFile(filename, threadId, "", () => {
                        fs.unlink(filename);
                    });
                }
            });
        });
    } else if (co["blur"].m) {
        const pixels = parseInt(co["blur"].m[1]) || 2;
        const gauss = co["blur"].m[2];
        const url = co["blur"].m[3];
        processImage(url, attachments, groupInfo, (img, filename) => {
            if (gauss) {
                // Gaussian blur (extremely resource-intensive – will pretty much halt the bot while processing)
                sendMessage("Hang on, this might take me a bit...", threadId, () => {
                    const now = (new Date()).getTime();
                    img.gaussian(pixels).write(filename, (err) => {
                        if (!err) {
                            sendFile(filename, threadId, `Processing took ${((new Date()).getTime() - now) / 1000} seconds.`, () => {
                                fs.unlink(filename);
                            });
                        }
                    });
                });
            } else {
                img.blur(pixels).write(filename, (err) => {
                    if (!err) {
                        sendFile(filename, threadId, "", () => {
                            fs.unlink(filename);
                        });
                    }
                });
            }
        });
    } else if (co["overlay"].m) {
        const url = co["overlay"].m[1];
        const overlay = co["overlay"].m[2];
        processImage(url, attachments, groupInfo, (img, filename) => {
            jimp.loadFont(jimp.FONT_SANS_32_BLACK, (err, font) => {
                if (!err) {
                    const width = img.bitmap.width; // Image width
                    const height = img.bitmap.height; // Image height
                    const textDims = measureText(font, overlay); // Get text dimensions (x,y)
                    img.print(font, (width - textDims[0]) / 2, (height - textDims[1]) / 2, overlay, (width + textDims[0])).write(filename, (err) => {
                        if (!err) {
                            sendFile(filename, threadId, "", () => {
                                fs.unlink(filename);
                            });
                        }
                    });
                } else {
                    sendError("Couldn't load font", threadId);
                }
            });
        });
    } else if (co["brightness"].m) {
        const bright = (co["brightness"].m[1].toLowerCase() == "brighten");
        // Value must range from -1 to 1
        let perc = parseInt(co["brightness"].m[2]);
        perc = (perc > 100) ? 1 : (perc / 100.0);
        perc = bright ? perc : (-1 * perc);
        const url = co["brightness"].m[3];
        processImage(url, attachments, groupInfo, (img, filename) => {
            img.brightness(perc).write(filename, (err) => {
                if (!err) {
                    sendFile(filename, threadId, "", () => {
                        fs.unlink(filename);
                    });
                }
            });
        });
    } else if (co["mute"].m) {
        const getCallback = (muted) => {
            return (err) => {
                if (!err) {
                    sendMessage(`Bot ${muted ? "muted" : "unmuted"}`, threadId);
                }
            }
        }
        const mute = !(co["mute"].m[1]); // True if muting; false if unmuting
        setGroupProperty("muted", mute, groupInfo, getCallback(mute));
    } else if (co["christen"].m) {
        api.changeNickname(co["christen"].m[1], threadId, config.bot.id);
    } else if (co["wolfram"].m) {
        const query = co["wolfram"].m[1];
        request(`http://api.wolframalpha.com/v1/result?appid=${credentials.WOLFRAM_KEY}&i=${encodeURIComponent(query)}`, (err, res, body) => {
            if (!(err || body == "Wolfram|Alpha did not understand your input")) {
                sendMessage(body, threadId);
            } else {
                sendMessage(`No results found for "${query}"`, threadId);
            }
        });
    } else if (co["destroy"].m) {
        for (let m in groupInfo.members) {
            // Bot should never be in members list, but this is a safeguard
            // (ALSO VERY IMPORTANT so that group isn't completely emptied)
            // We're talking triple redundancies at this point
            if (groupInfo.members.hasOwnProperty(m) && groupInfo.members[m] != config.bot.id) {
                kick(groupInfo.members[m], groupInfo);
            }
        }
        // Archive the thread afterwards to avoid clutter in the messages list
        // (bot will still have access and be able to add people back if necessary)
        api.changeArchivedStatus(threadId, true, (err) => {
            if (err) {
                console.log(`Error archiving thread ${threadId}`);
            }
        });
    } else if (co["clearstats"].m) {
        resetStats();
    } else if (co["infiltrate"].m) {
        const searchName = co["infiltrate"].m[1];
        api.getThreadList(0, config.threadLimit, "inbox", (err, chats) => {
            if (!err) {
                if (!searchName) { // Just list chats
                    let message = "Available groups:";
                    message += chats.filter((c) => {
                        // Check if can add admin
                        const members = c.participantIDs;
                        const botLoc = members.indexOf(config.bot.id);
                        if (botLoc > -1) {
                            members.splice(botLoc, 1);
                            // Can add to chat and more than the bot & one other in the chat
                            return (c.canReply && members.length > 1);
                        }
                        return false;
                    }).map((c) => {
                        const numMembers = c.participants.length - 1; // Exclude bot
                        return `\n– ${c.name || c.threadID} (${numMembers} ${numMembers == 1 ? "member" : "members"})`;
                    }).join("");
                    sendMessage(message, threadId);
                } else {
                    let chatFound = false;
                    for (let i = 0; i < chats.length; i++) {
                        const chatName = chats[i].name;
                        const chatId = chats[i].threadID;
                        if (chatId == searchName || chatName.toLowerCase().indexOf(searchName.toLowerCase()) > -1) {
                            chatFound = true;
                            addUser(config.owner.id, {
                                "threadId": chatId
                            }, true, (err) => {
                                if (err) {
                                    sendError(`You're already in group "${chatName}".`, threadId);
                                } else {
                                    sendMessage(`Added you to group "${chatName}".`, threadId);
                                }
                            }, false); // Add admin to specified group; send confirmation to both chats
                        }
                    }
                    if (!chatFound) {
                        sendError(`Chat with name "${searchName}" not found.`, threadId)
                    }
                }
            } else {
                sendError("Thread list couldn't be retrieved.", threadId);
            }
        });
    } else if (co["alias"].m) {
        const user = co["alias"].m[2].toLowerCase();
        const aliasInput = co["alias"].m[3]
        const aliases = groupInfo.aliases;
        const name = groupInfo.names[groupInfo.members[user]];
        if (co["alias"].m[1]) { // Clear
            delete aliases[user];
            setGroupProperty("aliases", aliases, groupInfo, (err) => {
                if (!err) {
                    sendMessage(`Alias cleared for ${name}.`, threadId);
                }
            });
        } else if (aliasInput) { // Set new alias
            const alias = aliasInput.toLowerCase();
            aliases[user] = alias;
            setGroupProperty("aliases", aliases, groupInfo, (err) => {
                if (!err) {
                    sendMessage(`${name} can now be called "${aliasInput}".`, threadId);
                }
            });
        } else { // Display alias for user if exists
            if (aliases[user]) {
                sendMessage(`${name} can also be called "${aliases[user]}".`, threadId);
            } else {
                sendMessage(`${name} does not have an alias.`, threadId);
            }
        }
    } else if (co["weather"].m) {
        const city = co["weather"].m[1];
        request(`http://api.openweathermap.org/data/2.5/weather?appid=${credentials.WEATHER_KEY}&q=${city}&units=imperial`, (err, res, body) => {
            if (!err && res.statusCode == 200) {
                const data = JSON.parse(body);
                const name = data.name;
                const country = data.sys.country;
                const weather = data.weather[0];
                const cur = data.main;

                const msg = `Weather for ${name} (${country}):\nConditions: ${weather.description}\nTemp: ${cur.temp} ºF (L-${cur.temp_min} H-${cur.temp_max})\nCloud cover: ${data.clouds.all}%`;
                sendFileFromUrl(`http://openweathermap.org/img/w/${weather.icon}.png`, `media/${weather.icon}.png`, msg, threadId);
            } else {
                sendError("Couldn't retrieve weather for that location.", threadId);
            }
        });
    } else if (co["branch"].m) {
        const input = co["branch"].m[1];
        const members = input.split(",").map(m => parseNameReplacements(m.toLowerCase().trim(), fromUserId, groupInfo));
        const ids = members.map(m => groupInfo.members[m]);

        // Start a new chat with the collected IDs and the bot
        sendMessage(`Welcome! This group was created from ${groupInfo.name}.`, ids, (err, info) => {
            if (!err) {
                sendMessage("Subgroup created.", threadId);
            }
        });
    }
}
exports.handleCommand = handleCommand; // Export for external use

// Utility functions

/*
This is used in place of (or in conjunction with) a regex for command matching.
It combines any passed regular expressions with a capturing group that looks for
a username (or alias) match and returns a regex match object containing the username
of the person matched (even if an alias was used – the function handles aliases on its
own and converts them back to usernames) in the order described below.

It takes a `command` (a regex to be matched *before* the username), the `message` to be
searched, the `fromUserId` of the sender (for converting "me" to a username), the group's
`groupData` object, whether the username match should be `optional` (default `false`), any
separator `sep` to be placed between the prefix match and the username (default 1 space), and
any `suffix` match to be matched *after* the username match.

Returns a RegExp match object containing the matches in the following order:
1. {prefix match(es)}
2. {username match}
3. {suffix match(es)}
*/
function matchesWithUser(command, message, fromUserId, groupData, optional = false, sep = " ", suffix = "") {
    // Construct regex string
    let match = message.match(new RegExp(`${command}${optional ? "(?:" : ""}${sep}${groupData.userRegExp}${optional ? ")?" : ""}${suffix}`, "i"));
    if (match) {
        // Preserve properties
        const index = match.index;
        const input = match.input;
        for (let i = 1; i < match.length; i++) { // Start offset one to skip full match at [0]
            let m = match[i];
            if (m) { // Make sure only modifying the user field (no aliases here)
                // Any post-match changes that need to be made
                let fixes = parseNameReplacements(m, fromUserId, groupData);
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
}
exports.matchesWithUser = matchesWithUser; // Export for external use

/*
Wrapper function for sending messages easily
Isn't that much simpler than the actual message function, but it
allows for an optional thread parameter (default is currently stored ID)
and for outputting messages to stdout when the API isn't available (e.g. before login)

Accepts either a simple string or a message object with URL/attachment fields.

Probably a good idea to use this wrapper for all sending instances for debug purposes
and consistency.
*/
function sendMessage(m, threadId, callback = () => { }, api = gapi) {
    try {
        api.sendMessage(m, threadId, callback);
    } catch (e) { // For debug mode (API not available)
        console.log(`${threadId}: ${m}`);
        callback();
    }
}
exports.sendMessage = sendMessage;

// Wrapper function for sending error messages to chat (uses sendMessage wrapper)
function sendError(m, threadId) {
    sendMessage(`Error: ${m}`, threadId);
}
exports.sendError = sendError;

/*
Wrapper function for using mentions
Mentions parameter is an array of dictionaries for each mention
Each dict contains "tag" and "id" keys that should be set to
the text and the id of the mention respectively
*/
function sendMessageWithMentions(message, mentions, threadId) {
    sendMessage({
        "body": message,
        "mentions": mentions,
    }, threadId);
}

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
        users.splice(users.indexOf(groupInfo.names[fromUserId]), 1);
        m = m.split("@@" + allMatch[1]).join("");
    } else {
        let matches = matchesWithUser("@@", m, fromUserId, groupInfo, false, "");
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
            matches = matchesWithUser("@@", m, fromUserId, groupInfo, false, "");
        }
        // After loop, m will contain the message without the pings (the message to be sent)
    }
    return {
        "users": users,
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
            message += ` at ${getTimeString()}` // Time stamp
            // Send message with links to chat/sender
            sendMessageWithMentions(message, [{
                "tag": sender,
                "id": senderId
            }, {
                "tag": info.name,
                "id": info.threadId
            }], info.members[pingUsers[i]]);
        }
    }
}

// Kick user for an optional length of time in seconds (default indefinitely)
// Also accepts optional callback parameter if length is specified
function kick(userId, info, time, callback = () => { }, api = gapi) {
    if (userId != config.bot.id) { // Never allow bot to be kicked
        api.removeUserFromGroup(userId, info.threadId, (err) => {
            if (err) {
                sendError("Cannot kick user from private chat", info.threadId);
            } else {
                if (time) {
                    setTimeout(() => {
                        addUser(userId, info, false); // Don't welcome if they're not new to the group
                        callback();
                    }, time * 1000);
                }
                updateGroupInfo(info.threadId);
            }
        });
    }
}

/*
Adds user to group and updates members list
Optional parameter to welcome new user to the group
Buffer limit controls number of times it will attempt to add the user to the group
Optional parameter to control whether it should retry adding if it fails initially
if not successful on the first attempt (default 5)
*/
function addUser(id, info, welcome = true, callback = () => { }, retry = true, currentBuffer = 0, api = gapi) {
    api.addUserToGroup(id, info.threadId, (err, data) => {
        if (!err) {
            updateGroupInfo(info.threadId, null, (err, info) => {
                if (!err && welcome) {
                    sendMessage(`Welcome to ${info.name}, ${info.names[id]}!`, info.threadId);
                }
            });
            callback();
        } else if (err && (currentBuffer < config.addBufferLimit)) {
            if (retry) {
                addUser(id, info, welcome, callback, retry, (currentBuffer + 1));
            } else {
                callback(err);
            }
        } else {
            callback(err);
        }
    });
}

/*
Update stored info about groups after every message in the background
Takes an optional message object when called by the update subroutine,
but can be ignored when called from anywhere else.

Using callback is discouraged as the idea of this function is to update in
the background to decrease lag, but it may be useful if updates are required
to continue.
*/
function updateGroupInfo(threadId, message, callback = () => { }, api = gapi) {
    getGroupInfo(threadId, (err, existingInfo) => {
        if (!err) {
            let isNew = false;
            if (!existingInfo) {
                const n = config.bot.names; // Bot name info

                // Group not yet registered
                isNew = true;
                sendMessage(`Hello! I'm ${n.long}${n.short ? `, but you can call me ${n.short}` : ""}. Give me a moment to collect some information about this chat before you use any commands.`, threadId);

                api.muteThread(threadId, -1); // Mute chat

                // Add bot's nickname if available
                api.changeNickname(n.short, threadId, config.bot.id); // Won't do anything if undefined
            }
            api.getThreadInfo(threadId, (err, data) => {
                if (data) {
                    let info = existingInfo || {};
                    info.threadId = threadId;
                    info.lastMessage = message;
                    info.name = data.name || "Unnamed chat";
                    info.emoji = data.emoji ? data.emoji.emoji : null;
                    info.color = data.color;
                    if (data.nicknames && data.nicknames[config.bot.id]) { // Don't add bot to nicknames list
                        delete data.nicknames[config.bot.id];
                    }
                    info.nicknames = data.nicknames || {};
                    if (!info.hasOwnProperty("isGroup") && typeof (message.isGroup) == "boolean") {
                        info.isGroup = message.isGroup;
                    }
                    if (isNew) {
                        // These properties only need to be initialized once
                        info.muted = true;
                        info.playlists = {};
                        info.aliases = {};
                        info.isGroup = message.isGroup;
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
                            const aliases = Object.keys(info.aliases).map((n) => {
                                return info.aliases[n];
                            });
                            const matches = Object.keys(info.members);
                            info.userRegExp = utils.getRegexFromMembers(matches.concat(aliases));
                            // Attempt to give chat a more descriptive name than "Unnamed chat" if possible
                            if (!data.name) {
                                let names = Object.keys(info.names).map((n) => {
                                    return info.names[n];
                                });
                                info.name = names.join("/") || "Unnamed chat";
                            }

                            if (isNew) {
                                // Alert owner now that chat name is available
                                sendMessage(`Bot added to new chat: "${info.name}".`, config.owner.id);
                            }
                        }
                        setGroupInfo(info, (err) => {
                            if (!existingInfo) {
                                sendMessage(`All done! Use '${config.trigger} help' to see what I can do.`, threadId);
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
}

// Gets stored information about a group
function getGroupInfo(threadId, callback) {
    getGroups((err, groups) => {
        const groupData = JSON.parse(groups) || {};
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
}

// Wrapper function for retrieving all groups from memory
function getGroups(callback) {
    mem.get(`groups`, callback);
}

// Updates stored information about a group
function setGroupInfo(info, callback = () => { }) {
    getGroups((err, groups) => {
        const groupData = JSON.parse(groups) || {};
        groupData[info.threadId] = info;
        mem.set(`groups`, JSON.stringify(groupData), {}, (err, success) => {
            callback(success ? null : err);
        });
    });
}

// Wrapper for updating a group property
function setGroupProperty(key, value, info, callback = () => { }) {
    info[key] = value;
    setTimeout(() => {
        setGroupInfo(info, (err) => {
            callback(err);
        });
    }, 1500);
    // NOTE: temporary arbitrary delay until I can figure out how to prevent
    // the background update calls from overwriting these property changes
}

// Searches help for a given entry and returns an object containing the entry
// and its key if found
function getHelpEntry(input, log) {
    for (let c in log) {
        if (log.hasOwnProperty(c)) {
            const names = log[c].display_names;
            for (let i = 0; i < names.length; i++) {
                if (input == names[i]) {
                    return {
                        "key": c,
                        "entry": log[c]
                    };
                }
            }
        }
    }
}

// Wrapper for sending an emoji to the group quickly
function sendGroupEmoji(groupInfo, size = "medium") {
    sendEmoji(groupInfo.emoji || config.defaultEmoji, groupInfo.threadId, size);
}

// Specify size as a string: "small", "medium", or "large"
function sendEmoji(emoji, threadId, size = "small") {
    sendMessage({
        "emoji": emoji,
        "emojiSize": size
    }, threadId);
}
exports.sendEmoji = sendEmoji; // Export for Easter eggs

function isBanned(senderId, groupInfo) {
    return (config.banned.indexOf(senderId) > -1 || !senderId || !groupInfo.members[senderID]);
}

// Sends file(s) where each filename is a relative path to the file from root
// Accepts a string filename or an array of filename strings, an optional message body parameter, and a callback
function sendFile(filenames, threadId, message = "", callback = () => { }, api = gapi) {
    if (typeof (filenames) == "string") { // If only one is passed
        filenames = [filenames];
    }
    for (let i = 0; i < filenames.length; i++) {
        filenames[i] = fs.createReadStream(`${__dirname}/${filenames[i]}`);
    }
    const msg = {
        "body": message,
        "attachment": filenames
    }
    sendMessage(msg, threadId, callback);
}
exports.sendFile = sendFile;

// Returns a string of the current time in EST
function getTimeString() {
    const offset = -4; // Eastern
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 600000); // UTC milliseconds since 1970
    const eastern = new Date(utc + (offset * 60 * 60000));
    return eastern.toLocaleTimeString();
}

// Wrapper for formatted date at current time
function getDateString() {
    return (new Date()).toLocaleDateString();
}

/*
Creates a description for a user search result given the match's data from the chat API
Also performs a Graph API search for a high-res version of the user's profile picture
and uploads it with the description if it finds one
Optional parameter to specify which level of match it is (1st, 2nd, 3rd, etc.)
*/
function searchForUser(match, threadId, num = 0, api = gapi) {
    const desc = `${(num === 0) ? "Best match" : "Match " + (num + 1)}: ${match.name}\n${match.profileUrl}\nRank: ${match.score}`;

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

/*
Sends a file to the group from a URL by temporarily downloading it
and re-uploading it as part of the message (useful for images on Facebook
domains, which are blocked by Facebook for URL auto-detection)
Accepts url, optional file download location/name, optional message, and optional
threadId parameters
*/
function sendFileFromUrl(url, path = "media/temp.jpg", message = "", threadId, api = gapi) {
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

// Gets a random hex color from the list of supported values (now that Facebook has restricted it to
// a certain subset of them; more specifically, the lowercase hex values of colors in the palette UI)
function getRandomColor(api = gapi) {
    const colors = Object.keys(api.threadColors).map(n => api.threadColors[n]);
    return colors[Math.floor(Math.random() * colors.length)];
}

// Restarts the bot (requires deploying to Heroku – see config)
// Includes optional callback
function restart(callback = () => { }) {
    request.delete({
        "url": `https://api.heroku.com/apps/${config.appName}/dynos/web`,
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
function logInSpotify(callback = () => { }) {
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
function sendContentsOfFile(file, threadId) {
    fs.readFile(file, "utf-8", (err, text) => {
        if (!err) {
            sendMessage(text, threadId);
        } else {
            console.log(err);
        }
    });
}
exports.sendContentsOfFile = sendContentsOfFile;

// Functions for getting/setting user scores (doesn't save much in terms of
// code/DRY, but wraps the functions so that it's easy to change how they're stored)
function setScore(userId, score, callback) {
    mem.set(`userscore_${userId}`, score, {}, callback);
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

function getAllScores(groupInfo, callback = () => { }) {
    const members = groupInfo.names;
    let results = [];
    let now = current = (new Date()).getTime();

    function updateResults(value) {
        results.push(value);
        const success = (results.length == Object.keys(members).length);

        current = (new Date()).getTime();
        if (success || (current - now) >= config.asyncTimeout) {
            callback(success, results)
        }
    }

    for (let m in members) {
        if (members.hasOwnProperty(m)) {
            getScore(m, (err, val) => {
                updateResults({
                    "name": members[m],
                    "score": parseInt(val) || "0"
                });
            });
        }
    }
}

// Sets group image to image found at given URL
// Accepts url, threadId, and optional error message parameter to be displayed if changing the group image fails
function setGroupImageFromUrl(url, threadId, errMsg = "Photo couldn't download properly", api = gapi) {
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

// Processes an image or images by sifting between URL input and attachments and downloading
// Returns a JIMP image object and filename where the image was stored
function processImage(url, attachments, info, callback = () => { }) {
    const threadId = info.threadId;
    if (url) { // URL passed
        const filename = `media/${encodeURIComponent(url)}.png`;
        jimp.read(url, (err, file) => {
            if (err) {
                sendError("Unable to retrieve image from that URL", threadId);
            } else {
                callback(file, filename);
            }
        });
    } else if (attachments || (info.lastMessage && info.lastMessage.attachments.length > 0)) {
        const attaches = attachments || info.lastMessage.attachments; // Either current message or last
        for (let i = 0; i < attaches.length; i++) {
            if (attaches[i].type == "photo") {
                const filename = `media/${attaches[i].name}.png`;
                jimp.read(attaches[i].largePreviewUrl, (err, file) => {
                    if (err) {
                        sendError("Invalid file", threadId);
                    } else {
                        callback(file, filename);
                    }
                });
            } else {
                sendError(`Sorry, but ${attaches[i].name} is not an acceptable file type`, threadId);
            }
        }
    } else {
        sendError("You must provide either a URL or a valid image attachment", threadId);
    }
}

// Gets dimensions of text for centering it on an image
function measureText(font, text) {
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
}

// Sends a message to all of the chats that the bot is currenty in (use sparingly)
function sendToAll(msg) {
    getGroups((err, groupData) => {
        const groups = JSON.parse(groupData);
        if (groups) {
            for (let g in groups) {
                if (groups[g].isGroup) {
                    sendMessage(msg, g);
                }
            }
        }
    });
}

// Sends all files in a directory (relative to root)
function sendFilesFromDir(dir, threadId) {
    fs.readdir(dir, (err, filenames) => {
        if (!err) {
            sendFile(filenames.map((f) => {
                return `${dir}/${f}`;
            }), threadId);
        } else {
            console.log(err);
        }
    });
}
exports.sendFilesFromDir = sendFilesFromDir;

/*
Retrieve usage stats for a command from memory
Takes a command string, a fullData flag, and optional callback
The callback passes an object containing the count for that command,
the total number of commands and, if the fullData flag is true, a log of
all the command's uses with an "at" timestamp and the "user" of the invoker
for each command as an array of dictionaries with these properties
*/
function getStats(command, fullData, callback) {
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
}

// Updates the usage stats for a command in memory
// Takes a command string and a stats object with `count`, `total`, and
// `record` fields (i.e. the output from `getStats()` with the `fullData`
// flag set to true)
function setStats(command, stats, callback = () => { }) {
    mem.set(`usage_total_all`, `${stats.total}`, {}, (t_err, success) => {
        mem.set(`usage_total_${command}`, `${stats.count}`, {}, (c_err, success) => {
            mem.set(`usage_record_${command}`, `${JSON.stringify(stats.record)}`, {}, (u_err, success) => {
                callback(t_err, c_err, u_err);
            });
        });
    });
}

function getAllStats(callback) {
    const co = commands.commands;
    const names = Object.keys(co).filter((c) => {
        return (co[c].display_names.length > 0); // Don't show secret commands
    });
    let results = [];
    let now = current = (new Date()).getTime();

    function updateResults(value) {
        results.push(value);

        const success = (results.length == names.length);
        current = (new Date()).getTime();

        if (success || (current - now) >= config.asyncTimeout) {
            callback(success, results)
        }
    }

    for (let i = 0; i < names.length; i++) {
        let key = names[i];
        getStats(key, true, (err, stats) => {
            if (!err) {
                updateResults({
                    "key": key,
                    "pretty_name": co[key].pretty_name,
                    "stats": stats
                });
            }
        });
    }
}

// Updates the usage statistics for a particular command (takes command name and
// sending user's ID)
function updateStats(command, senderID, callback = () => { }) {
    getStats(command, true, (err, stats) => {
        if (!err) {
            stats.count++;
            stats.total++;
            stats.record.push({
                "at": (new Date()).toISOString(),
                "user": senderID
            });
            setStats(command, stats, callback);
        } else {
            callback(err);
        }
    })
}

// Clears the stats to start over
function resetStats() {
    const co = commands.commands;
    for (let c in co) {
        if (co.hasOwnProperty(c)) {
            setStats(c, {
                "count": 0,
                "total": 0,
                "record": []
            })
        }
    }
}

// Outputs the statistics data for debugging/analysis
function logStats() {
    const co = commands.commands;
    for (let c in co) {
        if (co.hasOwnProperty(c)) {
            getStats(c, true, (err, stats) => {
                console.log(`${c}: ${stats.count}/${stats.total}`);
                for (let i = 0; i < stats.record.length; i++) {
                    console.log(stats.record[i]);
                }
            });
        }
    }
}

// Returns the passed list of record objects narrowed to those within the
// specified time period
function narrowedWithinTime(record, marker) {
    return record.filter((val) => {
        return (new Date(val.at) > marker);
    });
}

// Gets the most active user of a given command using its passed records
function getHighestUser(record) {
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
}
/* Given a stats object, it adds a `usage` field containing the following:
  `perc`: Percentage of total usage
  `day`: # of times used in the last day
  `month`: # of times used in the last month
*/
function getComputedStats(stats) {
    const usage = {};
    usage.perc = (((stats.count * 1.0) / stats.total) * 100) || 0;

    // Time scopes
    const dayMarker = new Date();
    dayMarker.setDate(dayMarker.getDate() - 1); // Last day
    const monthMarker = new Date();
    monthMarker.setMonth(monthMarker.getMonth() - 1); // Last month

    const dateRecords = narrowedWithinTime(stats.record, dayMarker) // All command calls within the last day
    const monthRecords = narrowedWithinTime(stats.record, monthMarker) // All command calls within the last month

    usage.day = dateRecords ? dateRecords.length : 0;
    usage.month = monthRecords ? monthRecords.length : 0;

    stats.usage = usage;
    return stats;
}

// Allows the bot to react to a message given a message ID (from listen)
// Possible reactions: 'love', 'funny', 'wow', 'sad', 'angry', 'like', and 'dislike'
function reactToMessage(messageId, reaction = "like", api = gapi) {
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
}
exports.reactToMessage = reactToMessage;

/*
Parses a given message and makes the necessary shortcut replacements, which currently include
changing "me" to the current user and any aliases to the corresponding user based on the current
group.

Returns the parsed and replaced string.
*/
function parseNameReplacements(message, fromUserId, groupInfo) {
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
}