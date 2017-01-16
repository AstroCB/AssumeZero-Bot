// Utility functions for config file
const ids = require("./ids");
const fs = require("fs");

exports.setRegexFromMembers = function(groupId = ids.group) {
    const members = Object.keys(ids.members[groupId]);
    var regstr = "(";
    for (var i = 0; i < members.length; i++) {
        regstr += members[i];
        if (i != (members.length - 1)) {
            regstr += "|";
        }
    }
    regstr += ")"
    // Final format: (user1|user2|user3|usern)
    return regstr;
}

exports.contains = function(a, groupId = ids.group) {
    const vals = Object.keys(ids.members[groupId]).map(function(key) {
        return ids.members[groupId][key];
    });
    return (vals.indexOf(a) > -1);
};

// For banning functionality
exports.getBannedUsers = function() {
    try {
        return JSON.parse(fs.readFileSync("banned.json"));
    } catch (e) {
        return [];
    }
}

exports.addBannedUser = function(id, callback) {
    const bannedUsers = exports.getBannedUsers();
    if (bannedUsers.indexOf(id) < 0) {
        bannedUsers.push(id);
        fs.writeFile("banned.json", JSON.stringify(bannedUsers), (err) => {
            callback(err, bannedUsers, "banned");
        });
    } else {
        callback("User already in ban list");
    }
}

exports.removeBannedUser = function(id, callback = () => {}) {
    const bannedUsers = exports.getBannedUsers();
    const ind = bannedUsers.indexOf(id);
    if (ind > -1) {
        bannedUsers.splice(ind, 1);
        fs.writeFile("banned.json", JSON.stringify(bannedUsers), (err) => {
            callback(err, bannedUsers, "unbanned");
        });
    } else {
        callback("User not in ban list");
    }
}
