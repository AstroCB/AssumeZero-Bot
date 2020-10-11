// Utility functions for config file
exports.getRegexFromMembers = names => {
    let regstr = "(";
    for (let i = 0; i < names.length; i++) {
        regstr += names[i];
        regstr += "|";
    }
    regstr += "me)"; // Include "me" for current user
    // Final format: (user1|user2|user3|usern|me)
    return regstr;
};

// Returns whether the passed user ID is in the members object
exports.contains = (a, members) => {
    const vals = Object.keys(members).map(key => members[key]);
    return (vals.indexOf(a) > -1);
};