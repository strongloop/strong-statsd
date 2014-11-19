// Copyright (c) 2010-2014 Etsy, see LICENSE.etsy
// Copyright (C) 2014 Strongloop, see LICENSE.md
var debug = require('debug')('strong-statsd:udp');
var dgram  = require('dgram');
var server;

exports.start = function(config, callback){
  var udp_version = config.address_ipv6 ? 'udp6' : 'udp4';
  var port = 'port' in config ? config.port : 8125;
  server = dgram.createSocket(udp_version, callback);
  server.bind(port, config.address || undefined);

  server.on('listening', function() {
    var addr = this.address();
    debug('server: udp listening with %s on %s:%d',
        addr.family, addr.address, addr.port);
  });

  return server;
};
