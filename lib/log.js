function Log(name) {
  this.name = name;

  Readable.call(this);

  this.setEncoding('utf-8');
};

util.inherits(Log, require('stream').Readable);

Log.prototype._read = function _read() {
  // We don't actually have to do anything here, because we don't support flow
  // control, anything written to the log is already present and readable.
};

Log.prototype.log = function log() {
  var msg = util.format.apply(null, arguments);
  debug('log %s: log <%s>', this.name, msg);
  this.push(msg, 'utf8');
};

Log.prototype.write = function write(data) {
  debug('log %s: write <%s>', this.name, data);
  this.push(data, 'utf8');
};

