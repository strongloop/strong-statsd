// Copyright (C) 2014 Strongloop, see LICENSE.md
var assert = require('assert');
var dgram = require('dgram');
var statsd = require('../');
var tap = require('tap');
var util = require('util');

function checkUrl(url, port, host) {
  tap.test(url, function(t) {
    var server = statsd();
    t.equal(server.backend(url), server, 'returns this');
    t.deepEqual(server.config.backends, ['statsd-udpkv-backend'], 'backend');
    t.deepEqual(server.config.udpkv.port, port, 'port');
    t.deepEqual(server.config.udpkv.host, host, 'host');
    t.end();
  });
};

checkUrl('splunk://:7', 7, 'localhost');
checkUrl('splunk://example:7', 7, 'example');
checkUrl('splunk:example:7', 7, 'example');

tap.test('port missing', function(t) {
  var server = statsd();
  try {
    server.backend('splunk://example');
  } catch(er) {
    t.equal(er.message, 'splunk port missing');
    t.end();
  }
});

tap.test('splunk output', function(t) {
  var splunk = dgram.createSocket('udp4')

  splunk.bind(0);

  splunk.on('message', function(data) {
    var sawFoo = /stat=foo/.test(data);
    console.log('splunk done? %j <%s>', sawFoo, data);

    if (sawFoo) {
      splunk.close();
      server.stop(function() {
        console.log('statsd: closed');
        t.end();
      });
    }
  });

  splunk.on('listening', splunkReady);

  var server = statsd({silent: false, debug: true});

  function splunkReady() {
    var splunkPort = splunk.address().port;
    var splunkUrl = util.format('splunk://:%d', splunkPort);

    server.backend(splunkUrl);
    server.start(onStart);
  }

  function onStart(er) {
    var msg = new Buffer('foo:1|c');

    t.ifError(er);
    if (er) throw er;
    t.assert(server.port > 0);
    t.assert(server.send('foo.count', 9));
  }
});

process.on('exit', function(code) {
  if (code == 0) console.log('PASS');
});
