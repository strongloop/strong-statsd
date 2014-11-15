var tap = require('tap');
var Statsd = require('../');

function checkUrl(url, port, host, scope) {
  tap.test(url, function(t) {
    var server = Statsd();
    t.equal(server.backend(url), server, 'returns this');
    t.deepEqual(server.config.backends, [], 'backend');
    t.deepEqual(server.statsdPort, port, 'port');
    t.deepEqual(server.statsdHost, host, 'host');
    t.deepEqual(server.statsdScope, scope, 'scope');
    t.end();
  });
};

checkUrl('statsd', 8125, 'localhost', '');
checkUrl('statsd:', 8125, 'localhost', '');
checkUrl('statsd://', 8125, 'localhost', '');
checkUrl('statsd://example', 8125, 'example', '');
checkUrl('statsd://:7', 7, 'localhost', '');
checkUrl('statsd:///scope', 8125, 'localhost', 'scope');
checkUrl('statsd://example:7/', 7, 'example', '');
checkUrl('statsd://example:7', 7, 'example', '');
checkUrl('statsd://example/scope', 8125, 'example', 'scope');
checkUrl('statsd://:7/scope', 7, 'localhost', 'scope');
checkUrl('statsd://example:7/scope', 7, 'example', 'scope');
checkUrl('statsd:example', 8125, 'example', '');
checkUrl('statsd:/scope', 8125, 'localhost', 'scope');
checkUrl('statsd:example:7/', 7, 'example', '');
checkUrl('statsd:example:7', 7, 'example', '');
checkUrl('statsd:example/scope', 8125, 'example', 'scope');
checkUrl('statsd:example:7/scope', 7, 'example', 'scope');


process.on('exit', function(code) {
  if (code == 0) console.log('PASS');
});
