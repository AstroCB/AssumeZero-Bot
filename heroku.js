const express = require("express");
const http = require("http");
const app = express();

// Bind to ports to make Heroku happy even though it doesn't use them
app.set("port", (process.env.PORT || 3000));
app.listen(app.get("port"));

// Ping every 45 minutes to keep awake
setInterval(function() {
    http.get("http://assume-bot.herokuapp.com");
}, 2700000);
