var assert = require('assert');
var debug = require('debug')('strong-statsd:debug');
var fmt = require('util').format;
var fs = require('fs');
var statsd = require('../');
var tap = require('tap');

tap.test('internal backend', function(t) {
  var scope = 'app.host.3';
  var server = statsd({
    // scope expansion is MANDATORY for internal use
    scope: scope,
  });
  var startTime = Math.round(new Date().getTime() / 1000); // from statsd
  var pass;

  server.backend('internal');

  server.start(function(er) {
    var expectedUrl = fmt('statsd://:%d/%s', server.port, scope);
    t.ifError(er);
    t.assert(server.port > 0);
    t.equal(expectedUrl, server.url);
    t.assert(server.send('foo.count', -10));
    t.assert(server.send('foo.count', -9));
    t.assert(server.send('foo.timer', 123));
    t.assert(server.send('foo.timer', 7));
    t.assert(server.send('foo.value', 4));
    t.assert(server.send('foo.value', 4.5));
  });

  server.on('metrics', function(metrics) {
    debug('recv metrics: %j', metrics);
  });

  server.once('metrics', firstReport);

  var first;

  function firstReport(metrics) {
    first = metrics;
    t.assert(metrics.timestamp > startTime);
    t.deepEqual(Object.keys(metrics), ['processes', 'timestamp']);
    t.deepEqual(Object.keys(metrics.processes), ['3']);
    t.deepEqual(metrics.processes['3'], {
      counters: { 'foo.count': -19 }, // Note that counts are accumulated
      timers: { 'foo.timer': [7,123] }, // All timers are reported
      gauges: { 'foo.value': 4.5 }, // Only last gauge is reported
    });
    server.once('metrics', secondReport);
  }

  function secondReport(metrics) {
    t.assert(metrics.timestamp > first.timestamp);
    t.deepEqual(Object.keys(metrics), ['processes', 'timestamp']);
    t.deepEqual(Object.keys(metrics.processes), ['3']);
    t.deepEqual(metrics.processes['3'], {
      counters: { 'foo.count': 0 }, // XXX(sam) I think this is odd
      timers: { 'foo.timer': [] }, // No timers, so no values
      gauges: { 'foo.value': 4.5 }, // Last gauge value is sticky
    });
    server.stop();
    pass = true;
  }

  server.child.on('exit', function(code) {
    t.equal(code, 0);
    t.assert(pass);
    t.end();
  });
});

process.on('exit', function(code) {
  if (code == 0) console.log('PASS');
});
