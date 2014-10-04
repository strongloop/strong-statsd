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
  var er = server.backend('splunk://example');
  t.equal(er.error, 'splunk port missing');
  t.end();
});

tap.test('splunk output', function(t) {
  var splunk = dgram.createSocket('udp4')
  var udp = dgram.createSocket('udp4');

  splunk.bind(0);

  splunk.on('message', function(data) {
    var sawFoo = /stat=foo/.test(data);
    console.log('splunk done? %j <%s>', sawFoo, data);

    if (sawFoo) {
      splunk.close();
      udp.close();
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
    assert(server.port > 0);
    console.log('send `%s` to %d', msg, server.port);
    udp.send(msg, 0, msg.length, server.port, '127.0.0.1');
  }
});
