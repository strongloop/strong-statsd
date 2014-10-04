# strong-statsd

Control a statsd child process.

Uses strongloop-forks/strong-fork-statsd, a fork of etsy/statsd with support
for being controlled by a parent process.

## Usage

### Statsd = require('strong-statsd')

Constructor.

### statsd = Statsd(options)

Options:

- silent: whether to pipe stdio to parent, default is false, log to stdout
- debug: cause statsd to log debug messages

### statsd.backend(url)

Specify one or more backends.

Backend URL formats:

- `console:[?color[=<true|false>]]`: json dump to console, mostly useful for
  testing and debugging

- `graphite://[<host>][:<port>]`: forward to
  [graphite](http://graphite.readthedocs.org/en/latest/), host defaults to
  `"localhost"`, port defaults to `2003`

- `syslog:[?[application=<application>][,priority=<priority>]`: write to
  local system log using `syslog(3)`. The application defaults to `"statsd"`,
  and priority defaults to `"LOG_INFO"`, but can be set to any of `"LOG_DEBUG"`,
  `"LOG_INFO"`, `"LOG_NOTICE"`, `"LOG_WARNING"`, or `"LOG_CRIT"`.

- `splunk://[<host>]:<port>`: write using a UDP key value protocol to splunk,
  host defaults to localhost, and port is mandatory, since the protocol has no
  assigned port.
  
### statsd.start(callback)

Starts statsd child process, callback indicates when it is started, and the
statsd port is known.

### statsd.port

The port that the statsd server is listening on.

### statsd.stop(callback)

Stop the statsd child, callback indicates it has exited.
