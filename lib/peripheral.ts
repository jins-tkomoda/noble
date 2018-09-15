import * as events from 'events';

import { Noble } from './noble';
import { Characteristic } from './characteristic';
import { Service } from './service';

export interface AdvertismentServiceData {
  uuid: string;
  data: Buffer;
}

export interface Advertisement {
  localName: string;
  serviceData: AdvertismentServiceData[];
  txPowerLevel: number;
  manufacturerData: Buffer | null;
  serviceUuids: string[];
  serviceSolicitationUuids?: string[];
}

interface ServicesAndCharacteristics {
  services?: Service[];
  characteristics?: Characteristic[];
}

export class Peripheral extends events.EventEmitter {
  public addressType: string;
  public connectable: boolean;
  public rssi: number;
  public address: string;
  public id: string;
  public uuid: string;
  public advertisement: Advertisement;
  public services: Service[];
  public state: 'error' | 'connecting' | 'connected' | 'disconnecting' | 'disconnected';
  private _noble: Noble;

  constructor(
    noble: Noble,
    id: string,
    address: string,
    addressType: string,
    connectable: boolean,
    advertisement: Advertisement,
    rssi: number
  ) {
    super();
    this._noble = noble;

    this.id = id;
    this.uuid = id; // for legacy
    this.address = address;
    this.addressType = addressType;
    this.connectable = connectable;
    this.advertisement = advertisement;
    this.rssi = rssi;
    this.services = [];
    this.state = 'disconnected';
  }

  public toString() {
    return JSON.stringify({
      id: this.id,
      address: this.address,
      addressType: this.addressType,
      connectable: this.connectable,
      advertisement: this.advertisement,
      rssi: this.rssi,
      state: this.state,
    });
  }

  public connect(): Promise<void>;
  public connect(callback?: (error?: Error) => void): void;
  public connect(callback?: (error?: Error) => void): void | Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      this.once('connect', error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });

      if (this.state === 'connected') {
        this.emit('connect', new Error('Peripheral already connected'));
      } else {
        this.state = 'connecting';
        this._noble.connect(this.id);
      }
    });

    if (typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  public disconnect(): Promise<void>;
  public disconnect(callback?: () => void): void;
  public disconnect(callback?: () => void): void | Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      this.once('disconnect', () => {
        resolve();
      });

      this.state = 'disconnecting';
      this._noble.disconnect(this.id);
    });

    if (typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  public updateRssi(): Promise<number>;
  public updateRssi(callback?: (error: Error | null, rssi?: number) => void): void;
  public updateRssi(callback?: (error: Error | null, rssi?: number) => void): void | Promise<number> {
    const promise = new Promise<number>((resolve, reject) => {
      this.once('rssiUpdate', rssi => {
        resolve(rssi);
      });

      this._noble.updateRssi(this.id);
    });

    if (typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  public discoverServices(uuids?: string[]): Promise<Service[]>;
  public discoverServices(uuids?: string[], callback?: (error: Error | null, services?: Service[]) => void): void;
  public discoverServices(uuids: string[] = [], callback?: (error: Error | null, services?: Service[]) => void): void | Promise<Service[]> {
    const promise = new Promise<Service[]>((resolve, reject) => {
      this.once('servicesDiscover', services => {
        resolve(services);
      });

      this._noble.discoverServices(this.id, uuids);
    });

    if (typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  public discoverSomeServicesAndCharacteristics(serviceUuids: string[], characteristicUuids: string[]): Promise<ServicesAndCharacteristics>;
  public discoverSomeServicesAndCharacteristics(
    serviceUuids: string[],
    characteristicUuids: string[],
    callback?: (error: Error | null, services?: Service[], characteristics?: Characteristic[]) => void
  ): void;
  public discoverSomeServicesAndCharacteristics(
    serviceUuids: string[],
    characteristicUuids: string[],
    callback?: (error: Error | null, services?: Service[], characteristics?: Characteristic[]) => void
  ): void | Promise<ServicesAndCharacteristics> {
    const promise = new Promise<ServicesAndCharacteristics>((resolve, reject) => {
      this.discoverServices(serviceUuids, (err, services) => {
        let numDiscovered = 0;
        const allCharacteristics: Characteristic[] = [];
        services = Array.isArray(services) ? services : [];

        for (const service of services) {
          service.discoverCharacteristics(characteristicUuids, (error, characteristics) => {
            numDiscovered++;
            if (error === null && Array.isArray(characteristics)) {
              for (const characteristic of characteristics) {
                allCharacteristics.push(characteristic);
              }
            }

            if (services && numDiscovered === services.length) {
              resolve({ services, characteristics: allCharacteristics });
            }
          });
        }
      });
    });

    if (typeof callback === 'function') {
      promise.then(({ services, characteristics }) => callback(null, services, characteristics), callback);
    }

    return promise;
  }

  public discoverAllServicesAndCharacteristics(): Promise<ServicesAndCharacteristics>;
  public discoverAllServicesAndCharacteristics(
    callback?: (error: Error | null, services?: Service[], characteristics?: Characteristic[]) => void
  ): void;
  public discoverAllServicesAndCharacteristics(
    callback?: (error: Error | null, services?: Service[], characteristics?: Characteristic[]) => void
  ): void | Promise<ServicesAndCharacteristics> {
    return this.discoverSomeServicesAndCharacteristics([], [], callback);
  }

  public readHandle(handle: number): Promise<Buffer>;
  public readHandle(handle: number, callback?: (error: Error | null, data?: Buffer) => void): void;
  public readHandle(handle: number, callback?: (error: Error | null, data?: Buffer) => void): void | Promise<Buffer> {
    const promise = new Promise<Buffer>((resolve, reject) => {
      this.once(`handleRead${handle}`, data => {
        resolve(data);
      });
      this._noble.readHandle(this.id, handle);
    });

    if (typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  public writeHandle(handle: number, data: Buffer, withoutResponse?: boolean): Promise<void>;
  public writeHandle(handle: number, data: Buffer, withoutResponse?: boolean, callback?: (error?: Error | null) => void): void;
  public writeHandle(
    handle: number,
    data: Buffer,
    withoutResponse: boolean = false,
    callback?: (error?: Error | null) => void
  ): void | Promise<void> {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer');
    }

    const promise = new Promise<void>((resolve, reject) => {
      this.once(`handleWrite${handle}`, resolve);

      this._noble.writeHandle(this.id, handle, data, withoutResponse);
    });

    if (typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }
}
