# Pulls latest changes and restarts the bot
git pull origin master
if [ $1 == "--reinstall" ]
then
    npm install
fi
npm run-script restart