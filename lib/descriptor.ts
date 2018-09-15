import * as events from 'events';

import { Noble } from './noble';
import { descriptorInfo } from './gatt-database';

export class Descriptor extends events.EventEmitter {
  public name: string | null;
  public type: string | null;
  public uuid: string;
  private _noble: Noble;
  private _peripheralId: string;
  private _serviceUuid: string;
  private _characteristicUuid: string;

  constructor(noble: Noble, peripheralId: string, serviceUuid: string, characteristicUuid: string, uuid: string) {
    super();
    this._noble = noble;
    this._peripheralId = peripheralId;
    this._serviceUuid = serviceUuid;
    this._characteristicUuid = characteristicUuid;

    this.uuid = uuid;
    this.name = null;
    this.type = null;

    const descriptor = descriptorInfo(uuid);
    if (descriptor) {
      this.name = descriptor.name;
      this.type = descriptor.type;
    }
  }

  public toString() {
    return JSON.stringify({
      uuid: this.uuid,
      name: this.name,
      type: this.type,
    });
  }

  public readValue(): Promise<Buffer>;
  public readValue(callback?: (error?: Error | null, data?: Buffer) => void): void;
  public readValue(callback?: (error?: Error | null, data?: Buffer) => void): void | Promise<Buffer> {
    const promise = new Promise<Buffer>((resolve, reject) => {
      this.once('valueRead', resolve);

      this._noble.readValue(this._peripheralId, this._serviceUuid, this._characteristicUuid, this.uuid);
    });

    if (typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  public writeValue(data: Buffer): Promise<void>;
  public writeValue(data: Buffer, callback?: (error?: Error) => void): void;
  public writeValue(data: Buffer, callback?: (error?: Error) => void): void | Promise<void> {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer');
    }

    const promise = new Promise<void>((resolve, reject) => {
      this.once('valueWrite', resolve);

      this._noble.writeValue(this._peripheralId, this._serviceUuid, this._characteristicUuid, this.uuid, data);
    });

    if (typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }
}
