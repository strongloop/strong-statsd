var assert = require('assert');
var statsd = require('../')({debug: true, silent: true});
var started = false;

// Not enough to hold node alive... but don't unref until AFTER child is
// started... otherwise parent process might prematurely exit, because there is
// nothing keeping it alive.
statsd.start(function(er) {
  console.log('started on', statsd.port);
  if (er) throw er;
  assert(statsd.port > 0);
  started = true;
});

process.on('exit', function() {
  assert.equal(started, true);
});
