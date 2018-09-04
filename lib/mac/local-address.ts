import * as childProcess from 'child_process'

export default function localAddress(callback) {
  childProcess.exec('system_profiler SPBluetoothDataType', {}, (error, stdout, stderr) => {
    let address = null;

    if (!error) {
      const found = stdout.match(/\s+Address: (.*)/);
      if (found) {
        address = found[1].toLowerCase().replace(/-/g, ':');
      }
    }

    callback(address);
  });
}
