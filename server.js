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
    console.log(req.body);
    if (req.body && req.body.message && req.body.senderId && req.body.threadId) {
        main.handleMessage({
            "body": req.body.message,
            "senderID": req.body.senderId,
            "threadID": req.body.threadId,
            "type": "message"
        }, api);
        res.sendStatus(200);
    } else {
        console.log(req.body);
        res.status(500).send({
            "error": "Error receiving data"
        });
    }
});

// Ping every 20 minutes to keep awake
// Sleep from 3 AM to 9 AM to preserve time (UTC)
const local_low = 3;
const local_high = 9;
const offset = 5;
setInterval(function() {
    var now = new Date();
    if (now.getUTCHours() < (local_low + offset) || now.getUTCHours() >= (local_high + offset)) {
        console.log("Pinging server");
        http.get("http://assume-bot.herokuapp.com");
    }
}, 1200000);
