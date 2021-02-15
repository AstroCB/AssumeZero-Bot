# Pulls latest changes and restarts the bot
git checkout -- package*.json # Ignore local package changes
git pull origin master
if [ ! -z "$1" ] && [ $1 == "--reinstall" ]
then
    npm install
    npm update
fi
npm run-script restart
