'use latest';

const request = require('request'),
  {Client} = require('pg');

module.exports = function(ctx, cb) {
  const client = new Client(ctx.data.DATABASE_URL);
  var selectAccessToken = {
      name: 'SELECT_TOKENS',
      text: "SELECT access_token FROM tokens",
      values: []
    },
    insertCurrentTrack = {
      name: 'INSERT_CURRENT_TRACK',
      text: "INSERT INTO current_track (id, artist, album, song) VALUES ($1, $2, $3, $4)",
      values: []
    },
    currentSong = null,
    previousSong = null;

  client.connect();

  console.log('requesting current song...');
  client.query(selectAccessToken, function(err, res) {
    if (err) {
      console.log(err);
      return cb(err);
    }

    let options = {
      url: 'https://api.spotify.com/v1/me/player/currently-playing',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + res.rows[0].access_token
      }
    };
    request(options, function callback(error, response, body) {
      if (!error && response.statusCode === 200) {
        let info = JSON.parse(body);
        currentSong = info.item.id;
        ctx.storage.get(function (error, data) {
          previousSong = data.previous_song;
          if (currentSong !== previousSong) {
            console.log('new song, saving it...');
            insertCurrentTrack.values = [currentSong, info.item.artists[0].name, info.item.album.name, info.item.name];
            client.query(insertCurrentTrack, function(err, res) {
              if (err) console.log(err);
              previousSong = {
                previous_song: currentSong
              };
              ctx.storage.set(previousSong, function (error) {
                if (error) return cb(error);
                return cb();
              });
            })
          }
          else return cb();
        });
      }
    });
  });
};