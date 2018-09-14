import * as events from 'events';

import { Noble } from './noble';
import { Characteristic } from './characteristic';
import { serviceInfo } from './gatt-database';

export class Service extends events.EventEmitter {
  public name: string | null;
  public type: string | null;
  public uuid: string;
  public includedServiceUuids: string[];
  public characteristics: Characteristic[];
  private _noble: Noble;
  private _peripheralId: string;

  constructor(noble: Noble, peripheralId: string, uuid: string) {
    super();
    this._noble = noble;
    this._peripheralId = peripheralId;

    this.uuid = uuid;
    this.name = null;
    this.type = null;
    this.includedServiceUuids = [];
    this.characteristics = [];

    const service = serviceInfo(uuid);
    if (service) {
      this.name = service.name;
      this.type = service.type;
    }
  }

  toString() {
    return JSON.stringify({
      uuid: this.uuid,
      name: this.name,
      type: this.type,
      includedServiceUuids: this.includedServiceUuids,
    });
  }

  discoverIncludedServices(serviceUuids?: string[]): Promise<string[]>;
  discoverIncludedServices(serviceUuids?: string[], callback?: (error: Error | null, includedServiceUuids?: string[]) => void): void;
  discoverIncludedServices(
    serviceUuids: string[] = [],
    callback?: (error: Error | null, includedServiceUuids?: string[]) => void
  ): void | Promise<string[]> {
    const promise = new Promise<string[]>((resolve, reject) => {
      this.once('includedServicesDiscover', resolve);

      this._noble.discoverIncludedServices(this._peripheralId, this.uuid, serviceUuids);
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  discoverCharacteristics(characteristicUuids?: string[]): Promise<Characteristic[]>;
  discoverCharacteristics(
    characteristicUuids?: string[],
    callback?: (error: Error | null, characteristics?: Characteristic[]) => void
  ): void;
  discoverCharacteristics(
    characteristicUuids: string[] = [],
    callback?: (error: Error | null, characteristics?: Characteristic[]) => void
  ): void | Promise<Characteristic[]> {
    const promise = new Promise<Characteristic[]>((resolve, reject) => {
      this.once('characteristicsDiscover', resolve);

      this._noble.discoverCharacteristics(this._peripheralId, this.uuid, characteristicUuids);
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }
}
