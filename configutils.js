// Utility functions for config file
const ids = require("./ids");

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
    a = parseInt(a);
    var vals = Object.keys(ids.members[groupId]).map(function(key) {
        return ids.members[groupId][key];
    });
    return (vals.indexOf(a) > -1);
};
