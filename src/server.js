const child_process = require("child_process");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const main = require("./main");
const config = require("./config");

app.set("port", (process.env.PORT || 4000));
app.listen(app.get("port"));

// Landing page
app.get("/", (_, res) => {
    res.sendFile("index.html", {
        "root": __dirname
    });
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Accept POST requests for commands
app.post("/command", (req, res) => {
    console.log("Command POST received");
    if (req.body && req.body.message && req.body.senderId && req.body.threadId) {
        // Hook into main to handle message
        main.handleMessage(null, {
            "body": req.body.message,
            "senderID": req.body.senderId,
            "threadID": req.body.threadId,
            "attachments": [],
            "type": "message"
        }, true);
        res.sendStatus(200);
    } else {
        console.log(req.body);
        res.status(500).send({
            "error": "Error receiving data"
        });
    }
});

// Listen for GitHub webhooks for automated deploys
app.post("/pushed", (req, res) => {
    let changeMsg;
    let shouldReinstall = false;

    const payload = req.body;
    if (payload && payload.commits.length > 0) {
        changeMsg = ` of change "${payload.head_commit.message}"`;

        // Check if any commits modified package files to see if a reinstall of deps is needed
        const pkgModified = payload.commits.map(com => com.modified.some(e => /package(-lock)?\.json/.test(e))).reduce((p, c) => p ? p : c);
        shouldReinstall = pkgModified;
    }
    console.info(`Starting automated deploy${changeMsg ? changeMsg : ""}${shouldReinstall ? " and reinstalling" : ""}...`);

    res.sendStatus(200);
    child_process.exec(`cd ${config.repoPath} && ./deploy.sh${shouldReinstall ? " --reinstall" : ""}`, err => {
        if (err) {
            console.error(err);
        }
    });
});

app.get("/healthcheck", (_, res) => {
    main.utils.sendMessage("healthcheck", config.bot.id, (err) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.sendStatus(200);
        }
    });
});