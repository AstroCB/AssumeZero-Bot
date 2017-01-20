const express = require("express");
const http = require("http");
const app = express();
const bodyParser = require("body-parser");
const owner = require("./ids").owner;
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
    if (req.body && req.body.command) {
        console.log("POST received");
        sendCommand(req.body.command);
    } else {
        console.log(req);
        res.status(500).send({
            "error": "Error receiving command"
        });
    }
});

function sendCommand(command) {
    // Log in & send command to handler function
    main.login((err, api) => {
        if (!err) {
            main.handleCommand(command, owner, api);
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
