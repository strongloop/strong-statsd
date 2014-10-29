var assert = require('assert');
var dgram = require('dgram');
var tap = require('tap');
var util = require('util');
var Statsd = require('../');

tap.test('statsd output', function(t) {
  t.plan(4);

  var statsd = dgram.createSocket('udp4')

  statsd.bind(0);

  statsd.on('message', function(data) {
    var sawFoo = /APP.foo.count/.test(data);
    console.log('statsd done? %j <%s>', sawFoo, data);

    if (sawFoo) {
      statsd.close();
      server.stop(function() {
        console.log('statsd: closed');
        t.assert(sawFoo);
        t.end();
      });
    }
  });

  statsd.on('listening', statsdReady);

  var server = Statsd({
    silent: false,
    debug: true,
    scope: 'X',
    expandScope: expandScope
  });

  function expandScope(scope) {
    t.equal(scope, '%a');
    return 'APP';
  }

  var statsdPort;
  var statsdUrl;

  function statsdReady() {
    statsdPort = statsd.address().port;
    statsdUrl = util.format('statsd://:%d/%a', statsdPort);

    server.backend(statsdUrl);
    server.start(onStart);
  }

  function onStart(er) {
    t.ifError(er);
    t.assert(server.send('foo.count', 9));
    t.equal(server.url, util.format('statsd://localhost:%d/%a', statsdPort));
  }
});

process.on('exit', function(code) {
  if (code == 0) console.log('PASS');
});
