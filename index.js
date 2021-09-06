const fs = require('fs');
const open = require('open');
const axios = require('axios').default;
const express = require('express');
const colors = require('colors');

require('dotenv').config();

const app = express();

colors.setTheme({
  msg: 'grey',
  info: 'green',
  warn: 'yellow',
  error: 'red',
});

//env credentials

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

const port = 3001;
const tokenFileName = 'token.json';
const callbackURL = `http://localhost:${port}/callback`;
const basicAuth = `Basic ${Buffer.from(spotifyClientId + ':' + spotifyClientSecret).toString('base64')}`;

const axiosSpotifyAccount = axios.create({
  baseURL: 'https://accounts.spotify.com/api/token',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: basicAuth,
  },
});

const saveSpotifyToken = (data) => {
  fs.writeFileSync(tokenFileName, JSON.stringify(data), (err) => {
    if (err) {
      return console.log(`-> ${err}`.error);
    }
  });
};

const authorizeAccessToken = (userToken) => {
  axiosSpotifyAccount({
    method: 'post',
    params: {
      grant_type: 'authorization_code',
      code: userToken,
      redirect_uri: callbackURL,
    },
  })
    .then(({ data }) => {
      console.log('-> authorized new access token, now saving it...'.msg);
      saveSpotifyToken(data);
      console.log(`-> access token saved! in ${tokenFileName}`.info);
    })
    .catch(handleAxiosException);
};

const savedSpotifyAccessToken = () => {
  const tokenBuffer = fs.readFileSync(tokenFileName);
  return tokenBuffer.length > 0 ? JSON.parse(tokenBuffer) : null;
};

const getSpotifyAccessToken = () => {
  try {
    if (!savedSpotifyAccessToken()) {
      console.log(`-> no access token found in ${tokenFileName}, attempting to authorize one`.warn);
      try {
        open(`https://accounts.spotify.com/authorize?client_id=${spotifyClientId}&response_type=code&redirect_uri=${callbackURL}&scope=user-read-currently-playing%20user-read-playback-state`);
      } catch (error) {
        console.log(`-> ${error.message}`.error);
      }
    } else {
      console.log(`-> access token found in ${tokenFileName}, refreshing token...`.msg);
      refreshSpotifyToken();
      console.log('-> token refreshed!'.info);
    }
  } catch (error) {
    console.log(`-> no ${tokenFileName} file found, creating token.json file`.warn);
    saveSpotifyToken(null);
    console.log(`-> ${tokenFileName} file created!`.info);
    getSpotifyAccessToken();
  }
};

const refreshSpotifyToken = () => {
  axiosSpotifyAccount({
    method: 'post',
    params: {
      grant_type: 'refresh_token',
      refresh_token: savedSpotifyAccessToken().refresh_token,
    },
  })
    .then(({ data }) => {
      console.log(`-> updating access token in ${tokenFileName}`.msg);
      saveSpotifyToken({ ...savedSpotifyAccessToken(), ...data });
      console.log('-> updated access token!'.info);
    })
    .catch(handleAxiosException);
};

app.get('/callback', (req, res) => {
  const [, token] = req.url?.split('=');
  authorizeAccessToken(token);
  res.send('success! 👍');
});

const server = app.listen(3001, () => {
  console.log(`-> server started on port ${port} 🚀`.msg);
  getSpotifyAccessToken();
});

// handle server exceptions & events

const handleAxiosException = (error) => {
  console.log(`-> ${error.message} : ${error.response.statusText}`.error);
  console.log(`   > error: ${error.response.data.error}`.error);
  console.log(`   > error description: ${error.response.data.error_description}`.error);
};

process.on('unhandledRejection', (error) => {
  console.log(error.message);
  server.close(() => process.exit(1));
});

process.on('SIGTSTP', () => {
  console.log('server is suspended'.msg);
});

process.on('SIGINT', () => {
  console.log('terminating server...'.msg);
  server.close(() => process.exit(0));
});
