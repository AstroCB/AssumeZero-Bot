const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const main = require("./main");
const login = require("messenger-botcore").login.login;

app.set("port", (process.env.PORT || 3000));
app.listen(app.get("port"));

// Landing page
app.get("/", function (req, res) {
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
        login((err, api) => {
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
