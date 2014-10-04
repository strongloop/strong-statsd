var assert = require('assert');
var dgram = require('dgram');
var net = require('net');
var statsd = require('../');
var tap = require('tap');
var util = require('util');

function checkUrl(url, port, host) {
  tap.test(url, function(t) {
    var server = statsd();
    t.equal(server.backend(url), server, 'returns this');
    t.deepEqual(server.config.backends, ['./backends/graphite'], 'backend');
    t.deepEqual(server.config.graphitePort, port, 'port');
    t.deepEqual(server.config.graphiteHost, host, 'host');
    t.deepEqual(server.config.graphite.legacyNamespace, false, 'legacy');
    t.end();
  });
};

checkUrl('graphite', 2003, 'localhost');
checkUrl('graphite:', 2003, 'localhost');
checkUrl('graphite://', 2003, 'localhost');
checkUrl('graphite://example', 2003, 'example');
checkUrl('graphite://example:7', 7, 'example');
checkUrl('graphite://example:', 2003, 'example');
checkUrl('graphite:example', 2003, 'example');
checkUrl('graphite:example:7', 7, 'example');
checkUrl('graphite:example:', 2003, 'example');


tap.test('graphite output', function(t) {
  var graphite = net.createServer(onConnect).listen(0);
  var udp = dgram.createSocket('udp4');

  function onConnect(sock) {
    sock.on('data', function(data) {
      var sawFoo = /stats.counters.foo/.test(data);
      console.log('graphite done? %j <%s>', sawFoo, data);

      if (sawFoo) {
        graphite.close(function() { console.log('graphite: closed'); });
        udp.close();
        server.stop(function() { console.log('statsd: closed'); });
        t.end();
      }
    });
  }

  graphite.on('listening', function() {
    var graphitePort = this.address().port;
    var graphiteUrl = util.format('graphite:localhost:%d', graphitePort)

    server.backend(graphiteUrl);
    server.start(onStart);
  });

  var server = statsd({silent: false, debug: true});

  function onStart(er) {
    var msg = new Buffer('foo:1|c');

    t.ifError(er);
    if (er) throw er;
    assert(server.port > 0);
    console.log('send `%s` to %d', msg, server.port);
    udp.send(msg, 0, msg.length, server.port, '127.0.0.1');
  }
});
