// Copyright (C) 2014 Strongloop, see LICENSE.md
var assert = require('assert');
var fmt = require('util').format;

function SyslogBackend(startupTime, config, emitter, logger) {
  var config= config.syslog;
  var application = config.application;
  var priority = config.priority;
  var syslog = config.syslog;

  assert(application);
  assert(priority);
  assert(syslog);

  var flags = syslog.LOG_PID | syslog.LOG_ODELAY;

  priority = syslog[priority];

  // XXX(sam) LOCAL0 could be made configurable
  syslog.init(application, flags, syslog.LOG_LOCAL0);

  emitter.on('flush', function(timestamp, metrics) {
    var ts = new Date(startupTime / 1000).toISOString();
    write(ts, metrics.counters, 'count');
    write(ts, metrics.timers, 'ms');
    write(ts, metrics.gauges, 'gauge');

    function write(ts, metrics, type) {
      for (var name in metrics)
        syslog.log(priority, fmt('%s=%s (%s)', name, metrics[name], type));
    }
  });

  return true; // Required to indicate success
}

exports.init = SyslogBackend;
