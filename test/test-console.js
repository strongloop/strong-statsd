var assert = require('assert');
var statsd = require('../');
var tap = require('tap');

function checkUrl(url, color) {
  tap.test(url, function(t) {
    var server = statsd();
    t.equal(server.backend(url), server, 'returns this');
    t.deepEqual(server.config.backends, ['./backends/console'], 'backend');
    t.deepEqual(server.config.console, {prettyprint: color}, 'config');
    t.end();
  });
};

checkUrl('console', false);
checkUrl('console:', false);
checkUrl('console:?', false);
checkUrl('console:?pretty', true);
checkUrl('console:?pretty=true', true);
checkUrl('console:?pretty=anything', true);
checkUrl('console:?pretty=false', false);

tap.test('console output', function(t) {
  var server = statsd({silent: true});
  server.backend('console');

  server.start(function(er) {
    t.ifError(er);
    t.assert(server.port > 0);
    t.assert(/^statsd:\/\/:\d+\/$/.test(server.url), server.url);
  });

  var flushingStats;
  var jsonSeen;
  if (server.child.stdout) {
    server.child.stdout.on('data', function(line) {
      flushingStats = flushingStats || /stats=/.test(line);
      jsonSeen = jsonSeen || /"counters":/.test(line);
      console.log('line<%s> %j %j', line, flushingStats, jsonSeen);

      if (flushingStats && jsonSeen)
        server.stop();
    });
  }

  server.child.on('exit', function() {
    t.assert(flushingStats, 'flushing stats');
    t.assert(jsonSeen, 'flushing counter json');
    t.end();
  });
});

process.on('exit', function() {
  console.log('PASS');
});
