const fs = require("fs");
const open = require("open");
const axios = require("axios");
const express = require("express");

require("dotenv").config();

const app = express();

//env credentials

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

const callbackURL = "http://localhost:3001/callback";

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
      Authorization: `Basic ${Buffer.from(
        spotifyClientId + ":" + spotifyClientSecret
      ).toString("base64")}`,
    },
  })
    .then(({ data }) => {
      fs.writeFileSync("access_token", `Bearer ${data.access_token}`, (err, data) => {
        if (err) {
          return console.log(err);
        }
        console.log(data);
      });
    })
    .catch((error) => {
      console.log(error.message);
    });
};

// get spotify token

open(
  `https://accounts.spotify.com/authorize?client_id=${spotifyClientId}&response_type=code&redirect_uri=${callbackURL}&scope=user-read-currently-playing%20user-read-playback-state`
);

app.get("/callback", (req, res) => {
  const [, userToken] = req.url?.split("=");
  authorizeSpotify(userToken);
  res.send("success!");
});

app.listen(3001, () => {
  console.log("server started on port 3001");
});
