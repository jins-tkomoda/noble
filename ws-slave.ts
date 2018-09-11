import * as debugModule from 'debug';
import * as WebSocket from 'ws';

import * as noble from './index';
import { Characteristic } from './lib/characteristic';
import { Descriptor } from './lib/descriptor';
import { Peripheral } from './lib/peripheral';
import { Service } from './lib/service';

const debug = debugModule('slave');

const serverMode = !process.argv[2];
const port = 0xB1e;
const host = process.argv[2];


let ws: WebSocket;
let wss: WebSocket.Server;

interface WsSlaveCharacteristic {
  uuid: string;
  properties: string[];
}

if (serverMode) {
  debug('noble - ws slave - server mode');
  wss = new WebSocket.Server({
    port: 0xB1e
  });

  wss.on('connection', (ws_: WebSocket) => {
    debug('ws -> connection');

    ws = ws_;

    ws.on('message', onMessage);

    ws.on('close', () => {
      debug('ws -> close');
      noble.stopScanning();
    });

    noble.on('stateChange', (state) => {
      sendEvent({
        type: 'stateChange',
        state: state
      });
    });

    // Send poweredOn if already in this state.
    if (noble._state === 'poweredOn') {
      sendEvent({
        type: 'stateChange',
        state: 'poweredOn'
      });
    }


  });
} else {
  ws = new WebSocket(`ws://${host}:${port}`);

  ws.on('open', () => {
    debug('ws -> open');
  });

  ws.on('message', (message) => {
    onMessage(message);
  });

  ws.on('close', () => {
    debug('ws -> close');

    noble.stopScanning();
  });
}

const peripherals = {} as any;

// TODO: open/close ws on state change

function sendEvent(event: any) {
  const message = JSON.stringify(event);

  debug(`ws -> send: ${message}`);

  const clients = serverMode ? wss.clients : new Set([ws]);

  clients.forEach(client => client.send(message));
}

const onMessage = function(message: any) {
  debug(`ws -> message: ${message}`);

  const command = JSON.parse(message);

  const action = command.action;
  const peripheralUuid = command.peripheralUuid;
  const serviceUuids = command.serviceUuids;
  const serviceUuid = command.serviceUuid;
  const characteristicUuids = command.characteristicUuids;
  const characteristicUuid = command.characteristicUuid;
  const data = command.data ? Buffer.from(command.data, 'hex') : null;
  const withoutResponse = command.withoutResponse;
  const broadcast = command.broadcast;
  const notify = command.notify;
  const descriptorUuid = command.descriptorUuid;
  const handle = command.handle;

  const peripheral = peripherals[peripheralUuid];
  let service;
  let characteristic;
  let descriptor;


  if (peripheral && serviceUuid) {
    const services = peripheral.services;

    for (const i in services) {
      if (services[i].uuid === serviceUuid) {
        service = services[i];

        if (characteristicUuid) {
          const characteristics = service.characteristics;

          for (const j in characteristics) {
            if (characteristics[j].uuid === characteristicUuid) {
              characteristic = characteristics[j];

              if (descriptorUuid) {
                const descriptors = characteristic.descriptors;

                for (const k in descriptors) {
                  if (descriptors[k].uuid === descriptorUuid) {
                    descriptor = descriptors[k];
                    break;
                  }
                }
              }
              break;
            }
          }
        }
        break;
      }
    }
  }

  if (action === 'startScanning') {
    noble.startScanning(serviceUuids, command.allowDuplicates);
  } else if (action === 'stopScanning') {
    noble.stopScanning();
  } else if (action === 'connect') {
    peripheral.connect();
  } else if (action === 'disconnect') {
    peripheral.disconnect();
  } else if (action === 'updateRssi') {
    peripheral.updateRssi();
  } else if (action === 'discoverServices') {
    peripheral.discoverServices(command.uuids);
  } else if (action === 'discoverIncludedServices') {
    service.discoverIncludedServices(serviceUuids);
  } else if (action === 'discoverCharacteristics') {
    service.discoverCharacteristics(characteristicUuids);
  } else if (action === 'read') {
    characteristic.read();
  } else if (action === 'write') {
    characteristic.write(data, withoutResponse);
  } else if (action === 'broadcast') {
    characteristic.broadcast(broadcast);
  } else if (action === 'notify') {
    characteristic.notify(notify);
  } else if (action === 'discoverDescriptors') {
    characteristic.discoverDescriptors();
  } else if (action === 'readValue') {
    descriptor.readValue();
  } else if (action === 'writeValue') {
    descriptor.writeValue(data);
  } else if (action === 'readHandle') {
    peripheral.readHandle(handle);
  } else if (action === 'writeHandle') {
    peripheral.writeHandle(handle, data, withoutResponse);
  }
};

noble.on('discover', (peripheral) => {
  peripherals[peripheral.uuid] = peripheral;

  peripheral.on('connect', function() {
    sendEvent({
      type: 'connect',
      peripheralUuid: peripheral.uuid
    });
  });

  peripheral.on('disconnect', function() {
    sendEvent({
      type: 'disconnect',
      peripheralUuid: peripheral.uuid
    });

    for (const i in peripheral.services) {
      for (const j in peripheral.services[i].characteristics) {
        for (const k in peripheral.services[i].characteristics[j].descriptors) {
          peripheral.services[i].characteristics[j].descriptors[k].removeAllListeners();
        }

        peripheral.services[i].characteristics[j].removeAllListeners();
      }
      peripheral.services[i].removeAllListeners();
    }

    peripheral.removeAllListeners();
  });

  peripheral.on('rssiUpdate', function(rssi: number) {
    sendEvent({
      type: 'rssiUpdate',
      peripheralUuid: peripheral.uuid,
      rssi: rssi
    });
  });

  peripheral.on('servicesDiscover', function(this: Peripheral, services: Service[]) {
    const peripheral = this;
    const serviceUuids: string[] = [];

    const includedServicesDiscover = function(this: Service, includedServiceUuids: string[]) {
      sendEvent({
        type: 'includedServicesDiscover',
        peripheralUuid: peripheral.uuid,
        serviceUuid: this.uuid,
        includedServiceUuids: includedServiceUuids
      });
    };

    const characteristicsDiscover = function(this: Service, characteristics: Characteristic[]) {
      const service = this;
      const discoveredCharacteristics: WsSlaveCharacteristic[] = [];

      const read = function(this: Characteristic, data: Buffer, isNotification: boolean) {
        const characteristic = this;

        sendEvent({
          type: 'read',
          peripheralUuid: peripheral.uuid,
          serviceUuid: service.uuid,
          characteristicUuid: characteristic.uuid,
          data: data.toString('hex'),
          isNotification: isNotification
        });
      };

      const write = function(this: Characteristic) {
        const characteristic = this;

        sendEvent({
          type: 'write',
          peripheralUuid: peripheral.uuid,
          serviceUuid: service.uuid,
          characteristicUuid: characteristic.uuid
        });
      };

      const broadcast = function(this: Characteristic, state: string) {
        const characteristic = this;

        sendEvent({
          type: 'broadcast',
          peripheralUuid: peripheral.uuid,
          serviceUuid: service.uuid,
          characteristicUuid: characteristic.uuid,
          state: state
        });
      };

      const notify = function(this: Characteristic, state: string) {
        const characteristic = this;

        sendEvent({
          type: 'notify',
          peripheralUuid: peripheral.uuid,
          serviceUuid: service.uuid,
          characteristicUuid: characteristic.uuid,
          state: state
        });
      };

      const descriptorsDiscover = function(this: Characteristic, descriptors: Descriptor[]) {
        const characteristic = this;

        const discoveredDescriptors: string[] = [];

        const valueRead = function(this: Descriptor, data: Buffer) {
          const descriptor = this;

          sendEvent({
            type: 'valueRead',
            peripheralUuid: peripheral.uuid,
            serviceUuid: service.uuid,
            characteristicUuid: characteristic.uuid,
            descriptorUuid: descriptor.uuid,
            data: data.toString('hex')
          });
        };

        const valueWrite = function(this: Descriptor, data: Buffer) {
          const descriptor = this;

          sendEvent({
            type: 'valueWrite',
            peripheralUuid: peripheral.uuid,
            serviceUuid: service.uuid,
            characteristicUuid: characteristic.uuid,
            descriptorUuid: descriptor.uuid
          });
        };

        for (const k in descriptors) {
          descriptors[k].on('valueRead', valueRead);

          descriptors[k].on('valueWrite', valueWrite);

          discoveredDescriptors.push(descriptors[k].uuid);
        }

        sendEvent({
          type: 'descriptorsDiscover',
          peripheralUuid: peripheral.uuid,
          serviceUuid: service.uuid,
          characteristicUuid: this.uuid,
          descriptors: discoveredDescriptors
        });
      };

      for (const characteristic of characteristics) {
        characteristic.on('read', read);

        characteristic.on('write', write);

        characteristic.on('broadcast', broadcast);

        characteristic.on('notify', notify);

        characteristic.on('descriptorsDiscover', descriptorsDiscover);

        discoveredCharacteristics.push({
          uuid: characteristic.uuid,
          properties: characteristic.properties
        });
      }

      sendEvent({
        type: 'characteristicsDiscover',
        peripheralUuid: peripheral.uuid,
        serviceUuid: this.uuid,
        characteristics: discoveredCharacteristics
      });
    };

    for (const i in services) {
      services[i].on('includedServicesDiscover', includedServicesDiscover);

      services[i].on('characteristicsDiscover', characteristicsDiscover);

      serviceUuids.push(services[i].uuid);
    }

    sendEvent({
      type: 'servicesDiscover',
      peripheralUuid: peripheral.uuid,
      serviceUuids: serviceUuids
    });
  });

  peripheral.on('handleRead', function(handle: number, data: Buffer) {
    sendEvent({
      type: 'handleRead',
      peripheralUuid: peripheral.uuid,
      handle: handle,
      data: data.toString('hex')
    });
  });

  peripheral.on('handleWrite', function(handle: number) {
    sendEvent({
      type: 'handleWrite',
      peripheralUuid: peripheral.uuid,
      handle: handle
    });
  });

  peripheral.on('handleNotify', function(handle: number, data: Buffer) {
    sendEvent({
      type: 'handleNotify',
      peripheralUuid: peripheral.uuid,
      handle: handle,
      data: data.toString('hex')
    });
  });

  sendEvent({
    type: 'discover',
    peripheralUuid: peripheral.uuid,
    address: peripheral.address,
    addressType: peripheral.addressType,
    connectable: peripheral.connectable,
    advertisement: {
      localName: peripheral.advertisement.localName,
      txPowerLevel: peripheral.advertisement.txPowerLevel,
      serviceUuids: peripheral.advertisement.serviceUuids,
      manufacturerData: (peripheral.advertisement.manufacturerData ? peripheral.advertisement.manufacturerData.toString('hex') : null),
      serviceData: (peripheral.advertisement.serviceData ? Buffer.from(peripheral.advertisement.serviceData).toString('hex') : null)
    },
    rssi: peripheral.rssi
  });
});
