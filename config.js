const utils = require("./configutils"); // Utility functions

// The trigger word that precedes most commands and will activate the bot
exports.trigger = "physics";

// Choose whether to allow bot to respond in any chat it is added to
// If true, group properties will be generated dynamically at runtime
// Otherwise, set them below
// By default, tries looking for a Heroku config var called DYNAMIC
// Change default val below if not using Heroku
exports.dynamic = process.env.DYNAMIC ? JSON.parse(process.env.DYNAMIC) : true;

// Name of chat
exports.groupName = "Assume Zero Brain Power";

// The regular expression used for detecting names in commands issued to the bot
// By default, it will look for the names listed as keys in the group's members
// dictionary in ids.js For custom name detection, remove this function call and
// replace it with a string containing a regular expression
exports.userRegExp = utils.setRegexFromMembers();

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

// Decide whether it should check for Easter eggs, most of which won't make sense
// outside of the chat it was built for (Assume Zero Brain Power)
exports.easterEggs = true;

// How many points a vote is worth by default
// See commands.js for more info
exports.votePoints = 5;

// Specify here user Spotify playlists to select from with the "song" command
exports.spotifyPlaylists = [{
        "name": "Cameron",
        "id": "100007016509302",
        "user": "astrocb",
        "uri": "5y1RF0Qzrh7ZLpPYRk7vPZ"
    },
    {
        "name": "Justin",
        "id": "100000284649585",
        "user": "zhiyikuang",
        "uri": "53Bq3HDhuLlpTYutbeAT53"
    }, {
        "name": "Larry",
        "id": "100002237228114",
        "user": "1211218832",
        "uri": "3L1HbTx5JPlvoYzebh2cq9"
    }, {
        "name": "Colin",
        "id": "100003158871750",
        "user": "colinam1",
        "uri": "5DLJfgTgZ041ykJgH1Ior4"
    }, {
      "name": "Matthew",
      "id": "100006496860557",
      "user": "powerplayer117",
      "uri": "2b80Bi6Pu90f6LzJwcwXpM"
    }
];
// Default playlist used if invalid user passed
exports.defaultPlaylist = exports.spotifyPlaylists[1];

// Number of top tracks to display for Spotify searches
exports.spotifySearchLimit = 3;
