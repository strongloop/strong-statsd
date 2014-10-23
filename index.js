var assert = require('assert');
var debug = require('debug')('strong-statsd');
var fork = require('child_process').fork;
var fs = require('fs');
var ipc = require('strong-control-channel/process');
var parse = require('url').parse;
var path = require('path');
var sender = require('strong-agent-statsd');
var stats = require.resolve('strong-fork-statsd/stats.js');
var syslog = require('node-syslog'); // FIXME protect, or use strong-fork-syslog
var util = require('util');

// Config template:
// {
//   // Start listening for statsd/udp on ephemeral port
//   port: 0,
// 
//   // Graphite configuration
//   backends: [ "./backends/graphite" ],
//   graphitePort: 2003,
//   graphiteHost: "localhost",
//   graphite: { legacyNamespace: false, },
// 
//   // Syslog configuration (should be a backend, but it isn't)
//   dumpMessages: true,
//   log: { backend: 'syslog', level: 'LOG_WARNING' },
// 
//   // Console configuration, useful for testing
//   backends: [ "./backends/console" ],
//   console: { prettyprint: true },
//
//   // splunk configuration:
//   //  https://github.com/dylanmei/statsd-udpkv-backend#configuration
// }

function Statsd(options) {
  if (!(this instanceof Statsd))
      return new Statsd(options);

  options = util._extend({}, options);
  this.port = 0;
  this.debug = !!options.debug;
  this.silent = !!options.silent;
  this.expandScope = options.expandScope;
  this.statsdScope = options.scope || '';
  this.statsdHost = null;
  this.statsdPort = null;
  this.configFile = path.resolve('.statsd.json');
  this.config = {
    port: this.port,
    debug: this.debug,
    dumpMessages: this.debug,
    backends: [], // No backends is valid and useful, see syslog config
  };
  this._send = null;
}

Statsd.prototype.backend = function backend(url) {
  var backend;
  var config = {};
  var _ = parse(url, true);
  if (!_.protocol) {
    // bare word, such as 'console', or 'statsd'
    _.protocol = url + ':';
    _.pathname = ''; // the bare word also shows up here, clear it
  }

  switch (_.protocol) {
    case 'statsd:': {
      if (this.config.backends.length) {
        return die('statsd is incompatible with other backends');
      }
      this.statsdHost = _.hostname || 'localhost';
      this.statsdPort = _.port || 8125;
      var scope = _.pathname;
      if (!scope || scope === '/') {
        // leave as default
      } else {
        // skip the leading '/'
        this.statsdScope = scope.slice(1);
      }

      // We won't be using a backend, return immediately.
      return this;
    }
    case 'debug:': {
      backend = "./backends/console";
      config = {
        console: {
          prettyprint: 'pretty' in _.query && _.query.pretty !== 'false'
        }
      };
      break;
    }
    case 'graphite:': {
      backend = "./backends/graphite";
      config = {
        graphitePort: _.port || 2003, // graphite default
        graphiteHost: _.hostname || 'localhost',
        graphite: {
          legacyNamespace: false
        }
      };
      break;
    }
    case 'splunk:': {
      if (!_.port) {
        return die('splunk port missing');
      }
      backend = "statsd-udpkv-backend";
      config = {
        udpkv: {
          host: _.hostname || 'localhost',
          port: _.port,
        },
      };
      break;
    }
    case 'syslog:': {
      // Called level in statsd config, but priority everywhere else. :-(
      var level = _.query.priority;
      if (level) {
        // Must be valid, or statsd/syslog will abort.
        if (!/^LOG_/.test(level) || !(level in syslog)) {
          return die('syslog priority invalid');
        }
      }
      // Note syslog doesn't use a backend, for some reason.
      config = {
        dumpMessages: true,
        log: {
          backend: 'syslog',
          application: _.query.application || 'statsd',
          level: level || 'LOG_INFO',
        },
      };
      break;
    }
    default:
      return die('url format unknown');
  }

  if (this.statsdHost)
    return die('statsd is incompatible with other backends');

  if (backend)
    this.config.backends.push(backend);
  this.config = util._extend(this.config, config);

  function die(error) {
    var er = Error(error);
    er.url = url;
    throw er;
  }

  return this;
};

Statsd.prototype.start = function start(callback) {
  var self = this;
  var scope = this.statsdScope;
  scope = this.expandScope ? this.expandScope(scope) : scope;

  if (this.statsdHost) {
    this._send = sender({
      port: this.statsdPort,
      host: this.statsdHost,
      scope: scope,
    });
    process.nextTick(callback);
    return this;
  }

  try {
    debug('statsd configfile %s: %j', this.configFile, this.config);
    fs.writeFileSync(this.configFile, JSON.stringify(this.config));
  } catch(er) {
    return callback(er);
  }

  this.child = fork(stats, [this.configFile], {silent: this.silent});

  var channel = ipc.attach(onRequest, this.child);

  function onRequest(req, respond) {
    debug('statsd receiving: %j', req);

    assert.equal(req.cmd, 'address');
    assert(!self.address);

    self.address = req.address;
    self.port = req.port;
    self.family = req.family;

    respond({message: 'ok'});

    self._send = sender({
      port: self.port,
      host: 'localhost',
      scope: scope,
    });

    self.url = util.format('statsd://:%d/%s', self.port, self.statsdScope);

    self.child.unref();
    // XXX(sam) no documented way to unref the ipc channel :-(
    self.child._channel.unref();

    if (self.silent) {
      self.child.stdin.unref();
      self.child.stdout.unref();
      self.child.stderr.unref();
    }

    callback();
  }

  if (this.silent) {
    // fork() documents an 'encoding' option, but doesn't implement it :-(
    this.child.stdout.setEncoding('utf-8');
    this.child.stderr.setEncoding('utf-8');
    this.child.stdout.on('data', function(data) {
      debug('stdout: <%s>', data.trim());
    });
    this.child.stderr.on('data', function(data) {
      debug('stderr: <%s>', data.trim());
    });
  }

  return this;
};

Statsd.prototype.send = function send(name, value) {
  if (this._send) {
    this._send(name, value);
    return true;
  }
  return false;
};

Statsd.prototype.stop = function stop(callback) {
  callback = callback || function(){};
  if (!this.child) {
    process.nextTick(callback);
    return;
  }
  this.child.kill();
  this.child.once('exit', callback);
};

module.exports = Statsd;
