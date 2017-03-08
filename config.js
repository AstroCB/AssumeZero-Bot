const utils = require("./configutils"); // Utility functions

// The trigger word that precedes most commands and will activate the bot
exports.trigger = "physics";

// Bot owner information
exports.owner = {
    "names": {
        "short": "Cameron",
        "long": "Cameron Bernhardt"
    },
    "id": "100007016509302" // ID of bot owner (for secure commands and reports)
};

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
        "name": "Jonah",
        "id": "100004639632165",
        "user": "jzl003",
        "uri": "0ohKnensHQhhKtNCaBIKmQ"
    }, {
        "name": "Colin",
        "id": "100003158871750",
        "user": "colinam1",
        "uri": "5DLJfgTgZ041ykJgH1Ior4"
    },
    {
        "name": "Anton",
        "id": "100010603296156",
        "user": "apozharski",
        "uri": "4aWii0hXP9A73HcGm9NUII"
    },
    {
        "name": "Kevin",
        "id": "100004459232882",
        "user": "kwang21093",
        "uri": "5891o4biUm1gPGgNd2JGPg"
    }, {
        "name": "Matthew",
        "id": "100006496860557",
        "user": "powerplayer117",
        "uri": "2fdwKfdyavl28cVOWOjBkB"
    }
];

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
    "Yep", "Good one", "Eh"
];

// Default bounds for RNG command
exports.defaultRNGBounds = [1, 100];
