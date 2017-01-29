// Stores user commands (accessible via trigger word set in config.js)
const config = require("./config");
exports.commands = {
    "help": {
        "display_names": ["help"],
        "pretty_name": "Help",
        "short_description": "Get help",
        "description": "Get more information about a command, or open quick help",
        "syntax": "help (command)",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /help(.*)/i,
        "experimental": false
    },
    "kick": {
        "display_names": ["kick"],
        "pretty_name": "Kick",
        "short_description": "Kick member",
        "description": "Kicks a given member from the chat",
        "syntax": "kick {member} ({number of seconds})",
        "sudo": false,
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
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /xkcd(?: (new|\d+|search (.+)))?/i,
        "experimental": false
    },
    "addsearch": {
        "display_names": ["add", "search"],
        "pretty_name": "Add/search",
        "short_description": "Add/search user",
        "description": "Searches for the given user and either outputs the best match (for searching) or adds it to the chat (for adding)",
        "syntax": "(add|search ({number of results})) {user}",
        "sudo": false,
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
        "short_description": "Execute group temporarily",
        "description": `Every single group member, including your Socialpath Yiyi Kuang, is now an enemy of the group chat (for ${config.order66Time} seconds)`,
        "syntax": "execute order 66",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /execute order 66/i,
        "experimental": false
    },
    "resetcolor": {
        "display_names": ["reset color"],
        "pretty_name": "Reset color",
        "short_description": "Reset color",
        "description": "Resets the group colors",
        "syntax": "reset color(s)",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /reset color(?:s)?/i,
        "experimental": false
    },
    "setcolor": {
        "display_names": ["set color"],
        "pretty_name": "Set color",
        "short_description": "Set chat color",
        "description": "Sets the color to the specified hex value and outputs previous color",
        "syntax": "set color(s) (to) #{six-digit hex color}",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /set color(?:s)? (?:to )?(#(?:[a-f]|\d){6})/i,
        "experimental": false
    },
    "hitlights": {
        "display_names": ["hit the lights"],
        "pretty_name": "Hit the lights",
        "short_description": "Random chat colors",
        "description": "Changes the group colors to random colors in quick succession",
        "syntax": "hit the lights",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /hit the lights/i,
        "experimental": false
    },
    "resetnick": {
        "display_names": ["reset nickname"],
        "pretty_name": "Reset nickname",
        "short_description": "Reset nickname",
        "description": "Clears the nickname for the given member",
        "syntax": "reset (nick)name {member}",
        "sudo": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": "reset (?:nick)?name",
        "experimental": false
    },
    "setnick": {
        "display_names": ["set nickname"],
        "pretty_name": "Set nickname",
        "short_description": "Set nickname",
        "description": "Sets the given nickname for the given member",
        "syntax": "set (nick)name {member} {nickname}",
        "sudo": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": "set (?:nick)?name",
        "experimental": false
    },
    "wakeup": {
        "display_names": ["wake up"],
        "pretty_name": "Wake up",
        "short_description": "Message user repeatedly",
        "description": `Sends ${config.wakeUpTimes} messages to the given member`,
        "syntax": "wake up {member}",
        "sudo": false,
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
        "short_description": "Get random message",
        "description": "Retrieves a random message from the recent history of the group",
        "syntax": "random message",
        "sudo": false,
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
        "short_description": "Is bot up?",
        "description": "Tests whether the bot is running",
        "syntax": "alive(?)",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /alive(?:\?)?/i,
        "experimental": false
    },
    "resetemoji": {
        "display_names": ["reset emoji"],
        "pretty_name": "Reset emoji",
        "short_description": "Reset emoji",
        "description": "Resets the emoji to the group default",
        "syntax": "reset emoji",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /reset emoji/i,
        "experimental": false
    },
    "setemoji": {
        "display_names": ["set emoji"],
        "pretty_name": "Set emoji",
        "short_description": "Set chat emoji",
        "description": "Sets the emoji to the specified Unicode value",
        "syntax": "set emoji (to) #{emoji}",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /set emoji (?:to )?([\uD83C-\uDBFF\uDC00-\uDFFF]{1,2})/iu, // Match emoji w/ Unicode modifier (1-2 chars)
        "experimental": false
    },
    "echo": {
        "display_names": ["echo", "quote"],
        "pretty_name": "Echo/quote",
        "short_description": "Repeat/quote statement",
        "description": "Echoes or quotes the provided statement",
        "syntax": "(echo|quote) ${statement}",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(echo|quote) (.*)/i,
        "experimental": false
    },
    "ban": {
        "display_names": ["ban"],
        "pretty_name": "Ban",
        "short_description": "Bans/unbans",
        "description": "Bans or unbans the provided member",
        "syntax": "(un)ban ${member}",
        "sudo": true,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": "(un)?ban",
        "experimental": false
    },
    "dynamic": {
        "display_names": ["dynamic"],
        "pretty_name": "Dynamic",
        "short_description": "Set dynamic mode",
        "description": "Allows user to change the state of the bot's dynamic mode setting",
        "syntax": "dynamic (on|off)",
        "sudo": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /dynamic (on|off)/i,
        "experimental": false
    },
    "vote": {
        "display_names": ["<", ">"],
        "pretty_name": "Vote (</>)",
        "short_description": "Vote on users",
        "description": "Allows users to upvote (>) or downvote (<) a given user to influence their current point total",
        "syntax": "(<|>) (points) ${member}",
        "sudo": false,
        "user_input": {
            "accepts": true,
            "optional": false
        },
        "regex": "(<|>)",
        "experimental": false
    },
    "score": {
        "display_names": ["score", "get score", "set score"],
        "pretty_name": "Score",
        "short_description": "Get/set user score",
        "description": "Displays the user's current point score or sets it to a new provided value (must be ≥ 0)",
        "syntax": "score (new score) ${member}",
        "sudo": false,
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
        "short_description": "Restarts the bot",
        "description": "Restarts the bot (requires deployment to Heroku)",
        "syntax": "restart",
        "sudo": true,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /restart/i,
        "experimental": false
    },
    "song": {
        "display_names": ["song", "get song"],
        "pretty_name": "Song",
        "short_description": "Get random song",
        "description": "Grabs a random song from member playlist",
        "syntax": "(get) song (${member})",
        "sudo": false,
        "user_input": {
            "accepts": true,
            "optional": true
        },
        "regex": "(?:get )?song",
        "experimental": false
    },
    "spotsearch": {
        "display_names": ["artist", "song", "track"],
        "pretty_name": "Spotify search",
        "short_description": "Search for artists & songs",
        "description": "Searches Spotify's database for artists and songs",
        "syntax": "(artist|(song|track)) ${query}",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(artist|song|track) (.*)/i,
        "experimental": false
    },
    "photo": {
        "display_names": ["set picture", "set photo", "set image", "change picture", "change photo", "set photo", "picture", "photo", "image"],
        "pretty_name": "Group photo",
        "short_description": "Sets group photo to URL",
        "description": "Changes the group's photo to the image at the specified URL",
        "syntax": "(set|change) (photo|picture|image) (url)",
        "sudo": false,
        "user_input": {
            "accepts": false,
            "optional": false
        },
        "regex": /(?:(?:set|change) )?(?:photo|picture|image) ((?:http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?)/i, // URL
        "experimental": false
    }
};
