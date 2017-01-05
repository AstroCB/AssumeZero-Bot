exports.assume = 883154065107088; // AØBP thread ID
exports.bot = 100014788693366;
exports.members = { // Member ids
    // NOTE: **NEVER** add the bot's ID to this list or order 66 will obliterate the chat
    "cam": 100007016509302,
    "yiyi": 100000284649585,
    "larry": 100002237228114,
    "jonah": 100004639632165,
    "colin": 100003158871750,
    "anton": 100010603296156
};
exports.contains = function(a) {
    a = parseInt(a);
    var vals = Object.keys(exports.members).map(function(key) {
        return exports.members[key];
    });
    return (vals.indexOf(a) > -1);
};
