var assert = require('assert');
var debug = require('debug')('strong-statsd');
var fork = require('child_process').fork;
var fs = require('fs');
var ipc = require('strong-control-channel/process');
var parse = require('url').parse;
var path = require('path');
var stats = require.resolve('strong-fork-statsd/stats.js');
var util = require('util');
var syslog = require('node-syslog'); // FIXME protect, or use strong-fork-syslog

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
  options = util._extend({}, options);
  this.port = 0;
  this.debug = !!options.debug;
  this.silent = !!options.silent;
  this.configFile = path.resolve('.statsd.json');
  this.config = {
    port: this.port,
    debug: this.debug,
    dumpMessages: this.debug,
    backends: [], // No backends is valid and useful, see syslog config
  };
}

Statsd.prototype.backend = function backend(url) {
  var backend;
  var config = {};
  var _ = parse(url, true);
  if (!_.protocol) {
    // bare word, such as 'console', or 'statsd'
    _.protocol = url + ':';
  }

  switch (_.protocol) {
    case 'console:': {
      backend = "./backends/console";
      config = {
        console: {
          prettyprint: 'color' in _.query && _.query.color !== 'false'
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
        return {error: 'splunk port missing'};
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
          return {error: 'syslog priority invalid'};
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
      return;
  }

  if (backend)
    this.config.backends.push(backend);
  this.config = util._extend(this.config, config);

  return this;
};

Statsd.prototype.start = function start(callback) {
  var self = this;

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
    callback();
  }

  this.child.unref();
  // XXX(sam) no documented way to unref the ipc channel :-(
  this.child._channel.unref();

  if (this.silent) {
    this.child.stdin.unref();
    this.child.stdout.unref();
    this.child.stderr.unref();

    // fork() documents an 'encoding' option, but doesn't implement it :-(
    this.child.stdout.setEncoding('utf-8');
    this.child.stderr.setEncoding('utf-8');
    this.child.stdout.on('data', function(data) {
      debug('stdout:', data.trim());
    });
    this.child.stderr.on('data', function(data) {
      debug('stderr:', data.trim());
    });
  }

  return this.child;
};

Statsd.prototype.stop = function stop(callback) {
  this.child.kill();
  if (callback)
    this.child.once('exit', callback);
};

function statsd(options) {
  return new Statsd(options);
}

module.exports = statsd;
