# WeVote weconnect-server

[![Build Status](https://travis-ci.org/wevote/weconnect-server.svg?branch=develop)](https://travis-ci.org/wevote/WebApp)

This **weconnect-server** git repository contains the code for WeVote's Node Javascript application server.
* Node is the interpreter/compiler for server based JavaScript (JavaScript not running in a browser).
* The **weconnect-server** 
   * is based on the excellent [Hackathon Starter](https://github.com/sahat/hackathon-starter) "A kickstarter for Node.js Web applications". (But we use is as an API server).
   * is a backend API server "written in Node" to support our React [weconnect](https://github.com/wevote/weconnect) front end client.
   * uses the Express.js application server to run our app, and serve up HTTP requests.
   * uses the Prisma.js ORM (Object Relational Model) to read and write from our PostgreSQL database server.
<br><br>

Interested in [volunteering or applying for an internship](https://wevote.applytojob.com/apply)? [Starting presentation here](https://prezi.com/p/6iu9aks7zqvs/?present=1).
Please also [read about our values](https://docs.google.com/document/d/12qBXevI3mVKUsGmXL8mrDMPnWJ1SYw9zX9LGW5cozgg/edit) and
[see our Code of Conduct](CODE_OF_CONDUCT.md)
To join us, please [review our openings here](https://wevote.applytojob.com/apply), and apply for a volunteer position through that page.

Our current version of our public facing web app is here [https://WeVote.US](https://WeVote.US) and we are working on a new version now!

## Installing the weconnect-server

These instruction assume that you are installing on a Mac.  If you use Windows or Linux, the installation procedure should be similar.

This procedure is based on using the free Community edition of WebStorm, which has great Git integraton, a great integrated Node debugger, and is an excellent editor.  If you have the paid version of WebStorm the instructions should be the same.  If you have some other preferred editor, we recommend that you still do this install, and then use your other editor as you wish! 
<br><br>

### If you don't already have one, create an account in [GitHub](https://github.com/)
[GitHub](https://github.com/) is where WeVote stores the source code for our various projects.
<br><br>

### Download and install WebStorm
The free Community edition is at https://www.jetbrains.com/webstorm/

License it as a free Community installation.

Once installed, start WebStorm from Launch Pad or Spotlight

<img src="docs/images/WelcomeToWebStorm.png" alt="Alt Text" width="600" >

The first step is to press that "Clone Repository" button to clone the https://github.com/wevote/weconnect-server repository. 
Enter the URL and press the Clone button.

<img src="docs/images/CloneRepository.png" alt="Alt Text" width="600" >

Now the latest code is on your machine.

<img src="docs/images/CodeInstalledInWebstorm.png" alt="Alt Text" width="1200" >
<br><br>

### Configure the WebStorm display mode
If you like the default white characters on a black background, skip this step.

Access the settings dialog from the gear icon in the upper right hand side of the WebStorm app.
Set the Theme as you would like, or have it "Sync with OS" (which is my preference), and then save.
<br><br>

<img src="docs/images/WebStormAppearanceSettings.png" alt="Alt Text" width="700" >
<br><br>

### About WebStorm plugins
Plugins extend the capability of WebStorm and are worth exploring.  If it sounds good, we usually install them, unless the suggestions are far off-topic for what we are using WebStorm for today.
Plugins suggested by WebStorm are safe to install, and easy to remove if you don't like them.
<br><br>

### Install Homebrew (If it is not already installed)
Open a terminal window by clicking on the terminal icon on the bottom left side of WebStorm, type `brew` and hit return, if brew is installed you can skip this step.

To Install [Homebrew](https://brew.sh/) paste this following command into the terminal, and press return

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
<img src="docs/images/InstallHomebrew.png" alt="Alt Text" width="1200" >

After a few minutes, homebrew will be installed.  You will now use Homebrew to install some more applications.
<br><br>

### Install Node
This project needs a Node version of at least 22.0<br>
If you have an earlier version of Node installed, you will need to reinstall it.

Check your node version via the terminal (This computer was at V18, and needed to be upgraded.  Node had been previously installed with 
Homebrew.  "homebrew" is in the path to the Node executable (`/opt/homebrew/bin/node`), so we know it was installed with Homebrew.)

```
stevepodell@Steves-MacBook-Air weconnect-server % which node             
/opt/homebrew/bin/node
stevepodell@Steves-MacBook-Air weconnect-server % node -v
v18.10.0
stevepodell@Steves-MacBook-Air weconnect-server % 
```

If Node was installed on your computer by some method other than Homebrew, you will have to research how to upgrade your installation of Node.

If Node was installed with Homebrew or you have never installed Node, continue...

```bash
  stevepodell@Steves-MacBook-Air weconnect-server % brew install node@22
  ...
  ==> Caveats
  node@22 is keg-only, which means it was not symlinked into /usr/local,
  because this is an alternate version of another formula.
   
  If you need to have node@22 first in your PATH, run:
     echo 'export PATH="/usr/local/opt/node@22/bin:$PATH"' >> ~/.zshrc

  For compilers to find node@22 you may need to set:
    export LDFLAGS="-L/usr/local/opt/node@22/lib"
    export CPPFLAGS="-I/usr/local/opt/node@22/include"
  ==> Summary
🍺  /usr/local/Cellar/node@22/22.11.0: 2,628 files, 83.7MB
  ==> Running `brew cleanup node@22`...
  Disable this behaviour by setting HOMEBREW_NO_INSTALL_CLEANUP.
  Hide these hints with HOMEBREW_NO_ENV_HINTS (see `man brew`).
  stevepodell@Steves-MacBook-Air weconnect-server % 
```
If Homebrew asks you to make the following 4 manual changes to link in Node.  Execute these 4 lines in your terminal.
```bash
stevepodell@Steves-MacBook-Air weconnect-server % echo 'export PATH="/usr/local/opt/node@22/bin:$PATH"' >> ~/.zshrc
stevepodell@Steves-MacBook-Air weconnect-server % echo 'export PATH="/usr/local/opt/node@22/bin:$P                 
stevepodell@Steves-MacBook-Air weconnect-server % export LDFLAGS="-L/usr/local/opt/node@22/lib"
stevepodell@Steves-MacBook-Air weconnect-server % export CPPFLAGS="-I/usr/local/opt/node@22/include"
stevepodell@Steves-MacBook-Air weconnect-server % 
```
Then confirm the version of Node is greater than V22, open a new terminal window (with the "+" icon) and type

```
stevepodell@Steves-MacBook-Air weconnect-server % node -v
v22.11.0
stevepodell@Steves-MacBook-Air weconnect-server % 
```
<br><br>

### Set up your Git remotes within WebStorm

<img src="docs/images/GitRemotes.png" alt="Alt Text" width="1200" >

At WeVote we use different naming conventions for `origin` and `upstream` than you might be familiar with from other projects, so you
will need to rename the default git origin (which at WeVote is your private branch in GitHub
)

<img src="docs/images/GitOriginBefore.png" alt="Alt Text" width="500" >

Edit the origin line, and change the name to upstream, then press OK

<img src="docs/images/RenameOrigin.png" alt="Alt Text" width="500" >

Then press the + button and set up the new value for “origin”. 
(DON’T USE SailingSteve — use your GitHub handle — the GitHub username that is in the URL after you sign in to GitHub .)

<img src="docs/images/DefineRemote.png" alt="Alt Text" width="500" >

When done, your remotes will look something like this (with your GitHub handle instead of SailingSteve!)

<img src="docs/images/RemotesSetup.png" alt="Alt Text" width="500" >

At this point you are poised to make Git branches and pull requests.
<br><br>

### Load all the Node packages that we use in the weconnect-server
If you haven't already done this via a prompt from Webstorm, type
```
stevepodell@Steves-MacBook-Air weconnect-server % npm install
```
You can run this command as often as you want, and it will cause no harm.
<br><br>

### Make a live copy of .env-template to the .env file

Right-click on the `.env-template` file in Webstorm, and right-click paste it as `.env`

<img src="docs/images/WebstormPasteConfig.png" alt="Alt Text" width="1200" >

Open `.env` in WebStorm by double-clicking on it

<img src="docs/images/EnvConfigEditing.png" alt="Alt Text" width="1200" >

Modify the `DATABASE_URL` line by substituting your Postgres username and password, and then save.

Here is a filled in example:

```
DATABASE_URL=postgresql://jerrygarcia:jerryspassword@localhost:5432/WeConnectDB?schema=public
```
<br><br>

### Use the Prisma ORM to "migrate" the database and table definitions to the postgres server

Generate the schema from prisma/schema.prisma to node_modules
```
stevepodell@Steves-MacBook-Air weconnect-server % prisma generate
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 73ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Help us improve the Prisma ORM for everyone. Share your feedback in a short 2-min survey: https://pris.ly/orm/survey/release-5-22

stevepodell@Steves-MacBook-Air weconnect-server % 
```

Initialize the generated schema into the postgres database server.
```
stevepodell@Steves-MacBook-Air weconnect-server %  prisma migrate dev --name init
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "WeConnectDB", schema "public" at "localhost:5432"

Applying migration `20241126190549_init`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20241126190549_init/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 104ms


stevepodell@Steves-MacBook-Air weconnect-server % 
```
<br><br>

### Add a Run Configuration in WebStorm to start the weconnect-server

Open the pull-down that initially says "Current File", and select Edit Configurations
<br>
<img src="docs/images/RunConfigMenu.png" alt="Alt Text" width="400" style="border: 1px solid lightgrey;"><br>

(We use [nodemon](https://www.npmjs.com/package/nodemon) during development, so that changes you make in your editor, are immediately transferred to the running version, without having to save and restart).

In a terminal window, run `which nodemon`.  Then copy that path that results from the witch command.

<img src="docs/images/WhichNodemon.png" alt="Alt Text" width="900" style="border: 1px solid lightgrey;"><br>

In the Run/Debug Configurations dialog, press the "+" button and then select "Node.js"
<br><img src="docs/images/SelectNodeFromList.png" alt="Alt Text" width="600" ><br>
Then fill in the run configuration... 
1) In the "Name" field, enter `Start weconnect-server`
2) In the "Node Parameters" field, paste the path to nodemon.
3) In the "File" field, enter `weconnect-server.js` .
4) And press "OK" to save
<br><img src="docs/images/NodeConfigFillIn.png" alt="Alt Text" width="900" >
<br><br>
 
### Create a run config to start postgres

1) Add another "New Configuration", this time for a Shell Script (close to the bottom of the list of configurations on the right)
2) In this "Run/Debug Configurations" dialog Name field, enter "Start Postgres"
3) In the "Script Path" paste in `/usr/local/opt/postgresql@14/bin/postgres` 
4) in the "Script Options" paste in `-D /usr/local/var/postgresql@14`
5) Remove any text in the "Interpreter Path" field.
6) Make sure "Execute in the terminal" is checked
7) Then press OK to save

<img src="docs/images/PostgresConfigFillIn.png" alt="Alt Text" width="600" >

(This run configuration is the equivalent of typing

````/usr/local/opt/postgresql@14/bin/postgres -D /usr/local/var/postgresql@14```` 

in the terminal.)
<br><br>

### Install pgadmin4, a Mac based browser app for the postgres database
```
stevepodell@Steves-MacBook-Air weconnect-server % brew install --cask pgadmin4
```
This will take a few minutes, when it completes launch the app from Launch Pad or Spotlight

Register the server as WeVoteServer

<img src="docs/images/RegisterTheServer.png" alt="Alt Text" width="600" >

And in the "Connection tab" set the "Host" name as localhost — also add your postgres "Username" and "Password", then Save

<img src="docs/images/RegisterPgAdminHost.png" alt="Alt Text" width="600" >
<br><br>

### Start the app!
First start postgres via the run configuration

<img src="docs/images/StartPostgres.png" alt="Alt Text" width="400" style="border: 1px solid lightgrey;">

Then start weconnect-server.js with the run configuration.
<br><br><img src="docs/images/StartTheApp.png" alt="Alt Text" width="1200" >

As you can see when you press the Green start arrow, the server starts up in a terminal window where you can see 
logging.  Any `console.log()` lines that you put in the code will appear in this JavaScript console for this Node based server (which has no DOM).  

Alternatively if you press the green bug icon, you start a debugging session, where you can set breakpoints, examine threads,  and examine data
in a familiar way to what you might be used to with Chrome Dev Tools (Inspect) or debugging in PyCharm.

<img src="docs/images/StartDebug.png" alt="Alt Text" width="1200" >
<br><br>

### View the app in the Chrome browser

When you navigate in Chrome to `http://localhost:4000/` you will see the client view of app (in these early days the UI is 
generated on the server via the Pug UI package), this UI of course is rendered as a DOM within Chrome,
and as with any web app, right-clicking on the page and choosing Inspect, will allow you to run the Chrome Dev Tools.

<img src="docs/images/AppInChrome.png" alt="Alt Text" width="1200" >



Credits &amp; Thanks
---------------

Mad respect to [Hackathon Starter](https://github.com/sahat/hackathon-starter)

License
-------

The MIT License (MIT)

Copyright (c) 2024 We Vote USA

Forked from [Hackathon Starter](https://github.com/sahat/hackathon-starter) Copyright (c) 2024 Sahat Yalkabov

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
