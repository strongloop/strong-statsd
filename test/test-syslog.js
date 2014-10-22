var assert = require('assert');
var statsd = require('../');
var tap = require('tap');

function checkUrl(url, application, priority) {
  tap.test(url, function(t) {
    var server = statsd();
    t.equal(server.backend(url), server, 'returns this');
    t.deepEqual(server.config.dumpMessages, true, 'backend');
    t.deepEqual(server.config.log.backend, 'syslog', 'backend');
    t.deepEqual(server.config.log.application, application, 'application');
    t.deepEqual(server.config.log.level, priority, 'priority');
    t.end();
  });
};

checkUrl('syslog', 'statsd', 'LOG_INFO');
checkUrl('syslog:', 'statsd', 'LOG_INFO');
checkUrl('syslog:?', 'statsd', 'LOG_INFO');
checkUrl('syslog:?application=app', 'app', 'LOG_INFO');
checkUrl('syslog:?priority=LOG_WARNING', 'statsd', 'LOG_WARNING');
checkUrl('syslog:?application=X&priority=LOG_WARNING', 'X', 'LOG_WARNING');
checkUrl('syslog:?application=X&priority=LOG_WARNING', 'X', 'LOG_WARNING');

tap.test('priority invalid', function(t) {
  var server = statsd();
  try {
    server.backend('syslog:?priority=LOG_WARN');
  } catch(er) {
    t.equal(er.message, 'syslog priority invalid');
    t.end();
  }
});


tap.test('syslog output', function(t) {
  var server = statsd({silent: false, debug: true});
  server.backend('syslog');

  server.start(function(er) {
    t.ifError(er);
  });

  // No robust way to check for syslog output, just wait
  // a while to make sure it doesn't crash.
  setTimeout(function() {
    server.stop();
  }, 2*1000);

  server.child.on('exit', function() {
    t.end();
  });
});

process.on('exit', function() {
  console.log('PASS');
});
