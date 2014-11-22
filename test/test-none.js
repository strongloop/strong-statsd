// Copyright (C) 2014 Strongloop, see LICENSE.md
var assert = require('assert');
var Statsd = require('../');
var statsd = new Statsd({debug: true, silent: true, flushInterval: 2});

assert.equal(statsd.port, 0);

var metric = 'foo.count';

// FIXME should refuse to start with no backends!
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

process.on('exit', function(code) {
  if (code == 0) console.log('PASS');
});
