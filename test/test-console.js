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
checkUrl('console:?color', true);
checkUrl('console:?color=true', true);
checkUrl('console:?color=anything', true);
checkUrl('console:?color=false', false);

tap.test('console output', function(t) {
  var server = statsd({silent: true});
  server.backend('console');

  server.start(function(er) {
    t.ifError(er);
  });

  var flushingStats;
  var jsonSeen;
  if (server.child.stdout) {
    server.child.stdout.on('data', function(line) {
      flushingStats = flushingStats || /Flushing stats at/.test(line);
      jsonSeen = jsonSeen || /counters: { '/.test(line);

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
