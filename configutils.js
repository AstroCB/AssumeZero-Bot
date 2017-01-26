// Utility functions for config file
const ids = require("./ids");
var credentials;
try {
    // Login creds from local dir
    credentials = require("./credentials");
} catch (e) {
    // Deployed to Heroku or config file is missing
    credentials = process.env;
}
const fs = require("fs");
const mem = require("memjs").Client.create(credentials.MEMCACHIER_SERVERS, {
    username: credentials.MEMCACHIER_USERNAME,
    password: credentials.MEMCACHIER_PASSWORD
});

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

exports.getBannedUsers = function(callback) {
    mem.get("banned", (err, data) => {
        try {
            callback(err, JSON.parse(data.toString()) || []);
        } catch (e) {
            // Send empty arr by default
            callback(err, []);
        }
    });
}

exports.addBannedUser = function(id, callback) {
    exports.getBannedUsers((err, bannedUsers) => {
        if (!err) {
            if (bannedUsers.indexOf(id) < 0) {
                bannedUsers.push(id);
                mem.set("banned", JSON.stringify(bannedUsers), (err, success) => {
                    if (success) {
                        console.log(`User ${id} banned`);
                    }
                    callback(err, bannedUsers, "banned");
                });
            } else {
                callback("User already in ban list");
            }
        } else {
            console.log(err);
        }
    });
}

exports.removeBannedUser = function(id, callback = () => {}) {
    exports.getBannedUsers((err, bannedUsers) => {
        if (!err) {
            const ind = bannedUsers.indexOf(id);
            if (ind > -1) {
                bannedUsers.splice(ind, 1);
                mem.set("banned", JSON.stringify(bannedUsers), (err, success) => {
                    if (success) {
                        console.log(`User ${id} unbanned`);
                    }
                    callback(err, bannedUsers, "unbanned");
                });
            } else {
                callback("User not in ban list");
            }
        } else {
            console.log(err);
        }
    });
}
