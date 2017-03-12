// Stores user commands (accessible via trigger word set in config.js)
const config = require("./config");
exports.commands = {
    "help": {
        "display_names": ["help"],
        "pretty_name": "Help",
        "short_description": "",
        "description": "Get more information about a command, or open quick help",
        "syntax": "help ({command})",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /help(.*)/i,
        "experimental": false
    },
    "psa": {
        "display_names": ["psa"],
        "pretty_name": "PSA",
        "short_description": "Messages all the bot's groups",
        "description": "Announces a message to all of the group chats that the bot is present in",
        "syntax": "psa {message}",
        "sudo": true,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /psa ([\s\S]*)/i, // Match EVERYTHING
        "experimental": false
    },
    "bug": {
        "display_names": ["bug", "bug report"],
        "pretty_name": "Bug",
        "short_description": "File a bug report",
        "description": `Messages ${config.owner.names.short} directly with your message and adds to your chat for debugging`,
        "syntax": "bug {message}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /bug (.*)/i,
        "experimental": false
    },
    "kick": {
        "display_names": ["kick"],
        "pretty_name": "Kick",
        "short_description": "Removes member",
        "description": "Removes a given member from the chat for an optional amount of time",
        "syntax": "kick {member} ({number of seconds})",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": ["kick", "(?: (\\d+))?"], // Optional number param after name
        "experimental": false
    },
    "xkcd": {
        "display_names": ["xkcd", "xkcd search"],
        "pretty_name": "xkcd",
        "short_description": "Links xkcd",
        "description": "Outputs the numbered xkcd or search result (or a random one if none was specified)",
        "syntax": "xkcd (new|{comic number}|search {search query})",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /xkcd(?: (new|\d+|search (.+)))?/i,
        "experimental": false
    },
    "spotsearch": {
        "display_names": ["search artist", "search song", "search track"],
        "pretty_name": "Spotify search",
        "short_description": "Search for music",
        "description": "Searches Spotify's database for artists and songs",
        "syntax": "search (artist|(song|track)) {query}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /search (artist|song|track) (.*)/i,
        "experimental": false
    },
    "song": {
        "display_names": ["song", "get song"],
        "pretty_name": "Song",
        "short_description": "Random song",
        "description": "Grabs a random song from member playlists added with 'playlist' command",
        "syntax": "song ({member})",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": true,
            "optional": true
        },
        "regex": "song",
        "experimental": false
    },
    "playlist": {
        "display_names": ["add playlist", "playlist"],
        "pretty_name": "Playlist",
        "short_description": "Add/update playlist",
        "description": "Add or update playlist for the group – to find a playlist's URI (e.g. spotify:user:astrocb:playlist:05zXCuscrw1BW5NyeN45DB), right click on it and click 'Copy Spotify URI'",
        "syntax": "playlist {member} {playlist URI}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": true,
            "optional": true
        },
        "regex": ["playlist", "( spotify:user:([^:]+):playlist:([A-z0-9]+))?"],
        "experimental": false
    },
    "addsearch": {
        "display_names": ["add", "search"],
        "pretty_name": "Add/search",
        "short_description": "",
        "description": "Searches for the given user and either outputs the best match (for searching) or adds it to the chat (for adding)",
        "syntax": "(add|search ({number of results})) {user}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(add|search(?: (\d*))?) (.*)/i,
        "experimental": false
    },
    "order66": {
        "display_names": ["execute order 66", "order 66"],
        "pretty_name": "Order 66",
        "short_description": "Destroy group temporarily",
        "description": `Every single group member, including your Socialpath Yiyi Kuang, is now an enemy of the group chat (for ${config.order66Time} seconds)`,
        "syntax": "execute order 66",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /execute order 66/i,
        "experimental": false
    },
    "setcolor": {
        "display_names": ["reset color", "set color"],
        "pretty_name": "(Re)set color",
        "short_description": "",
        "description": "(Re)sets the color to the specified hex value and outputs previous color",
        "syntax": "set color(s) (to) (#{six-digit hex color}|rand(om))",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(re)?set color(?:s)?(?: (?:to )?(#(?:[a-f]|\d){6}|rand(?:om)?))?/i,
        "experimental": false
    },
    "hitlights": {
        "display_names": ["hit the lights"],
        "pretty_name": "Hit the lights",
        "short_description": "Random chat colors",
        "description": "Changes the group colors to random colors in quick succession",
        "syntax": "hit the lights",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /hit the lights/i,
        "experimental": false
    },
    "resetnick": {
        "display_names": ["clear nickname"],
        "pretty_name": "Clear nickname",
        "short_description": "",
        "description": "Clears the nickname for the given member",
        "syntax": "clear (nick)name {member}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": "clear (?:nick)?name",
        "experimental": false
    },
    "setnick": {
        "display_names": ["set nickname", "change nickname", "set name", "change name", "rename"],
        "pretty_name": "Set nickname",
        "short_description": "",
        "description": "Sets the given nickname for the given member",
        "syntax": "(((set|change) (nick)name)|rename) {member} {nickname}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": ["(?:(?:(?:set|change) (?:nick)?name)|rename)", " (.*)"],
        "experimental": false
    },
    "wakeup": {
        "display_names": ["wake up"],
        "pretty_name": "Wake up",
        "short_description": "Message user repeatedly",
        "description": `Sends ${config.wakeUpTimes} messages to the given member`,
        "syntax": "wake up {member}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": "wake up",
        "experimental": false
    },
    "randmess": {
        "display_names": ["get random message", "random message"],
        "pretty_name": "Random message",
        "short_description": "",
        "description": "Retrieves a random message from the recent history of the group",
        "syntax": "random message",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /random message/i,
        "experimental": true
    },
    "alive": {
        "display_names": ["alive", "alive?"],
        "pretty_name": "Alive",
        "short_description": "Is the bot awake?",
        "description": "Tests whether the bot is running",
        "syntax": "alive(?)",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /alive(?:\?)?/i,
        "experimental": false
    },
    "setemoji": {
        "display_names": ["set emoji", "reset emoji", "emoji"],
        "pretty_name": "Set emoji",
        "short_description": "",
        "description": "(Re)sets the emoji to the specified Unicode value",
        "syntax": "(re)set emoji (to) #{emoji}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(re)?set emoji(?: (?:to )?([\uD83C-\uDBFF\uDC00-\uDFFF]{1,2}))?/iu, // Match emoji w/ Unicode modifier (1-2 chars)
        "experimental": false
    },
    "echo": {
        "display_names": ["echo", "quote"],
        "pretty_name": "Echo/quote",
        "short_description": "",
        "description": "Echoes or quotes the provided statement",
        "syntax": "(echo|quote) {statement}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(echo|quote) (.*)/i,
        "experimental": false
    },
    "ban": {
        "display_names": ["ban", "unban"],
        "pretty_name": "Ban",
        "short_description": "",
        "description": "Bans or unbans the provided member",
        "syntax": "(un)ban {member}",
        "sudo": true,
        "attachments": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": "(un)?ban",
        "experimental": false
    },
    "vote": {
        "display_names": ["<", ">", "points", "vote"],
        "pretty_name": "Vote (</>)",
        "short_description": "Vote on users",
        "description": "Allows users to upvote (>) or downvote (<) a given user to influence their current point total",
        "syntax": "(<|>) {member}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": "(<|>)",
        "experimental": false
    },
    "score": {
        "display_names": ["score", "set score", "get score"],
        "pretty_name": "Score",
        "short_description": "Get/set user score",
        "description": "Displays the user's current point score or sets it to a new provided value (must be ≥ 0)",
        "syntax": "score (new score) {member}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": "score(?: (\\d+))?",
        "experimental": false
    },
    "restart": {
        "display_names": ["restart"],
        "pretty_name": "Restart",
        "short_description": "",
        "description": "Restarts the bot (requires remote deployment to Heroku)",
        "syntax": "restart",
        "sudo": true,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /restart/i,
        "experimental": false
    },
    "photo": {
        "display_names": ["set picture", "set photo", "set image", "change picture", "change photo", "set photo", "picture", "photo", "image"],
        "pretty_name": "Group photo",
        "short_description": "Sets group photo to URL",
        "description": "Changes the group's photo to the image at the specified URL or the attached image",
        "syntax": "(set|change) (photo|picture|image) (url)",
        "sudo": false,
        "attachments": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(?:(?:set|change) )?(?:photo|picture|image)(?: ((?:http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i, // URL
        "experimental": false
    },
    "poll": {
        "display_names": ["poll"],
        "pretty_name": "Poll",
        "short_description": "Creates a group poll",
        "description": "Creates a poll in the group with the given title and optional comma-delimited initial options in brackets",
        "syntax": "poll {title} ([opt1,opt2,opt3])",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /poll ([^[]+)(?:\[(.*)\])?/i,
        "experimental": false
    },
    "title": {
        "display_names": ["set title", "change title", "title"],
        "pretty_name": "Set title",
        "short_description": "",
        "description": "Sets the title to the specified value",
        "syntax": "(set|change) title {title}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(?:(?:set|change) )?title (.*)/i,
        "experimental": false
    },
    "answer": {
        "display_names": ["ask", "answer", "magic 8 ball"],
        "pretty_name": "Magic 8-ball",
        "short_description": "",
        "description": "Answers your yes/no question with a random value",
        "syntax": "(ask|answer) {question}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(?:ask|answer) .*/i,
        "experimental": false
    },
    "rng": {
        "display_names": ["random", "rand", "rng"],
        "pretty_name": "Random number generator",
        "short_description": "",
        "description": `Generates a random number in the given range (between two args if passed, between ${config.lowerBoundDefault} and the arg if one is passed, or between ${config.lowerBoundDefault} and ${config.upperBoundDefault} otherwise)`,
        "syntax": "(rng|rand(om)) ({lower bound}) ({upper bound})",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /r(?:and(?:om)?|ng)(?: (\d+))?(?: (\d+))?/i,
        "experimental": false
    },
    "bw": {
        "display_names": ["bw", "black and white", "grayscale"],
        "pretty_name": "Black & white",
        "short_description": "Converts an image to black and white",
        "description": "Converts an image to black and white with either a URL or an uploaded image",
        "syntax": "bw ({url})",
        "sudo": false,
        "attachments": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /bw(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
        "experimental": false
    },
    "sepia": {
        "display_names": ["sepia"],
        "pretty_name": "Sepia",
        "short_description": "Converts an image to sepia tone",
        "description": "Converts an image to sepia tone with either a URL or an uploaded image",
        "syntax": "sepia ({url})",
        "sudo": false,
        "attachments": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /sepia(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
        "experimental": false
    },
    "flip": {
        "display_names": ["flip", "mirror"],
        "pretty_name": "Flip",
        "short_description": "Flips/mirrors an image",
        "description": "Flips/mirrors the image from the given URL or attachments",
        "syntax": "flip (horiz(ontal)|vert(ical)) ({url})",
        "sudo": false,
        "attachments": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /flip (horiz(?:ontal)?|vert(?:ical)?)(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
        "experimental": false
    },
    "invert": {
        "display_names": ["invert"],
        "pretty_name": "Invert",
        "short_description": "Invert image colors",
        "description": "Inverts the colors of the image from the given URL or attachments",
        "syntax": "invert ({url})",
        "sudo": false,
        "attachments": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /invert(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
        "experimental": false
    },
    "blur": {
        "display_names": ["blur"],
        "pretty_name": "Blur",
        "short_description": "Blurs an image",
        "description": "Blurs the image by the given number of pixels from the given URL or attachments; optional param to do a Gaussian blur, which is very slow",
        "syntax": "blur {pixels} (gauss) ({url})",
        "sudo": false,
        "attachments": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /blur(?: (\d+))?( gauss)?(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
        "experimental": false
    },
    "overlay": {
        "display_names": ["overlay"],
        "pretty_name": "Overlay",
        "short_description": "Overlays text on an image",
        "description": "Overlays text on an image from the given URL or attachments",
        "syntax": "overlay ({url}) {text}",
        "sudo": false,
        "attachments": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /overlay(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?(.*)/i,
        "experimental": false
    },
    "brightness": {
        "display_names": ["brighten", "darken"],
        "pretty_name": "Brighten/darken",
        "short_description": "Alters image brightness",
        "description": "Brightens or darkens an image by the given percent",
        "syntax": "(brighten|darken) {percentage} ({url})",
        "sudo": false,
        "attachments": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(brighten|darken) (\d*)(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
        "experimental": false
    },
    "mute": {
        "display_names": ["mute", "unmute"],
        "pretty_name": "Mute/unmute",
        "short_description": "Turns on/off easter eggs",
        "description": "Turns on/off easter eggs until they are turned back on",
        "syntax": "(un)mute",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(un)?mute/i,
        "experimental": false
    },
    "christen": {
        "display_names": ["christen"],
        "pretty_name": "Christen",
        "short_description": "Names the bot",
        "description": "The bot doesn't see itself as a user for security purposes, so the name command will not work on it, but this command allows you to name it",
        "syntax": "christen {name}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /christen (.*)/i,
        "experimental": false
    },
    "wolfram": {
        "display_names": ["wolfram"],
        "pretty_name": "Wolfram",
        "short_description": "Searches Wolfram Alpha",
        "description": "Performs a search using Wolfram Alpha (http://www.wolframalpha.com)",
        "syntax": "wolfram {query}",
        "sudo": false,
        "attachments": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /wolfram (.*)/i,
        "experimental": false
    }
};
