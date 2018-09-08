import * as events from 'events';

import { Noble } from './noble';
import { Characteristic }  from './characteristic';

import * as services from './services.json';

export class Service extends events.EventEmitter {
  private _noble: Noble;
  private _peripheralId: string;
  private uuid: string;
  private name;
  private type;
  private includedServiceUuids: string[];

  public characteristics: Characteristic[];

  constructor(noble: Noble, peripheralId: string, uuid: string) {
    super();
    this._noble = noble;
    this._peripheralId = peripheralId;

    this.uuid = uuid;
    this.name = null;
    this.type = null;
    this.includedServiceUuids = null;
    this.characteristics = [];

    const service = services[uuid];
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
      includedServiceUuids: this.includedServiceUuids
    });
  }

  discoverIncludedServices(serviceUuids: string[], callback) {
    const promise = new Promise((resolve, reject) => {
      this.once('includedServicesDiscover', resolve);

      this._noble.discoverIncludedServices(
        this._peripheralId,
        this.uuid,
        serviceUuids
      );
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  discoverCharacteristics(characteristicUuids: string[] = [], callback) {
    const promise = new Promise((resolve, reject) => {
      this.once('characteristicsDiscover', resolve);

      this._noble.discoverCharacteristics(
        this._peripheralId,
        this.uuid,
        characteristicUuids
      );
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }
}
