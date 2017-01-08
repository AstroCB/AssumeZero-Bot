const express = require("express");
const http = require("http");
const app = express();

// Bind to ports to make Heroku happy even though it doesn't use them
app.set("port", (process.env.PORT || 3000));
app.listen(app.get("port"));

// Ping every 45 minutes to keep awake
// Sleep from 3 AM to 9 AM to preserve time (UTC)
const local_low = 3;
const local_high = 9
const offset = 5;
setInterval(function() {
    var now = new Date();
    if (now.getUTCHours() < (local_low + offset) || now.getUTCHours() >= (local_high + offset)) {
        http.get("http://assume-bot.herokuapp.com");
    }
}, 2700000);
