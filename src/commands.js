/* eslint-disable no-useless-escape */
// Stores user commands (accessible via trigger word set in config.js)
const config = require("./config");
exports.categories = {
    "meta": {
        "display_name": "Meta",
        "description": "Commands related to the bot itself",
        "commands": {
            "help": {
                "display_names": ["help"],
                "pretty_name": "Help",
                "short_description": "",
                "description": "Get more information about a command, or open quick help",
                "syntax": "help ({command})",
                "example": "help stats",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /help(.*)/i,
                "experimental": false
            },
            "stats": {
                "display_names": ["stats"],
                "pretty_name": "Stats",
                "short_description": "Get command/user stats",
                "description": "Displays information about command or user usage",
                "syntax": "stats {command}",
                "example": "stats alive",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /stats(.*)/i,
                "experimental": false
            },
            "psa": {
                "display_names": ["psa"],
                "pretty_name": "PSA",
                "short_description": "Messages all the bot's groups",
                "description": "Announces a message to all of the group chats that the bot is present in",
                "syntax": "psa {message}",
                "example": "psa Hello, world!",
                "sudo": true,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /psa ([\s\S]*)/i, // Match EVERYTHING
                "experimental": false
            },
            "bug": {
                "display_names": ["bug", "bug report"],
                "pretty_name": "Bug",
                "short_description": "File a bug report",
                "description": `Messages ${config.owner.names.short} directly with your message and adds to your chat for debugging`,
                "syntax": "bug {message}",
                "example": "bug Pinging is broken",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /bug(.*)?/i,
                "experimental": false
            },
            "alive": {
                "display_names": ["alive", "alive?"],
                "pretty_name": "Alive",
                "short_description": "Is the bot awake?",
                "description": "Tests whether the bot is running",
                "syntax": "alive(?)",
                "example": "alive?",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /alive(?:\?)?/i,
                "experimental": false
            },
            "ban": {
                "display_names": ["ban", "unban"],
                "pretty_name": "Ban",
                "short_description": "",
                "description": "Bans or unbans the provided member",
                "syntax": "(un)ban {member}",
                "example": "ban me",
                "sudo": true,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": false
                },
                "regex": "(un)?ban",
                "experimental": false
            },
            "mute": {
                "display_names": ["mute", "unmute"],
                "pretty_name": "Mute/unmute",
                "short_description": "Turns on/off easter eggs",
                "description": "Turns on/off easter eggs until they are toggled again",
                "syntax": "(un)mute",
                "example": ["mute", "unmute"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /(un)?mute/i,
                "experimental": false
            },
            "christen": {
                "display_names": ["christen"],
                "pretty_name": "Christen",
                "short_description": "Names the bot",
                "description": "The bot doesn't see itself as a user for security purposes, so the name command will not work on it, but this command allows you to name it",
                "syntax": "christen {name}",
                "example": `christen ${config.bot.names.short || config.bot.names.long}`,
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /christen (.*)/i,
                "experimental": false
            },
            "clearstats": {
                "display_names": ["clear stats"],
                "pretty_name": "Clear stats",
                "short_description": "",
                "description": "Wipes usage statistics to start over",
                "syntax": "clear stats",
                "example": "",
                "sudo": true,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /clear stats/i,
                "experimental": false
            },
            "alias": {
                "display_names": ["alias"],
                "pretty_name": "Alias",
                "short_description": "Assign an alternate username",
                "description": "A member's default username is their first name; this command allows a user to assign an alternate username, which will be accepted in any command where a member name is required",
                "syntax": "alias ({member}|clear {member}|{member} {alternate name})",
                "example": [`alias me ${config.bot.names.short || "Bot"}`, `alias clear me`, `alias me`],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": false
                },
                "regex": ["alias( clear)?", "(?: (.*))?"],
                "experimental": false
            },
            "restart": {
                "display_names": ["restart"],
                "pretty_name": "Restart",
                "short_description": "",
                "description": "Restarts the bot (requires remote deployment to Heroku)",
                "syntax": "restart",
                "example": "",
                "sudo": true,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /restart/i,
                "experimental": false
            },
            "undo": {
                "display_names": ["undo"],
                "pretty_name": "Undo",
                "short_description": "Remove last message",
                "description": "Removes last message sent by the bot (if sent within the past 10 minutes)",
                "syntax": "undo",
                "example": ["undo"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /undo/i,
                "experimental": false
            },
            "richcontent": {
                "display_names": ["rich content"],
                "pretty_name": "Rich content",
                "short_description": "Turns on/off rich content (expanded tweets, wiki articles, etc.)",
                "description": "Turns on/off rich content ",
                "syntax": "rich content (on|off)",
                "example": ["rich content on", "rich content off"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /rich content (on|off)/i,
                "experimental": false
            },
        }
    },
    "messenger": {
        "display_name": "Messenger",
        "description": "For interacting with Messenger features",
        "commands": {
            "kick": {
                "display_names": ["kick"],
                "pretty_name": "Kick",
                "short_description": "Removes member",
                "description": "Removes a given member from the chat for an optional amount of time",
                "syntax": "kick {member} ({number of seconds})",
                "example": ["kick me", "kick me 25"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": false
                },
                "regex": ["kick", "(?: (\\d+))?"], // Optional number param after name
                "experimental": false
            },
            "addsearch": {
                "display_names": ["add", "search"],
                "pretty_name": "Add/search",
                "short_description": "",
                "description": "Searches for the given user and either outputs the best match (for searching) or adds it to the chat (for adding)",
                "syntax": "(add|search ({number of results})) {user}",
                "example": ["search Physics Resurrected", "add Physics Resurrected", "search 5 Physics Resurrected"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /(add|search(?: (\d*))?) (.*)/i,
                "experimental": false
            },

            "color": {
                "display_names": ["color"],
                "pretty_name": "Color",
                "short_description": "Sets the chat color; see full help for accepted values",
                "description": "Sets the chat color to one of several currently accepted values:\n\nMessengerBlue: none\nViking: #44bec7\nGoldenPoppy: #ffc300\nRadicalRed: #fa3c4c\nShocking: #d696bb\nPictonBlue: #6699cc\nFreeSpeechGreen: #13cf13\nPumpkin: #ff7e29\nLightCoral: #e68585 \nMediumSlateBlue: #7646ff\nDeepSkyBlue: #20cef5\nFern: #67b868\nCameo: #d4a88c\nBrilliantRose: #ff5ca1\nBilobaFlower: #a695c7\n\nThis command accepts either the name or hex value as input.",
                "syntax": "color (#{six-digit hex color}|rand(om))",
                "example": ["color", "color #ffc300", "color random"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /color( (#(?:[a-f]|\d){6}|rand(?:om)?|[A-z]+))?/i,
                "experimental": false
            },
            "clearnick": {
                "display_names": ["clear nickname"],
                "pretty_name": "Clear nickname",
                "short_description": "",
                "description": "Clears the nickname for the given member",
                "syntax": "clear (nick)name {member}",
                "example": "clear name me",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": false
                },
                "regex": "clear (?:nick)?name",
                "experimental": false
            },
            "setnick": {
                "display_names": ["nickname", "name", "rename"],
                "pretty_name": "Set nickname",
                "short_description": "",
                "description": "Sets the given nickname for the given member",
                "syntax": "((nick|re)name) {member} {nickname}",
                "example": ["nickname me Bot Impersonator", "rename me Bot Impersonator"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": false
                },
                "regex": ["(?:(?:nick|re)?name)", " (.*)"],
                "experimental": false
            },
            "randmess": {
                "display_names": ["random message"],
                "pretty_name": "Random message",
                "short_description": "",
                "description": "Retrieves a random message from the recent history of the group",
                "syntax": "random message",
                "example": "",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /random message/i,
                "experimental": false
            },
            "emoji": {
                "display_names": ["emoji"],
                "pretty_name": "Emoji",
                "short_description": "",
                "description": "Sets the emoji to the specified Unicode value",
                "syntax": "emoji {emoji}",
                "example": "emoji 🚀",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /emoji ([\uD83C-\uDBFF\uDC00-\uDFFF]{1,2})/iu, // Match emoji w/ Unicode modifier (1-2 chars)
                "experimental": false
            },
            "photo": {
                "display_names": ["picture", "photo", "image"],
                "pretty_name": "Photo",
                "short_description": "Sets group photo",
                "description": "Changes the group's photo to the image at the specified URL or the attached image, or displays the current photo if neither is given.",
                "syntax": "(photo|picture|image) ({url})",
                "example": ["photo http://i.imgur.com/tzwVWot.png", "photo [attach an image]", "photo"],
                "sudo": false,
                "attachments": true,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /(?:photo|picture|image)(?: ((?:http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i, // URL
                "experimental": false
            },
            "poll": {
                "display_names": ["poll"],
                "pretty_name": "Poll",
                "short_description": "Creates a group poll",
                "description": "Creates a poll in the group with the given title and optional comma-delimited initial options in brackets",
                "syntax": "poll {title} ([{option 1}, {option 2}, {option 3}, {option n}])",
                "example": ["poll What time should we eat dinner? [6 PM, 6:30 PM, Tomorrow]", "poll Which restaurant should we go to?"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /poll ([^[]+)(?:\[(.*)\])?/i,
                "experimental": false
            },
            "title": {
                "display_names": ["set title", "change title", "title"],
                "pretty_name": "Set title",
                "short_description": "",
                "description": "Sets the title to the specified value",
                "syntax": "title {title}",
                "example": "title One Chat to Rule Them All",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /title (.*)/i,
                "experimental": false
            },
            "branch": {
                "display_names": ["branch"],
                "pretty_name": "Branch",
                "short_description": "Create a new group from a subset of the current members",
                "description": "Creates a new group chat given members of the current chat, with an optional title",
                "syntax": "branch (title) {member 1}, {member 2}, {member 3}, {member n}",
                "example": ["branch me, Cameron, Jonah, Justin", "branch Test Chat me, Larry"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /branch ([^,]+ )?((?:[^,]+(?:,|$))+)/i,
                "experimental": false
            },
            "restore": {
                "display_names": ["restore"],
                "pretty_name": "Restore",
                "short_description": "Restores the properties of a previous chat",
                "description": "Given a thread ID for an existing chat that the bot is in, this will change the current chat's properties (color, nicknames, title, etc.) to match",
                "syntax": "restore {thread ID}",
                "example": ["restore 883154065107088"],
                "sudo": true,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /restore (\d+)/i,
                "experimental": false
            },
            "admin": {
                "display_names": ["admin", "deadmin"],
                "pretty_name": "(De)admin",
                "short_description": "De(admin) a user",
                "description": "Change a user's admin status for a group",
                "syntax": "(de)admin {user}",
                "example": ["admin me", "deadmin me"],
                "sudo": true,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": false
                },
                "regex": "(de)?admin",
                "experimental": false
            }
        }
    },
    "hidden": {
        "commands": {
            "destroy": { // DANGEROUS COMMAND
                "display_names": [], // Secret
                "pretty_name": "Destroy",
                "short_description": "",
                "description": "Destroys the chat",
                "syntax": "sudo destroy confirm", // Redundancy to prevent accidental triggers
                "example": "",
                "sudo": true,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /sudo destroy confirm/i,
                "experimental": false
            },
            "infiltrate": {
                "display_names": [], // Secret command
                "pretty_name": "Infiltrate",
                "short_description": "",
                "description": "Allows the bot to add the admin to groups that it's in",
                "syntax": "infiltrate ({threadId}|{group name})",
                "example": ["infiltrate", "infiltrate 883154065107088", "infiltrate Assume Zero Brain Power"],
                "sudo": true,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /infiltrate(?: ([0-9]+|.+))?/i,
                "experimental": false
            }
        }
    },
    "fun": {
        "display_name": "Fun",
        "description": "Just for fun",
        "commands": {
            "vote": {
                "display_names": ["<", ">", "points", "vote"],
                "pretty_name": "Vote (</>)",
                "short_description": "Vote on users",
                "description": "Allows users to upvote (>) or downvote (<) a given user to influence their current point total",
                "syntax": "(<|>) {member}",
                "example": ["> me", "< me"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": false
                },
                "regex": "(<|>)",
                "experimental": false
            },
            "score": {
                "display_names": ["score", "scoreboard"],
                "pretty_name": "Score",
                "short_description": "Get/set user score",
                "description": "Displays the user's current point score or sets it to a new provided value (must be ≥ 0)",
                "syntax": "score(board|({new score}) {member})",
                "example": ["scoreboard", "score me", "score me 20"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": true
                },
                "regex": ["score(board)?", "(?: (\\d+))?"],
                "experimental": false
            },
            "order66": {
                "display_names": ["execute order 66", "order 66"],
                "pretty_name": "Order 66",
                "short_description": "Destroy group temporarily",
                "description": `Every single group member, including your Socialpath Yiyi Kuang, is now an enemy of the group chat (for ${config.order66Time} seconds)`,
                "syntax": "execute order 66",
                "example": "",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /execute order 66/i,
                "experimental": false
            },
            "hitlights": {
                "display_names": ["hit the lights"],
                "pretty_name": "Hit the lights",
                "short_description": "Random chat colors",
                "description": "Changes the group colors to random colors in quick succession",
                "syntax": "hit the lights",
                "example": "",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /hit the lights/i,
                "experimental": false
            },
            "wakeup": {
                "display_names": ["wake up", "wake"],
                "pretty_name": "Wake up",
                "short_description": "Message user repeatedly",
                "description": `Sends ${config.wakeUpTimes} messages to the given member`,
                "syntax": "wake up {member}",
                "example": ["wake me", "wake up me"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": false
                },
                "regex": "wake(?: up)?",
                "experimental": false
            },
            "echo": {
                "display_names": ["echo", "quote"],
                "pretty_name": "Echo/quote",
                "short_description": "",
                "description": "Echoes or quotes the provided statement",
                "syntax": "(echo|quote) {statement}",
                "example": ["echo Hello, world!", "quote I am not a bot"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /(echo|quote)(?:(?:\s|$)([\s\S]+))?/im,
                "experimental": false
            },
            "answer": {
                "display_names": ["ask", "answer", "magic 8 ball"],
                "pretty_name": "Magic 8-ball",
                "short_description": "",
                "description": "Answers your yes/no question with a random value",
                "syntax": "(ask|answer) {question}",
                "example": ["ask Do you believe in magic?", "answer Will we have school tomorrow?"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /(?:ask|answer) .*/i,
                "experimental": false
            },
            "rng": {
                "display_names": ["random", "rand", "rng"],
                "pretty_name": "Random number generator",
                "short_description": "",
                "description": `Generates a random number in the given range (between two args if passed, between ${config.defaultRNGBounds[0]} and the arg if one is passed, or between ${config.defaultRNGBounds[0]} and ${config.defaultRNGBounds[1]} otherwise)`,
                "syntax": "(rng|rand(om)) (({lower bound}) {upper bound})",
                "example": ["rand", "rng 0 50", "rng 100"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /r(?:and(?:om)?|ng)(?: (\d+))?(?: (\d+))?/i,
                "experimental": false
            },
            "snap": {
                "display_names": ["snap"],
                "pretty_name": "Snap",
                "short_description": "Destroy half the group temporarily",
                "description": "Fun isn’t something one considers when balancing the group chat. But this...does put a smile on my face...",
                "syntax": "snap",
                "example": "",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /snap/i,
                "experimental": false
            },
            "choose": {
                "display_names": ["choose"],
                "pretty_name": "Choose",
                "short_description": "",
                "description": "Choose one thing from a list of options",
                "syntax": "choose {thing 1}, {thing 2}, {thing 3}",
                "example": "choose Mr. Robot, Better Call Saul, Suits",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /choose ((?:[^,]+(?:,|$))+)/i,
                "experimental": false
            },
            "sponge": {
                "display_names": ["sponge"],
                "pretty_name": "Spongebob",
                "short_description": "",
                "description": "sPoNgIfIeS tExT",
                "syntax": "sponge {text}",
                "example": "sponge this command works",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /sponge (.+)/i,
                "experimental": false
            }
        }

    },
    "info": {
        "display_name": "Information",
        "description": "Retrieving info from various sources",
        "commands": {
            "xkcd": {
                "display_names": ["xkcd", "xkcd search"],
                "pretty_name": "xkcd",
                "short_description": "Links xkcd",
                "description": "Outputs the numbered xkcd or search result (or a random one if none was specified)",
                "syntax": "xkcd (new|{comic number}|search {search query})",
                "example": ["xkcd new", "xkcd 303", "xkcd search Wisdom of the Ancients"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /xkcd(?: (new|\d+|search (.+)))?/i,
                "experimental": false
            },
            "wiki": {
                "display_names": ["wiki", "wikipedia", "wiki search"],
                "pretty_name": "Wiki",
                "short_description": "Searches Wikipedia",
                "description": "Searches Wikipedia for a given query and returns the best result",
                "syntax": "wiki {query}",
                "example": ["wiki bots"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /wiki (.*)/i,
                "experimental": false
            },
            "space": {
                "display_names": ["space"],
                "pretty_name": "Space",
                "short_description": "Search for images from the NASA database",
                "description": "Performs a search on NASA's database of space imagery, found at https://images.nasa.gov/; use 'random' to get a random result rather than the top",
                "syntax": "space (random) {search query}",
                "example": ["space mars", "space milky way", "space random sun"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /space (rand(?:om)? )?(.*)/i,
                "experimental": false
            },
            "wolfram": {
                "display_names": ["wolfram"],
                "pretty_name": "Wolfram",
                "short_description": "Searches Wolfram Alpha",
                "description": "Performs a search using Wolfram Alpha (http://www.wolframalpha.com)",
                "syntax": "wolfram {query}",
                "example": ["wolfram ∫(5x^2 + 10x + 34)dx", "wolfram Who is the president of the United States?"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /wolfram (.*)/i,
                "experimental": false
            },
            "weather": {
                "display_names": ["weather"],
                "pretty_name": "Weather",
                "short_description": "",
                "description": "Get current weather for a given city",
                "syntax": "weather {city name}",
                "example": "weather Timonium",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /weather (.+)/i,
                "experimental": false
            },
            "google": {
                "display_names": ["google"],
                "pretty_name": "Google",
                "short_description": "Generates a link to Google the given term",
                "description": "Given a search query, the bot will create a link to a Google search for it",
                "syntax": "google {query}",
                "example": ["google UMD schedule of classes"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /google (.+)/i,
                "experimental": false
            },
            "lucky": {
                "display_names": ["lucky"],
                "pretty_name": "Lucky",
                "short_description": "I'm feeling lucky",
                "description": "Replicates functionality of Google's \"I'm feeling lucky\" functionality (takes to first webpage result for a search)",
                "syntax": "lucky {query}",
                "example": ["lucky define testing"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /lucky (.+)/i,
                "experimental": true
            },
            "covid": {
                "display_names": ["covid"],
                "pretty_name": "COVID",
                "short_description": "Information about COVID-19",
                "description": "Search various data sets for information about COVID cases around the world",
                "syntax": "covid ((state|country|province|top|today|vaccine) {query})",
                "example": ["covid", "covid state Maryland", "covid country Italy", "covid province Hubei", "covid top 5", "covid today all", "covid vaccine moderna"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /covid(?: (state|country|province|top|today|vaccine) (.+))?/i,
                "experimental": false
            },
            "stocks": {
                "display_names": ["stocks", "$"],
                "pretty_name": "Stocks",
                "short_description": "",
                "description": "Get current stock prices",
                "syntax": "${ticker symbol}",
                "example": "$TSLA",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optinoal": false
                },
                "regex": /\$([A-Z]+)/i,
                "experimental": false
            }
        }
    },
    "spotify": {
        "display_name": "Spotify",
        "description": "For interacting with Spotify",
        "commands": {
            "spotsearch": {
                "display_names": ["search artist", "search song", "search track"],
                "pretty_name": "Spotify search",
                "short_description": "Search for music",
                "description": "Searches Spotify's database for artists and songs",
                "syntax": "search (artist|(song|track)) {query}",
                "example": ["search artist The Goo Goo Dolls", "search song Back in Black"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /search (artist|song|track) (.*)/i,
                "experimental": false
            },
            "song": {
                "display_names": ["song", "get song"],
                "pretty_name": "Song",
                "short_description": "Random song",
                "description": "Grabs a random song from member playlists added with 'playlist' command",
                "syntax": "song ({member})",
                "example": "song me",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": true
                },
                "regex": "song",
                "experimental": false
            },
            "playlist": {
                "display_names": ["playlist"],
                "pretty_name": "Playlist",
                "short_description": "Add/update playlist",
                "description": "Add or update playlist for the group – to find a playlist's URI in Spotify desktop, right click on it, select 'Share', and click 'URI'",
                "syntax": "playlist {member} {playlist URI}",
                "example": "playlist me spotify:user:astrocb:playlist:05zXCuscrw1BW5NyeN45DB",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": true
                },
                "regex": ["playlist", "( spotify:user:([^:]+):playlist:([A-z0-9]+))?"],
                "experimental": false
            }
        }
    },
    "photo": {
        "display_name": "Photos",
        "description": "For photo editing",
        "commands": {
            "bw": {
                "display_names": ["bw", "black and white", "grayscale"],
                "pretty_name": "Black & white",
                "short_description": "Converts an image to black and white",
                "description": "Converts an image to black and white with either a URL or an uploaded image",
                "syntax": "bw ({url})",
                "example": ["bw http://i.imgur.com/tzwVWot.png", "bw [attach an image]"],
                "sudo": false,
                "attachments": true,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /bw(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
                "experimental": false
            },
            "sepia": {
                "display_names": ["sepia"],
                "pretty_name": "Sepia",
                "short_description": "Converts an image to sepia tone",
                "description": "Converts an image to sepia tone with either a URL or an uploaded image",
                "syntax": "sepia ({url})",
                "example": ["sepia http://i.imgur.com/tzwVWot.png", "sepia [attach an image]"],
                "sudo": false,
                "attachments": true,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /sepia(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
                "experimental": false
            },
            "flip": {
                "display_names": ["flip", "mirror"],
                "pretty_name": "Flip",
                "short_description": "Flips/mirrors an image",
                "description": "Flips/mirrors the image from the given URL or attachments",
                "syntax": "flip (horiz(ontal)|vert(ical)) ({url})",
                "example": ["flip http://i.imgur.com/tzwVWot.png", "flip horizontal http://i.imgur.com/tzwVWot.png", "flip vert [attach an image]"],
                "sudo": false,
                "attachments": true,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /flip (horiz(?:ontal)?|vert(?:ical)?)(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
                "experimental": false
            },
            "invert": {
                "display_names": ["invert"],
                "pretty_name": "Invert",
                "short_description": "Invert image colors",
                "description": "Inverts the colors of the image from the given URL or attachments",
                "syntax": "invert ({url})",
                "example": ["invert http://i.imgur.com/tzwVWot.png", "invert [attach an image]"],
                "sudo": false,
                "attachments": true,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /invert(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
                "experimental": false
            },
            "blur": {
                "display_names": ["blur"],
                "pretty_name": "Blur",
                "short_description": "Blurs an image",
                "description": "Blurs the image by the given number of pixels from the given URL or attachments; optional param to do a Gaussian blur, which is very slow (< 15 pixels recommended for this one)",
                "syntax": "blur {# of pixels} (gauss) ({url})",
                "example": ["blur 50 http://i.imgur.com/tzwVWot.png", "blur 10 gauss [attach an image]"],
                "sudo": false,
                "attachments": true,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /blur(?: (\d+))?( gauss)?(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
                "experimental": false
            },
            "overlay": {
                "display_names": ["overlay"],
                "pretty_name": "Overlay",
                "short_description": "Overlays text on an image",
                "description": "Overlays text on an image from the given URL or attachments",
                "syntax": "overlay ({url}) {text}",
                "example": ["overlay http://i.imgur.com/tzwVWot.png Hello there!", "overlay Wake up! [attach an image]"],
                "sudo": false,
                "attachments": true,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /overlay(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?(.*)/i,
                "experimental": false
            },
            "brightness": {
                "display_names": ["brighten", "darken"],
                "pretty_name": "Brighten/darken",
                "short_description": "Alters image brightness",
                "description": "Brightens or darkens an image by the given percentage",
                "syntax": "(brighten|darken) {percentage} ({url})",
                "example": ["brighten 10 http://i.imgur.com/tzwVWot.png", "darken 20 [attach an image]"],
                "sudo": false,
                "attachments": true,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /(brighten|darken) (\d*)(?: ((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?))?/i,
                "experimental": false
            }
        }
    },
    "umd": {
        "display_name": "UMD",
        "description": "Commands related to UMD",
        "commands": {
            "course": {
                "display_names": ["course"],
                "pretty_name": "Course",
                "short_description": "UMD course info",
                "description": "Gets information about a specific course at UMD",
                "syntax": "course {course}",
                "example": "course CMSC330",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /course ([A-z]{4}[0-9]{3}[A-z]?)/i,
                "experimental": false
            },
            "professor": {
                "display_names": ["professor"],
                "pretty_name": "Professor",
                "short_description": "UMD professor info",
                "description": "Gets information about a specific professor at UMD",
                "syntax": "professor {professor}",
                "example": "professor Allan Yashinski",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /professor (.+)/i,
                "experimental": false
            },
            "whereis": {
                "display_names": ["whereis"],
                "pretty_name": "Whereis",
                "short_description": "Find UMD buildings",
                "description": "Find the location of different UMD buildings",
                "syntax": "whereis {building name or code}",
                "example": "whereis AVW",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /whereis (.+)/i,
                "experimental": false
            },
            "findbus": {
                "display_names": ["findbus"],
                "pretty_name": "Find Bus",
                "short_description": "Find UMD buses",
                "description": "Find the location of different UMD buses",
                "syntax": "findbus {bus number}",
                "example": "findbus 117",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /findbus (\d+)/i,
                "experimental": false
            }
        }
    },
    "misc": {
        "display_name": "Miscellaneous",
        "description": "Random utility stuff",
        "commands": {
            "pin": {
                "display_names": ["pin"],
                "pretty_name": "Pin",
                "short_description": "Pin a message to the chat",
                "description": `Pins a message to the chat to be accessed later, using a unique name (case-sensitive)${config.introPin ? `; special pins named "${config.introPin}" will be displayed when a new member joins the chat` : ""}`,
                "syntax": "pin (delete|rename|append) {pin name} ({new message})",
                "example": ["pin test Test message", "pin", "pin rename test other", "pin append other New stuff", "pin delete other"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /pin(?:(?:\s|$)([\S]+)?(?:\s|$)?([\s\S]+)?)?/im,
                "experimental": false
            },
            "tab": {
                "display_names": ["tab"],
                "pretty_name": "Tab",
                "short_description": "Keeps a running total",
                "description": "Maintains a running total for the group that can be incremented or decremented (default amount is 1)",
                "syntax": "tab {add|subtract|clear} ({amount})",
                "example": ["tab add 5.50", "tab subtract 2.10", "tab add", "tab subtract", "tab clear"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /tab(?: (add|subtract|clear|split)(?: \$?((?:\d+)?(?:\.\d+)?))?|)?/i,
                "experimental": false
            },
            "remind": {
                "display_names": ["remind"],
                "pretty_name": "Remind",
                "short_description": "",
                "description": "Sends a reminder at a certain point in the future",
                "syntax": "remind {person} {reminder} (in|for|at) {time}",
                "example": "remind me let the dogs out in 20 minutes",
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": true,
                    "optional": false
                },
                "regex": ["remind", "[^\s](.+) (?:in|for|at|on) (.+)"],
                "experimental": false
            },
            "event": {
                "display_names": ["event"],
                "pretty_name": "Event",
                "short_description": "Create and manage events",
                "description": "Create, delete, and list events in the chat, which will send reminders for pre-set times (with RSVP functionality)",
                "syntax": "event (create {name} for {date/time}|delete {name}|list ({name}))",
                "example": ["event create Dinner for tomorrow at 6 PM", "event delete Dinner", "event list", "event repeat daily"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /event (?:(create) (.+) for (.+)|(delete) (.+)|(list)( .+)?|(repeat) (.+))/i,
                "experimental": false
            },
            "group": {
                "display_names": ["group"],
                "pretty_name": "Mention groups",
                "short_description": "",
                "description": "Manage groups of people that can be mentioned collectively with @@group_name",
                "syntax": "group (create|delete|subscribe|unsubscribe) {group_name} ({users})",
                "example": ["group create testers me, Larry", "group delete testers", "group subscribe testers Anton", "group unsubscribe testers me"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /group (create|delete|subscribe|unsubscribe|list)(?: ([\w]+)(?: (.+))?)?/i,
                "experimental": false
            },
            "timer": {
                "display_names": ["timer"],
                "pretty_name": "Timer",
                "short_description": "",
                "description": "Starts/stops a timer in the chat, and reports the duration",
                "syntax": "timer (start|stop)",
                "example": ["timer start", "timer stop"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /timer (start|stop)/i,
                "experimental": false
            },
            "follow": {
                "display_names": ["follow", "unfollow"],
                "pretty_name": "Follow",
                "short_description": "Follow a Twitter account",
                "description": "Follows a Twitter account, sending new tweets to the chat as they're posted",
                "syntax": "(un)follow {twitter_handle}|list",
                "example": ["follow @AstroCB", "unfollow @AstroCB", "follow list"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /(un)?follow @?(\w+)/i,
                "experimental": false
            },
            "subscribe": {
                "display_names": ["subscribe", "unsubscribe"],
                "pretty_name": "Subscribe",
                "short_description": "Subscribe to an RSS feed",
                "description": "Subscribes to an RSS feed, sending new items to the chat as they're added",
                "syntax": "(un)subscribe {feed URL}|list",
                "example": ["subscribe https://github.com/AstroCB/AssumeZero-Bot/commits/master.atom", "unsubscribe https://github.com/AstroCB/AssumeZero-Bot/commits/master.atom", "subscribe list"],
                "sudo": false,
                "attachments": false,
                "user_input": {
                    "accepts": false,
                    "optional": false
                },
                "regex": /(un)?subscribe (\S+)/i,
                "experimental": false
            },
        }
    }
};

// Splice all of the categories' commands together into one map
const commGroups = Object.keys(exports.categories).map(cat => exports.categories[cat].commands);
exports.commands = commGroups.reduce((acc, group) => {
    for (let co in group) {
        if (group.hasOwnProperty(co)) {
            acc[co] = group[co];
        }
    }
    return acc;
}, {});