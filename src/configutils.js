// Utility functions for config file
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

exports.getRegexFromMembers = (names) => {
    let regstr = "(";
    for (let i = 0; i < names.length; i++) {
        regstr += names[i];
        regstr += "|";
    }
    regstr += "me)" // Include "me" for current user
    // Final format: (user1|user2|user3|usern|me)
    return regstr;
}

// Returns whether the passed user ID is in the members object
exports.contains = (a, members) => {
    const vals = Object.keys(members).map(key => members[key]);
    return (vals.indexOf(a) > -1);
};

// For banning functionality

exports.getBannedUsers = (callback) => {
    mem.get("banned", (err, data) => {
        try {
            callback(err, JSON.parse(data.toString()) || []);
        } catch (e) {
            // Send empty arr by default
            callback(err, []);
        }
    });
}

exports.addBannedUser = (id, callback) => {
    exports.getBannedUsers((err, bannedUsers) => {
        if (!err) {
            if (bannedUsers.indexOf(id) < 0) {
                bannedUsers.push(id);
                mem.set("banned", JSON.stringify(bannedUsers), {}, (err, success) => {
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

exports.removeBannedUser = (id, callback = () => { }) => {
    exports.getBannedUsers((err, bannedUsers) => {
        if (!err) {
            const ind = bannedUsers.indexOf(id);
            if (ind > -1) {
                bannedUsers.splice(ind, 1);
                mem.set("banned", JSON.stringify(bannedUsers), {}, (err, success) => {
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
