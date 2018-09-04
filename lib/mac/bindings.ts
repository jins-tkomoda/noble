import * as os from 'os';

const osRelease = parseFloat(os.release());
let binding;
if (osRelease < 14) {
  throw new Error('Mac OS versions earlier than Yosemite are no longer supported.');
} else if (osRelease < 15) {
  binding = require('./yosemite');
} else {
  binding = require('./highsierra');
}

export default binding;
