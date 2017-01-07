// Stores user commands (accessible via trigger word set in config.js)
const config = require("./config");
exports.commands = {
    "help": {
        "display_names": ["help"],
        "pretty_name": "Help",
        "description": "Get more information about a command, or open quick help",
        "syntax": "help (command)",
        "user_input": false,
        "regex": /help(.*)/i,
        "experimental": false
    },
    "kick": {
        "display_names": ["kick"],
        "pretty_name": "Kick",
        "description": "Kicks a given member from the chat",
        "syntax": "kick {member}",
        "user_input": true,
        "regex": "kick",
        "experimental": false
    },
    "addsearch": {
        "display_names": ["add", "search"],
        "pretty_name": "Add/search",
        "description": "Searches for the given user and either outputs the best match (for searching) or adds it to the chat (for adding)",
        "syntax": "(add|search) {user}",
        "user_input": true,
        "regex": /(add|search) (.*)/i,
        "experimental": false
    },
    "order66": {
        "display_names": ["execute order 66", "order 66"],
        "pretty_name": "Order 66",
        "description": `Every single group member, including your Socialpath Yiyi Kuang, is now an enemy of the group chat (for ${config.order66Time} seconds)`,
        "syntax": "execute order 66",
        "user_input": false,
        "regex": /execute order 66/i,
        "experimental": false
    },
    "resetcolor": {
        "display_names": ["reset color"],
        "pretty_name": "Reset color",
        "description": "Resets the group colors",
        "syntax": "reset color(s)",
        "user_input": false,
        "regex": /reset color(?:s)?/i,
        "experimental": false
    },
    "setcolor": {
        "display_names": ["set color"],
        "pretty_name": "Set color",
        "description": "Sets the color to the specified hex value and outputs previous color",
        "syntax": "change color(s) (to) #{six-digit hex color}",
        "user_input": false,
        "regex": /set color(?:s)? (?:to )?(#(?:[a-f]|\d){6})/i,
        "experimental": false
    },
    "hitlights": {
        "display_names": ["hit the lights"],
        "pretty_name": "Hit the lights",
        "description": "Changes the group colors to random colors in quick succession",
        "syntax": "hit the lights",
        "user_input": false,
        "regex": /hit the lights/i,
        "experimental": false
    },
    "resetnick": {
        "display_names": ["reset nickname"],
        "pretty_name": "Reset nickname",
        "description": "Clears the nickname for the given member",
        "syntax": "reset (nick)name {member}",
        "user_input": true,
        "regex": "reset (?:nick)?name",
        "experimental": false
    },
    "setnick": {
        "display_names": ["set nickname"],
        "pretty_name": "Set nickname",
        "description": "Sets the given nickname for the given member",
        "syntax": "set (nick)name {member} {nickname}",
        "user_input": true,
        "regex": "set (?:nick)?name",
        "experimental": false
    },
    "wakeup": {
        "display_names": ["wake up"],
        "pretty_name": "Wake up",
        "description": `Sends ${config.wakeUpTimes} messages to the given member`,
        "syntax": "wake up {member}",
        "user_input": true,
        "regex": "wake up",
        "experimental": false
    },
    "randmess": {
        "display_names": ["random message"],
        "pretty_name": "Random message",
        "description": "Retrieves a random message from the recent history of the group",
        "syntax": "random message",
        "user_input": false,
        "regex": /random message/i,
        "experimental": true
    },
    "alive": {
        "display_names": ["alive", "alive?"],
        "pretty_name": "Alive",
        "description": "Tests whether the bot is running",
        "syntax": "alive(?)",
        "user_input": false,
        "regex": /alive(?:\?)?/i,
        "experimental": false
    }
};
