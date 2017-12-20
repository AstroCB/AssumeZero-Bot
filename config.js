const utils = require("./configutils"); // Utility functions

// The trigger word that precedes most commands and will activate the bot
exports.trigger = "physics";

// Bot owner information
exports.owner = {
    "names": {
        "short": "Cameron",
        "long": "Cameron Bernhardt"
    },
    "id": "100007016509302" // ID of bot owner (for secure commands, reports, and alerts)
};

// Bot information
exports.bot = {
    "names": {
        "short": "AØBøt", // Will be used as 'nickname' in chat (remove if same as account name)
        "long": "AssumeZero Bot" // Name displayed in profile on bot's Facebook account
    },
    "id": "100015168671225" // Bot's ID (for security purposes in commands)
}

// Default group name when no other information is available
exports.defaultTitle = "Unnamed chat"

// Heroku settings (might need to tweak some things if using another host)
// App name
exports.appName = "assume-bot";

// Server URL
exports.serverURL = `http://${exports.appName}.herokuapp.com`;

// Whether the bot should sleep at night to preserve dyno hours
// If not, it will ping the server every 20 min to keep it awake
exports.shouldSleep = false;

// What time the bot should sleep in your timezone
exports.localSleepTime = 3;

// What time the bot should wake up in your timezone
exports.localWakeTime = 9;

// Your server's UTC offset
exports.serverUTCOffset = 5;

// Time in seconds to ban users for Order 66
exports.order66Time = 15;

// Time in seconds to ban users for violating the GIF policy
exports.banTime = 30;

// Number of times to message user with the "wake up" command
exports.wakeUpTimes = 20;

// Default color (hex)
exports.defaultColor = "#67B868";

// Number of random colors to cycle through for the "hit the lights" command
exports.numColors = 10;

// Default emoji
exports.defaultEmoji = "🚀";

// exports.banned is a list of banned user IDs as strings
// Stored in memory and pulled at runtime & after updates
// Remove this function call and replace with an array of user IDs to override
utils.getBannedUsers((err, users) => {
    if (err) {
        console.log(err);
    }
    exports.banned = users;
});

// For xkcd searching capability
// Custom search engine that searches the xkcd website only
// (keep unless you want to customize the results) and an API key
// from Google Dev Console
exports.xkcd = {
    "engine": "017207449713114446929:kyxuw7rvlw4",
    "key": "AIzaSyCHfJCpWEYUCydDMbb9PqK42XpPQd9L-F8"
};

// How many points a vote is worth by default
// See commands.js for more info
exports.votePoints = 5;

// Default playlist to use if group has no added playlists
exports.defaultPlaylist = {
    "name": "Assume Zero Brain Power",
    "user": "astrocb",
    "uri": "4joxRVv8wzT4keFzCS3gAt"
};

// Number of top tracks to display for Spotify searches
exports.spotifySearchLimit = 3;

// Number of times bot will retry adding a user if it fails on the first time
exports.addBufferLimit = 5;

// List of responses for "answer" command
exports.answerResponses = ["Yes", "No", "Maybe", "It is certain", "Time will tell", "Ask again later",
    "Only if you believe", "Possibly", "Never", "Of course", "No way", "You're out of your mind", "Nope",
    "Yep", "Good one", "Eh", "Si crees", "Por supuesto", "...", "Welp"
];

// Default bounds for RNG command
exports.defaultRNGBounds = [1, 100];

// Timeout in milliseconds for functions that gather data asynchronously
exports.asyncTimeout = 5000;

// Number of chats to fetch when pulling thread history
exports.threadLimit = 50;

// For Wikipedia searching capability
// Custom search engine that searches Wikipedia only
// (keep unless you want to customize the results) and an API key
// from Google Dev Console
exports.wiki = {
    "engine": "017207449713114446929:cyipvxn5_rk",
    "key": "AIzaSyCHfJCpWEYUCydDMbb9PqK42XpPQd9L-F8"
};