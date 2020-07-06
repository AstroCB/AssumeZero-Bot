# Script to run the bot and auto-restart on crashes
# If you're using multiple bot instances with BotCore, you should use a
# process manager like pm2 instead (see package.json for examples)

until (node src/main.js); do
    echo "Bot crashed with exit code $?.  Respawning..." >&2
    sleep 1
done

