const fs = require('fs');
const open = require('open');
const axios = require('axios').default;
const colors = require('colors');
const express = require('express');

require('dotenv').config();

const app = express();

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const slackToken = process.env.SLACK_TOKEN;

colors.setTheme({
  msg: ['grey', 'bold'],
  info: 'green',
  warn: 'yellow',
  error: 'red',
  listening: ['magenta', 'bold'],
});

const port = 3001;
const basicAuth = `Basic ${Buffer.from(spotifyClientId + ':' + spotifyClientSecret).toString('base64')}`;
const callbackURL = `http://localhost:${port}/callback`;
const tokenFileName = 'token.json';

let spotifyMonitorTimer = null;

const axiosSpotifyAccount = axios.create({
  baseURL: 'https://accounts.spotify.com/api/token',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: basicAuth,
  },
});

const axiosSpotifyApi = axios.create({
  baseURL: 'https://api.spotify.com',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
});

const updateSlackStatus = (statusText = '', statusEmoji = '') => {
  console.log('-> updating slack status...'.msg);
  const profile = { status_text: statusText, status_emoji: statusEmoji };
  axios({
    method: 'post',
    url: 'https://slack.com/api/users.profile.set',
    data: { profile },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${slackToken}`,
    },
  })
    .then(({ data }) => {
      if (data.ok) {
        console.log('-> slack status successfully updated'.info);
        console.log(`-> playing: ${statusText} 🎧`.listening);
      } else {
        console.log('-> an error occurred when updating slack status'.error);
        console.log(data);
      }
    })
    .catch(handleAxiosException);
};

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
      startMonitoringSpotify();
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
      console.log(`-> updated access token! in ${tokenFileName}`.info);
      startMonitoringSpotify();
    })
    .catch(handleAxiosException);
};

const startMonitoringSpotify = () => {
  console.log(`-> checking for currently playing`.msg);
  axiosSpotifyApi({
    method: 'get',
    url: '/v1/me/player/currently-playing',
    headers: { Authorization: `Bearer ${savedSpotifyAccessToken().access_token}` },
  })
    .then(({ data }) => {
      if (data === '' || !data.is_playing) {
        console.log('-> nothing is playing'.warn);
        updateSlackStatus();
        setTimeout(() => startMonitoringSpotify(), 30000);
      } else {
        const currentlyPlaying = `${data.item.artists[0].name} - ${data.item.name}`;
        spotifyMonitorTimer = data.item.duration_ms - data.progress_ms + 2000;
        updateSlackStatus(currentlyPlaying, ':musical_note:');
        setTimeout(() => startMonitoringSpotify(), spotifyMonitorTimer);
      }
    })
    .catch((error) => {
      if (error?.response.status === 401) {
        console.log(`-> ${error.response.message}`.warn);
        console.log(`-> refreshing access token...`.msg);
        refreshSpotifyToken();
        console.log(`-> access token refreshed!`.info);
        startMonitoringSpotify();
      } else {
        handleAxiosException(error);
      }
    });
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

process.on('SIGTSTP', () => {
  console.log('-> suspending server'.msg);
  updateSlackStatus();
});

process.on('SIGCONT', () => {
  console.log('-> resuming server...'.msg);
  startMonitoringSpotify();
});

process.on('SIGINT', () => {
  console.log('-> reseting slack status before closing server...'.msg);
  updateSlackStatus();
  setTimeout(() => {
    server.close(() => process.exit(0));
  }, 1000);
});
