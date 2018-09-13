import * as events from 'events';

import { Noble } from './noble';
import { Descriptor } from './descriptor';
import { characteristicInfo } from './gatt-database';

export class Characteristic extends events.EventEmitter {
  private _noble: Noble;
  private _peripheralId: string;
  private _serviceUuid: string;

  public name: string | null;
  public type: string | null;
  public uuid: string;
  public properties: string[];
  public descriptors: Descriptor[];

  constructor(noble: Noble, peripheralId: string, serviceUuid: string, uuid: string, properties: string[]) {
    super();
    this._noble = noble;
    this._peripheralId = peripheralId;
    this._serviceUuid = serviceUuid;

    this.uuid = uuid;
    this.name = null;
    this.type = null;
    this.properties = properties;
    this.descriptors = [];

    const characteristic = characteristicInfo(uuid);
    if (characteristic) {
      this.name = characteristic.name;
      this.type = characteristic.type;
    }
  }

  toString() {
    return JSON.stringify({
      uuid: this.uuid,
      name: this.name,
      type: this.type,
      properties: this.properties,
    });
  }

  read(): Promise<Buffer>;
  read(callback?: (error: Error | null, data?: Buffer) => void): void;
  read(callback?: (error: Error | null, data?: Buffer) => void): void | Promise<Buffer> {
    const promise = new Promise<Buffer>((resolve, reject) => {
      const onRead = (data: Buffer, isNotificaton: boolean) => {
        // only call the callback if 'read' event and non-notification
        // 'read' for non-notifications is only present for backwards compatbility
        if (!isNotificaton) {
          // remove the listener
          this.removeListener('read', onRead);

          // call the callback
          resolve(data);
        }
      };

      this.on('read', onRead);

      this._noble.read(this._peripheralId, this._serviceUuid, this.uuid);
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  write(data: Buffer, withoutResponse?: boolean): Promise<void>;
  write(data: Buffer, withoutResponse?: boolean, callback?: (error?: Error) => void): void;
  write(data: Buffer, withoutResponse: boolean = false, callback?: (error?: Error) => void): void | Promise<void> {
    if (process.title !== 'browser' && !(data instanceof Buffer)) {
      throw new Error('data must be a Buffer');
    }

    const promise = new Promise<void>((resolve, reject) => {
      this.once('write', resolve);

      this._noble.write(this._peripheralId, this._serviceUuid, this.uuid, data, withoutResponse);
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  broadcast(broadcast: boolean): Promise<void>;
  broadcast(broadcast: boolean, callback?: (error?: Error) => void): void;
  broadcast(broadcast: boolean, callback?: (error?: Error) => void): void | Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      this.once('broadcast', resolve);

      this._noble.broadcast(this._peripheralId, this._serviceUuid, this.uuid, broadcast);
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  // deprecated in favour of subscribe/unsubscribe
  notify(notify: boolean): Promise<void>;
  notify(notify: boolean, callback?: (error?: Error) => void): void;
  notify(notify: boolean, callback?: (error?: Error) => void): void | Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      this.once('notify', resolve);

      this._noble.notify(this._peripheralId, this._serviceUuid, this.uuid, notify);
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  subscribe(): Promise<void>;
  subscribe(callback?: (error?: Error) => void): void;
  subscribe(callback?: (error?: Error) => void): void | Promise<void> {
    return this.notify(true, callback);
  }

  unsubscribe(): Promise<void>;
  unsubscribe(callback?: (error?: Error) => void): void;
  unsubscribe(callback?: (error?: Error) => void): void | Promise<void> {
    return this.notify(false, callback);
  }

  discoverDescriptors(): Promise<Descriptor[]>;
  discoverDescriptors(callback?: (error: Error | null, descriptors?: Descriptor[]) => void): void;
  discoverDescriptors(callback?: (error: Error | null, descriptors?: Descriptor[]) => void): void | Promise<Descriptor[]> {
    const promise = new Promise<Descriptor[]>((resolve, reject) => {
      this.once('descriptorsDiscover', resolve);

      this._noble.discoverDescriptors(this._peripheralId, this._serviceUuid, this.uuid);
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }
}
