var fs = require('fs');
var util = require('util');

function LogBackend(startupTime, config, emitter) {
  var config = config.log || {};
  var file = config.file || '-';
  var out;

  if (file === '-')
    out = process.stdout;
  else
    out = fs.createWriteStream(file, 'wa');

  emitter.on('flush', function(timestamp, metrics) {
    var ts = new Date(startupTime / 1000).toISOString();
    write(ts, metrics.counters, 'count');
    write(ts, metrics.timers, 'ms');
    write(ts, metrics.gauges, 'gauge');
  });

  function write(ts, metrics, type) {
    for (var name in metrics)
      out.write(util.format('%s %s=%s (%s)\n', ts, name, metrics[name], type));
  }

  return true; // Required to indicate success
}

exports.init = LogBackend;
