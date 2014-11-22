// Copyright (C) 2014 Strongloop, see LICENSE.md

var EE = require('events').EventEmitter;
var dgram = require('dgram');
var util = require('util');

module.exports = Statsd;

function Statsd() {
  var self = new EE;
  var server = dgram.createSocket('udp4')

  server.bind(0);

  server.on('message', function(data) {
    self.emit('data', String(data));
  });

  server.on('listening', function() {
    self.url = util.format('statsd://:%d', this.address().port);
    console.log('listen:', this.address(), self.url);
    self.emit('listening');
  });

  server.on('error', function(er) {
    self.emit('error', er);
  });

  self.close = function(callback) {
    server.once('close', function() {
      self.emit('close');
    });
    if (callback) self.once('close', callback);
    server.close();
  };

  return self;
}
