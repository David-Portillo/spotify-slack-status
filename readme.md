# INTRODUCTION

spotify-slack-status updates your slack status to what you are currently listening to on Spotify.

# REQUIREMENTS

- requires node v14+
- Slack token
- Spotify token

# INSTALLATION

1. rename .env.sample file to .env
2. place your Spotify and Slack token in the right place, Slack token should start with xoxp-
3. cd into root of this repo and run npm i
4. run the script with npm start

# FAQs

##### HOW TO GET A SLACK TOKEN?

1. Login at https://api.slack.com/apps
2. Click create an app
3. Select "From Scratch" option
4. Enter an app name and choose a workspace and create app
5. Under "Add features and functionality" click on permissions
6. Under "Oauth Tokens for your Workspace" copy your User Oauth Token, it should start with xoxp
7. Under "User Token Scopes" type in users.profile:write
8. Navigate back to your apps
9. Under "Install your app" click on "Install to Workspace" and click allow
10. Add users.profile:write permission to your app and install it to your workspace

##### HOW TO GET A SPOTIFY TOKEN?

1. Navigate to https://developer.spotify.com/dashboard/
2. Log in or create an account
3. Navigate to your dashboard and create an app
4. Enter your app details - any info for app name and app description should suffice
5. Open your app properties and type in localhost:3001/ under Redirect URI and save changes
6. Copy the client ID and client secret and paste it in you .env file