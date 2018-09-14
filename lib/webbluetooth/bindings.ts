/* eslint-disable no-unused-vars */
import * as events from 'events';

import * as debugModule from 'debug';

import { NobleBindingsInterface } from '../bindings';

const debug = debugModule('webble-bindings');

function makeList(uuid: string | number) {
  return { services: [uuid] };
}

function addDashes(uuid: string | number) {
  if (!uuid || typeof uuid !== 'string') {
    return uuid;
  }
  if (uuid && uuid.length === 32) {
    uuid = `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16, 20)}-${uuid.substring(20)}`;
  }
  return uuid.toLowerCase();
}

function stripDashes(uuid: string | number) {
  if (typeof uuid === 'string') {
    uuid = uuid.split('-').join('');
  }
  return uuid;
}

export class NobleBindings extends events.EventEmitter implements NobleBindingsInterface {
  private _ble: Bluetooth;
  private _startScanCommand: null;
  private _peripherals: any;

  constructor(ble?: Bluetooth) {
    super();
    this._ble = ble || navigator.bluetooth;
    this._startScanCommand = null;
    this._peripherals = {};
  }

  public init() {
    process.nextTick(() => {
      debug('initing');
      if (!this._ble) {
        this.emit('error', new Error('This browser does not support WebBluetooth.'));
      } else {
        debug('emit powered on');
        this.emit('stateChange', 'poweredOn');
      }
    });
  }

  public startScanning(serviceUuids: string[] = [], allowDuplicates: boolean = false) {
    const uuids = serviceUuids.map((service: string | number) => {
      //web bluetooth requires 4 char hex service names to be passed in as integers
      if (typeof service === 'string' && service.length === 4) {
        service = parseInt(`0x${service}`);
      } else if (typeof service === 'string' && service.length === 6 && service.indexOf('0x') === 0) {
        service = parseInt(service);
      }
      return service;
    });

    const dashedUuids = uuids.map(addDashes);

    const filterList = dashedUuids.map(makeList);
    /*if(options.name){
      filterList.push({name: options.name});
    }
    if(options.namePrefix){
      filterList.push({namePrefix: options.namePrefix});
    }*/

    const options: RequestDeviceOptions = {
      filters: filterList,
    };

    debug('startScanning', options, allowDuplicates);

    this._ble
      .requestDevice(options)
      .then(device => {
        debug('scan finished', device);
        this.emit('scanStop', {});
        if (device) {
          const address = device.id;
          //TODO use device.adData when api is ready
          //const rssi = device.adData.rssi;
          this._peripherals[address] = {
            uuid: address,
            address: address,
            advertisement: { localName: device.name }, //advertisement,
            device: device,
            cachedServices: {} as { [uuid: string]: BluetoothRemoteGATTService[] },
            localName: device.name,
            serviceUuids: dashedUuids,
          };

          const rssi = 0;
          const paired = false;
          // const addressType = device.addressType;
          const addressType = 'public';
          // const paired = !device.paired
          /*
           if(device.adData){
            this._peripherals[address].rssi = device.adData.rssi;
           }
          */

          this.emit('discover', device.id, device.id, addressType, paired, this._peripherals[address].advertisement, rssi);
        }
      })
      .catch(err => {
        debug('err scanning', err);
        this.emit('scanStop', {});
        this.emit('error', err);
      });

    this.emit('scanStart');
  }

  public stopScanning() {
    this._startScanCommand = null;

    //TODO: need web api completed for this to work'=
    this.emit('scanStop');
  }

  public connect(deviceUuid: string) {
    debug('connect', deviceUuid);
    const peripheral = this._peripherals[deviceUuid];
    //clear any cached services in case this is a reconnect
    peripheral.cachedServices = {};

    // Attempts to connect to remote GATT Server.
    peripheral.device.gatt.connect().then(
      (gattServer: BluetoothRemoteGATTServer) => {
        debug('peripheral connected', gattServer);

        const onDisconnected = (event: Event) => {
          debug('disconnected', peripheral.uuid);
          this.emit('disconnect', peripheral.uuid);
        };
        peripheral.device.addEventListener('gattserverdisconnected', onDisconnected, { once: true });

        this.emit('connect', deviceUuid);
      },
      (err: Error) => {
        debug('err connecting', err);
        this.emit('connect', deviceUuid, err);
      }
    );
  }

  public disconnect(deviceUuid: string) {
    const peripheral = this._peripherals[deviceUuid];
    if (peripheral.device.gatt) {
      peripheral.device.gatt.disconnect();
      this.emit('disconnect', deviceUuid);
    }
  }

  public updateRssi(deviceUuid: string) {
    const peripheral = this._peripherals[deviceUuid];

    //TODO: need web api completed for this to work
    // this.emit('rssiUpdate', deviceUuid, rssi);
  }

  public discoverServices(deviceUuid: string, serviceUuids: string[] = []) {
    const peripheral = this._peripherals[deviceUuid];

    //TODO: need web api completed for this to work
    if (peripheral) {
      this.emit('servicesDiscover', deviceUuid, peripheral.serviceUuids);
    }
  }

  public discoverIncludedServices(deviceUuid: string, serviceUuid: string, serviceUuids: string[]) {
    const peripheral = this._peripherals[deviceUuid];

    //TODO impelment when web API has functionatility then emit response
    //this.emit('includedServicesDiscover', deviceUuid, serviceUuid, includedServiceUuids);
  }

  public discoverCharacteristics(deviceUuid: string, serviceUuid: string, characteristicUuids: string[]) {
    const peripheral = this._peripherals[deviceUuid];

    if (peripheral) {
      this.getPrimaryService(peripheral, serviceUuid)
        .then((service: BluetoothRemoteGATTService) => {
          return service.getCharacteristics();
        })
        .then((characteristics: BluetoothRemoteGATTCharacteristic[]) => {
          const discoveredCharacteristics = characteristics.map(char => {
            const charInfo = { uuid: stripDashes(char.uuid), properties: [] as string[] };

            if (char.properties.writeWithoutResponse) {
              charInfo.properties.push('writeWithoutResponse');
            }

            if (char.properties.write) {
              charInfo.properties.push('write');
            }

            if (char.properties.read) {
              charInfo.properties.push('read');
            }

            if (char.properties.notify) {
              charInfo.properties.push('notify');
            }

            return charInfo;
          });

          debug('discoverCharacteristics', deviceUuid, serviceUuid, discoveredCharacteristics);
          this.emit('characteristicsDiscover', deviceUuid, serviceUuid, discoveredCharacteristics);
        });
    }
  }

  public read(deviceUuid: string, serviceUuid: string, characteristicUuid: string) {
    const peripheral = this._peripherals[deviceUuid];
    debug('read', deviceUuid, serviceUuid, characteristicUuid);

    this.getPrimaryService(peripheral, serviceUuid)
      .then(service => {
        return service.getCharacteristic(addDashes(characteristicUuid));
      })
      .then(characteristic => {
        return characteristic.readValue();
      })
      .then(data => {
        this.emit('read', peripheral.uuid, serviceUuid, characteristicUuid, Buffer.from(data.buffer), false);
      })
      .catch(err => {
        debug('error reading characteristic', err);
        this.emit('error', err);
      });
  }

  public write(deviceUuid: string, serviceUuid: string, characteristicUuid: string, data: Buffer, withoutResponse: boolean = false) {
    const peripheral = this._peripherals[deviceUuid];
    debug('write', deviceUuid, serviceUuid, characteristicUuid, data, withoutResponse);

    this.getPrimaryService(peripheral, serviceUuid)
      .then(service => {
        return service.getCharacteristic(addDashes(characteristicUuid));
      })
      .then(characteristic => {
        return characteristic.writeValue(data);
      })
      .then(() => {
        debug('value written');
        this.emit('write', peripheral.uuid, serviceUuid, characteristicUuid);
      })
      .catch(err => {
        debug('error writing to characteristic', serviceUuid, characteristicUuid, err);
      });
  }

  public broadcast(deviceUuid: string, serviceUuid: string, characteristicUuid: string, broadcast: boolean) {
    const peripheral = this._peripherals[deviceUuid];

    //TODO impelment when web API has functionatility then emit response
    //this.emit('broadcast', deviceUuid, serviceUuid, characteristicUuid, state);
  }

  public notify(deviceUuid: string, serviceUuid: string, characteristicUuid: string, notify: boolean) {
    const peripheral = this._peripherals[deviceUuid];

    const charPromise = this.getPrimaryService(peripheral, serviceUuid).then(service => {
      return service.getCharacteristic(addDashes(characteristicUuid));
    });

    peripheral.notifcationListeners = peripheral.notifcationListeners || {};

    if (notify) {
      charPromise
        .then(characteristic => {
          return characteristic.startNotifications();
        })
        .then(characteristic => {
          debug('notifications started', characteristicUuid);
          peripheral.notifcationListeners[`${serviceUuid}__${characteristicUuid}`] = (evt: any) => {
            debug('oncharacteristicvaluechanged', evt, Buffer.from(evt.target.value.buffer));
            this.emit('read', deviceUuid, serviceUuid, characteristicUuid, Buffer.from(evt.target.value.buffer), true);
          };
          characteristic.addEventListener(
            'characteristicvaluechanged',
            peripheral.notifcationListeners[`${serviceUuid}__${characteristicUuid}`]
          );

          const onDisconnected = () => {
            characteristic.removeEventListener(
              'characteristicvaluechanged',
              peripheral.notifcationListeners[`${serviceUuid}__${characteristicUuid}`]
            );
            delete peripheral.notifcationListeners[`${serviceUuid}__${characteristicUuid}`];
          };
          peripheral.device.addEventListener('gattserverdisconnected', onDisconnected, { once: true });

          this.emit('notify', deviceUuid, serviceUuid, characteristicUuid, true);
          return characteristic;
        })
        .catch(err => {
          debug('error enabling notifications on characteristic', err);
          this.emit('error', err);
        });
    } else {
      charPromise
        .then(characteristic => {
          return characteristic.stopNotifications();
        })
        .then(characteristic => {
          debug('notifications stopped', characteristic);
          if (peripheral.notifcationListeners[`${serviceUuid}__${characteristicUuid}`]) {
            characteristic.removeEventListener(
              'characteristicvaluechanged',
              peripheral.notifcationListeners[`${serviceUuid}__${characteristicUuid}`]
            );
            delete peripheral.notifcationListeners[`${serviceUuid}__${characteristicUuid}`];
          }
          this.emit('notify', deviceUuid, serviceUuid, characteristicUuid, false);
          return characteristic;
        })
        .catch(err => {
          debug('error disabling notifications on characteristic', err);
          this.emit('error', err);
        });
    }
  }

  public discoverDescriptors(deviceUuid: string, serviceUuid: string, characteristicUuid: string) {
    const peripheral = this._peripherals[deviceUuid];

    //TODO impelment when web API has functionatility then emit response
    //this.emit('descriptorsDiscover', deviceUuid, serviceUuid, characteristicUuid, descriptors);
  }

  public readValue(deviceUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) {
    const peripheral = this._peripherals[deviceUuid];

    //TODO impelment when web API has functionatility then emit response
    //this.emit('valueRead', deviceUuid, serviceUuid, characteristicUuid, descriptorUuid, data);
  }

  public writeValue(deviceUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer) {
    const peripheral = this._peripherals[deviceUuid];

    //TODO impelment when web API has functionatility then emit response
    //this.emit('valueWrite', deviceUuid, serviceUuid, characteristicUuid, descriptorUuid);
  }

  public readHandle(deviceUuid: string, handle: number) {
    const peripheral = this._peripherals[deviceUuid];

    //TODO impelment when web API has functionatility then emit response
    //this.emit('handleRead', deviceUuid, handle, data);
  }

  public writeHandle(deviceUuid: string, handle: number, data: Buffer, withoutResponse: boolean = false) {
    const peripheral = this._peripherals[deviceUuid];

    //TODO impelment when web API has functionatility then emit response
    //this.emit('handleWrite', deviceUuid, handle);
  }

  private onOpen() {
    debug('on -> open');
  }

  private onClose() {
    debug('on -> close');

    this.emit('stateChange', 'poweredOff');
  }

  private getPrimaryService(peripheral: any, serviceUuid: string | number): Promise<BluetoothRemoteGATTService> {
    serviceUuid = addDashes(serviceUuid);

    if (peripheral.cachedServices[serviceUuid]) {
      return new Promise((resolve, reject) => {
        resolve(peripheral.cachedServices[serviceUuid]);
      });
    }

    return peripheral.device.gatt.getPrimaryService(serviceUuid).then((service: BluetoothRemoteGATTService) => {
      peripheral.cachedServices[serviceUuid] = service;
      return service;
    });
  }
}
