# AssumeZero Bot

## About
AssumeZero Bot is a highly configurable bot that can be added to Facebook Messenger group chats. It is designed to expose features that may be hidden or made difficult to use by Messenger's UI, both on desktop and mobile. In addition to this functionality, it also connects to several different external services, like [Spotify](https://spotify.com), [Wolfram|Alpha](http://wolframalpha.com), and [OpenWeatherMap](https://openweathermap.org).

The bot was written with [Node.js](https://nodejs.org/) and the incredible [Facebook Chat API](https://github.com/Schmavery/facebook-chat-api), which allows the bot to emulate a Facebook user who can be added and removed from chats. As of this writing, Facebook's [official API](https://developers.facebook.com/docs/chat) can still only be used in one-on-one conversations.

## Usage
Most of the bot's features are activated with a "trigger word," which can be changed in [`config.js`](config.js). The default trigger word is "physics" and most commands will be in the form:

> physics command [options]

To see a list of commands, use:

> physics help

## Basic Commands
As a rule of thumb, the bot is capable of doing everything that a human user can do on the desktop version of Messenger. This includes messaging the chat, adding and removing users, and modifying user nicknames. Let's take a look:

![physics alive](media/docs/alive.png)

![physics add](media/docs/add.png)

![physics kick](media/docs/kick.png)

![physics rename]()

However, being a bot comes with its own set of advantages. For example, the bot can remove a user for a certain period of time before adding them back automatically!

![physics kick (time)](media/docs/kicktime.png)

Because the bot interfaces directly with Facebook's endpoints through the Facebook Chat API, it often has access to an expanded set of abilities that are not directly available through Messenger's UI.

For instance, it can set the chat emoji to any emoji supported by Messenger rather than just those provided by the default palette.

![physics emoji](media/docs/emoji.png)

It can also query Facebook to perform searches for users, pages, and groups. This can be used to verify that the user being added via the "add" command is the one you actually want to add: the add command first performs a search for the given user that is weighted based on its Facebook-determined proximity (the "rank" in a search result) and then adds the first user to result from this query.

![physics search]()

There are plenty more commands like this, such as poll, title, and photo, but they all operate on a similar premise to these basic examples. Check out the help entries for these commands to learn more.

## Database-dependent Commands

The bot stores information about each conversation that it is a part of in its database. This information is initialized the first time it is added to a chat, so you will see this message:

![Init message]()

After this, the group's information will be continously updated in the background as it receives new messages. This means that any changes to the group's properties, such as adding/removing users, changing the title or photo, or updating the colors or emoji, will be reflected in the bot's database entry for the conversation, which allows it to stay up-to-date and use these properties when needed without the need for a blocking network call.

As a result of this persistent storage, certain commands can store and retrieve information about the conversation and its participants.

The simplest of these is the vote command, which comes in two variants, to increase and decrease a user's globally-tracked 'score' respectively:

![physics \>]()
![physics \<]()

What this score indicates is arbitrary and is up to the user to decide, but regardless of its usage, the scores of any users in a group chat can be shown with the scoreboard command:

![physics scoreboard]()

Similarly, the score of a single user can be retrieved with the score command:

![physics score]()

The bot can list statistics for its usage with the stats command -- this command can list aggregated data for all commands, but it also takes an optional command argument to display more specific information about a given command, including its most prolific user (if they are in the chat<sup name="link1">[1](#note1)</sup>. The data collected for these statistics does not contain any specific messages from a conversation, but rather global counts of how many times a user has used that command. In other words, no private data is stored.

![physics stats]()


Now for some more interesting stuff -- the playlist command interfaces with the Spotify API<sup name="link2">[2](#note2)</sup> to store playlists for each user and retrieve songs from them on command. To add a playlist to the chat, you'll need its [Spotify URI](https://support.spotify.com/us/article/sharing-music) and a user to associate it to. Once stored, the song command can be used to get a random song from it. See the help entries for these commands for more information.

![physics playlist]()

The bot can keep a running tab for each conversation, allowing users to keep track of any shared finances and easily split costs between them. Several child commands exist for this command:

![physics tab]()

Add and subtract have a default value of $1, and the split command will split between all members in the group by default, but it accepts an optional parameter to indicate how many people the tab should be split between.

Lastly, the pin command will allow you to pin a message that can be recalled later; this is useful for keeping track of something in an active chat where it would otherwise get buried.

![physics pin]()

# Fun Commands

**Note**: Several of these commands interface with external APIs that may require configuration in [`config.js`](config.js), but for the most part can be used with the keys I've already provided (although you may want to generate your own for each API so that we're not sharing usage limits).

These commands are pretty simple, so I'll show them without explanation and you can get more info in the help entries:

![physics xkcd]()
![physics weather]()
![physics space]()
![physics wiki]()
![physics wolfram]()

Be careful with this one (see [Under the Hood](#under-the-hood) for safety precautions taken):

![physics execute order 66]()

This command was a lot more interesting when Messenger's backend accepted arbitrary hex values for the group color, but it can still enumerate through all of the whitelisted colors in the palette.

![physics hit the lights]()

This one can be pretty spammy (and can also get the Facebook account that the bot is using temporarily or permanently banned, speaking from experience). It is configurable in [`config.js`](config.js).

![physics wake up]()

Lastly, the random message command will get a random message from the current conversation, but it is quite finnicky on Facebook's end, so YMMV.

![physics random message]()

# Image Processing Commands
