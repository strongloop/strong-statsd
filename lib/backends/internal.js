// Copyright (C) 2014 Strongloop, see LICENSE.md
var assert = require('assert');
var control = require('strong-control-channel/process');

if (!process.send) {
  // This occurs during unit tests, strong-statsd always spawns with ipc
  console.error('statsd internal backend requires ipc');
} else {
  var channel = control.attach();
}

function InternalBackend(startupTime, config, emitter) {
  emitter.on('flush', function(timestamp, metrics) {
    var msg = {
      cmd: 'metrics',
      metrics: munge(timestamp, metrics),
    };

    channel.notify(msg, function(rsp) {});
  });

  return true; // Required to indicate success
}

// We'll strip the scope prefix, so the front-end doesn't see it, and can query
// metrics based on the app/host/id metadata without having to do its own
// parsing of the names.
//
// Match `app.host.(worker id).(metric)`, we discard app and host, because it
// could theoreticaly vary by metric (though that would likely be a bug), but we
// need the worker ID, and the metric name.
//
// This is here to guarantee the rx is compiled only once.
var SCOPERX = /[^.]+\.[^.]+\.([^.]+)\.(.*)/;

function munge(timestamp, metrics) {
  var processes = {};
  var batch = {
    processes: processes,
    timestamp: timestamp,
  };

  read('counters');
  read('timers');
  read('gauges');

  return batch;

  function read(type) {
    var all = metrics[type];
    for (var name in all) {
      read1(type, name, all[name]);
    }
  }

  function read1(type, name, value) {
    var rx = SCOPERX.exec(name);

    if (!rx) return; // statsd internal metrics have no scope

    var wid = rx[1];
    var name = rx[2];

    assert(wid.length, 'wid too short: ' + name);
    assert(name.length, 'name too short: ' + name);

    var p = processes[wid] || (processes[wid] = {
      counters: {}, timers: {}, gauges: {}
    });
    var t = p[type];

    t[name] = value;
  }
}

exports.init = InternalBackend;
exports.munge = munge; // Exposed for use by unit tests
