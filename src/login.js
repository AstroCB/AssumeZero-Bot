const messenger = require("facebook-chat-api"); // Chat API
const config = require("./config");
var credentials;
try {
    // Login creds from local dir
    credentials = require("./credentials");
} catch (e) {
    // Deployed to Heroku or config file is missing
    credentials = process.env;
}

// External storage API (Memcachier) (requires credentials)
const mem = require("memjs").Client.create(credentials.MEMCACHIER_SERVERS, {
    "username": credentials.MEMCACHIER_USERNAME,
    "password": credentials.MEMCACHIER_PASSWORD
});

exports.login = (callback) => {
    function withAppstate(appstate, callback) {
        console.log("Logging in with saved appstate...");
        messenger({
            appState: JSON.parse(appstate)
        }, (err, api) => {
            if (err) {
                withCreds(callback);
            } else {
                callback(err, api);
            }
        });
    }
    function withCreds(callback) {
        console.log("Logging in with credentials...");
        messenger({
            email: credentials.EMAIL,
            password: credentials.PASSWORD
        }, (err, api) => {
            if (err) return console.error(`Fatal error: failed login with credentials`);

            mem.set("appstate", JSON.stringify(api.getAppState()), {}, merr => {
                if (err) {
                    return console.error(merr);
                } else {
                    callback(err, api);
                }
            });
        });
    }
    // Logging message with config details
    console.log(`Bot ${config.bot.id} logging in ${process.env.EMAIL ? "remotely" : "locally"} with trigger "${config.trigger}".`);
    if (process.argv.includes("--force-login") || process.argv.includes("-f")) {
        // Force login with credentials
        withCreds(callback);
    } else {
        mem.get("appstate", (err, val) => {
            if (!err && val) {
                withAppstate(val, callback);
            } else {
                withCreds(callback);
            }
        });
    }
}

exports.logout = (callback) => {
    mem.delete("appstate", err => {
        if (err) {
            console.log(`Error logging out: ${err}`);
        } else {
            console.log("Logged out successfully.");
        }
        callback(err);
    });
}

if (require.main === module) {
    if (process.argv.includes("--logout")) {
        this.logout(_ => {
            process.exit();
        });
    } else {
        this.login(_ => {
            process.exit();
        });
    }
}