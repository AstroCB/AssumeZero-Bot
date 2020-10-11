// Ping server to wake up
const http = require("http");
const config = require("../config");
http.get(config.serverURL, res => {
    if (res.statusCode != 200) {
        return console.error(res);
    } 
        process.exit();
    
});
