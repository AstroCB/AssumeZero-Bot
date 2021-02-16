/*
    This file defines the bot's "ticker," the recurring process that runs every
    `config.tickerInterval` minutes to do things like: checking whether it's time
    to send event reminders, checking whether new tweets have been posted to
    followed accounts, etc.

    To add a new process to run in the ticker, define a new function that accepts
    a single parameter representing a map from threadId to groupInfo objects
    and add it to the `checks` list.
*/
const utils = require("./utils");
const config = require("./config");

const checks = [events, tweets, feeds];

exports.ticker = () => {
    utils.getGroupData((err, data) => {
        if (!err) {
            checks.forEach(check => check(data));
        }
    });
};

// Check whether scheduled events are occurring
function events(data) {
    // Collect events from all of the groups
    let events = Object.keys(data).reduce((events, group) => {
        const gEvents = data[group].events;
        Object.keys(gEvents).forEach(event => {
            events.push(gEvents[event]);
        });

        return events;
    }, []);

    const curTime = new Date();
    events.forEach(event => {
        if (new Date(event.timestamp) <= curTime
            || (event.remind_time && new Date(event.remind_time) <= curTime)) {
            // Event is occurring! (or occurred since last check)
            let msg, mentions, replyId;
            if (event.type == "event") {
                // Event
                msg = `Happening ${event.remind_time ? `in ${config.reminderTime} minutes` : "now"}: ${event.title}${event.going.length > 0 ? "\n\nReminder for " : ""}`;

                // Build up mentions string (with Oxford comma 🤘)
                const goingList = event.going.map(user => `@${user.name}`);
                msg += utils.prettyList(goingList);

                mentions = event.going.map(user => {
                    return {
                        "tag": `@${user.name}`,
                        "id": user.id
                    };
                });
            } else {
                // Reminder
                msg = `Reminder for @${event.owner_name}: ${event.reminder}`;
                mentions = [{
                    "tag": `@${event.owner_name}`,
                    "id": event.owner
                }];
                replyId = event.replyId;
            }

            // Send off the reminder message and delete the event
            const groupInfo = data[event.threadId];
            utils.sendMessageWithMentions(msg, mentions, groupInfo.threadId, replyId);

            if (event.remind_time) {
                // Don't delete, but don't remind again
                groupInfo.events[event.key_title].remind_time = null;
                utils.setGroupProperty("events", groupInfo.events, groupInfo);
            } else if (event.repeats_every) {
                // Event repeats again; update reminder time
                const newDate = new Date(event.timestamp + event.repeats_every);
                const { eventTime, prettyTime, earlyReminderTime } = utils.getEventTimeMetadata(newDate);

                groupInfo.events[event.key_title] = {
                    ...groupInfo.events[event.key_title],
                    "timestamp": eventTime,
                    "pretty_time": prettyTime,
                    "remind_time": earlyReminderTime
                };
                utils.setGroupProperty("events", groupInfo.events, groupInfo);
            } else {
                utils.deleteEvent(event.key_title, event.owner, groupInfo, groupInfo.threadId, false);
            }
        }
    });
}

// Check whether followed accounts have tweeted
function tweets(data) {
    Object.keys(data).forEach(threadId => {
        const groupInfo = data[threadId];
        const followedUsers = groupInfo.following;

        Object.keys(followedUsers).forEach(username => {
            utils.getLatestTweetID(username, (err, id) => {
                if (!err) {
                    if (followedUsers[username] !== id) {
                        // New tweet since last check; store it
                        followedUsers[username] = id;
                        utils.setGroupProperty("following", followedUsers, groupInfo);

                        // Send the new tweet to the chat
                        utils.sendTweetMsg(id, threadId, true);
                    }
                }
            });
        });
    });
}

// Check whether subscribed RSS feeds have updated
function feeds(data) {
    Object.keys(data).forEach(threadId => {
        const groupInfo = data[threadId];
        const feeds = groupInfo.feeds;

        Object.keys(feeds).forEach(feedURL => {
            utils.getLatestFeedItems(feedURL, groupInfo, (err, items, feed) => {
                if (!err && items.length > 0) {
                    // New feed items since last check: update last check record and send items to chat
                    feeds[feedURL] = new Date().toISOString();
                    utils.setGroupProperty("feeds", feeds, groupInfo);

                    const itemText = items.map(item => `\n${item.title.trim()}\n${item.link}`).join('\n');
                    utils.sendMessage(`New item${items.length == 1 ? '' : 's'} in feed "${feed.title}"\n${itemText}`, threadId);
                }
            });
        });
    });
}