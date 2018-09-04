const Noble = require('./lib/noble');

module.exports = (bindings) => {
  return new Noble(bindings);
};
