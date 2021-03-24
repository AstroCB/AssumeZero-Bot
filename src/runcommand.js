const request = require("request");
const fs = require("fs");
const Entities = require("html-entities").XmlEntities;
const jimp = require("jimp");
const botcore = require("messenger-botcore");
const config = require("./config");
const utils = require("./utils");
const cutils = require("./configutils");
const commands = require("./commands");
const entities = new Entities();
let credentials;
try {
    // Login creds from local dir
    credentials = require("./credentials");
} catch (e) {
    // Deployed to Heroku or config file is missing
    credentials = process.env;
}
// Spotify API (requires credentials)
const spotify = new (require("spotify-web-api-node"))({
    "clientId": credentials.SPOTIFY_CLIENTID,
    "clientSecret": credentials.SPOTIFY_CLIENTSECRET
}); // Spotify API

// Stores user commands (accessible via trigger word set in config.js)
// Command order indicates (and determines) precedence
const funcs = {
    "help": (threadId, cmatch) => { // Check help first to avoid command conflicts
        const cats = commands.categories;
        let input;
        if (cmatch[1]) {
            input = cmatch[1].trim().toLowerCase();
        }
        if (input && input.length > 0) {
            // Give details of specific command or category
            const cat = utils.getHelpCategory(input);
            const entry = utils.getHelpEntry(input);
            if (cat) {
                const name = cat.display_name;
                const desc = cat.description;
                const commands = cat.commands;

                let mess = `_${name} commands: ${desc}_\n\n`;
                for (let c in commands) {
                    if (commands.hasOwnProperty(c)) {
                        const curEntry = commands[c];
                        if (curEntry.display_names.length > 0) { // Don't display if no display names (secret command)
                            // Only display short description if one exists
                            mess += `${curEntry.syntax}${curEntry.short_description ? `: ${curEntry.short_description}` : ""}${curEntry.sudo ? " [OWNER]" : ""}\n`;
                            mess += "------------------\n"; // Suffix for separating commands
                        }
                    }
                }
                mess += `Contact ${config.owner.names.long} with any questions, or use "${config.trigger} bug" to report bugs directly.\n\nTip: for more detailed descriptions, use "${config.trigger} help {command}"`;
                utils.sendMessage(mess, threadId);
            } else if (entry) {
                const info = entry.entry;

                const example = {}; // Fill example data (sometimes array; sometimes string)
                if (Array.isArray(info.example)) {
                    example.header = "Examples:\n";
                    example.body = info.example.map(e => {
                        return `${config.trigger} ${e}`; // Add trigger to example
                    }).join("\n");
                } else if (info.example.length > 0) {
                    example.header = "Example: ";
                    example.body = `${config.trigger} ${info.example}`;
                }

                const helpMsg = `Entry for command "${info.pretty_name}":\n${info.description}\n\nSyntax: ${config.trigger} ${info.syntax}${example.header ? `\n\n${example.header}${example.body}` : ""}`;
                const addenda = `${info.attachments ? "\n\n(This command accepts attachments)" : ""}${info.sudo ? "\n\n(This command requires owner privileges)" : ""}${info.experimental ? "\n\n(This command is experimental)" : ""}`;
                utils.getStats(entry.key, false, (err, stats) => {
                    if (err) { // Couldn't retrieve stats; just show help message
                        utils.sendMessage(`${helpMsg}${addenda}`, threadId);
                    } else {
                        const perc = (((stats.count * 1.0) / stats.total) * 100) || 0;
                        utils.sendMessage(`${helpMsg}\n\nThis command has been used ${stats.count} ${stats.count == 1 ? "time" : "times"}, representing ${perc.toFixed(3)}% of all invocations.${addenda}`, threadId);
                    }
                });
            } else {
                utils.sendError(`Help entry not found for "${input}"`, threadId);
            }
        } else {
            // No command passed; give overview of categories
            let mess = `Quick Help for ${config.bot.names.short || config.bot.names.long}\n\nSelect a category from below with "${config.trigger} help {category}"\n\n`;
            for (let c in cats) {
                if (cats.hasOwnProperty(c)) {
                    const cat = cats[c];
                    if (cat.display_name) { // Don't display hidden categories
                        mess += `*${cat.display_name}*: ${cat.description}\n`;
                    }
                }
            }
            utils.sendMessage(mess, threadId);
        }
    },
    "stats": (threadId, cmatch, groupInfo) => {
        const command = cmatch[1];
        utils.getStats(command, true, () => {
            let input;
            if (cmatch[1]) {
                input = cmatch[1].trim().toLowerCase();
            }
            if (input && input.length > 0) {
                // Give details of specific command
                const entry = utils.getHelpEntry(input);
                if (entry) {
                    const key = entry.key;
                    const info = entry.entry;
                    utils.getStats(key, true, (err, stats) => {
                        if (!err) {
                            stats = utils.getComputedStats(stats);
                            let m = `'${info.pretty_name}' has been used ${stats.count} ${stats.count == 1 ? "time" : "times"} out of a total of ${stats.total} ${stats.total == 1 ? "call" : "calls"}, representing ${stats.usage.perc.toFixed(3)}% of all bot invocations.`;
                            m += `\n\nIt was used ${stats.usage.day} ${stats.usage.day == 1 ? "time" : "times"} within the last day and ${stats.usage.month} ${stats.usage.month == 1 ? "time" : "times"} within the last month.`;

                            const user = utils.getHighestUser(stats.record);
                            if (user) { // Found a user with highest usage
                                const name = groupInfo.names[user] || "not in this chat";
                                m += `\n\nIts most prolific user is ${name}.`;
                            }

                            utils.sendMessage(m, threadId);
                        }
                    });
                } else {
                    utils.sendError(`Entry not found for ${input}`, threadId);
                }
            } else {
                // No command passed; show all
                utils.getAllStats((success, data) => {
                    if (!success) {
                        console.log("Failed to retrieve all stats");
                    }
                    for (let i = 0; i < data.length; i++) {
                        data[i].stats = utils.getComputedStats(data[i].stats); // Get usage stats for sorting
                    }
                    data = data.sort((a, b) => {
                        return (b.stats.usage.perc - a.stats.usage.perc); // Sort greatest to least
                    });

                    let msg = "Command: % of total usage | # today | # this month\n";

                    data.forEach(co => {
                        msg += `\n${co.pretty_name}: ${co.stats.usage.perc.toFixed(3)}% | ${co.stats.usage.day} | ${co.stats.usage.month}`;
                    });

                    utils.sendMessage(msg, threadId);
                });
            }
        });
    },
    "psa": (_, cmatch) => {
        utils.sendToAll(`"${cmatch[1]}"\n\nThis has been a public service announcement from ${config.owner.names.short}.`);
    },
    "bug": (_, cmatch, groupInfo, __, fromUserId) => {
        const msg = cmatch[1] || "none";

        if (msg.toLowerCase().trim() == "thread") {
            utils.sendMessage(`Thread ID: ${groupInfo.threadId}`, groupInfo.threadId);
        } else {
            utils.sendMessage(`-------BUG-------\nMessage: ${msg}\nSender: ${groupInfo.names[fromUserId]}\nTime: ${utils.getTimeString()} (${utils.getDateString()})\nGroup: ${groupInfo.name}\nID: ${groupInfo.threadId}\nInfo: ${JSON.stringify(groupInfo)}`, config.owner.id, err => {
                if (!err) {
                    if (groupInfo.isGroup && !cutils.contains(config.owner.id, groupInfo.members)) { // If is a group and owner is not in it, add
                        utils.sendMessage(`Report sent. Adding ${config.owner.names.short} to the chat for debugging purposes...`, groupInfo.threadId, () => {
                            utils.addUser(config.owner.id, groupInfo, false);
                        });
                    } else { // Otherwise, just send confirmation
                        utils.sendMessage(`Report sent to ${config.owner.names.short}.`, groupInfo.threadId);
                    }
                } else {
                    utils.sendMessage(`Report could not be sent; please message ${config.owner.names.short} directly.`, groupInfo.threadId);
                }
            });
        }
    },
    "kick": (_, cmatch, groupInfo, __, senderId) => {
        const user = cmatch[1].toLowerCase();
        const optTime = cmatch[2] ? parseInt(cmatch[2]) : undefined;
        try {
            // Make sure already in group
            if (groupInfo.members[user]) {
                // Kick with optional time specified in call only if specified in command
                utils.kick(groupInfo.members[user], senderId, groupInfo, optTime);
            } else {
                utils.sendError(`Couldn't find user "${cmatch[1]}".`, groupInfo.threadId);
            }
        } catch (e) {
            utils.sendError(e, groupInfo.threadId);
        }
    },
    "xkcd": (threadId, cmatch) => { // Check before regular searches to prevent collisions
        if (cmatch[1]) { // Parameter specified
            const query = cmatch[2];
            const param = cmatch[1].split(query).join("").trim(); // Param = 1st match - 2nd
            if (query && param == "search") {
                // Perform search using Google Custom Search API (provide API key / custom engine in config.js)
                const url = `https://www.googleapis.com/customsearch/v1?key=${config.xkcd.key}&cx=${config.xkcd.engine}&q=${encodeURIComponent(query)}`;
                request(url, (err, res, body) => {
                    if (!err && res.statusCode == 200) {
                        const results = JSON.parse(body).items;
                        if (results.length > 0) {
                            utils.sendMessage({
                                "url": results[0].formattedUrl // Best match
                            }, threadId);
                        } else {
                            utils.sendError("No results found", threadId);
                        }
                    } else {
                        console.log(err);
                    }
                });
            } else if (param == "new") { // Get most recent (but send as permalink for future reference)
                request("http://xkcd.com/info.0.json", (err, res, body) => {
                    if (!err && res.statusCode == 200) {
                        const num = parseInt(JSON.parse(body).num); // Number of most recent xkcd
                        utils.sendMessage({
                            "url": `http://xkcd.com/${num}`
                        }, threadId);
                    } else {
                        // Just send to homepage for newest as backup
                        utils.sendMessage({
                            "url": "http://xkcd.com/"
                        }, threadId);
                    }
                });
            } else if (param) { // If param != search or new, it should be either a number or valid sub-URL for xkcd.com
                utils.sendMessage({
                    "url": `http://xkcd.com/${param}`
                }, threadId);
            }
        } else { // No parameter passed; send random xkcd
            // Get info of most current xkcd to find out the number of existing xkcd (i.e. the rand ceiling)
            request("http://xkcd.com/info.0.json", (err, res, body) => {
                if (!err && res.statusCode == 200) {
                    const num = parseInt(JSON.parse(body).num); // Number of most recent xkcd
                    const randxkcd = Math.floor(Math.random() * num) + 1;
                    utils.sendMessage({
                        "url": `http://xkcd.com/${randxkcd}`
                    }, threadId);
                }
            });
        }
    },
    "wiki": (threadId, cmatch) => {
        const query = cmatch[1];
        // Perform search using Google Custom Search API (provide API key / custom engine in config.js)
        const url = `https://www.googleapis.com/customsearch/v1?key=${config.wiki.key}&cx=${config.wiki.engine}&q=${encodeURIComponent(query)}`;
        request(url, (err, res, body) => {
            if (!err && res.statusCode == 200) {
                const results = JSON.parse(body).items;
                if (results.length > 0) {
                    utils.sendMessage({
                        "url": results[0].formattedUrl // Best match
                    }, threadId);
                } else {
                    utils.sendError("No results found.", threadId);
                }
            } else {
                console.log(err);
            }
        });
    },
    "spotsearch": (threadId, cmatch) => {
        utils.loginSpotify(spotify, err => {
            if (!err) {
                const query = cmatch[2];
                if (cmatch[1].toLowerCase() == "artist") {
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
                                            utils.sendFilesFromUrl(image, threadId, message);
                                        } else if (link) {
                                            // Just send link
                                            utils.sendMessage({
                                                "body": message,
                                                "url": bestMatch
                                            }, threadId);
                                        } else {
                                            // Just send message
                                            utils.sendMessage(message, threadId);
                                        }
                                    }
                                });
                            } else {
                                utils.sendError(`No results found for query "${query}"`, threadId);
                            }
                        } else {
                            utils.sendError(err, threadId);
                        }
                    });
                } else {
                    // Song search
                    spotify.searchTracks(query, {}, (err, data) => {
                        if (!err) {
                            const bestMatch = data.body.tracks.items[0];
                            if (bestMatch) {
                                const message = `Best match: ${bestMatch.name} by ${utils.getArtists(bestMatch)} (from ${bestMatch.album.name})${bestMatch.explicit ? " (Explicit)" : ""}`;
                                const url = bestMatch.external_urls.spotify;
                                const preview = bestMatch.preview_url;

                                if (preview) {
                                    // Upload preview
                                    utils.sendFilesFromUrl(preview, threadId, message);
                                } else {
                                    // Just send Spotify URL
                                    utils.sendMessage({
                                        "body": message,
                                        "url": url
                                    }, threadId);
                                }
                            } else {
                                utils.sendError(`No results found for query "${query}"`, threadId);
                            }
                        } else {
                            utils.sendError(err, threadId);
                        }
                    });
                }
            } else {
                console.log(err);
            }
        });
    },
    "song": (threadId, cmatch, groupInfo) => {
        utils.loginSpotify(spotify, err => {
            if (!err) {
                const user = cmatch[1] ? cmatch[1].toLowerCase() : null;
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
                            utils.sendMessage(`User ${groupInfo.names[userId]} does not have a stored playlist; using ${playlist.name}'s instead.`, threadId);
                        }
                    } else {
                        // No playlist specified; grab random one from group
                        playlist = randPlaylist;
                    }
                } else {
                    playlist = config.defaultPlaylist;
                    utils.sendMessage(`No playlists found for this group. To add one, use "${config.trigger} playlist" (see help for more info).\nFor now, using the default playlist.`, threadId);
                }

                spotify.getPlaylist(playlist.uri, {}, (err, data) => {
                    if (!err) {
                        const name = data.body.name;
                        const songs = data.body.tracks.items;
                        let track = songs[Math.floor(Math.random() * songs.length)].track;
                        let buffer = 0;
                        while (!track.preview_url && buffer < songs.length) { // Don't use songs without previews if possible
                            track = songs[Math.floor(Math.random() * songs.length)].track;
                            buffer++;
                        }
                        utils.sendMessage(`Grabbing a song from ${playlist.name}'s playlist, "${name}"...`, threadId);
                        const msg = `How about ${track.name} (from "${track.album.name}") by ${utils.getArtists(track)}${track.explicit ? " (Explicit)" : ""}?`;
                        if (track.preview_url) {
                            // Send preview MP3 to chat if exists
                            utils.sendFilesFromUrl(track.preview_url, threadId, msg);
                        } else {
                            utils.sendMessage({
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
    },
    "playlist": (threadId, cmatch, groupInfo) => {
        const playlists = groupInfo["playlists"];
        if (cmatch[1]) { // User provided
            const user = cmatch[1].toLowerCase();
            const userId = groupInfo.members[user];
            const name = groupInfo.names[userId];
            if (cmatch[2]) { // Data provided
                const newPlaylist = {
                    "name": name,
                    "id": userId,
                    "user": cmatch[3],
                    "uri": cmatch[4]
                };
                playlists[userId] = newPlaylist;
                utils.setGroupProperty("playlists", playlists, groupInfo, err => {
                    if (!err) {
                        utils.loginSpotify(spotify, err => {
                            if (!err) {
                                spotify.getPlaylist(newPlaylist.uri, {}, (err, data) => {
                                    if (!err) {
                                        let message = `Playlist "${data.body.name}" added to the group. Here are some sample tracks:\n`;
                                        const songs = data.body.tracks.items;
                                        for (let i = 0; i < config.spotifySearchLimit; i++) {
                                            if (songs[i]) {
                                                let track = songs[i].track;
                                                message += `– ${track.name}${track.explicit ? " (Explicit)" : ""} (from ${track.album.name})${(i != config.spotifySearchLimit - 1) ? "\n" : ""}`;
                                            }
                                        }
                                        utils.sendMessage(message, threadId);
                                    } else {
                                        utils.sendError("Playlist couldn't be added; check the URI and make sure that you've set the playlist to public.", threadId);
                                    }
                                });
                            } else {
                                console.log(err);
                            }
                        });
                    }
                });
            } else {
                const playlist = groupInfo.playlists[userId];
                if (playlist) {
                    utils.loginSpotify(spotify, err => {
                        if (!err) {
                            spotify.getPlaylist(playlist.uri, {}, (err, data) => {
                                if (!err) {
                                    const pname = data.body.name;
                                    const desc = entities.decode(data.body.description); // Can have HTML entities in text
                                    const image = data.body.images[0];
                                    const owner = data.body.owner;
                                    const id = data.body.id;
                                    const url = `https://open.spotify.com/playlist/${id}`;
                                    const message = `${pname} by ${owner.display_name} (${owner.id}):\n\n"${desc}"\n\n${url}`;

                                    if (image) {
                                        utils.sendFilesFromUrl(image.url, threadId, message);
                                    } else {
                                        utils.sendMessage(message);
                                    }
                                } else {
                                    utils.sendError(`Couldn't find playlist with URI ${playlist.uri} for user ${playlist.name}`, threadId);
                                }
                            });
                        }
                    });
                } else {
                    utils.sendError("Please include a Spotify URI to add a playlist (see help for more info)", threadId);
                }
            }
        } else { // No user provided; just display current playlists
            const pArr = Object.keys(playlists).map(p => {
                return playlists[p];
            });
            if (pArr.length === 0) {
                utils.sendMessage(`No playlists for this group. To add one, use "${config.trigger} playlist" (see help).`, threadId);
            } else {
                utils.loginSpotify(spotify, err => {
                    if (!err) {
                        let results = [];
                        const now = (new Date()).getTime();
                        let current = now;

                        // eslint-disable-next-line no-inner-declarations
                        function updateResults(value) {
                            results.push(value);

                            const success = (results.length == pArr.length);
                            current = (new Date()).getTime();

                            if (success || (current - now) >= config.asyncTimeout) {
                                const descs = results.map(p => {
                                    return `"${p.name}" by ${p.user} (${p.length} songs)`;
                                });
                                utils.sendMessage(`Playlists for this group:\n— ${descs.join("\n— ")}`, threadId);
                            }
                        }

                        for (let i = 0; i < pArr.length; i++) {
                            spotify.getPlaylist(pArr[i].uri, {}, (err, data) => {
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
    },
    "pin": (threadId, cmatch, groupInfo, _, fromUserId, __, msgObj) => {
        const name = cmatch[1];
        const msg = cmatch[2];
        const reply = msgObj.messageReply;

        if (groupInfo.pinned) {
            if (name == "delete") { // Delete pins
                utils.deletePin(msg, groupInfo, threadId);
            } else if (name == "rename") {
                utils.renamePin(msg, groupInfo, threadId);
            } else if (!msg && !reply) { // No new pin message; display pins
                if (name) { // Requested specific pin
                    const pin = groupInfo.pinned[name];
                    if (pin) {
                        utils.sendMessage(utils.stringifyPin(pin), threadId);
                    } else {
                        utils.sendError("Couldn't find that pin.", threadId);
                    }
                } else {
                    const pins = Object.keys(groupInfo.pinned);
                    if (pins.length > 0) {
                        if (pins.length == 1) { // Display pin if only one; otherwise list pins
                            const pin = pins[0];
                            utils.sendMessage(utils.stringifyPin(groupInfo.pinned[pin]), threadId);
                        } else {
                            let msg = pins.reduce((m, pin) => `${m}\n${pin}`, "Available pins:");
                            utils.sendMessage(msg, threadId);
                        }
                    } else {
                        utils.sendError("No pinned messages in this chat.", threadId);
                    }
                }
            } else { // Pin new message (or append to existing pin)
                let pin = msg;
                let sender = groupInfo.names[fromUserId];
                let time = msgObj.timestamp;

                if (reply) { // If reply provided, pin the reply instead
                    pin = reply.body;
                    sender = reply.senderID == config.bot.id ? config.bot.names.short :
                        (groupInfo.names[reply.senderID] || "Unknown");
                    time = reply.timestamp;
                }
                const date = new Date(parseInt(time));

                if (name == "append") {
                    // -- Appending an existing pin --
                    // Need to extract existing pin name and content to append, which
                    // comes from different places in the case of a reply pin
                    // (regex designed to capture multiple lines)
                    const match = msg ? (msg.match(/(\S+)(?:\s|$)([\s\S]+)/m) || []) : [];
                    const existing = reply ? msg : match[1];
                    const content = reply ? pin : match[2];

                    if (existing && content) {
                        utils.appendPin(content, existing, date, sender, groupInfo);
                    } else {
                        utils.sendError("Please provide a pin and content to append to it.", threadId);
                    }
                } else {
                    // Just a regular fresh pin creation (or overwrite)
                    if (pin && name) {
                        utils.addPin(pin, name, date, sender, groupInfo);
                    } else {
                        utils.sendError("Please provide a pin name and message to pin.", threadId);
                    }
                }
            }
        } else {
            console.log("Unable to pin message due to malformed db entry");
        }
    },
    "tab": (threadId, cmatch, groupInfo) => {
        const op = cmatch[1];
        const amt = parseFloat(cmatch[2]) || 1;
        const cur = groupInfo.tab || 0;
        const numMembers = Object.keys(groupInfo.members).length;
        if (!op) { // No operation – just display total
            utils.sendMessage(`$${cur.toFixed(2)} ($${(cur / numMembers).toFixed(2)} per person in this group)`, threadId);
        } else if (op == "split") {
            const num = parseFloat(cmatch[2]) || numMembers;
            utils.sendMessage(`$${cur.toFixed(2)}: $${(cur / num).toFixed(2)} per person for ${num} ${(num == 1) ? "person" : "people"}`, threadId);
        } else if (op == "clear") { // Clear tab
            utils.setGroupProperty("tab", 0, groupInfo, err => {
                if (!err) { utils.sendMessage("Tab cleared.", threadId); }
            });
        } else {
            const newTab = (op == "add") ? (cur + amt) : (cur - amt);
            utils.setGroupProperty("tab", newTab, groupInfo, err => {
                if (!err) { utils.sendMessage(`Tab updated to $${newTab.toFixed(2)}.`, threadId); }
            });
        }
    },
    "addsearch": (threadId, cmatch, groupInfo, api) => {
        // Fields 1 & 3 are are for the command and the user, respectively
        // Field 2 is for an optional number parameter specifying the number of search results
        // for a search command (default is 1)
        const user = cmatch[3];
        const command = cmatch[1].split(" ")[0].toLowerCase(); // Strip opt parameter from match if present
        try {
            api.getUserID(user, (err, data) => {
                if (!err) {
                    const filteredData = data.filter(m => m.type == "user");
                    const bestMatch = filteredData[0]; // Hopefully the right person
                    const numResults = parseInt(cmatch[2]) || 1; // Number of results to display
                    if (command == "search") { // Is a search command
                        // Output search results / propic
                        const descriptions = filteredData.slice(0, numResults).map((match, num) => {
                            return `${(num === 0) ? "Best match" : "Match " + (num + 1)}: ${match.name}\n${match.profileUrl}\nRank: ${match.score}\nUser ID: ${match.userID}`;
                        }).join("\n\n");

                        utils.sendFilesFromUrl(bestMatch.photoUrl, threadId, descriptions);
                    } else { // Is an add command
                        // Add best match to group and update log of member IDs
                        utils.addUser(bestMatch.userID, groupInfo);
                    }
                } else {
                    if (err.error) {
                        // Fix typo in API error message
                        utils.sendError(`${err.error.replace("Bes", "Best")}`, threadId);
                    }
                }
            });
        } catch (e) {
            utils.sendError(`User ${user} not recognized`);
        }
    },
    "order66": (threadId, _, groupInfo, __, senderId) => {
        // Remove everyone from the chat for configurable amount of time (see config.js)
        // Use stored threadId in case it changes later (very important)
        if (groupInfo.isGroup) {
            if (groupInfo.admins.includes(config.bot.id)) {
                utils.sendMessage("I hate you all.", threadId);
                setTimeout(() => {
                    utils.kickMultiple(Object.keys(groupInfo.names), senderId, groupInfo, config.order66Time, () => {
                        utils.sendMessage("Balance is restored to the Force.", threadId);
                    });
                }, 2000); // Make sure people see the message (and impending doom)
            } else {
                utils.sendMessage("Not. Yet. The Senate will decide your fate.", threadId);
            }
        } else {
            utils.sendMessage("Cannot execute Order 66 on a non-group chat. Safe for now, you are, Master Jedi.", threadId);
        }
    },
    "color": (threadId, cmatch, groupInfo, api) => {
        // Extract input and pull valid colors from API as well as current thread color
        const apiColors = api.threadColors;
        const hexToName = Object.keys(apiColors).reduce((obj, key) => { obj[apiColors[key]] = key; return obj; }, {}); // Flip the map
        const ogColor = hexToName[groupInfo.color ? groupInfo.color.toLowerCase() : groupInfo.color]; // Will be null if no custom color set

        if (cmatch[1]) {
            const inputColor = cmatch[2];
            const colorToSet = (inputColor.match(/rand(om)?/i)) ? utils.getRandomColor() : inputColor.toLowerCase();

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
                utils.sendError("Couldn't find this color. See help for accepted values.", threadId);
            } else {
                api.changeThreadColor(usableVal, threadId, err => {
                    if (!err) {
                        utils.sendMessage(`Last color was ${ogColor}.`, threadId);
                    }
                });
            }
        } else { // No color requested – show current color
            utils.sendMessage(`The current chat color is ${ogColor} (hex value: ${groupInfo.color ? groupInfo.color : "empty"}).`, threadId);
        }
    },
    "hitlights": (threadId, _, groupInfo, api) => {
        const ogColor = groupInfo.color || config.defaultColor; // Will be null if no custom color set
        const delay = 500; // Delay between color changes (half second is a good default)
        for (let i = 0; i < config.numColors; i++) { // Need block scoping for timeout
            setTimeout(() => {
                api.changeThreadColor(utils.getRandomColor(), threadId);
                if (i == (config.numColors - 1)) { // Set back to original color on last
                    setTimeout(() => {
                        api.changeThreadColor(ogColor, threadId);
                    }, delay);
                }
            }, delay + (i * delay)); // Queue color changes
        }
    },
    "clearnick": (threadId, cmatch, groupInfo, api) => {
        const user = cmatch[1].toLowerCase();
        api.changeNickname("", threadId, groupInfo.members[user]);
    },
    "setnick": (threadId, cmatch, groupInfo, api) => {
        const user = cmatch[1].toLowerCase();
        const newName = cmatch[2];
        api.changeNickname(newName, threadId, groupInfo.members[user]);
    },
    "wakeup": (threadId, cmatch, groupInfo) => {
        const user = cmatch[1].toLowerCase();
        const members = groupInfo.members; // Save in case it changes
        for (let i = 0; i < config.wakeUpTimes; i++) {
            setTimeout(() => {
                utils.sendMessage("Wake up", members[user]);
            }, 500 + (500 * i));
        }
        utils.sendMessage(`Messaged ${user.substring(0, 1).toUpperCase()}${user.substring(1)} ${config.wakeUpTimes} times`, threadId);
    },
    "randmess": (threadId, _, __, api) => {
        // Get thread length
        api.getThreadInfo(threadId, (err, data) => {
            if (!err) {
                const count = data.messageCount; // Probably isn't that accurate
                let randMessage = Math.floor(Math.random() * (count + 1));
                api.getThreadHistory(threadId, count, null, (err, data) => {
                    if (err) {
                        utils.sendMessage("Error: Messages could not be loaded", threadId);
                    } else {
                        let m = data[randMessage];
                        while (!(m && m.body)) {
                            randMessage = Math.floor(Math.random() * (count + 1));
                            m = data[randMessage];
                        }
                        let b = m.body,
                            name = m.senderName,
                            time = new Date(m.timestamp);
                        utils.sendMessage(`${b} - ${name} (${time.toLocaleDateString()})`, threadId);
                    }
                });
            }
        });
    },
    "alive": (_, __, groupInfo) => {
        utils.sendGroupEmoji(groupInfo, "large"); // Send emoji and react to message in response
    },
    "emoji": (threadId, cmatch, groupInfo, api) => {
        api.changeThreadEmoji(cmatch[1], threadId, err => {
            if (err) {
                // Set to default as backup if errors
                api.changeThreadEmoji(groupInfo.emoji, threadId);
            }
        });
        utils.updateGroupInfo(threadId); // Update emoji
    },
    "echo": (threadId, cmatch, _, api, fromUserId) => {
        const command = cmatch[1].toLowerCase();
        let message = `${cmatch[2]}`;
        if (command == "echo") {
            // Just an echo – repeat message
            utils.sendMessage(message, threadId);
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
                    utils.sendMessage(message, threadId);
                }
            });
        }
    },
    "ban": (threadId, cmatch, groupInfo) => {
        const user = cmatch[2].toLowerCase();
        const userId = groupInfo.members[user];

        if (user) {
            if (cmatch[1]) { // Unban
                botcore.banned.removeUser(userId, success => {
                    if (success) {
                        utils.sendMessage(`Successfully unbanned ${groupInfo.names[userId]}.`, threadId);
                    } else {
                        utils.sendError(`Unable to unban ${groupInfo.names[userId]} because they're not currently banned.`, threadId);
                    }
                });
            } else { // Ban
                botcore.banned.addUser(userId, success => {
                    if (success) {
                        utils.sendMessage(`Successfully banned ${groupInfo.names[userId]}.`, threadId);
                    } else {
                        utils.sendError(`Unable to ban ${groupInfo.names[userId]} because they've already been banned.`, threadId);
                    }
                });
            }
        } else {
            utils.sendError(`User ${user} not found`, threadId);
        }
    },
    "vote": (threadId, cmatch, groupInfo) => {
        const user = cmatch[2].toLowerCase();
        const userId = groupInfo.members[user];
        const user_cap = user.substring(0, 1).toUpperCase() + user.substring(1);
        const getCallback = () => {
            return (err, success, newScore) => {
                if (success) {
                    utils.sendMessage(`${user_cap}'s current score is now ${newScore}.`, threadId);
                } else {
                    utils.sendError("Score update failed.", threadId);
                }
            };
        };
        if (userId) {
            if (cmatch[1] == ">") {
                // Upvote
                utils.updateScore(true, userId, getCallback(true));
            } else {
                // Downvote
                utils.updateScore(false, userId, getCallback(false));
            }
        } else {
            utils.sendError(`User ${user_cap} not found`, threadId);
        }
    },
    "score": (threadId, cmatch, groupInfo) => {
        if (cmatch[1]) { // Display scoreboard
            utils.getAllScores(groupInfo, (success, scores) => {
                if (success) {
                    scores = scores.sort((a, b) => {
                        return (b.score - a.score); // Sort greatest to least
                    });

                    let message = `Rankings for ${groupInfo.name}:`;
                    for (let i = 0; i < scores.length; i++) {
                        message += `\n${i + 1}. ${scores[i].name}: ${scores[i].score}`;
                    }
                    utils.sendMessage(message, threadId);
                } else {
                    utils.sendError("Scores couldn't be retrieved for this group.", threadId);
                }
            });
        } else if (cmatch[2]) {
            const user = cmatch[2].toLowerCase();
            const userId = groupInfo.members[user];
            const user_cap = user.substring(0, 1).toUpperCase() + user.substring(1);
            if (userId) {
                const new_score = cmatch[3];
                if (new_score || new_score == "0") { // Set to provided score if valid (0 is falsey)
                    utils.setScore(userId, new_score, (err, success) => {
                        if (success) {
                            utils.sendMessage(`${user_cap}'s score updated to ${new_score}.`, threadId);
                        } else {
                            utils.sendError(err, threadId);
                        }
                    });
                } else { // No value provided; just display score
                    utils.getScore(`${userId}`, (err, val) => {
                        if (!err) {
                            const stored_score = val ? val.toString() : 0;
                            utils.sendMessage(`${user_cap}'s current score is ${stored_score}.`, threadId);
                        } else {
                            console.log(err);
                        }
                    });
                }
            } else {
                utils.sendError(`User ${user_cap} not found`, threadId);
            }
        }
    },
    "restart": (threadId,) => {
        utils.restart(() => {
            utils.sendMessage("Restarting...", threadId);
        });
    },
    "photo": (threadId, cmatch, groupInfo, _, __, attachments, messageObj) => {
        // Set group photo to photo at provided URL
        const url = cmatch[1];
        if (url) {
            // Use passed URL
            utils.setGroupImageFromUrl(url, threadId, "Can't set group image for this chat.");
        } else if (attachments && attachments[0]) {
            if (attachments[0].type == "photo") {
                // Use photo attachment
                utils.setGroupImageFromUrl(attachments[0].largePreviewUrl, threadId, "Attachment is invalid.");
            } else {
                utils.sendError("This command only accepts photo attachments.", threadId);
            }
        } else if (messageObj.type == "message_reply") {
            const msg = messageObj.messageReply;
            if (msg.attachments && msg.attachments.length > 0) {
                const photo = msg.attachments[0];
                if (photo.type == "photo") {
                    utils.setGroupImageFromUrl(photo.largePreviewUrl, threadId, "Attachment is invalid.");
                } else {
                    utils.sendError("This command only accepts photo attachments.", threadId);
                }
            } else {
                utils.sendError("The message you're replying to must ahve a photo attachment.", threadId);
            }
        } else {
            // If no photo provided, just display current group photo if it exists
            if (groupInfo.image) {
                utils.sendFilesFromUrl(groupInfo.image, threadId);
            } else {
                utils.sendError("This group currently has no photo set. To add one, use this command with either a valid image URL or a photo attachment.", threadId);
            }
        }
    },
    "poll": (threadId, cmatch, _, api) => {
        const title = cmatch[1];
        const opts = cmatch[2];
        let optsObj = {};
        if (opts) {
            const items = opts.split(",");
            for (let i = 0; i < items.length; i++) {
                optsObj[items[i]] = false; // Initialize options to unselected in poll
            }
        }
        api.createPoll(title, threadId, optsObj, err => { // I contributed this func to the API!
            if (err) {
                utils.sendError("Cannot create a poll in a non-group chat.", threadId);
            }
        });
    },
    "title": (threadId, cmatch, _, api) => {
        const title = cmatch[1];
        api.setTitle(title, threadId, err => {
            if (err) {
                utils.sendError("Cannot set title for non-group chats.", threadId);
            }
        });
    },
    "answer": threadId => {
        utils.sendMessage(config.answerResponses[Math.floor(Math.random() * config.answerResponses.length)], threadId);
    },
    "space": (threadId, cmatch) => {
        const search = cmatch[2];
        request.get(`https://images-api.nasa.gov/search?q=${encodeURIComponent(search)}&media_type=image`, (err, res, body) => {
            if (!err) {
                const results = JSON.parse(body).collection.items;
                if (results && results.length > 0) {
                    const chosen = cmatch[1] ? Math.floor(Math.random() * results.length) : 0; // If rand not specified, use top result
                    const link = results[chosen].links[0].href;
                    const data = results[chosen].data[0];
                    utils.sendFilesFromUrl(link, threadId, `"${data.title}"\n${data.description}`);
                } else {
                    utils.sendError(`No results found for ${search}`, threadId);
                }
            } else {
                utils.sendError(`No results found for ${search}`, threadId);
            }
        });
    },
    "rng": (threadId, cmatch) => {
        let lowerBound, upperBound;
        if (cmatch[2]) {
            lowerBound = parseInt(cmatch[1]); // Assumed to exist if upperBound was passed
            upperBound = parseInt(cmatch[2]);
        } else { // No last parameter
            lowerBound = config.defaultRNGBounds[0];
            if (cmatch[1]) { // Only parameter passed becomes upper bound
                upperBound = parseInt(cmatch[1]);
            } else { // No params passed at all
                upperBound = config.defaultRNGBounds[1];
            }
        }
        const rand = Math.floor(Math.random() * (upperBound - lowerBound + 1)) + lowerBound;
        const chance = Math.abs(((1.0 / (upperBound - lowerBound + 1)) * 100).toFixed(2));
        utils.sendMessage(`${rand}\n\nWith bounds of (${lowerBound}, ${upperBound}), the chances of receiving this result were ${chance}%`, threadId);
    },
    "bw": (threadId, cmatch, groupInfo, _, __, attachments) => {
        const url = cmatch[1];
        utils.processImage(url, attachments, groupInfo, (img, filename, path) => {
            img.greyscale().write(path, err => {
                if (!err) {
                    utils.sendFile(filename, threadId, "", () => {
                        fs.unlink(path, () => { });
                    });
                }
            });
        });
    },
    "sepia": (threadId, cmatch, groupInfo, _, __, attachments) => {
        const url = cmatch[1];
        utils.processImage(url, attachments, groupInfo, (img, filename, path) => {
            img.sepia().write(path, err => {
                if (!err) {
                    utils.sendFile(filename, threadId, "", () => {
                        fs.unlink(path, () => { });
                    });
                }
            });
        });
    },
    "flip": (threadId, cmatch, groupInfo, _, __, attachments) => {
        const horiz = (cmatch[1].toLowerCase().indexOf("horiz") > -1); // Horizontal or vertical
        const url = cmatch[2];
        utils.processImage(url, attachments, groupInfo, (img, filename, path) => {
            img.flip(horiz, !horiz).write(path, err => {
                if (!err) {
                    utils.sendFile(filename, threadId, "", () => {
                        fs.unlink(path, () => { });
                    });
                }
            });
        });
    },
    "invert": (threadId, cmatch, groupInfo, _, __, attachments) => {
        const url = cmatch[1];
        utils.processImage(url, attachments, groupInfo, (img, filename, path) => {
            img.invert().write(path, err => {
                if (!err) {
                    utils.sendFile(filename, threadId, "", () => {
                        fs.unlink(path, () => { });
                    });
                }
            });
        });
    },
    "blur": (threadId, cmatch, groupInfo, _, __, attachments) => {
        const pixels = parseInt(cmatch[1]) || 2;
        const gauss = cmatch[2];
        const url = cmatch[3];
        utils.processImage(url, attachments, groupInfo, (img, filename, path) => {
            if (gauss) {
                // Gaussian blur (extremely resource-intensive – will pretty much halt the bot while processing)
                utils.sendMessage("Hang on, this might take me a bit...", threadId, () => {
                    const now = (new Date()).getTime();
                    img.gaussian(pixels).write(path, err => {
                        if (!err) {
                            utils.sendFile(filename, threadId, `Processing took ${((new Date()).getTime() - now) / 1000} seconds.`, () => {
                                fs.unlink(path, () => { });
                            });
                        }
                    });
                });
            } else {
                img.blur(pixels).write(path, err => {
                    if (!err) {
                        utils.sendFile(filename, threadId, "", () => {
                            fs.unlink(path, () => { });
                        });
                    }
                });
            }
        });
    },
    "overlay": (threadId, cmatch, groupInfo, _, __, attachments) => {
        const url = cmatch[1];
        const overlay = cmatch[2];
        utils.processImage(url, attachments, groupInfo, (img, filename, path) => {
            jimp.loadFont(jimp.FONT_SANS_32_BLACK, (err, font) => {
                if (!err) {
                    const width = img.bitmap.width; // Image width
                    const height = img.bitmap.height; // Image height
                    const textDims = utils.measureText(font, overlay); // Get text dimensions (x,y)
                    img.print(font, (width - textDims[0]) / 2, (height - textDims[1]) / 2, overlay, (width + textDims[0])).write(path, err => {
                        if (!err) {
                            img.write(path, err => {
                                if (!err) {
                                    utils.sendFile(filename, threadId, "", () => {
                                        fs.unlink(path, () => { });
                                    });
                                } else {
                                    utils.sendError("Encountered a problem trying to save the image.", threadId);
                                }
                            });
                        }
                    });
                } else {
                    utils.sendError("Couldn't load font.", threadId);
                }
            });
        });
    },
    "brightness": (threadId, cmatch, groupInfo, _, __, attachments) => {
        const bright = (cmatch[1].toLowerCase() == "brighten");
        // Value must range from -1 to 1
        let perc = parseInt(cmatch[2]);
        perc = (perc > 100) ? 1 : (perc / 100.0);
        perc = bright ? perc : (-1 * perc);
        const url = cmatch[3];
        utils.processImage(url, attachments, groupInfo, (img, filename, path) => {
            img.brightness(perc).write(path, err => {
                if (!err) {
                    utils.sendFile(filename, threadId, "", () => {
                        fs.unlink(path, () => { });
                    });
                }
            });
        });
    },
    "mute": (threadId, cmatch, groupInfo) => {
        const getCallback = muted => {
            return err => {
                if (!err) {
                    utils.sendMessage(`Bot ${muted ? "muted" : "unmuted"}`, threadId);
                }
            };
        };
        const mute = !(cmatch[1]); // True if muting; false if unmuting
        utils.setGroupProperty("muted", mute, groupInfo, getCallback(mute));
    },
    "christen": (threadId, cmatch, _, api) => {
        api.changeNickname(cmatch[1], threadId, config.bot.id);
    },
    "wolfram": (threadId, cmatch) => {
        const query = cmatch[1];
        request(`http://api.wolframalpha.com/v1/result?appid=${credentials.WOLFRAM_KEY}&i=${encodeURIComponent(query)}`, (err, res, body) => {
            if (!(err || body == "Wolfram|Alpha did not understand your input")) {
                utils.sendMessage(body, threadId);
            } else {
                utils.sendMessage(`No results found for "${query}"`, threadId);
            }
        });
    },
    "destroy": (threadId, _, groupInfo, api, senderId) => { // DANGEROUS COMMAND
        for (let m in groupInfo.members) {
            // Bot should never be in members list, but this is a safeguard
            // (ALSO VERY IMPORTANT so that group isn't completely emptied)
            // We're talking triple redundancies at this point
            if (groupInfo.members.hasOwnProperty(m) && groupInfo.members[m] != config.bot.id
                && groupInfo.members[m] != api.getCurrentUserID()) {
                utils.kick(groupInfo.members[m], senderId, groupInfo);
            }
        }
        // Archive the thread afterwards to avoid clutter in the messages list
        // (bot will still have access and be able to add people back if necessary)
        api.changeArchivedStatus(threadId, true, err => {
            if (err) {
                console.log(`Error archiving thread ${threadId}`);
            }
        });
    },
    "clearstats": () => {
        utils.resetStats();
    },
    "infiltrate": (threadId, cmatch, _, api) => {
        const searchName = cmatch[1];
        api.getThreadList(config.threadLimit, null, [], (err, chats) => {
            if (!err) {
                if (!searchName) { // Just list chats
                    let message = "Available groups:";
                    message += chats.filter(c => c.isGroup && c.participants.length > 2).map(c => {
                        const numMembers = c.participants.length - 1; // Exclude bot
                        return `\n– ${c.name || c.threadID} (${numMembers} ${numMembers == 1 ? "member" : "members"})`;
                    }).join("");
                    utils.sendMessage(message, threadId);
                } else {
                    let chatFound = false;
                    for (let i = 0; i < chats.length; i++) {
                        const chatName = chats[i].name;
                        const chatId = chats[i].threadID;
                        if (chatId == searchName || chatName.toLowerCase().indexOf(searchName.toLowerCase()) > -1) {
                            chatFound = true;
                            utils.addUser(config.owner.id, {
                                "threadId": chatId
                            }, true, err => {
                                if (err) {
                                    utils.sendError(`You're already in group "${chatName}".`, threadId);
                                } else {
                                    utils.sendMessage(`Added you to group "${chatName}".`, threadId);
                                }
                            }, false); // Add admin to specified group; send confirmation to both chats
                        }
                    }
                    if (!chatFound) {
                        utils.sendError(`Chat with name "${searchName}" not found.`, threadId);
                    }
                }
            } else {
                utils.sendError("Thread list couldn't be retrieved.", threadId);
            }
        });
    },
    "alias": (threadId, cmatch, groupInfo) => {
        const user = cmatch[2].toLowerCase();
        const aliasInput = cmatch[3];
        const aliases = groupInfo.aliases;
        const name = groupInfo.names[groupInfo.members[user]];
        if (cmatch[1]) { // Clear
            delete aliases[user];
            utils.setGroupProperty("aliases", aliases, groupInfo, err => {
                if (!err) {
                    utils.sendMessage(`Alias cleared for ${name}.`, threadId);
                }
            });
        } else if (aliasInput) { // Set new alias
            const alias = aliasInput.toLowerCase();
            aliases[user] = alias;
            utils.setGroupProperty("aliases", aliases, groupInfo, err => {
                if (!err) {
                    utils.sendMessage(`${name} can now be called "${aliasInput}".`, threadId);
                }
            });
        } else { // Display alias for user if exists
            if (aliases[user]) {
                utils.sendMessage(`${name} can also be called "${aliases[user]}".`, threadId);
            } else {
                utils.sendMessage(`${name} does not have an alias.`, threadId);
            }
        }
    },
    "weather": (threadId, cmatch) => {
        const city = cmatch[1];
        request(`http://api.openweathermap.org/data/2.5/weather?appid=${credentials.WEATHER_KEY}&q=${city}&units=imperial`, (err, res, body) => {
            if (!err && res.statusCode == 200) {
                const data = JSON.parse(body);
                const name = data.name;
                const country = data.sys.country;
                const weather = data.weather[0];
                const cur = data.main;

                const msg = `Weather for ${name} (${country}):\nConditions: ${weather.description}\nTemp: ${cur.temp} ºF (L-${cur.temp_min} H-${cur.temp_max})\nCloud cover: ${data.clouds.all}%`;
                utils.sendFilesFromUrl(`http://openweathermap.org/img/w/${weather.icon}.png`, threadId, msg);
            } else {
                utils.sendError("Couldn't retrieve weather for that location.", threadId);
            }
        });
    },
    "branch": (threadId, cmatch, groupInfo, api, fromUserId) => {
        const title = cmatch[1] ? cmatch[1].trim() : null;
        const input = cmatch[2];
        const members = input.split(",").map(m => utils.parseNameReplacements(m.toLowerCase().trim(), fromUserId, groupInfo));
        const ids = members.map(m => groupInfo.members[m]);

        // Start a new chat with the collected IDs and the bot
        utils.sendMessage(`Welcome! This group was created from ${groupInfo.name}.`, ids, (err, info) => {
            if (!err) {
                if (info.threadID) {
                    // Set title if provided
                    if (title) {
                        api.setTitle(title, info.threadID);
                    }

                    // Pre-initialize chat silently to prevent welcome message send
                    utils.updateGroupInfo(info.threadID, "", () => { }, false);
                }
                utils.sendMessage(`Subgroup${title ? ` "${title}"` : ""} created.`, threadId);
            } else {
                console.log(err);
            }
        });
    },
    "restore": (threadId, cmatch, _, api) => {
        const oldId = cmatch[1];

        // Collect properties about old chat
        utils.getGroupInfo(oldId, (err, info) => {
            // Also collect info about current chat to check against
            utils.getGroupInfo(threadId, (curErr, curInfo) => {
                if (err || !info) {
                    utils.sendError("Couldn't find any stored information for that chat; make sure the bot has been initialized in it previously.", threadId);
                } else if (curErr || !curInfo) {
                    utils.sendError("Couldn't load information about this current chat; wait for initialization.", threadId);
                } else {
                    const restorables = {
                        "title": (info.name == exports.defaultTitle) ? null : info.name,
                        "emoji": info.emoji,
                        "color": info.color,
                        "nicknames": info.nicknames,
                        "muted": info.muted,
                        "playlists": info.playlists,
                        "aliases": info.aliases,
                        "tab": info.tab,
                        "pinned": info.pinned,
                        "image": info.image
                    };

                    // Check for restorable properties and restore them
                    if (restorables.title && curInfo.isGroup) { api.setTitle(restorables.title, threadId); }
                    if (restorables.emoji) { api.changeThreadEmoji(restorables.emoji, threadId); }
                    if (restorables.color) { api.changeThreadColor(restorables.color, threadId); }
                    if (restorables.image) { utils.setGroupImageFromUrl(restorables.image, threadId); }
                    if (restorables.nicknames) {
                        for (let id in restorables.nicknames) {
                            // Check if member is in the current group first
                            if (restorables.nicknames.hasOwnProperty(id) && cutils.contains(id, curInfo.members)) {
                                api.changeNickname(restorables.nicknames[id], threadId, id);
                            }
                        }
                    }
                    // Restore groupInfo properties (cascaded to avoid race conditions)
                    utils.setGroupProperty("muted", restorables.muted, curInfo, () => {
                        utils.setGroupProperty("playlists", restorables.playlists, curInfo, () => {
                            utils.setGroupProperty("aliases", restorables.aliases, curInfo, () => {
                                utils.setGroupProperty("tab", restorables.tab, curInfo, () => {
                                    utils.setGroupProperty("pinned", restorables.pinned, curInfo, () => {
                                        utils.setGroupProperty("image", restorables.image, curInfo);
                                    });
                                });
                            });
                        });
                    });
                }
            });
        });
    },
    "google": (threadId, cmatch) => {
        const query = cmatch[1];
        const encoded = encodeURI(query);
        utils.sendMessage({
            "url": `https://www.google.com/search?q=${encoded}`
        }, threadId);
    },
    "snap": (threadId, _, groupInfo, api, fromUserId) => {
        // Remove a random half of the members from the chat for configurable amount of time (see config.js)
        // Use stored threadId in case it changes later (very important)
        if (groupInfo.isGroup) {
            api.getUserInfo(fromUserId, (err, info) => {
                if (!err) {
                    const sender = info[fromUserId].name.split(" ");
                    const lastName = sender[sender.length - 1];
                    if (groupInfo.admins.includes(config.bot.id)) {
                        utils.sendMessage(`You have my respect, ${lastName}. I hope they remember you.`, threadId);
                        setTimeout(() => {
                            const mem = Object.keys(groupInfo.members);
                            const len = mem.length;
                            let selected = [];
                            for (let i = 0; i < len / 2; i++) {
                                let s = mem[Math.floor(Math.random() * len)];
                                while (selected.indexOf(s) > -1) {
                                    s = mem[Math.floor(Math.random() * len)];
                                }
                                selected[i] = s;
                            }
                            const snapped = selected.map(key => groupInfo.members[key]);
                            utils.kickMultiple(snapped, fromUserId, groupInfo, config.order66Time, () => {
                                utils.sendMessage("Perfectly balanced, as all things should be.", threadId);
                            });
                        }, 2000); // Make sure people see the message (and impending doom)
                    } else {
                        utils.sendMessage(`You could not live with your failure, ${lastName}. Where did that bring you? Back to me.`, threadId);
                    }
                }
            });
        } else {
            utils.sendMessage("Cannot perform The Snap on a non-group chat. The hardest choices require the strongest wills.", threadId);
        }
    },
    "choose": (threadId, cmatch) => {
        const choices = cmatch[1].split(",");
        const choice = choices[Math.floor(Math.random() * choices.length)];

        utils.sendMessage(choice, threadId);
    },
    "course": (threadId, cmatch) => {
        const course = cmatch[1];
        request.get(`https://api.umd.io/v0/courses/${course}`, (err, res, body) => {
            if (!err) {
                const data = JSON.parse(body);
                if (data.error_code && data.error_code == 404) {
                    utils.sendError("Course not found", threadId);
                } else {
                    const msg = `${data.name} (${data.course_id})\nCredits: ${data.credits}\n\n${data.description ? data.description : ""}`;
                    utils.sendMessage(msg, threadId);
                }
            }
        });
    },
    "professor": (threadId, cmatch) => {
        const prof = cmatch[1];
        request.get(`https://api.umd.io/v0/professors?name=${encodeURIComponent(prof)}`, (err, res, body) => {
            if (!err) {
                const data = JSON.parse(body);
                if (data.error_code && data.error_code == 404 || data.length < 1) {
                    utils.sendError("Professor not found", threadId);
                } else {
                    const best = data[0];
                    const msg = `${best.name} (${best.department || best.departments.join(", ")})\n\nCourses:\n${best.courses.join("\n")}`;
                    utils.sendMessage(msg, threadId);
                }
            }
        });
    },
    "remind": (threadId, cmatch, groupInfo, _, __, ___, messageObj) => {
        const user = cmatch[1].toLowerCase();
        const userId = groupInfo.members[user];
        const reminder = cmatch[2];
        const time = cmatch[3];

        if (userId) {
            utils.addReminder(userId, reminder, time, groupInfo, threadId, messageObj.messageID);
        } else {
            utils.sendError(`Couldn't find user "${cmatch[1]}".`, threadId);
        }
    },
    "whereis": (threadId, cmatch) => {
        const query = cmatch[1];
        let url = "https://www.google.com/maps/search/?api=1&query=";
        request.get("https://api.umd.io/v0/map/buildings", (err, res, body) => {
            if (!err) {
                const buildings = JSON.parse(body);
                let match;
                let i = 0;
                while (!match && i < buildings.length) {
                    const build = buildings[i];
                    const name = build.name;
                    const code = build.code;
                    const matcher = new RegExp(query, "i");
                    if (name.match(matcher) || code.match(matcher)) {
                        match = build;
                    }
                    i++;
                }

                if (match) {
                    utils.sendMessage({
                        "url": `${url}${match.lat},${match.lng}`
                    }, threadId);
                } else {
                    utils.sendError("No building matches found.", threadId);
                }
            }
        });
    },
    "admin": (threadId, cmatch, groupInfo, api, senderId) => {
        const status = cmatch[1] ? false : true;
        const user = cmatch[2].toLowerCase();
        const userId = groupInfo.members[user];

        if (groupInfo.isGroup) {
            api.changeAdminStatus(threadId, userId, status, err => {
                if (err) {
                    utils.sendError(`The bot must be an admin to promote other users. ${utils.getPromoteString(senderId, groupInfo)}`, threadId);
                }
            });
        } else {
            utils.sendError("Can't change admin status: not a group.", threadId);
        }
    },
    "undo": (threadId, _, groupInfo, api, __, ___, mObj) => {
        api.unsendMessage(groupInfo.lastBotMessageID, err => {
            if (err) {
                utils.sendMessage("Can't undo messages sent > 10 minutes ago.", threadId, undefined, mObj.messageID);
            }
        });
    },
    "findbus": (threadId, cmatch) => {
        const busNum = cmatch[1];
        const baseUrl = "https://www.google.com/maps/place/";
        request.get("https://api.umd.io/v0/bus/locations", (err, res, body) => {
            if (!err) {
                const data = JSON.parse(body);
                if (data && data.vehicle) {
                    const buses = data.vehicle.filter(bus => bus.routeTag == busNum);
                    if (buses.length > 0) {
                        const bus = buses[0]; // Should only find one match
                        const url = `${baseUrl}${bus.lat},${bus.lon}/`;
                        const body = `The ${bus.routeTag} bus currently has ${bus.passengerCount} passenger${bus.passengerCount != 1 ? "s" : ""} and is moving at ${bus.speedKmHr} km/h.`;

                        utils.sendMessage({
                            "url": url,
                            "body": body
                        }, threadId);
                    } else {
                        utils.sendError("That bus isn't currently running.", threadId);
                    }
                } else {
                    utils.sendError("No buses are currently reporting locations.", threadId);
                }
            }
        });
    },
    "event": (threadId, cmatch, groupInfo, _, fromUserId, __, mObj) => {
        if (cmatch[1]) {
            // Create event
            const title = cmatch[2];
            const at = cmatch[3];
            utils.addEvent(title, at, fromUserId, groupInfo, threadId);
        } else if (cmatch[4]) {
            // Delete event
            const title = cmatch[5];
            utils.deleteEvent(title, fromUserId, groupInfo, threadId);
        } else if (cmatch[6]) {
            // List event(s)
            const rawTitle = cmatch[7];
            utils.listEvents(rawTitle, groupInfo, threadId);
        } else if (cmatch[8]) {
            // Repeat event
            const interval = cmatch[9];
            if (mObj.messageReply) {
                utils.repeatEvent(interval, mObj.messageReply.messageID, groupInfo, threadId);
            } else {
                utils.sendError("The repeat command must be a reply to an existing event confirmation", threadId);
            }
        }
    },
    "covid": (threadId, cmatch) => {
        const type = cmatch[1];
        const search = cmatch[2];
        utils.getCovidData(type, search, threadId);
    },
    "stocks": (threadId, cmatch) => {
        const ticker = cmatch[1];
        utils.getStockData(ticker, (err, data) => {
            if (err) {
                utils.sendError(err, threadId);
            } else {
                const symbol = data["01. symbol"];
                const price = parseFloat(data["05. price"]).toLocaleString();
                const prev = parseFloat(data["08. previous close"]).toLocaleString();
                const changeNum = parseFloat(data["09. change"]);
                const change = changeNum > 0 ? `+${changeNum}` : changeNum;
                const changePercNum = parseFloat(data["10. change percent"]);
                const changePerc = changePercNum > 0 ? `+${changePercNum}` : changePercNum;
                const marketCap = data.marketCap.toLocaleString();
                const updated = data["07. latest trading day"];
                const title = data.name ? `${data.name} (${symbol})\n${data.exchange} ${data.type}\nMarket cap: $${marketCap}` : symbol;
                const msg = `${title}\n\nCurrent price: $${price}\nPrevious close: $${prev}\nChange: ${change} (${changePerc}%)\n\nLast updated: ${updated}`;

                utils.sendMessage(msg, threadId);
            }
        });
    },
    "group": (_, cmatch, groupInfo, __, fromUserId) => {
        const action = cmatch[1].toLowerCase();
        const name = cmatch[2] || "unnamed";
        const userList = cmatch[3];

        let userIds = [];
        if (userList) {
            const users = userList.split(",").map(m => utils.parseNameReplacements(m.toLowerCase().trim(), fromUserId, groupInfo));
            userIds = users.map(user => groupInfo.members[user]).filter(id => id);
            userIds = utils.pruneDuplicates(userIds);
        }

        switch (action) {
            case "create": utils.createMentionGroup(name, userIds, groupInfo); break;
            case "subscribe": utils.subToMentionGroup(name, userIds, groupInfo); break;
            case "unsubscribe": utils.unsubFromMentionGroup(name, userIds, groupInfo); break;
            case "delete": utils.deleteMentionGroup(name, groupInfo); break;
            case "list": utils.listMentionGroups(name, groupInfo); break;
        }
    },
    "lucky": (threadId, cmatch) => {
        const query = cmatch[1].trim().split(/\s/).join("+");

        request.get(`https://api.duckduckgo.com/?q=!${query}&format=json&no_redirect=1`, (err, res, body) => {
            if (!err && res.statusCode == 200) {
                const results = JSON.parse(body);
                if (results.Redirect) {
                    utils.sendMessage({ "url": results.Redirect }, threadId);
                } else {
                    utils.sendError("Couldn't find a good result for that search.", threadId);
                }
            } else {
                utils.sendError("Couldn't retrieve any results for that search.", threadId);
            }
        });
    },
    "timer": (threadId, cmatch, groupInfo) => {
        const operation = cmatch[1].toLowerCase().trim();

        if (operation == "start") {
            if (groupInfo.timer) {
                utils.sendError("Can't start a new timer while one is already running.", threadId);
            } else {
                const time = new Date();

                groupInfo.timer = time;
                utils.setGroupPropertyAndHandleErrors("timer", groupInfo,
                    "Couldn't start a new timer.",
                    `Started new timer from ${utils.getPrettyDateString(time, true)}.`);
            }
        } else {
            if (!groupInfo.timer) {
                utils.sendError("Can't stop a timer if one is not running.", threadId);
            } else {
                const from = new Date(groupInfo.timer);
                const to = new Date();

                groupInfo.timer = null;
                utils.setGroupPropertyAndHandleErrors("timer", groupInfo,
                    "Couldn't stop the timer.",
                    `Timer stopped. Elapsed time: ${utils.fancyDuration(from, to)}`);
            }
        }
    },
    "follow": (threadId, cmatch, groupInfo) => {
        const handle = cmatch[2];
        if (cmatch[1]) {
            // Unfollow
            const key = handle.toLowerCase();
            if (groupInfo.following[key]) {
                delete groupInfo.following[key];
                utils.setGroupPropertyAndHandleErrors("following", groupInfo,
                    "Huh, couldn't unfollow that user for some reason. Please try again.",
                    `Success! You've unfollowed @${handle}.`
                );
            } else {
                utils.sendError(`You're not currently following @${handle}. Use "${config.trigger} follow list" for a list of the users you're following.`, threadId);
            }
        } else {
            // Follow
            if (handle === "list") {
                const users = Object.keys(groupInfo.following).map(username => `\n@${username}`).join('');
                if (users.length > 0) {
                    return utils.sendMessage(`List of users you're currently following in this chat:\n${users}`, threadId);
                }
                return utils.sendMessage("You're not currently following any users in this chat.", threadId);
            }

            utils.getLatestTweetID(handle, (err, id, userInfo) => {
                if (err) {
                    utils.sendError(err.message, threadId);
                } else {
                    const { name, username } = userInfo;

                    groupInfo.following[username.toLowerCase()] = id;
                    utils.setGroupPropertyAndHandleErrors("following", groupInfo,
                        "Huh, couldn't follow that user for some reason. Please try again.",
                        `Success! You're now following tweets from ${name} (@${username}).\n\nTo stop receiving this user's tweets in this chat, use "${config.trigger} unfollow @${username}".`
                    );
                }
            });
        }
    },
    "subscribe": (threadId, cmatch, groupInfo) => {
        const url = cmatch[2];
        if (cmatch[1]) {
            // Unsubscribe
            if (groupInfo.feeds[url]) {
                delete groupInfo.feeds[url];
                utils.setGroupPropertyAndHandleErrors("feeds", groupInfo,
                    "Huh, couldn't unsubscribe from that feed for some reason. Please try again.",
                    "Success! You've unsubscribed from that feed."
                );
            } else {
                utils.sendError(`You're not currently subscribed to that feed. Use "${config.trigger} subscribe list" for a list of this chat's feed subscriptions.`, threadId);
            }
        } else {
            // Subscribe
            if (url === "list") {
                const feeds = Object.keys(groupInfo.feeds).map(feed => `\n${feed}`).join('');
                if (feeds.length > 0) {
                    return utils.sendMessage(`List of feeds you're currently subscribed to in this chat:\n${feeds}`, threadId);
                }
                return utils.sendMessage("You're not currently following any feeds in this chat.", threadId);
            }

            utils.getLatestFeedItems(url, groupInfo, (err, _, feed) => {
                if (err) {
                    utils.sendError("Unable to look up that feed. Ensure it's a valid direct URL to an RSS feed.", threadId);
                } else {
                    groupInfo.feeds[url] = new Date().toISOString();
                    utils.setGroupPropertyAndHandleErrors("feeds", groupInfo,
                        "Huh, couldn't subscribe to that feed for some reason. Please try again.",
                        `Success! You are now subscribed to the feed "${feed.title}".\n\nTo stop receiving updates from this feed in this chat, use "${config.trigger} unsubscribe ${url}".`
                    );
                }
            });
        }
    },
    "richcontent": (_, cmatch, groupInfo) => {
        const isEnabled = cmatch[1].toLowerCase();

        groupInfo.richContent = (isEnabled === "on");
        utils.setGroupPropertyAndHandleErrors("richContent", groupInfo,
            "Wasn't able to update rich content settings; please try again.",
            `Success! Rich content is now ${isEnabled}.`
        );
    },
    "sponge": (threadId, cmatch) => {
        const text = cmatch[1];

        utils.sendMessage(utils.spongeify(text), threadId);
    }
};

/*
    Run function: called with threadId, the matchInfo object (previously "co"),
    the groupInfo object, the current api instance, fromUserId, any
    attachments, and the full message object that triggered the command.

    Matches the correct command and runs its associated function block (above),
    passing in the requisite information from main.
*/
exports.run = (api, matchInfo, groupInfo, fromUserId, attachments, messageObj) => {
    for (let c in matchInfo) {
        if (matchInfo.hasOwnProperty(c) && matchInfo[c].m) {
            // Match found
            funcs[c](groupInfo.threadId, matchInfo[c].m, groupInfo, api,
                fromUserId, attachments, messageObj);
        }
    }
};