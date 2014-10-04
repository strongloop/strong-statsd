var assert = require('assert');
var statsd = require('../')({debug: true, silent:  true});
var udp = require('dgram').createSocket('udp4');

assert.equal(statsd.port, 0);

var msg = new Buffer('foo:1|c');

statsd.start(function(er) {
  console.log('started on', statsd.port);
  if (er) throw er;
  assert(statsd.port > 0);
  console.log('send `%s` to %d', msg, statsd.port);
  udp.send(msg, 0, msg.length, statsd.port, '127.0.0.1', function() {
    console.log('sent:', arguments);
  });
});

statsd.child.stdout.on('data', function(data) {
  if (data.indexOf(msg) >= 0) {
    udp.close();
    statsd.stop();
  }
});

process.on('exit', function() {
  console.log('PASS');
});
