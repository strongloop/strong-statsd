var assert = require('assert');
var Statsd = require('../');
var statsd = new Statsd({debug: true, silent: true});

assert.equal(statsd.port, 0);

var metric = 'foo.count';

statsd.start(function(er) {
  console.log('started on', statsd.port);
  if (er) throw er;
  assert(statsd.port > 0);
  console.log('send `%s` to %d', metric, statsd.port);
  statsd.send(metric, 12);
});

statsd.child.stdout.on('data', function(data) {
  if (data.indexOf(metric) >= 0) {
    statsd.stop();
  }
});

process.on('exit', function() {
  console.log('PASS');
});
