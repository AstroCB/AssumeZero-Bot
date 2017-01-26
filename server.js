const express = require("express");
const http = require("http");
const app = express();
const bodyParser = require("body-parser");
const main = require("./index");

// Bind to ports to make Heroku happy even though it doesn't use them
app.set("port", (process.env.PORT || 3000));
app.listen(app.get("port"));

// Landing page
app.get("/", function(req, res) {
    res.sendFile("index.html", {
        "root": __dirname
    });
});

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
    extended: true
}));
// Accept POST requests for commands
app.post("/command", (req, res) => {
    if (req.body && req.body.senderId) {
        console.log("POST received");
        if (req.body.command) {
            handle(req.body.command, req.body.senderId, true);
        } else if (req.body.message) {
            handle(req.body.message, req.body.senderId);
        }
        res.sendStatus(200);
    } else {
        console.log(req.body);
        res.status(500).send({
            "error": "Error receiving data"
        });
    }
});

// Handles a message parameter string as if it were received by the bot
// Optional isCommand parameter to bypass the string parsing and pass directly
// to the handleCommand function in index (has a specific format & parameters
//  of its own, which is why it has its own flag)
function handle(message, sender, isCommand = false) {
    // Log in & send command to handler function
    main.login((err, api) => {
        if (!err) {
            if (isCommand) { // Specifically formatted command
                main.handleCommand(message, sender, api);
            } else { // Just parse the message normally (requires message obj)
                main.handleMessage({
                    "body": message,
                    "senderID": sender,
                    "type": "message"
                }, api);
            }
        } else {
            console.log(err);
        }
    });
}

// Ping every 20 minutes to keep awake
// Sleep from 3 AM to 9 AM to preserve time (UTC)
const local_low = 3;
const local_high = 9
const offset = 5;
setInterval(function() {
    var now = new Date();
    if (now.getUTCHours() < (local_low + offset) || now.getUTCHours() >= (local_high + offset)) {
        console.log("Pinging server");
        http.get("http://assume-bot.herokuapp.com");
    }
}, 1200000);
