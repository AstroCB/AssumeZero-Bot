const child_process = require("child_process");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const login = require("messenger-botcore").login.login;
const main = require("./main");
const config = require("./config");

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
    console.log("Command POST received");
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

// Listen for GitHub webhooks for automated deploys
app.post("/pushed", (req, res) => {
    const payload = req.body;
    console.log(`Starting automated deploy${payload ? ` of change "${payload.head_commit.message}"` : ""}...`);

    res.sendStatus(200);
    child_process.exec(`cd ${config.repoPath} && ./deploy.sh`, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
        }
    });
});