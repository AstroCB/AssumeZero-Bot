all:
	git add .
	git commit -m "Update commands"
	git push origin
enable:
	heroku ps:scale web=1 -a assume-bot
disable:
	heroku ps:scale web=0 -a assume-bot
restart:
	heroku ps:restart web -a assume-bot
