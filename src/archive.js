/*
By default, this file will take all existing group data from the database
and add it to the archive in the file called archive.json.

However, if called with the "--restore" flag, it will instead use the data
stored in the archive to replace the data in the database (in case of memory
loss). This essentially restores the database from backup.
*/
const fs = require("fs");
const credentials = require("./credentials") || process.env;
const mem = require("memjs").Client.create(credentials.MEMCACHIER_SERVERS, {
    username: credentials.MEMCACHIER_USERNAME,
    password: credentials.MEMCACHIER_PASSWORD
});

if (process.argv[2] == "--restore") { // Check command-line arguments
    // Restore database from archive
    console.log("Restoring...");
    fs.readFile("archive.json", (err, stored) => {
        if (!err) {
            mem.set("groups", stored.toString(), {}, err => {
                if (!err) {
                    console.log(`Data restored from backup:`, JSON.parse(stored));
                } else {
                    console.log(`Error: ${err}`);
                }
                process.exit();
            });
        } else {
            console.log("Error reading data from backup");
            process.exit();
        }
    });
} else {
    // Archives existing group data in a file called "archive.json"
    mem.get("groups", (err, info) => {
        if (!err) {
            fs.readFile("archive.json", (err, stored) => {
                const data = (err || stored.length == 0) ? {} : JSON.parse(stored);
                const groupInfo = info.length > 0 ? JSON.parse(info) : {};
                for (let g in groupInfo) {
                    if (groupInfo.hasOwnProperty(g)) {
                        data[g] = groupInfo[g];
                    }
                }
                fs.writeFile("archive.json", JSON.stringify(data), err => {
                    if (err) { console.error(`Couldn't create backup: ${err}`); }
                    process.exit();
                });
            });
        } else {
            console.error(`No group data found: ${err}`);
        }
    });
}