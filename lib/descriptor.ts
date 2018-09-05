import * as events from 'events';

import * as descriptors from './descriptors.json';

export default class Descriptor extends events.EventEmitter {
  private _noble;
  private _peripheralId;
  private _serviceUuid;
  private _characteristicUuid;
  private uuid;
  private name;
  private type;

  constructor(noble, peripheralId, serviceUuid, characteristicUuid, uuid) {
    super();
    this._noble = noble;
    this._peripheralId = peripheralId;
    this._serviceUuid = serviceUuid;
    this._characteristicUuid = characteristicUuid;

    this.uuid = uuid;
    this.name = null;
    this.type = null;

    const descriptor = descriptors[uuid];
    if (descriptor) {
      this.name = descriptor.name;
      this.type = descriptor.type;
    }
  }

  toString() {
    return JSON.stringify({
      uuid: this.uuid,
      name: this.name,
      type: this.type
    });
  }

  readValue(callback) {
    const promise = new Promise((resolve, reject) => {
      this.once('valueRead', resolve);

      this._noble.readValue(
        this._peripheralId,
        this._serviceUuid,
        this._characteristicUuid,
        this.uuid
      );
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }

  writeValue(data, callback) {
    if (!(data instanceof Buffer)) {
      throw new Error('data must be a Buffer');
    }

    const promise = new Promise((resolve, reject) => {
      this.once('valueWrite', resolve);

      this._noble.writeValue(
        this._peripheralId,
        this._serviceUuid,
        this._characteristicUuid,
        this.uuid,
        data
      );
    });

    if (callback && typeof callback === 'function') {
      promise.then(callback.bind(null, null), callback);
    }

    return promise;
  }
}
