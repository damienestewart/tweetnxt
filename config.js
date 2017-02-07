// This configures the twitter client.
// The information here should be for the twitter account that
// you'll be monitoring for tweets. In otherwords, it will be for the
// robot's twitter account.

// You can find this information at https://apps.twitter.com after you
// create a new app.

var Twitter = require('twitter');

var client = new Twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: ''
});

module.exports = client;
