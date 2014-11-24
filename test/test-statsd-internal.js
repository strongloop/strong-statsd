// Copyright (C) 2014 Strongloop, see LICENSE.md

var Server = require('./servers/statsd');
var Client = require('../');
var assert = require('assert');
var tap = require('tap');
var util = require('util');

tap.test('statsd internal', function(t) {
  t.plan(7);

  var server = Server();

  server.on('data', function(data) {
    var sawFoo = /APP.foo.count/.test(data);
    console.log('statsd done? %j <%s>', sawFoo, data);

    if (sawFoo) {
      server.close();
      client.stop(function() {
        console.log('statsd: closed');
        t.assert(sawFoo);
        t.end();
      });
    }
  });

  server.on('listening', statsdReady);

  var client = Client({
    silent: false,
    debug: true,
    scope: '%a',
    expandScope: expandScope,
    flushInterval: 2,
  });

  function expandScope(scope) {
    t.equal(scope, '%a');
    return 'APP';
  }

  function statsdReady() {
    client.backend(util.format('internal-statsd://:%d', server.port));
    client.start(onStart);
  }

  function onStart(er) {
    t.ifError(er);
    t.equal(client.port, 0);
    t.equal(client.server, null);
    t.assert(client.send('foo.count', 9));
    t.equal(client.url, util.format('internal-statsd://:%d', server.port));
  }
});

process.on('exit', function(code) {
  console.log('EXIT', code);
});