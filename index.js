const fs = require("fs");
const open = require("open");
const axios = require("axios");
const express = require("express");
const colors = require('colors');

require("dotenv").config();

const app = express();

colors.setTheme({
  info: 'green',
  warn: 'yellow',
  error: 'red'
});

//env credentials

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

let token = null;
const port = 3001;
const callbackURL = `http://localhost:${port}/callback`;
const basicAuth = `Basic ${Buffer.from(
  spotifyClientId + ":" + spotifyClientSecret
).toString("base64")}`;

const saveSpotifyToken = (data) => {
  fs.writeFileSync("token.json", JSON.stringify(data), (err) => {
    if (err) {
      return console.log(err);
    }
  });
};

const authorizeSpotify = (userToken) => {
  axios({
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    params: {
      grant_type: "authorization_code",
      code: userToken,
      redirect_uri: callbackURL,
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth,
    },
  })
    .then(({ data }) => {
      console.log("got a new token, now saving it...");
      saveSpotifyToken(data);
      console.log("token saved!");
    })
    .catch((error) => {
      console.log(error.message);
    });
};

const getSavedSpotifyToken = () => {
  const tokenBuffer = fs.readFileSync("token.json");
  return tokenBuffer.length > 0 ? JSON.parse(tokenBuffer) : null;
};

const getSpotifyAccessToken = () => {
  try {
    if (!getSavedSpotifyToken()) {
      console.log(
        "no token found in token.json, attempting to get a new token"
      );
      try {
        open(
          `https://accounts.spotify.com/authorize?client_id=${spotifyClientId}&response_type=code&redirect_uri=${callbackURL}&scope=user-read-currently-playing%20user-read-playback-state`
        );
      } catch (error) {
        console.log(error.message);
      }
    } else {
      console.log("token found in token.json, refreshing token...");
      refreshSpotifyToken();
      console.log("token refreshed!");
    }
  } catch (error) {
    console.log("no token.json file found, creating token.json file");
    saveSpotifyToken(null);
    console.log("token.json file created!");
    getSpotifyAccessToken();
  }
};

const refreshSpotifyToken = () => {
  axios({
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    params: {
      grant_type: "refresh_token",
      refresh_token: getSavedSpotifyToken().refresh_token,
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth,
    },
  })
    .then(({ data }) => {
      console.log("updating token in token.json");
      saveSpotifyToken({ ...getSavedSpotifyToken(), ...data });
      console.log("updated token!");
    })
    .catch((error) => {
      console.log(error.message);
    });
};

app.get("/callback", (req, res) => {
  const [, token] = req.url?.split("=");
  authorizeSpotify(token);
  res.send("success!");
});

const server = app.listen(3001, () => {
  console.log(`server started on port ${port}`);
  getSpotifyAccessToken();
});

// handle server exceptions & events

process.on("unhandledRejection", (error) => {
  console.log(error.message);
  server.close(() => process.exit(1));
});

process.on("SIGTSTP", () => {
  console.log("server is suspended");
});

process.on("SIGINT", () => {
  console.log("terminating server...");
  server.close(() => process.exit(0));
});
