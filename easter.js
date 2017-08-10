/*
 Check for commands that don't require a trigger (Easter eggs)
 Some commands may require additional configuration (and most only make sense for
 the original chat it was built for), so should probably be off by default
 */

const fs = require("fs");
const m = require("./index"); // For function access
const config = require("./config");

// List of Easter eggs
/*
 Each entry contains either a "regex" with a regular expression for matching
 or an "alt" function that takes, optionally, the following params in order:
    the message, the sending user ID, and the groupInfo object
 and will return a non-null value if the egg should be triggered.
 The entry also includes function "func" to be called if either condition is met,
 which can accept a threadId as the first parameter, a messageId as the second, a
 data object as the third containing the data from the "regex" match or anything returned by "alt",
 and lastly, the groupInfo object as the fourth in case any group-specific information is needed
 */
const eggs = [
    {
        "regex": /genius/i,
        "func": (threadId) => { m.sendFile("media/genius.jpg", threadId); }
    },
    {
        "regex": /cuck(?:ed)?/i,
        "func": (threadId, messageId) => { m.reactToMessage(messageId, "angry"); }
    },
    {
        "regex": /(?:^|\s)(?:problem |p)set(?:s)?/i,
        "func": (threadId) => { m.sendContentsOfFile("media/monologue.txt", threadId); }
    },
    {
        "regex": /(?:hard work)|(?:work(?:ing)? hard)/i,
        "func": (threadId) => { m.sendFile("media/umd.png", threadId); }
    },
    {
        "regex": /bingalee dingalee/i,
        "func": (threadId) => { m.sendFile("media/cornell.mp4", threadId); }
    },
    {
        "regex": /boxed wine/i,
        "func": (threadId) => { m.sendFile("media/jonah.png", threadId); }
    },
    {
        "regex": /where have you been/i,
        "func": (threadId) => { m.sendFile("media/purdue.png", threadId); }
    },
    {
        "regex": /nyu/i,
        "func": (threadId, messageId) => { m.reactToMessage(messageId, "sad"); }
    },
    {
        "regex": /physics c(?:[^A-z]|$)/i,
        "func": (threadId) => {
            m.sendMessage({
                "url": "https://www.youtube.com/watch?v=HydsTDvEINo"
            }, threadId);
        }
    },
    {
        "regex": /(?:\s|^)mechanics|electricity|magnetism|pulley|massless|friction|acceleration|torque|impulse/i,
        "func": (threadId) => { m.sendFile("media/shaw.png", threadId); }
    },
    {
        "alt": (message, fromUserId, groupInfo) => {
            return m.matchesWithUser("(?:get|measure|check) bac(?:[^k]|$)", message, fromUserId, groupInfo, true, "");
        },
        "func": (threadId, messageId, data) => {
            const name = data[1] || "Yiyi";
            m.sendMessage(`${name.substring(0, 1).toUpperCase() + name.substring(1)}'s BAC is far above healthy levels`, threadId);
        }
    },
    {
        "regex": /socialis(?:t|m)/i,
        "func": (threadId) => { m.sendFile("media/anton.png", threadId); }
    },
    {
        "regex": /pre(?:-|\s)?med/i,
        "func": (threadId) => { m.sendFile("media/premed.png", threadId); }
    },
    {
        "regex": /fruit/i,
        "func": (threadId) => { m.sendMessage("Just don't sleep for three days and you'll be good", threadId); }
    },
    {
        "regex": /good(?:\s)?ni(?:ght|te)(?:\,)? bot/i,
        "func": (threadId) => { m.sendMessage("Night!", threadId); }
    },
    {
        "regex": /public funds/i,
        "func": (threadId) => { m.sendFile("media/dirks.png", threadId); }
    },
    {
        "regex": /darth plagueis/i,
        "func": (threadId) => { m.sendContentsOfFile("media/plagueis.txt", threadId); }
    },
    {
        "regex": /(?:\s|^)(lit)(?:[^A-z0-9]|$)/i,
        "func": (threadId, messageId, data) => {
            if (data[1] == "LIT") { // Large if all caps
                m.sendEmoji("🔥", threadId, "large");
            } else {
                m.sendEmoji("🔥", threadId);
            }
        }
    },
    {
        "regex": /pozharski(y)? theorem/i,
        "func": (threadId) => { m.sendFile("media/pozharskiy.mp4", threadId); }
    },
    {
        "regex": /filthy rich/i,
        "func": (threadId) => { m.sendFile("media/money.png", threadId); }
    },
    {
        "regex": /rest of the country/i,
        "func": (threadId) => {
            m.sendMessage({
                "url": "https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap16_physics_c_mech_sg.pdf"
            }, threadId);
        }
    },
    {
        "regex": /drug dealer/i,
        "func": (threadId) => { m.sendFile("media/drugs.png", threadId); }
    },
    {
        "regex": /how is that even possible/i,
        "func": (threadId) => { m.sendFile("media/speedforce.mp4", threadId); }
    },
    {
        "regex": /fraternity/i,
        "func": (threadId) => { m.sendFile("media/frat.jpg", threadId); }
    },
    {
        "regex": /(?:girlfriend|(?:(?:^| )gf(?:$|[^A-z0-9])))/i,
        "func": (threadId) => { m.sendFile("media/girlfriend.png", threadId); }
    },
    {
        "regex": /el spaniard/i,
        "func": (threadId) => { m.sendFile("media/sols.pdf", threadId); }
    },
    {
        "regex": /xps (?:13|15)/i,
        "func": (threadId) => { m.sendFile("media/xps.jpg", threadId); }
    },
    {
        "regex": /gender/i,
        "func": (threadId) => { m.sendFile("media/binary.png", threadId); }
    },
    {
        "regex": /(^|\s)bob(bing|[^A-z]|$)/i,
        "func": (threadId) => { m.sendFile("media/serenade.mp4", threadId); }
    },
    {
        "regex": /wrong chat/i,
        "func": (threadId) => { m.sendFile("media/background.png", threadId); }
    },
    {
        "regex": /brown(?:[^A-z0-9]|$)/i,
        "func": (threadId) => { m.sendFile("media/brown.jpg", threadId); }
    },
    {
        "regex": /kys/i,
        "func": (threadId) => { m.sendMessage("Are you threatening me, Master Jedi?", threadId); }
    },
    {
        "regex": /drunk/i,
        "func": (threadId) => { m.sendFilesFromDir("media/yiyi", threadId); }
    },
    {
        "regex": /I'?m not drunk/i,
        "func": (threadId) => { m.sendMessage("That's debatable...", threadId); }
    },
    {
        "regex": /flush/i,
        "func": (threadId) => { m.sendFile("media/flush.png", threadId); }
    },
    {
        "regex": /(^|\s)pupper(?:s)?([^A-z]|$)/i,
        "func": (threadId) => { m.sendFile("media/dog.png", threadId); }
    },
    {
        "regex": /subaru/i,
        "func": (threadId) => { m.sendFile("media/subaru.png", threadId); }
    },
    {
        "regex": /ironic/i,
        "func": (threadId) => { m.sendFile("media/ironic.jpg", threadId); }
    },
    {
        "regex": /shrug/i,
        "func": (threadId) => { m.sendMessage(`¯\\_(ツ)_/¯`, threadId); }
    },
    {
        "regex": /mario/i,
        "func": (threadId) => { m.sendFile("media/mario.jpg", threadId); }
    },
    {
        "regex": /disappoint(?:ed|ment)/i,
        "func": (threadId) => { m.sendFile("media/disappoint.jpg", threadId); }
    },
    {
        "regex": /the flash/i,
        "func": (threadId) => { m.sendFile("media/flash.mp3", threadId) }
    },
    {
        "regex": /greek/i,
        "func": (threadId) => { m.sendContentsOfFile("media/greek.txt", threadId); }
    },
    {
        "regex": /racism/i,
        "func": (threadId) => { m.sendFile("media/racism.jpg", threadId); }
    },
    {
        "regex": /i('| a)m tired/i,
        "func": (threadId) => { m.sendFile("media/tired.jpg", threadId); }
    },
    {
        "regex": /good thing/i,
        "func": (threadId) => { m.sendFile("media/segregation.jpg", threadId); }
    },
    {
        "regex": /go terps/i,
        "func": (threadId) => { m.sendEmoji("🐢", threadId); }
    },
    {
        "regex": /tl(?:\;)?dr/i,
        "func": (threadId) => { m.sendMessage("Scroll up", threadId); }
    },
    {
        "regex": /me irl/i,
        "func": (threadId) => { m.sendFile("media/meirl.png", threadId); }
    },
    {
        "regex": /semicolon/i,
        "func": (threadId) => { m.sendFile("media/semicolons.png", threadId); }
    },
    {
        "regex": /russian language/i,
        "func": (threadId) => { m.sendFile("media/russian.m4a", threadId); }
    },
    {
        "regex": /how it(?: all)? began/i,
        "func": (threadId) => { m.sendFile("media/began.png", threadId); }
    },
    {
        "regex": /bad taste/i,
        "func": (threadId) => { m.sendFile("media/taste.png", threadId); }
    },
    {
        "regex": /microsoft windows/i,
        "func": (threadId) => { m.sendFile("media/windows.jpg", threadId); }
    },
    {
        "regex": /star wars/i,
        "func": (threadId) => { m.sendFile("media/email.png", threadId); }
    },
    {
        "regex": /internet/i,
        "func": (threadId) => { m.sendFile("media/internet.png", threadId); }
    },
    {
        "regex": /you(?:\'re| are) a mank/i,
        "func": (threadId) => { m.sendFile("media/mank.png", threadId); }
    },
    {
        "regex": /citizen of the (united states|us)/i,
        "func": (threadId) => { m.sendFile("media/citizen.jpg", threadId); }
    },
    {
        "regex": /d(?:ropbox|bx)/i,
        "func": (threadId) => { m.sendFile("media/dropbox.jpg", threadId); }
    },
    {
        "regex": /(?:yo)?u(?:\'re|r)? ri(?:ght|te)/i,
        "func": (threadId, messageId) => { m.reactToMessage(messageId, "angry"); }
    },
    {
        "regex": /(?:^|\s)(?:v|a)r($|[^A-z0-9])/i,
        "func": (threadId, messageId) => { m.reactToMessage(messageId, "funny"); }
    },
    {
        "regex": /langlieb family/i,
        "func": (threadId) => { m.sendFile("media/langlieb.png", threadId); }
    },
    {
        "regex": /assume zero brain power/i,
        "func": (threadId) => { m.sendFile("media/aøbp.png", threadId) }
    },
    {
        "regex": /capital( )?one/i,
        "func": (threadId) => { m.sendFile("media/capitalone.png", threadId); }
    },
    {
        "regex": /the ultimate driving machine/i,
        "func": (threadId) => { m.sendFile("media/bmw.png", threadId); }
    },
    {
        "regex": /badass/i,
        "func": (threadId) => { m.sendFile("media/mass.png", threadId); }
    },
    {
        "regex": /new-age kevin/i,
        "func": (threadId) => { m.sendFile("media/newkevin.jpeg", threadId); }
    },
    {
        "regex": new RegExp(`${config.trigger} spam`, "i"),
        "func": (threadId, mId, data, groupInfo) => {
            let emoji = [];
            for (let i = 0; i < 36; i++) { // Full row of emoji
                emoji.push(groupInfo.emoji);
            }
            m.sendMessage(emoji.join(""), threadId);
        }
    },
    {
        "regex": /slope day/i,
        "func": (threadId) => { m.sendFile(["media/slopejustin.png", "media/slopemarin.jpeg"], threadId); }
    },
    {
        "regex": /are you sure/i,
        "func": (threadId) => { m.sendFile("media/sure.png", threadId); }
    },
    {
        "regex": /^d(o|ew) it$/i,
        "func": (threadId) => { m.sendFile("media/palp.gif", threadId); }
    },
    {
        "regex": /boosted/i,
        "func": (threadId) => { m.sendFile("media/kevin.mp4", threadId); }
    },
    {
        "regex": /squash/i,
        "func": (threadId) => { m.sendFile("media/squash.png", threadId); }
    },
    {
        "regex": /corporate (yiyi|justin)/i,
        "func": (threadId) => { m.sendFile("media/corporate.jpg", threadId); }
    },
    {
        "regex": /clock out/i,
        "func": (threadId) => { m.sendFile("media/clockout.png", threadId); }
    },
    {
        "regex": /devil(')?s lettuce/i,
        "func": (threadId) => { m.sendFile("media/devil.png", threadId); }
    },
    {
        "regex": /life advice/i,
        "func": (threadId) => { m.sendFile("media/advice.png", threadId); }
    },
    {
        "regex": /UMD CS/i,
        "func": (threadId) => { m.sendFile("media/umdcs.jpeg", threadId); }
    },
    {
        "regex": /thank you pizza/i,
        "func": (threadId) => { m.sendFile("media/siri.jpg", threadId); }
    },
    {
        "regex": /happy birthday america/i,
        "func": (threadId) => { m.sendFile(["media/america.jpg", "media/russia.png"], threadId); }
    },
    {
        "regex": /bellyaching/i,
        "func": (threadId) => { m.sendFile("media/bellyaching.png", threadId); }
    },
    {
        "regex": /all(\-|\s)wheel drive/i,
        "func": (threadId) => { m.sendFile("media/awd.png", threadId); }
    },
    {
        "regex": /i graduated/i,
        "func": (threadId) => { m.sendFile("media/graduation.mp4", threadId); }
    },
    {
        "regex": /russian hacker/i,
        "func": (threadId) => { m.sendFile("media/hacker.jpeg", threadId); }
    },
    {
        "regex": /musk gone mad/i,
        "func": (threadId) => { m.sendFile("media/musk.png", threadId); }
    },
    {
        "regex": /the salesman/i,
        "func": (threadId) => { m.sendFile("media/salesman.jpg", threadId); }
    },
    {
        "regex": /rocket cars/i,
        "func": (threadId) => { m.sendFile("media/rocketcars.png", threadId); }
    },
    {
        "regex": /jazz grass/i,
        "func": (threadId) => { m.sendFile("media/jazzgrass.png", threadId); }
    }
];

exports.handleEasterEggs = (message, fromUserId, messageId, attachments, groupInfo, api) => {
    const threadId = groupInfo.threadId;
    if (!groupInfo.muted) { // Don't check for Easter eggs if muted
        for (let i = 0; i < eggs.length; i++) {
            // Check for regex first and then alt function
            // If matched, pass data to trigger function
            if (eggs[i].regex) {
                let match = message.match(eggs[i].regex);
                if (match) { eggs[i].func(groupInfo.threadId, messageId, match, groupInfo); }
            } else if (eggs[i].alt) {
                let alt = eggs[i].alt(message, fromUserId, groupInfo);
                if (alt) { eggs[i].func(groupInfo.threadId, messageId, alt, groupInfo); }
            } else {
                console.error("No conditions found for egg");
            }
        }
    }
}
