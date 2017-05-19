// Archives existing group data in a file called "archive.json"
const fs = require("fs");
const credentials = require("./credentials") || process.env;
const mem = require("memjs").Client.create(credentials.MEMCACHIER_SERVERS, {
    username: credentials.MEMCACHIER_USERNAME,
    password: credentials.MEMCACHIER_PASSWORD
});

mem.get("groups", (err, info) => {
    if (!err) {
        fs.readFile("archive.json", (err, exData) => {
            const data = err ? {} : exData;
            const groupInfo = JSON.parse(info);
            for (let g in groupInfo) {
                if (groupInfo.hasOwnProperty(g)) {
                    data[g] = groupInfo[g];
                }
            }
            fs.writeFile("archive.json", JSON.stringify(data), (err) => {
                if (err) { console.error(`Couldn't create backup: ${err}`); }
                process.exit();
            })
        })
    } else {
        console.error(`No group data found: ${err}`);
    }
})