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
- scope: prefix to add before all metric names (default is `""`, but also,
  if the `statsd:` backend URL is used, it can provide a scope that will
  override this option)
- expandScope: function to call on scope before using it as a prefix

### statsd.backend(url)

Specify one or more backends.

Backend URL formats:

- `statsd://[<host>][:<port>][/<scope>]`: publish to a statsd server, this isn't
  a backend, its a direct UDP publish, and it can not be combined with the other
  backends below. In other words, you can use backends, or raw statsd, but not
  both (for now).

- `console:[?pretty[=<true|false>]]`: json dump to console, mostly useful for
  testing and debugging. Pretty output is formatted as multi-line with color,
  otherwise it's single line.

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

### statsd.url

A `statsd:` URL that contains the PORT and (unexpanded) scope that should be
published to. The publish is usually done by `.send()`, but this URL may
be useful for display or debug purposes.

### statsd.send(name, value)

Send statsd metric with name and value. Metrics are discarded until statsd
is started.

### statsd.stop(callback)

Stop the statsd child, callback indicates it has exited.

Stopping is optional, the child will self-exit when the parent process exits.
