/* 
    Mutes all threads that the bot is currently in.
*/
const botcore = require("messenger-botcore");
const credentials = require("./credentials");
const LIMIT = 1000;

botcore.login.login(credentials, (err, api) => {
    if (!err) {
        api.getThreadList(LIMIT, null, [], (err, list) => {
            if (!err) {
                list.forEach(list => {
                    api.muteThread(list.threadID, -1);
                });
            }
        });
        api.markAsReadAll();
    }
});