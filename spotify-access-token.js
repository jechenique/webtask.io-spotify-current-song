'use latest';

const request = require('request'),
  {Client} = require('pg');

module.exports = function(ctx, cb) {
  const client = new Client(ctx.data.DATABASE_URL);
  var authOptions = null,
    accessToken = null,
    refreshToken = null,
    updateAccessToken = {
      name: 'UPDATE_TOKENS',
      text: "UPDATE tokens SET access_token = $1",
      values: []
    };

  client.connect();
  console.log('starting token job...');
  ctx.storage.get(function (error, data) {
    if (error) {
      console.log(error);
      return cb(error);
    }
    if (data.new_auth_options != '') {
      authOptions = data.new_auth_options;
    }
    else {
      authOptions = data.original_auth_options;
      authOptions.form.code = ctx.data.SPOTIFY_CODE;
    }
    authOptions.headers.Authorization = 'Basic ' + (new Buffer(ctx.data.SPOTIFY_CLIENT_ID + ':' + ctx.data.SPOTIFY_CLIENT_SECRET).toString('base64'));
    refreshToken = data.refresh_token;

    console.log('requesting access token...');
    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        accessToken = body.access_token;
        if (body.refresh_token !== undefined) {
          refreshToken = body.refresh_token;
        }

        updateAccessToken.values.push(accessToken);
        client.query(updateAccessToken, function(err, res) {
          if (err) {
            console.log(err);
            return cb(err);
          }
          let newData = {
            new_auth_options: {
              url: 'https://accounts.spotify.com/api/token',
              headers: {
                'Authorization': 'Basic ' + (new Buffer(ctx.data.SPOTIFY_CLIENT_ID + ':' + ctx.data.SPOTIFY_CLIENT_SECRET).toString('base64'))
              },
              form: {
                grant_type: 'refresh_token',
                refresh_token : refreshToken,
                redirect_uri: 'https://wt-34f0255d97fcdccd6a15f5e9fb9f10f3-0.run.webtask.io/hello'
              },
              json: true
            },
            refresh_token: refreshToken
          };
          ctx.storage.set(newData, function (error) {
            if (error) return cb(error);
            return cb();
          });
        })
      }
    });
  });
};