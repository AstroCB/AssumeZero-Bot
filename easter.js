const fs = require("fs");
const m = require("./index"); // For function access
const config = require("./config");

// Check for commands that don't require a trigger (Easter eggs)
// Some commands may require additional configuration (and most only make sense for
// the original chat it was built for), so should probably be off by default
exports.handleEasterEggs = (message, fromUserId, messageId, attachments, groupInfo, api) => {
    const threadId = groupInfo.threadId;
    if (!groupInfo.muted) { // Don't check for Easter eggs if muted
        if (message.match(/genius/i)) {
            m.sendFile("media/genius.jpg", threadId);
        }
        if (message.match(/cuck(?:ed)?/i)) {
            m.reactToMessage(messageId, "angry");
        }
        if (message.match(/(?:^|\s)(?:problem |p)set(?:s)?/i)) {
            m.sendContentsOfFile("media/monologue.txt", threadId);
        }
        if (message.match(/(?:hard work)|(?:work(?:ing)? hard)/i)) {
            m.sendFile("media/umd.png", threadId);
        }
        if (message.match(/bingalee dingalee/i)) {
            m.sendFile("media/cornell.mp4", threadId);
        }
        if (message.match(/boxed wine/i)) {
            m.sendFile("media/jonah.png", threadId);
        }
        if (message.match(/where have you been/i)) {
            m.sendFile("media/purdue.png", threadId);
        }
        if (message.match(/nyu/i)) {
            m.reactToMessage(messageId, "sad");
        }
        if (message.match(/physics c(?:[^A-z]|$)/i)) {
            m.sendMessage({
                "url": "https://www.youtube.com/watch?v=HydsTDvEINo"
            }, threadId);
        }
        if (message.match(/(?:\s|^)mechanics|electricity|magnetism|pulley|massless|friction|acceleration|torque|impulse/i)) {
            m.sendFile("media/shaw.png", threadId);
        }
        const bac = m.matchesWithUser("(?:get|measure|check) bac(?:[^k]|$)", message, fromUserId, groupInfo, true, "");
        if (bac) {
            const name = bac[1] || "Yiyi";
            m.sendMessage(`${name.substring(0,1).toUpperCase() + name.substring(1)}'s BAC is far above healthy levels`, threadId);
        }
        if (message.match(/socialis(?:t|m)/i)) {
            m.sendFile("media/anton.png", threadId);
        }
        if (message.match(/pre(?:-|\s)?med/i)) {
            m.sendFile("media/premed.png", threadId);
        }
        if (message.match(/fruit/i)) {
            m.sendMessage("Just don't sleep for three days and you'll be good", threadId);
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
        if (message.match(/pozharski(y)? theorem/i)) {
            m.sendFile("media/pozharskiy.mp4", threadId);
        }
        if (message.match(/(?:\s|^)rich(?:[^A-z0-9]|$)/i)) {
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
        if (message.match(/how is that even possible/i)) {
            m.sendFile("media/speedforce.mp4", threadId);
        }
        if (message.match(/(^|\s)fraternity/i)) {
            m.sendFile("media/frat.jpg", threadId);
        }
        if (message.match(/(?:girlfriend|(?:(?:^| )gf(?:$|[^A-z0-9])))/i)) {
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
        if (message.match(/brown(?:[^A-z0-9]|$)/i)) {
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
        if (message.match(/tired/i)) {
            m.sendFile("media/tired.jpg", threadId);
        }
        if (message.match(/good thing/i)) {
            m.sendFile("media/segregation.jpg", threadId);
        }
        if (message.match(/terps/i)) {
            m.sendEmoji("🐢", threadId);
        }
        if (message.match(/tl(?:\;)?dr/i)) {
            m.sendMessage("Scroll up", threadId);
        }
        if (message.match(/internet/i)) {
            m.sendFile("media/internet.png", threadId);
        }
        if (message.match(/star wars/i)) {
            m.sendFile("media/email.png", threadId);
        }
        if (message.match(/microsoft windows/i)) {
            m.sendFile("media/windows.jpg", threadId);
        }
        if (message.match(/bad taste/i)) {
            m.sendFile("media/taste.png", threadId);
        }
        if (message.match(/how it(?: all)? began/i)) {
            m.sendFile("media/began.png", threadId);
        }
        if (message.match(/russian/i)) {
            m.sendFile("media/russian.m4a", threadId);
        }
        if (message.match(/semicolon/i)) {
            m.sendFile("media/semicolons.png", threadId);
        }
        if (message.match(/me irl/i)) {
            m.sendFile("media/meirl.png", threadId);
        }
        if (message.match(/you(?:\'re| are) a mank/i)) {
            m.sendFile("media/mank.png", threadId);
        }
        if (message.match(/capitalone/i)) {
            m.sendFile("media/capitalone.png", threadId);
        }

        if (message.match(/assume zero brain power/i)) {
            m.sendFile("media/aøbp.png", threadId)
        }
        if (message.match(/langlieb/i)) {
            m.sendFile("media/langlieb.png", threadId);
        }
        if (message.match(/(?:^|\s)(?:v|a)r($|[^A-z0-9])/i)) {
            m.reactToMessage(messageId, "funny");
        }
        if (message.match(/(?:yo)?u(?:\'re|r)? ri(?:ght|te)/i)) {
            m.reactToMessage(messageId, "angry");
        }
        if (message.match(/d(?:ropbox|bx)/i)) {
            m.sendFile("media/dropbox.jpg", threadId);
        }
        if (message.match(/citizen/i)) {
            m.sendFile("media/citizen.jpg", threadId);
        }
        if (message.match(/boosted/i)) {
            m.sendFile("media/kevin.mp4", threadId);
        }
        if (message.match(/^d(o|ew) it$/i)) {
            m.sendFile("media/palp.gif", threadId);
        }
        if (message.match(/are you sure/i)) {
            m.sendFile("media/sure.png", threadId);
        }
        if (message.match(/slope day/i)) {
            m.sendFile("media/slope.png", threadId);
        }
    }
}
