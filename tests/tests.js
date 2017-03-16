// Ping server to wake up
const http = require("http");
const config = require("../config");
http.get(config.serverURL);
