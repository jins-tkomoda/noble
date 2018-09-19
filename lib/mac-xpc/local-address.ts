import * as childProcess from 'child_process';

export const localAddress = (callback: (address?: string) => void) => {
  childProcess.exec('system_profiler SPBluetoothDataType', {}, (error, stdout, stderr) => {
    let address;

    if (!error) {
      const found = stdout.match(/\s+Address: (.*)/);
      if (found) {
        address = found[1].toLowerCase().replace(/-/g, ':');
      }
    }

    callback(address);
  });
};
