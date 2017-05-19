m = "Update commands" # Commit message parameter option in invocation

all:
	git add .
	git commit -m $(m)
	git push origin
enable:
	heroku ps:scale web=1 -a assume-bot
disable:
	heroku ps:scale web=0 -a assume-bot
restart:
	heroku ps:restart web -a assume-bot
logs:
	heroku logs -n 100 -a assume-bot
start:
	npm start
archive:
	node archive.js
debug: disable start
