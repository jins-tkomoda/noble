import * as events from 'events';

import * as debugModule from 'debug';

import { NobleBindingsInterface } from './bindings';
import { Characteristic } from './characteristic';
import { Descriptor } from './descriptor';
import { Peripheral, Advertisement } from './peripheral';
import { Service } from './service';

const debug = debugModule('noble');

export class Noble extends events.EventEmitter {
  public _state: string;
  private initialized: boolean;
  private address: string;
  private _bindings: NobleBindingsInterface;
  private _peripherals!: { [peripheralUuid: string]: Peripheral };
  private _services!: { [peripheralUuid: string]: { [serviceUuid: string]: Service } };
  private _characteristics!: { [peripheralUuid: string]: { [serviceUuid: string]: { [characteristicUuid: string]: Characteristic } } };
  private _descriptors!: {
    [peripheralUuid: string]: { [serviceUuid: string]: { [characteristicUuid: string]: { [descriptorUuid: string]: Descriptor } } };
  };
  private _discoveredPeripheralUUids: string[];
  private _allowDuplicates: boolean;

  constructor(bindings: NobleBindingsInterface) {
    super();
    this.initialized = false;

    this.address = 'unknown';
    this._state = 'unknown';
    this._bindings = bindings;
    this._peripherals = {};
    this._services = {};
    this._characteristics = {};
    this._descriptors = {};
    this._discoveredPeripheralUUids = [];
    this._allowDuplicates = false;

    this._bindings.on('stateChange', this.onStateChange.bind(this));
    this._bindings.on('addressChange', this.onAddressChange.bind(this));
    this._bindings.on('scanStart', this.onScanStart.bind(this));
    this._bindings.on('scanStop', this.onScanStop.bind(this));
    this._bindings.on('discover', this.onDiscover.bind(this));
    this._bindings.on('connect', this.onConnect.bind(this));
    this._bindings.on('disconnect', this.onDisconnect.bind(this));
    this._bindings.on('rssiUpdate', this.onRssiUpdate.bind(this));
    this._bindings.on('servicesDiscover', this.onServicesDiscover.bind(this));
    this._bindings.on('includedServicesDiscover', this.onIncludedServicesDiscover.bind(this));
    this._bindings.on('characteristicsDiscover', this.onCharacteristicsDiscover.bind(this));
    this._bindings.on('read', this.onRead.bind(this));
    this._bindings.on('write', this.onWrite.bind(this));
    this._bindings.on('broadcast', this.onBroadcast.bind(this));
    this._bindings.on('notify', this.onNotify.bind(this));
    this._bindings.on('descriptorsDiscover', this.onDescriptorsDiscover.bind(this));
    this._bindings.on('valueRead', this.onValueRead.bind(this));
    this._bindings.on('valueWrite', this.onValueWrite.bind(this));
    this._bindings.on('handleRead', this.onHandleRead.bind(this));
    this._bindings.on('handleWrite', this.onHandleWrite.bind(this));
    this._bindings.on('handleNotify', this.onHandleNotify.bind(this));

    this.on('warning', message => {
      if (this.listeners('warning').length === 1) {
        console.warn(`noble: ${message}`); // eslint-disable-line no-console
      }
    });

    // lazy init bindings on first new listener, should be on stateChange
    this.on('newListener', event => {
      if (event === 'stateChange' && !this.initialized) {
        this.initialized = true;

        process.nextTick(() => {
          this._bindings.init();
        });
      }
    });

    // or lazy init bindings if someone attempts to get state first
    Object.defineProperties(this, {
      state: {
        get: function() {
          if (!this.initialized) {
            this.initialized = true;

            this._bindings.init();
          }
          return this._state;
        },
      },
    });
  }

  public startScanning(serviceUuids?: string[], allowDuplicates?: boolean): Promise<void>;
  public startScanning(serviceUuids?: string[], allowDuplicates?: boolean, callback?: (error?: Error) => void): void;
  public startScanning(
    serviceUuids: string[] = [],
    allowDuplicates: boolean = false,
    callback?: (error?: Error) => void
  ): void | Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      const scan = (state: string) => {
        if (state !== 'poweredOn') {
          const error = new Error(`Could not start scanning, state is ${state} (not poweredOn)`);

          reject(error);
        } else {
          this.once('scanStart', resolve);

          this._discoveredPeripheralUUids = [];
          this._allowDuplicates = allowDuplicates;

          this._bindings.startScanning(serviceUuids, allowDuplicates);
        }
      };

      // if bindings still not init, do it now
      if (!this.initialized) {
        this._bindings.init();
        this.initialized = true;
        this.once('stateChange', scan.bind(this));
      } else {
        scan.call(this, this._state);
      }
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  public stopScanning(): Promise<void>;
  public stopScanning(callback?: () => void): void;
  public stopScanning(callback?: () => void): void | Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      this.once('scanStop', resolve);

      if (this._bindings && this.initialized) {
        this._bindings.stopScanning();
      }
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  public connect(peripheralUuid: string) {
    this._bindings.connect(peripheralUuid);
  }

  public disconnect(peripheralUuid: string) {
    this._bindings.disconnect(peripheralUuid);
  }

  public updateRssi(peripheralUuid: string) {
    this._bindings.updateRssi(peripheralUuid);
  }

  public discoverServices(peripheralUuid: string, serviceUuids: string[] = []) {
    this._bindings.discoverServices(peripheralUuid, serviceUuids);
  }

  public discoverIncludedServices(peripheralUuid: string, serviceUuid: string, serviceUuids: string[]) {
    this._bindings.discoverIncludedServices(peripheralUuid, serviceUuid, serviceUuids);
  }

  public discoverCharacteristics(peripheralUuid: string, serviceUuid: string, characteristicUuids: string[]) {
    this._bindings.discoverCharacteristics(peripheralUuid, serviceUuid, characteristicUuids);
  }

  public read(peripheralUuid: string, serviceUuid: string, characteristicUuid: string) {
    this._bindings.read(peripheralUuid, serviceUuid, characteristicUuid);
  }

  public write(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, data: Buffer, withoutResponse: boolean) {
    this._bindings.write(peripheralUuid, serviceUuid, characteristicUuid, data, withoutResponse);
  }

  public broadcast(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, broadcast: boolean) {
    this._bindings.broadcast(peripheralUuid, serviceUuid, characteristicUuid, broadcast);
  }

  public notify(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, notify: boolean) {
    this._bindings.notify(peripheralUuid, serviceUuid, characteristicUuid, notify);
  }

  public discoverDescriptors(peripheralUuid: string, serviceUuid: string, characteristicUuid: string) {
    this._bindings.discoverDescriptors(peripheralUuid, serviceUuid, characteristicUuid);
  }

  public readValue(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) {
    this._bindings.readValue(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid);
  }

  public writeValue(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer) {
    this._bindings.writeValue(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data);
  }

  public readHandle(peripheralUuid: string, handle: number) {
    this._bindings.readHandle(peripheralUuid, handle);
  }

  public writeHandle(peripheralUuid: string, handle: number, data: Buffer, withoutResponse: boolean) {
    this._bindings.writeHandle(peripheralUuid, handle, data, withoutResponse);
  }

  private onStateChange(state: string) {
    debug(`stateChange ${state}`);

    this._state = state;

    this.emit('stateChange', state);
  }

  private onAddressChange(address: string) {
    debug(`addressChange ${address}`);

    this.address = address;
  }

  private onScanStart(filterDuplicates: boolean) {
    debug('scanStart');
    this.emit('scanStart', filterDuplicates);
  }

  private onScanStop() {
    debug('scanStop');
    this.emit('scanStop');
  }

  private onDiscover(uuid: string, address: string, addressType: string, connectable: boolean, advertisement: Advertisement, rssi: number) {
    let peripheral = this._peripherals[uuid];

    if (!peripheral) {
      peripheral = new Peripheral(this, uuid, address, addressType, connectable, advertisement, rssi);

      this._peripherals[uuid] = peripheral;
      this._services[uuid] = {};
      this._characteristics[uuid] = {};
      this._descriptors[uuid] = {};
    } else {
      // "or" the advertisment data with existing
      peripheral.advertisement = { ...peripheral.advertisement, ...advertisement };

      peripheral.connectable = connectable;
      peripheral.rssi = rssi;
    }

    const previouslyDiscoverd = this._discoveredPeripheralUUids.includes(uuid);

    if (!previouslyDiscoverd) {
      this._discoveredPeripheralUUids.push(uuid);
    }

    if (this._allowDuplicates || !previouslyDiscoverd) {
      this.emit('discover', peripheral);
    }
  }

  private onConnect(peripheralUuid: string, error?: Error) {
    const peripheral = this._peripherals[peripheralUuid];

    if (peripheral) {
      peripheral.state = error ? 'error' : 'connected';
      peripheral.emit('connect', error);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid} connected!`);
    }
  }

  private onDisconnect(peripheralUuid: string) {
    const peripheral = this._peripherals[peripheralUuid];

    if (peripheral) {
      peripheral.state = 'disconnected';
      peripheral.emit('disconnect');
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid} disconnected!`);
    }
  }

  private onRssiUpdate(peripheralUuid: string, rssi: number) {
    const peripheral = this._peripherals[peripheralUuid];

    if (peripheral) {
      peripheral.rssi = rssi;

      peripheral.emit('rssiUpdate', rssi);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid} RSSI update!`);
    }
  }

  private onServicesDiscover(peripheralUuid: string, serviceUuids: string[]) {
    const peripheral = this._peripherals[peripheralUuid];

    if (peripheral) {
      const services: Service[] = [];

      for (const serviceUuid of serviceUuids) {
        const service = new Service(this, peripheralUuid, serviceUuid);

        this._services[peripheralUuid][serviceUuid] = service;
        this._characteristics[peripheralUuid][serviceUuid] = {};
        this._descriptors[peripheralUuid][serviceUuid] = {};

        services.push(service);
      }

      peripheral.services = services;

      peripheral.emit('servicesDiscover', services);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid} services discover!`);
    }
  }

  private onIncludedServicesDiscover(peripheralUuid: string, serviceUuid: string, includedServiceUuids: string[]) {
    const service = this._services[peripheralUuid][serviceUuid];

    if (service) {
      service.includedServiceUuids = includedServiceUuids;

      service.emit('includedServicesDiscover', includedServiceUuids);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid}, ${serviceUuid} included services discover!`);
    }
  }

  private onCharacteristicsDiscover(peripheralUuid: string, serviceUuid: string, characteristics: Characteristic[]) {
    const service = this._services[peripheralUuid][serviceUuid];

    if (service) {
      const newCharacteristics: Characteristic[] = [];

      for (const characteristic of characteristics) {
        const characteristicUuid = characteristic.uuid;

        const newCharacteristic = new Characteristic(this, peripheralUuid, serviceUuid, characteristicUuid, characteristic.properties);

        this._characteristics[peripheralUuid][serviceUuid][characteristicUuid] = newCharacteristic;
        this._descriptors[peripheralUuid][serviceUuid][characteristicUuid] = {};

        newCharacteristics.push(newCharacteristic);
      }

      service.characteristics = newCharacteristics;

      service.emit('characteristicsDiscover', newCharacteristics);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid}, ${serviceUuid} characteristics discover!`);
    }
  }

  private onRead(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, data: Buffer, isNotification: boolean) {
    const characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

    if (characteristic) {
      characteristic.emit('data', data, isNotification);

      characteristic.emit('read', data, isNotification); // for backwards compatbility
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid}, ${serviceUuid}, ${characteristicUuid} read!`);
    }
  }

  private onWrite(peripheralUuid: string, serviceUuid: string, characteristicUuid: string) {
    const characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

    if (characteristic) {
      characteristic.emit('write');
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid}, ${serviceUuid}, ${characteristicUuid} write!`);
    }
  }

  private onBroadcast(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, state: string) {
    const characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

    if (characteristic) {
      characteristic.emit('broadcast', state);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid}, ${serviceUuid}, ${characteristicUuid} broadcast!`);
    }
  }

  private onNotify(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, state: string) {
    const characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

    if (characteristic) {
      characteristic.emit('notify', state);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid}, ${serviceUuid}, ${characteristicUuid} notify!`);
    }
  }

  private onDescriptorsDiscover(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuids: string[]) {
    const characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

    if (characteristic) {
      const descriptors: Descriptor[] = [];

      for (const descriptorUuid of descriptorUuids) {
        const newDescriptor = new Descriptor(this, peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid);

        this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid] = newDescriptor;

        descriptors.push(newDescriptor);
      }

      characteristic.descriptors = descriptors;

      characteristic.emit('descriptorsDiscover', descriptors);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid}, ${serviceUuid}, ${characteristicUuid} descriptors discover!`);
    }
  }

  private onValueRead(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer) {
    const descriptor = this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid];

    if (descriptor) {
      descriptor.emit('valueRead', data);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid}, ${serviceUuid}, ${characteristicUuid}, ${descriptorUuid} value read!`);
    }
  }

  private onValueWrite(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) {
    const descriptor = this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid];

    if (descriptor) {
      descriptor.emit('valueWrite');
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid}, ${serviceUuid}, ${characteristicUuid}, ${descriptorUuid} value write!`);
    }
  }

  private onHandleRead(peripheralUuid: string, handle: number, data: Buffer) {
    const peripheral = this._peripherals[peripheralUuid];

    if (peripheral) {
      peripheral.emit(`handleRead${handle}`, data);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid} handle read!`);
    }
  }

  private onHandleWrite(peripheralUuid: string, handle: number) {
    const peripheral = this._peripherals[peripheralUuid];

    if (peripheral) {
      peripheral.emit(`handleWrite${handle}`);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid} handle write!`);
    }
  }

  private onHandleNotify(peripheralUuid: string, handle: number, data: Buffer) {
    const peripheral = this._peripherals[peripheralUuid];

    if (peripheral) {
      peripheral.emit('handleNotify', handle, data);
    } else {
      this.emit('warning', `unknown peripheral ${peripheralUuid} handle notify!`);
    }
  }
}
