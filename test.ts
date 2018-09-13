/* eslint-disable no-console */
import * as noble from './index';
import { Peripheral } from './lib/peripheral';
import { Characteristic } from './lib/characteristic';
console.log('noble');

noble.on('stateChange', state => {
  console.log(`on -> stateChange: ${state}`);

  if (state === 'poweredOn') {
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});

noble.on('scanStart', () => {
  console.log('on -> scanStart');
});

noble.on('scanStop', () => {
  console.log('on -> scanStop');
});

noble.on('discover', (peripheral: Peripheral) => {
  console.log(`on -> discover: ${peripheral}`);

  noble.stopScanning();

  peripheral.on('connect', () => {
    console.log('on -> connect');
    peripheral.updateRssi();
  });

  peripheral.on('disconnect', () => {
    console.log('on -> disconnect');
  });

  peripheral.on('rssiUpdate', (rssi: number) => {
    console.log(`on -> RSSI update ${rssi}`);
    peripheral.discoverServices();
  });

  peripheral.on('servicesDiscover', services => {
    console.log(`on -> peripheral services discovered ${services}`);

    const serviceIndex = 0;

    services[serviceIndex].on('includedServicesDiscover', (includedServiceUuids: string[]) => {
      console.log(`on -> service included services discovered ${includedServiceUuids}`);
      services[serviceIndex].discoverCharacteristics();
    });

    services[serviceIndex].on('characteristicsDiscover', (characteristics: Characteristic[]) => {
      console.log(`on -> service characteristics discovered ${characteristics}`);

      const characteristicIndex = 0;

      characteristics[characteristicIndex].on('read', (data: Buffer, isNotification: boolean) => {
        console.log(`on -> characteristic read ${data} ${isNotification}`);
        console.log(data);

        peripheral.disconnect();
      });

      characteristics[characteristicIndex].on('write', () => {
        console.log('on -> characteristic write ');

        peripheral.disconnect();
      });

      characteristics[characteristicIndex].on('broadcast', (state: string) => {
        console.log(`on -> characteristic broadcast ${state}`);

        peripheral.disconnect();
      });

      characteristics[characteristicIndex].on('notify', (state: string) => {
        console.log(`on -> characteristic notify ${state}`);

        peripheral.disconnect();
      });

      characteristics[characteristicIndex].on('descriptorsDiscover', descriptors => {
        console.log(`on -> descriptors discover ${descriptors}`);

        const descriptorIndex = 0;

        descriptors[descriptorIndex].on('valueRead', (data: Buffer) => {
          console.log(`on -> descriptor value read ${data}`);
          console.log(data);
          peripheral.disconnect();
        });

        descriptors[descriptorIndex].on('valueWrite', () => {
          console.log('on -> descriptor value write ');
          peripheral.disconnect();
        });

        descriptors[descriptorIndex].readValue();
        //descriptors[descriptorIndex].writeValue(Buffer.from([0]));
      });

      characteristics[characteristicIndex].read();
      //characteristics[characteristicIndex].write(Buffer.from('hello'));
      //characteristics[characteristicIndex].broadcast(true);
      //characteristics[characteristicIndex].notify(true);
      // characteristics[characteristicIndex].discoverDescriptors();
    });

    services[serviceIndex].discoverIncludedServices();
  });

  peripheral.connect();
});
