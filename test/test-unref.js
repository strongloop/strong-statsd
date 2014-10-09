var assert = require('assert');
var statsd = require('../')({debug: true, silent: true});

// Not enough to hold node alive
statsd.start(function(er) {
  console.log('started on', statsd.port);
  if (er) throw er;
  assert(statsd.port > 0);
});
