const fs = require("fs");
const m = require("./index"); // For function access
const config = require("./config");

// Check for commands that don't require a trigger (Easter eggs)
// Some commands may require additional configuration (and most only make sense for
// the original chat it was built for), so should probably be off by default
exports.handleEasterEggs = (message, fromUserId, attachments, groupInfo, api) => {
    const threadId = groupInfo.threadId;
    if (!groupInfo.muted) { // Don't check for Easter eggs if muted
        if (message.match(/genius/i)) {
            m.sendFile("media/genius.jpg", threadId);
        }
        if (message.match(/cuck(?:ed)?/i)) {
            m.sendMessage("Delete your account.", threadId)
        }
        if (message.match(/(?:problem |p)set(?:s)?/i)) {
            m.sendContentsOfFile("media/monologue.txt", threadId);
        }
        if (message.match(/umd/i)) {
            m.sendFile("media/umd.png", threadId);
        }
        if (message.match(/cornell/i)) {
            m.sendMessage({
                "url": "https://www.youtube.com/watch?v=yBUz4RnoWSM"
            }, threadId);
        }
        if (message.match(/swarthmore/i)) {
            m.sendFile("media/jonah.png", threadId);
        }
        if (message.match(/purdue/i)) {
            m.sendMessage("I hear they have good chicken", threadId);
        }
        if (message.match(/nyu/i)) {
            m.sendMessage("We don't speak of it", threadId);
        }
        if (message.match(/commit seppuku/i)) {
            m.sendMessage("RIP", threadId);
        }
        if (message.match(/physics c(?:[^A-z]|$)/i)) {
            m.sendMessage({
                "url": "https://www.youtube.com/watch?v=HydsTDvEINo"
            }, threadId);
        }
        if (message.match(/(?:\s|^)shaw|mechanics|electricity|magnetism|pulley|massless|friction|acceleration|torque|impulse/i)) {
            m.sendFile("media/shaw.png", threadId);
        }
        const bac = m.matchesWithUser("(?:get|measure|check) bac(?:[^k]|$)", message, fromUserId, groupInfo, true, "");
        if (bac) {
            const name = bac[1] || "Yiyi";
            m.sendMessage(`${name.substring(0,1).toUpperCase() + name.substring(1)}'s BAC is far above healthy levels`, threadId);
        }
        if (message.match(new RegExp(`${config.trigger} .* cam$`, "i"))) {
            m.sendMessage("eron", threadId);
        }
        if (message.match(/socialis(?:t|m)/i)) {
            m.sendFile("media/anton.png", threadId);
        }
        if (message.match(/pre(?:-|\s)?med/i)) {
            m.sendFile("media/premed.png", threadId);
        }
        if (message.match(/(\s|^)sleep/i)) {
            m.sendMessage("Have I got a story to tell you about various fruits...", threadId);
        }
        if (message.match(/good(?:\s)?night(?:\, )?bot/i)) {
            m.sendMessage("Night!", threadId);
        }
        if (message.match(/public funds/i)) {
            m.sendFile("media/dirks.png", threadId);
        }
        if (message.match(/darth plagueis/i)) {
            m.sendContentsOfFile("media/plagueis.txt", threadId);
        }
        const lit = message.match(/(?:\s|^)(lit)(?:[^A-z0-9]|$)/i)
        if (lit) {
            if (lit[1] == "LIT") { // Large if all caps
                m.sendEmoji("🔥", threadId, "large");
            } else {
                m.sendEmoji("🔥", threadId);
            }
        }
        if (message.match(/pozharski(y)?/i)) {
            m.sendFile("media/pozharskiy.mp4", threadId);
        }
        if (message.match(/money/i)) {
            m.sendFile("media/money.png", threadId);
        }
        if (message.match(/rest of the country/i)) {
            m.sendMessage({
                "url": "https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap16_physics_c_mech_sg.pdf"
            }, threadId);
        }
        if (message.match(/(^|\s)drug/i)) {
            m.sendFile("media/drugs.png", threadId);
        }
        if (message.match(/(^|\s)how(\?|$)/i)) {
            m.sendFile("media/speedforce.mp4", threadId);
        }
        if (message.match(/(^|\s)frat/i)) {
            m.sendFile("media/frat.jpg", threadId);
        }
        if (message.match(/(^|\s)life([^A-z]|$)/i)) {
            m.sendFile("media/girlfriend.png", threadId);
        }
        if (message.match(/el spaniard/i)) {
            m.sendFile("media/sols.pdf", threadId);
        }
        if (message.match(/xps/i)) {
            m.sendFile("media/xps.jpg", threadId);
        }
        if (message.match(/gender/i)) {
            m.sendFile("media/binary.png", threadId);
        }
        if (message.match(/(^|\s)bob(bing|[^A-z]|$)/i)) {
            m.sendFile("media/serenade.mp4", threadId);
        }
        if (message.match(/wrong chat/i)) {
            m.sendFile("media/background.png", threadId);
        }
        if (message.match(/brown/i)) {
            m.sendFile("media/brown.jpg", threadId);
        }
        if (message.match(/kys/i)) {
            m.sendMessage("Are you threatening me, Master Jedi?", threadId);
        }
        if (message.match(/drunk/i)) {
            m.sendFilesFromDir("media/yiyi", threadId);
        }
        if (message.match(/I'?m not drunk/i)) {
            m.sendMessage("That's debatable...", threadId);
        }
        if (message.match(/flush/i)) {
            m.sendFile("media/flush.png", threadId);
        }
        if (message.match(/(^|\s)dog(?:s)?([^A-z]|$)/i)) {
            m.sendFile("media/dog.png", threadId);
        }
        if (message.match(/subaru/i)) {
            m.sendFile("media/subaru.png", threadId);
        }
        if (message.match(/ironic/i)) {
            m.sendFile("media/ironic.jpg", threadId);
        }
        if (message.match(/shrug/i)) {
            m.sendMessage(`¯\\_(ツ)_/¯`, threadId);
        }
        if (message.match(/mario/i)) {
            m.sendFile("media/mario.jpg", threadId);
        }
        if (message.match(/disappoint(?:ed|ment)/i)) {
            m.sendFile("media/disappoint.jpg", threadId);
        }
        if (message.match(/flash/i)) {
            m.sendFile("media/flash.mp3", threadId)
        }
        if (message.match(/greek/i)) {
            m.sendContentsOfFile("media/greek.txt", threadId);
        }
        if (message.match(/racism/i)) {
            m.sendFile("media/racism.jpg", threadId);
        }
    }
}
