/* eslint-disable no-useless-escape */

/*
    Check for commands that don't require a trigger (Easter eggs).
    
    Some commands may require additional configuration (and most only make
    sense for the original chat it was built for), so should probably be off
    by default.
*/

const utils = require("./utils"); // For function access
const config = require("./config");

// List of Easter eggs
/*
 Each entry contains either a "regex" with a regular expression for matching
 or an "alt" function that takes, optionally, the following params in order:
    the full message object, the sending user ID, and the groupInfo object
 and will return a non-null value if the egg should be triggered.
 The entry also includes function "func" to be called if either condition is met,
 which can accept a threadId as the first parameter, a messageId as the second, a
 data object as the third containing the data from the "regex" match or anything returned by "alt",
 and lastly, the groupInfo object as the fourth in case any group-specific information is needed
 */
const eggs = [
    {
        "regex": /master equation/i,
        "func": threadId => { utils.sendFile("../media/genius.jpg", threadId); }
    },
    {
        "regex": /(?:^|\s)(?:problem |p)set(?:s)?/i,
        "func": threadId => { utils.sendContentsOfFile("../media/monologue.txt", threadId); }
    },
    {
        "regex": /(?:hard work)|(?:work(?:ing)? hard)/i,
        "func": threadId => { utils.sendFile("../media/umd.png", threadId); }
    },
    {
        "regex": /bingalee dingalee/i,
        "func": threadId => { utils.sendFile("../media/cornell.mp4", threadId); }
    },
    {
        "regex": /boxed wine/i,
        "func": threadId => { utils.sendFile("../media/jonah.png", threadId); }
    },
    {
        "regex": /where have you been/i,
        "func": threadId => { utils.sendFile("../media/purdue.png", threadId); }
    },
    {
        "regex": /(?:^|\s)nyu(?:\s|$)/i,
        "func": (_, messageId) => { utils.reactToMessage(messageId, "sad"); }
    },
    {
        "regex": /physics c(?:[^A-z]|$)/i,
        "func": threadId => {
            utils.sendMessage({
                "url": "https://www.youtube.com/watch?v=HydsTDvEINo"
            }, threadId);
        }
    },
    {
        "regex": /(?:\s|^)mechanics|electricity|magnetism|pulley|massless|friction|acceleration|torque|impulse/i,
        "func": (threadId, messageId) => { utils.sendFile("../media/shaw.png", threadId, "", () => { }, messageId); }
    },
    {
        "alt": (message, fromUserId, groupInfo) => {
            return utils.matchesWithUser(/(?:get|measure|check) bac(?:[^k]|$)/, message.body, fromUserId, groupInfo, true, "");
        },
        "func": (threadId, _, data) => {
            const name = data[1] || "Yiyi";
            utils.sendMessage(`${name.substring(0, 1).toUpperCase() + name.substring(1)}'s BAC is far above healthy levels`, threadId);
        }
    },
    {
        "regex": /true socialis(?:t|m)/i,
        "func": threadId => { utils.sendFile("../media/anton.png", threadId); }
    },
    {
        "regex": /pre(?:-|\s)?med/i,
        "func": threadId => { utils.sendFile("../media/premed.png", threadId); }
    },
    {
        "regex": /(?:good)?(?:\s)?ni(?:ght|te)(?:\,)? bot/i,
        "func": threadId => { utils.sendMessage("Night!", threadId); }
    },
    {
        "regex": /(?:good)?(?:\s)?morning(?:\,)? bot/i,
        "func": threadId => { utils.sendMessage("Morning!", threadId); }
    },
    {
        "regex": /darth plagueis/i,
        "func": threadId => { utils.sendContentsOfFile("../media/plagueis.txt", threadId); }
    },
    {
        "regex": /(?:\s|^)(lit)(?:[^A-z0-9]|$)/i,
        "func": (threadId, _, data) => {
            if (data[1] == "LIT") { // Large if all caps
                utils.sendEmoji("🔥", threadId, "large");
            } else {
                utils.sendEmoji("🔥", threadId);
            }
        }
    },
    {
        "regex": /pozharski(y)? theorem/i,
        "func": threadId => { utils.sendFile("../media/pozharskiy.mp4", threadId); }
    },
    {
        "regex": /filthy rich/i,
        "func": threadId => { utils.sendFile("../media/money.png", threadId); }
    },
    {
        "regex": /rest of the country/i,
        "func": threadId => {
            utils.sendMessage({
                "url": "https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap16_physics_c_mech_sg.pdf"
            }, threadId);
        }
    },
    {
        "regex": /drug dealer/i,
        "func": threadId => { utils.sendFile("../media/drugs.png", threadId); }
    },
    {
        "regex": /how is that even possible/i,
        "func": threadId => { utils.sendFile("../media/speedforce.mp4", threadId); }
    },
    {
        "regex": /delta tau delta/i,
        "func": threadId => { utils.sendFile("../media/frat.jpg", threadId); }
    },
    {
        "regex": /my girlfriend/i,
        "func": threadId => { utils.sendFile("../media/girlfriend.png", threadId); }
    },
    {
        "regex": /el spaniard/i,
        "func": threadId => { utils.sendFile("../media/sols.pdf", threadId); }
    },
    {
        "regex": /xps (?:13|15)/i,
        "func": threadId => { utils.sendFile("../media/xps.jpg", threadId); }
    },
    {
        "regex": /(^|\s)bob(bing|[^A-z]|$)/i,
        "func": threadId => { utils.sendFile("../media/serenade.mp4", threadId); }
    },
    {
        "regex": /^wrong chat$/i,
        "func": threadId => { utils.sendFile("../media/background.png", threadId); }
    },
    {
        "regex": /^brown$/i,
        "func": threadId => { utils.sendFile("../media/brown.jpg", threadId); }
    },
    {
        "regex": /kys/i,
        "func": threadId => { utils.sendMessage("Are you threatening me, Master Jedi?", threadId); }
    },
    {
        "regex": /drunk yiyi/i,
        "func": threadId => { utils.sendFilesFromDir("../media/yiyi", threadId); }
    },
    {
        "regex": /I(?:\'|’)?m not drunk/i,
        "func": threadId => { utils.sendMessage("That's debatable...", threadId); }
    },
    {
        "regex": /flush/i,
        "func": threadId => { utils.sendFile("../media/flush.png", threadId); }
    },
    {
        "regex": /(^|\s)pupper(?:s)?([^A-z]|$)/i,
        "func": threadId => { utils.sendFile("../media/dog.png", threadId); }
    },
    {
        "regex": /subaru/i,
        "func": threadId => { utils.sendFile("../media/subaru.png", threadId); }
    },
    {
        "regex": /that(?:\'|’)?s ironic/i,
        "func": threadId => { utils.sendFile("../media/ironic.jpg", threadId); }
    },
    {
        "regex": /shrug/i,
        "func": threadId => { utils.sendMessage(`¯\\_(ツ)_/¯`, threadId); }
    },
    {
        "regex": /mario/i,
        "func": threadId => { utils.sendFile("../media/mario.jpg", threadId); }
    },
    {
        "regex": /disappoint(?:ed|ment)/i,
        "func": threadId => { utils.sendFile("../media/disappoint.jpg", threadId); }
    },
    {
        "regex": /the flash/i,
        "func": threadId => { utils.sendFile("../media/flash.mp3", threadId); }
    },
    {
        "regex": /institutional racism/i,
        "func": threadId => { utils.sendFile("../media/racism.jpg", threadId); }
    },
    {
        "regex": /i((?:\'|’)| a)m tired/i,
        "func": threadId => { utils.sendFile("../media/tired.jpg", threadId); }
    },
    {
        "regex": /that(?:\'|’)?s a good thing/i,
        "func": threadId => { utils.sendFile("../media/goodthing.jpg", threadId); }
    },
    {
        "regex": /go terps/i,
        "func": threadId => { utils.sendEmoji("🐢", threadId); }
    },
    {
        "regex": /tl(?:\;)?dr(\?|$)/i,
        "func": threadId => { utils.sendMessage("Scroll up", threadId); }
    },
    {
        "regex": /me irl/i,
        "func": threadId => { utils.sendFile("../media/meirl.png", threadId); }
    },
    {
        "regex": /semicolon/i,
        "func": threadId => { utils.sendFile("../media/semicolons.png", threadId); }
    },
    {
        "regex": /russian language/i,
        "func": threadId => { utils.sendFile("../media/russian.m4a", threadId); }
    },
    {
        "regex": /how it(?: all)? began/i,
        "func": threadId => { utils.sendFile("../media/began.png", threadId); }
    },
    {
        "regex": /microsoft windows/i,
        "func": threadId => { utils.sendFile("../media/windows.jpg", threadId); }
    },
    {
        "regex": /i love star wars/i,
        "func": threadId => { utils.sendFile("../media/email.png", threadId); }
    },
    {
        "regex": /from the internet/i,
        "func": threadId => { utils.sendFile("../media/internet.png", threadId); }
    },
    {
        "regex": /you(?:(?:\'|’)re| are) a mank/i,
        "func": threadId => { utils.sendFile("../media/mank.png", threadId); }
    },
    {
        "regex": /citizen of the (united states|us)/i,
        "func": threadId => { utils.sendFile("../media/citizen.jpg", threadId); }
    },
    {
        "regex": /use d(?:ropbox|bx)/i,
        "func": threadId => { utils.sendFile("../media/dropbox.jpg", threadId); }
    },
    {
        "regex": /(?:yo)?u(?:(?:\'|’)re|r)? ri(?:ght|te)/i,
        "func": (_, messageId) => { utils.reactToMessage(messageId, "angry"); }
    },
    {
        "regex": /(?:^|\s)(?:v|a)r($|[^A-z0-9])/i,
        "func": (_, messageId) => { utils.reactToMessage(messageId, "funny"); }
    },
    {
        "regex": /langlieb family/i,
        "func": threadId => { utils.sendFile("../media/langlieb.png", threadId); }
    },
    {
        "regex": /assume zero brain power/i,
        "func": threadId => { utils.sendFile("../media/aøbp.png", threadId); }
    },
    {
        "regex": /capital(\s)?one/i,
        "func": threadId => { utils.sendFile("../media/capitalone.png", threadId); }
    },
    {
        "regex": /the ultimate driving machine/i,
        "func": threadId => { utils.sendFile("../media/bmw.png", threadId); }
    },
    {
        "regex": /badass/i,
        "func": threadId => { utils.sendFile("../media/mass.png", threadId); }
    },
    {
        "regex": /new-age kevin/i,
        "func": threadId => { utils.sendFile("../media/newkevin.jpeg", threadId); }
    },
    {
        "regex": new RegExp(`${config.trigger} (.*)spam`, "i"),
        "func": (threadId, _, __, groupInfo) => {
            let emoji = [];
            for (let i = 0; i < 36; i++) { // Full row of emoji
                emoji.push(groupInfo.emoji);
            }
            utils.sendMessage(emoji.join(""), threadId);
        }
    },
    {
        "regex": /slope day/i,
        "func": threadId => { utils.sendFile(["../media/slopejustin.png", "../media/slopemarin.jpeg"], threadId); }
    },
    {
        "regex": /^are you sure$/i,
        "func": threadId => { utils.sendFile("../media/sure.png", threadId); }
    },
    {
        "regex": /^d(o|ew) it$/i,
        "func": threadId => { utils.sendFile("../media/palp.gif", threadId); }
    },
    {
        "regex": /boosted board/i,
        "func": threadId => { utils.sendFile("../media/kevin.mp4", threadId); }
    },
    {
        "regex": /play squash/i,
        "func": threadId => { utils.sendFile("../media/squash.png", threadId); }
    },
    {
        "regex": /corporate (yiyi|justin)/i,
        "func": threadId => { utils.sendFile("../media/corporate.jpg", threadId); }
    },
    {
        "regex": /clock out/i,
        "func": threadId => { utils.sendFile("../media/clockout.png", threadId); }
    },
    {
        "regex": /devil(?:\'|’)?s lettuce/i,
        "func": threadId => { utils.sendFile("../media/devil.png", threadId); }
    },
    {
        "regex": /life advice/i,
        "func": threadId => { utils.sendFile("../media/advice.png", threadId); }
    },
    {
        "regex": /UMD CS/i,
        "func": threadId => { utils.sendFile("../media/umdcs.jpeg", threadId); }
    },
    {
        "regex": /pizza time/i,
        "func": threadId => { utils.sendFile("../media/siri.jpg", threadId); }
    },
    {
        "regex": /happy birthday america/i,
        "func": threadId => { utils.sendFile(["../media/america.jpg", "../media/russia.png"], threadId); }
    },
    {
        "regex": /bellyaching/i,
        "func": threadId => { utils.sendFile("../media/bellyaching.png", threadId); }
    },
    {
        "regex": /all(\-|\s)wheel drive/i,
        "func": threadId => { utils.sendFile("../media/awd.png", threadId); }
    },
    {
        "regex": /i graduated/i,
        "func": threadId => { utils.sendFile("../media/graduation.mp4", threadId); }
    },
    {
        "regex": /russian hacker/i,
        "func": threadId => { utils.sendFile("../media/hacker.jpeg", threadId); }
    },
    {
        "regex": /elon musk/i,
        "func": threadId => { utils.sendFile("../media/musk.png", threadId); }
    },
    {
        "regex": /the salesman/i,
        "func": threadId => { utils.sendFile("../media/salesman.jpg", threadId); }
    },
    {
        "regex": /rocket cars/i,
        "func": threadId => { utils.sendFile("../media/rocketcars.png", threadId); }
    },
    {
        "regex": /jazz grass/i,
        "func": threadId => { utils.sendFile("../media/jazzgrass.png", threadId); }
    },
    {
        "alt": message => { // Check whether the bot was mentioned
            const mentions = Object.keys(message.mentions || {});
            return (mentions && mentions.length && mentions.includes(config.bot.id));
        },
        "func": threadId => { utils.sendMessage("Yo", threadId); }
    },
    {
        "regex": /fratty/i,
        "func": threadId => { utils.sendFile("../media/fratty.png", threadId); }
    },
    {
        "regex": /deborah unhinge/i,
        "func": threadId => { utils.sendFile("../media/unhinge.gif", threadId); }
    },
    {
        "regex": /deborah lunge/i,
        "func": threadId => { utils.sendFile("../media/lunge.gif", threadId); }
    },
    {
        "regex": /deborah lag/i,
        "func": threadId => { utils.sendFile("../media/lag.gif", threadId); }
    },
    {
        "regex": /genocide/i,
        "func": threadId => { utils.sendFile(["../media/gen1.jpg", "../media/gen2.jpg"], threadId); }
    },
    {
        "regex": /lake artemesia/i,
        "func": threadId => { utils.sendFile("../media/artemesia.jpg", threadId); }
    },
    {
        "regex": /shupped/i,
        "func": threadId => { utils.sendFile("../media/shup.png", threadId); }
    },
    {
        "regex": /^sad$/i,
        "func": (threadId, messageId) => { utils.reactToMessage(messageId, "sad"); }
    },
    {
        "regex": /devry/i,
        "func": threadId => { utils.sendFile("../media/devry.png", threadId); },
    },
    {
        "regex": /i(?:\'|’)?m confused/i,
        "func": threadId => { utils.sendFile("../media/kruskal.png", threadId); }
    },
    {
        "regex": /best honey/i,
        "func": threadId => { utils.sendFile("../media/madagain.jpg", threadId); }
    },
    {
        "regex": /i(?:\'|’)?ll lie/i,
        "func": threadId => { utils.sendFile("../media/lie.png", threadId); }
    },
    {
        "regex": /dulaney high school/i,
        "func": threadId => { utils.sendFile("../media/dulaney.png", threadId); }
    },
    {
        "regex": /university of maryland,? college park/i,
        "func": threadId => { utils.sendFile("../media/umdessay.png", threadId); }
    },
    {
        "regex": /i(?:\'|’)?ll lie/i,
        "func": threadId => { utils.sendFile("../media/lie.png", threadId); }
    },
    {
        "regex": /h(i|ey) larry/i,
        "func": threadId => { utils.sendFile("../media/triggered.png", threadId); }
    },
    {
        "regex": /the left/i,
        "func": threadId => { utils.sendFile("../media/anton_typ.gif", threadId); }
    },
    {
        "regex": /kitchen fire/i,
        "func": threadId => { utils.sendFile("../media/fire.mov", threadId); }
    },
    {
        "regex": /(^|\s)1\%/i,
        "func": threadId => { utils.sendFile("../media/onepercent.png", threadId); }
    },
    {
        "regex": /engage/,
        "func": threadId => { utils.sendFile("../media/engage.png", threadId); }
    }
];

exports.handleEasterEggs = (messageObj, fromUserId, attachments, groupInfo) => {
    const message = messageObj.body;
    const messageId = messageObj.messageID;
    if (!groupInfo.muted) { // Don't check for Easter eggs if muted
        for (let i = 0; i < eggs.length; i++) {
            // Check for regex first and then alt function
            // If matched, pass data to trigger function
            if (eggs[i].regex) {
                let match = message.match(eggs[i].regex);
                if (match) { eggs[i].func(groupInfo.threadId, messageId, match, groupInfo); }
            } else if (eggs[i].alt) {
                let alt = eggs[i].alt(messageObj, fromUserId, groupInfo);
                if (alt) { eggs[i].func(groupInfo.threadId, messageId, alt, groupInfo); }
            } else {
                console.error("No conditions found for egg");
            }
        }
    }
};
