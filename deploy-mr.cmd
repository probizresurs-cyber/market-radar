@echo off
rem Деплой market-radar на прод-VPS через обобщённый deploy.mjs из лидгена.
rem Вынесено в файл, потому что вставка длинной строки с env-переменными в
rem консоль периодически теряет символы, и команда падает на битом пути.
rem
rem Пути считаются от расположения самого файла (%~dp0 — папка nextjs-app),
rem поэтому скрипт не сломается при переносе репозитория.

setlocal

rem %~dp0 приходит с завершающим обратным слэшем, а deploy.mjs подставляет
rem этот путь в кавычки: git -C "…\nextjs-app\" — слэш экранирует кавычку,
rem и git получает вместо пути всю остальную строку команды. Срезаем его.
set "MR_ROOT=%~dp0"
set "MR_ROOT=%MR_ROOT:~0,-1%"
set "DEPLOY_ROOT=%MR_ROOT%"
set "DEPLOY_TAR_NAME=mr-deploy.tar.gz"
set "DEPLOY_REMOTE_TAR=/tmp/mr-deploy.tar.gz"
set "DEPLOY_REMOTE_DIR=/var/www/market-radar"
set "DEPLOY_PM2=market-radar"
set "DEPLOY_GIT=1"
set "DEPLOY_NO_INSTALL=1"

node "%~dp0..\marketradar-leadgen\scripts\deploy.mjs"

endlocal
