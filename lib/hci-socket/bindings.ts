/* eslint-disable no-console */
import * as events from 'events';

import { NobleBindingsInterface } from '../bindings';
import { GattCharacteristic } from '../shared';
import { Advertisement } from '../peripheral';
import { AclStream } from './acl-stream';
import { Gap } from './gap';
import { Gatt } from './gatt';
import { Hci, STATUS_MAPPER } from './hci';
import { Signaling } from './signaling';

interface NobleBindingsOptions {
  deviceId: number;
  hciReportAllEvents: boolean;
  useHciUserChannel: boolean;
  gattMultiRole: boolean;
}

export class NobleBindings extends events.EventEmitter implements NobleBindingsInterface {
  private options: NobleBindingsOptions;
  private _addresses: { [peripheralUuid: string]: string };
  private _addresseTypes: { [uuid: string]: string };
  private _state: string | null;
  private _pendingConnectionUuid: string | null;
  private _connectionQueue: string[];
  private _uuidsToHandles: { [uuids: string]: number };
  private _handlesToUuids: { [handle: number]: string };
  private _gatts: { [uuid: string]: Gatt; [handle: number]: Gatt };
  private _aclStreams: { [handle: number]: AclStream };
  private _signalings: { [uuid: string]: Signaling; [handle: number]: Signaling };
  private _hci: Hci;
  private _gap: Gap;
  private _scanServiceUuids: string[] | undefined;
  private onSigIntBinded!: () => void;

  constructor(options: Partial<NobleBindingsOptions> = {}) {
    super();

    const defaults = {
      deviceId: 0,
      hciReportAllEvents: false,
      useHciUserChannel: false,
      gattMultiRole: false,
    };
    this.options = { ...defaults, ...options };

    this._state = null;

    this._addresses = {};
    this._addresseTypes = {};

    this._pendingConnectionUuid = null;
    this._connectionQueue = [];

    this._handlesToUuids = {};
    this._uuidsToHandles = {};
    this._gatts = {};
    this._aclStreams = {};
    this._signalings = {};

    this._hci = new Hci(this.options.deviceId, this.options.useHciUserChannel);
    this._gap = new Gap(this._hci, this.options.hciReportAllEvents);
  }

  public startScanning(serviceUuids: string[] = [], allowDuplicates: boolean = false) {
    this._scanServiceUuids = serviceUuids;

    this._gap.startScanning(allowDuplicates);
  }

  public stopScanning() {
    this._gap.stopScanning();
  }

  public connect(peripheralUuid: string) {
    const address = this._addresses[peripheralUuid];
    const addressType = this._addresseTypes[peripheralUuid];

    if (!this._pendingConnectionUuid) {
      this._pendingConnectionUuid = peripheralUuid;

      this._hci.createLeConn(address, addressType);
    } else {
      this._connectionQueue.push(peripheralUuid);
    }
  }

  public disconnect(peripheralUuid: string) {
    this._hci.disconnect(this._uuidsToHandles[peripheralUuid]);
  }

  public updateRssi(peripheralUuid: string) {
    this._hci.readRssi(this._uuidsToHandles[peripheralUuid]);
  }

  public init() {
    this.onSigIntBinded = this.onSigInt.bind(this);

    this._gap.on('scanStart', this.onScanStart.bind(this));
    this._gap.on('scanStop', this.onScanStop.bind(this));
    this._gap.on('discover', this.onDiscover.bind(this));

    this._hci.on('stateChange', this.onStateChange.bind(this));
    this._hci.on('addressChange', this.onAddressChange.bind(this));
    this._hci.on('leConnComplete', this.onLeConnComplete.bind(this));
    this._hci.on('leConnUpdateComplete', this.onLeConnUpdateComplete.bind(this));
    this._hci.on('rssiRead', this.onRssiRead.bind(this));
    this._hci.on('disconnComplete', this.onDisconnComplete.bind(this));
    this._hci.on('encryptChange', this.onEncryptChange.bind(this));
    this._hci.on('aclDataPkt', this.onAclDataPkt.bind(this));

    this._hci.init();

    /* Add exit handlers after `init()` has completed. If no adaptor
    is present it can throw an exception - in which case we don't
    want to try and clear up afterwards (issue #502) */
    process.on('SIGINT', this.onSigIntBinded);
    process.on('exit', this.onExit.bind(this));
  }

  public discoverServices(peripheralUuid: string, serviceUuids: string[] = []) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.discoverServices(serviceUuids);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public discoverIncludedServices(peripheralUuid: string, serviceUuid: string, serviceUuids: string[] = []) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.discoverIncludedServices(serviceUuid, serviceUuids);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public discoverCharacteristics(peripheralUuid: string, serviceUuid: string, characteristicUuids: string[] = []) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.discoverCharacteristics(serviceUuid, characteristicUuids);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public read(peripheralUuid: string, serviceUuid: string, characteristicUuid: string) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.read(serviceUuid, characteristicUuid);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public write(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, data: Buffer, withoutResponse: boolean) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.write(serviceUuid, characteristicUuid, data, withoutResponse);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public broadcast(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, broadcast: boolean) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.broadcast(serviceUuid, characteristicUuid, broadcast);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public notify(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, notify: boolean) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.notify(serviceUuid, characteristicUuid, notify);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public discoverDescriptors(peripheralUuid: string, serviceUuid: string, characteristicUuid: string) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.discoverDescriptors(serviceUuid, characteristicUuid);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public readValue(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.readValue(serviceUuid, characteristicUuid, descriptorUuid);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public writeValue(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.writeValue(serviceUuid, characteristicUuid, descriptorUuid, data);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public readHandle(peripheralUuid: string, attHandle: number) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.readHandle(attHandle);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  public writeHandle(peripheralUuid: string, attHandle: number, data: Buffer, withoutResponse: boolean) {
    const handle = this._uuidsToHandles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.writeHandle(attHandle, data, withoutResponse);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  private onSigInt() {
    const sigIntListeners = process.listeners('SIGINT');

    if (sigIntListeners[sigIntListeners.length - 1] === this.onSigIntBinded) {
      // we are the last listener, so exit
      // this will trigger onExit, and clean up
      process.exit(1);
    }
  }

  private onExit() {
    this.stopScanning();

    for (const handle in this._aclStreams) {
      this._hci.disconnect(parseInt(handle, 10));
    }
  }

  private onStateChange(state: string) {
    if (this._state === state) {
      return;
    }
    this._state = state;

    if (state === 'unauthorized') {
      console.log('noble warning: adapter state unauthorized, please run as root or with sudo');
      console.log('               or see README for information on running without root/sudo:');
      console.log('               https://github.com/sandeepmistry/noble#running-on-linux');
    } else if (state === 'unsupported') {
      console.log('noble warning: adapter does not support Bluetooth Low Energy (BLE, Bluetooth Smart).');
      console.log('               Try to run with environment variable:');
      console.log('               [sudo] NOBLE_HCI_DEVICE_ID=x node ...');
    }

    this.emit('stateChange', state);
  }

  private onAddressChange(address: string) {
    this.emit('addressChange', address);
  }

  private onScanStart(filterDuplicates: boolean) {
    this.emit('scanStart', filterDuplicates);
  }

  private onScanStop() {
    this.emit('scanStop');
  }

  private onDiscover(
    status: number,
    address: string,
    addressType: string,
    connectable: boolean,
    advertisement: Advertisement,
    rssi: number
  ) {
    if (this._scanServiceUuids === undefined) {
      return;
    }

    let serviceUuids = advertisement.serviceUuids || [];
    const serviceData = advertisement.serviceData || [];
    let hasScanServiceUuids = this._scanServiceUuids.length === 0;

    if (!hasScanServiceUuids) {
      let i;

      serviceUuids = serviceUuids.slice();

      for (i in serviceData) {
        serviceUuids.push(serviceData[i].uuid);
      }

      for (i in serviceUuids) {
        hasScanServiceUuids = this._scanServiceUuids.includes(serviceUuids[i]);

        if (hasScanServiceUuids) {
          break;
        }
      }
    }

    if (hasScanServiceUuids) {
      const uuid = this.addressToUuid(address);
      this._addresses[uuid] = address;
      this._addresseTypes[uuid] = addressType;

      this.emit('discover', uuid, address, addressType, connectable, advertisement, rssi);
    }
  }

  private onLeConnComplete(
    status: number,
    handle: number,
    role: number,
    addressType: string,
    address: string,
    interval: number,
    latency: number,
    supervisionTimeout: number,
    masterClockAccuracy: number
  ) {
    let error;
    let uuid;

    if (status === 0) {
      uuid = this.addressToUuid(address);

      const aclStream = new AclStream(this._hci, handle, this._hci.addressType, this._hci.address, addressType, address);
      const gatt = new Gatt(address, aclStream, this.options.gattMultiRole);
      const signaling = new Signaling(handle, aclStream, this.options.useHciUserChannel);

      this._gatts[uuid] = this._gatts[handle] = gatt;
      this._signalings[uuid] = this._signalings[handle] = signaling;
      this._aclStreams[handle] = aclStream;
      this._uuidsToHandles[uuid] = handle;
      this._handlesToUuids[handle] = uuid;

      this._gatts[handle].on('mtu', this.onMtu.bind(this));
      this._gatts[handle].on('servicesDiscover', this.onServicesDiscovered.bind(this));
      this._gatts[handle].on('includedServicesDiscover', this.onIncludedServicesDiscovered.bind(this));
      this._gatts[handle].on('characteristicsDiscover', this.onCharacteristicsDiscovered.bind(this));
      this._gatts[handle].on('read', this.onRead.bind(this));
      this._gatts[handle].on('write', this.onWrite.bind(this));
      this._gatts[handle].on('broadcast', this.onBroadcast.bind(this));
      this._gatts[handle].on('notify', this.onNotify.bind(this));
      this._gatts[handle].on('notification', this.onNotification.bind(this));
      this._gatts[handle].on('descriptorsDiscover', this.onDescriptorsDiscovered.bind(this));
      this._gatts[handle].on('valueRead', this.onValueRead.bind(this));
      this._gatts[handle].on('valueWrite', this.onValueWrite.bind(this));
      this._gatts[handle].on('handleRead', this.onHandleRead.bind(this));
      this._gatts[handle].on('handleWrite', this.onHandleWrite.bind(this));
      this._gatts[handle].on('handleNotify', this.onHandleNotify.bind(this));

      this._signalings[handle].on('connectionParameterUpdateRequest', this.onConnectionParameterUpdateRequest.bind(this));

      this._gatts[handle].exchangeMtu(256);
    } else {
      uuid = this._pendingConnectionUuid;
      let statusMessage = STATUS_MAPPER[status] || 'HCI Error: Unknown';
      const errorCode = ` (0x${status.toString(16)})`;
      statusMessage = statusMessage + errorCode;
      error = new Error(statusMessage);
    }

    this.emit('connect', uuid, error);

    if (this._connectionQueue.length > 0) {
      const peripheralUuid = this._connectionQueue.shift();
      if (!peripheralUuid) {
        throw new Error(`Peripheral UUID not found in connection queue`);
        return;
      }

      address = this._addresses[peripheralUuid];
      addressType = this._addresseTypes[peripheralUuid];

      this._pendingConnectionUuid = peripheralUuid;

      this._hci.createLeConn(address, addressType);
    } else {
      this._pendingConnectionUuid = null;
    }
  }

  private onLeConnUpdateComplete(handle: number, interval: number, latency: number, supervisionTimeout: number) {
    // no-op
  }

  private onDisconnComplete(handle: number, reason: number) {
    const uuid = this._handlesToUuids[handle];

    if (uuid) {
      this._aclStreams[handle].push(null);
      this._gatts[handle].removeAllListeners();
      this._signalings[handle].removeAllListeners();

      delete this._gatts[uuid];
      delete this._gatts[handle];
      delete this._signalings[uuid];
      delete this._signalings[handle];
      delete this._aclStreams[handle];
      delete this._uuidsToHandles[uuid];
      delete this._handlesToUuids[handle];

      this.emit('disconnect', uuid); // TODO: handle reason?
    } else {
      console.warn(`noble warning: unknown handle ${handle} disconnected!`);
    }
  }

  private onEncryptChange(handle: number, encrypt: boolean) {
    const aclStream = this._aclStreams[handle];

    if (aclStream) {
      aclStream.pushEncrypt(encrypt);
    }
  }

  private onMtu(address: string, mtu: number) {
    // no op
  }

  private onRssiRead(handle: number, rssi: number) {
    this.emit('rssiUpdate', this._handlesToUuids[handle], rssi);
  }

  private onAclDataPkt(handle: number, cid: number, data: Buffer) {
    const aclStream = this._aclStreams[handle];

    if (aclStream) {
      aclStream.push(cid, data);
    }
  }

  private onServicesDiscovered(address: string, serviceUuids: string[]) {
    this.emit('servicesDiscover', this.addressToUuid(address), serviceUuids);
  }

  private onIncludedServicesDiscovered(address: string, serviceUuid: string, includedServiceUuids: string[]) {
    this.emit('includedServicesDiscover', this.addressToUuid(address), serviceUuid, includedServiceUuids);
  }

  private onCharacteristicsDiscovered(address: string, serviceUuid: string, characteristics: GattCharacteristic) {
    this.emit('characteristicsDiscover', this.addressToUuid(address), serviceUuid, characteristics);
  }

  private onRead(address: string, serviceUuid: string, characteristicUuid: string, data: Buffer) {
    this.emit('read', this.addressToUuid(address), serviceUuid, characteristicUuid, data, false);
  }

  private onWrite(address: string, serviceUuid: string, characteristicUuid: string) {
    this.emit('write', this.addressToUuid(address), serviceUuid, characteristicUuid);
  }

  private onBroadcast(address: string, serviceUuid: string, characteristicUuid: string, state: string) {
    this.emit('broadcast', this.addressToUuid(address), serviceUuid, characteristicUuid, state);
  }

  private onNotify(address: string, serviceUuid: string, characteristicUuid: string, state: string) {
    this.emit('notify', this.addressToUuid(address), serviceUuid, characteristicUuid, state);
  }

  private onNotification(address: string, serviceUuid: string, characteristicUuid: string, data: Buffer) {
    this.emit('read', this.addressToUuid(address), serviceUuid, characteristicUuid, data, true);
  }

  private onDescriptorsDiscovered(address: string, serviceUuid: string, characteristicUuid: string, descriptorUuids: string[]) {
    this.emit('descriptorsDiscover', this.addressToUuid(address), serviceUuid, characteristicUuid, descriptorUuids);
  }

  private onValueRead(address: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer) {
    this.emit('valueRead', this.addressToUuid(address), serviceUuid, characteristicUuid, descriptorUuid, data);
  }

  private onValueWrite(address: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) {
    this.emit('valueWrite', this.addressToUuid(address), serviceUuid, characteristicUuid, descriptorUuid);
  }
  private onHandleRead(address: string, handle: number, data: Buffer) {
    this.emit('handleRead', this.addressToUuid(address), handle, data);
  }

  private onHandleWrite(address: string, handle: number) {
    this.emit('handleWrite', this.addressToUuid(address), handle);
  }

  private onHandleNotify(address: string, handle: number, data: Buffer) {
    this.emit('handleNotify', this.addressToUuid(address), handle, data);
  }

  private onConnectionParameterUpdateRequest(
    handle: number,
    minInterval: number,
    maxInterval: number,
    latency: number,
    supervisionTimeout: number
  ) {
    this._hci.connUpdateLe(handle, minInterval, maxInterval, latency, supervisionTimeout);
  }

  private addressToUuid(address: string): string {
    return address
      .split(':')
      .join('')
      .toLowerCase();
  }
}
