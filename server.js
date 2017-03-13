const express = require("express");
const http = require("http");
const app = express();
const bodyParser = require("body-parser");
const main = require("./index");
const config = require("./config");

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
    console.log("POST received");
    if (req.body && req.body.message && req.body.senderId && req.body.threadId) {
        main.login((err, api) => {
            if (!err) {
                main.handleMessage(err, {
                    "body": req.body.message,
                    "senderID": req.body.senderId,
                    "threadID": req.body.threadId,
                    "attachments": [],
                    "type": "message"
                }, true, api);
                res.sendStatus(200);
            } else {
                console.log(err);
                res.status(500).send({
                    "error": "Unable to login"
                });
            }
        });
    } else {
        console.log(req.body);
        res.status(500).send({
            "error": "Error receiving data"
        });
    }
});

// Ping every 20 minutes to keep awake
setInterval(() => {
    const now = new Date();
    const isPingTime = (now.getUTCHours() < (config.localSleepTime + config.serverUTCOffset) || now.getUTCHours() >= (config.localWakeTime + config.serverUTCOffset));
    if (!config.shouldSleep || isPingTime) {
        console.log("Pinging server");
        http.get(config.serverURL);
    }
}, 1200000);
