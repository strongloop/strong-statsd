// Copyright (C) 2014 Strongloop, see LICENSE.md
var EventEmitter = require('events').EventEmitter;
var Log = require('./lib/log');
var Server = require('./lib/server');
var assert = require('assert');
var debug = require('debug')('strong-statsd');
var fmt = require('util').format;
var fork = require('child_process').fork;
var fs = require('fs');
var parse = require('url').parse;
var path = require('path');
var sender = require('strong-agent-statsd');
var util = require('util');

// FIXME use strong-fork-syslog
try { var syslog = require('node-syslog'); } catch (e) {}

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

  EventEmitter.call(this);

  options = util._extend({}, options);
  this.port = 0;
  this.debug = !!options.debug;
  this.expandScope = options.expandScope;
  this.statsdScope = options.scope || '';
  this.statsdHost = null;
  this.statsdPort = null;
  this.configFile = path.resolve('.statsd.json');
  this.flushInterval = (options.flushInterval || 15) * 1000;
  this.config = {
    port: this.port,
    debug: this.debug,
    flushInterval: this.flushInterval,
    dumpMessages: this.debug,
    backends: [], // No backends is valid and useful, see syslog config
  };
  this._send = null;
  this.server = null;
  this._socket = null;

  // XXX child.stdout/err structure for bacwards compat
  this.child = {
    stdout: new Log('stdout'),
    stderr: new Log('stderr'), // FIXME unused?
  };
  this.logger = {
    log: this.child.stdout.log.bind(this.child.stdout),
  };

}

util.inherits(Statsd, EventEmitter);

// XXX(sam) would be better to return a fully expanded URL (with all the
// defaults written in) then to return self
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
      backend = "./backends/repeater";
      config = {
        repeater: [{
          host: _.hostname || 'localhost',
          port: _.port || 8125,
        }]
      };
      break;
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
    case 'log:': {
      backend = require.resolve('./lib/backends/log');
      config = {
        log: {
          file: (_.hostname || '') + (_.pathname || ''),
          stdout: this.child.stdout,
        }
      };
      config.log.file = config.log.file || '-';
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
      backend = "./backends/splunk";
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
      if (!syslog) {
        return die('node-syslog not installed or not compiled');
      }
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
    case 'internal:': {
      backend = require.resolve('./lib/backends/internal');
      config = {
        internal: {
          notify: this.emit.bind(this, 'metrics'),
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

  debug('statsd config: %j', this.config);

  this.server = new Server;
  this.server.start(this.config, this.logger.log, onStart);

  function onStart(er, server) {
    if (er) return callback(er);

    self._socket = server;
    self.port = server.address().port;

    self._send = sender({
      port: self.port,
      host: 'localhost',
      scope: scope,
    });

    self.url = fmt('statsd://:%d/%s', self.port, self.statsdScope);

    callback();
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
  this.stopped = true;

  callback = callback || function(){};
  if (!this.server) {
    process.nextTick(callback);
    return;
  }
  this.server.stop(callback);
  this.server = null;
};

module.exports = Statsd;
