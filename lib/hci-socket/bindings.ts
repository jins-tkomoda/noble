/* eslint-disable no-console */
import * as events from 'events';

import { NobleBindingsInterface } from '../bindings';
import { AclStream } from './acl-stream';
import { Gap } from './gap';
import { Gatt } from './gatt';
import { Hci } from './hci';
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
  private _addresseTypes;
  private _connectable;
  private _state: string | null;
  private _pendingConnectionUuid: string | null;
  private _connectionQueue: string[];
  private _handles;
  private _gatts;
  private _aclStreams;
  private _signalings;
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
    this.options = {...defaults, ...options};

    this._state = null;

    this._addresses = {};
    this._addresseTypes = {};
    this._connectable = {};

    this._pendingConnectionUuid = null;
    this._connectionQueue = [];

    this._handles = {};
    this._gatts = {};
    this._aclStreams = {};
    this._signalings = {};

    this._hci = new Hci(this.options.deviceId, this.options.useHciUserChannel);
    this._gap = new Gap(this._hci, this.options.hciReportAllEvents);
  }

  startScanning(serviceUuids: string[] = [], allowDuplicates: boolean = false) {
    this._scanServiceUuids = serviceUuids;

    this._gap.startScanning(allowDuplicates);
  }

  stopScanning() {
    this._gap.stopScanning();
  }

  connect(peripheralUuid: string) {
    const address = this._addresses[peripheralUuid];
    const addressType = this._addresseTypes[peripheralUuid];

    if (!this._pendingConnectionUuid) {
      this._pendingConnectionUuid = peripheralUuid;

      this._hci.createLeConn(address, addressType);
    } else {
      this._connectionQueue.push(peripheralUuid);
    }
  }

  disconnect(peripheralUuid: string) {
    this._hci.disconnect(this._handles[peripheralUuid]);
  }

  updateRssi(peripheralUuid: string) {
    this._hci.readRssi(this._handles[peripheralUuid]);
  }

  init() {
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

  onSigInt() {
    const sigIntListeners = process.listeners('SIGINT');

    if (sigIntListeners[sigIntListeners.length - 1] === this.onSigIntBinded) {
      // we are the last listener, so exit
      // this will trigger onExit, and clean up
      process.exit(1);
    }
  }

  onExit() {
    this.stopScanning();

    for (const handle in this._aclStreams) {
      this._hci.disconnect(handle);
    }
  }

  onStateChange(state: string) {
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

  onAddressChange(address: string) {
    this.emit('addressChange', address);
  }

  onScanStart(filterDuplicates: boolean) {
    this.emit('scanStart', filterDuplicates);
  }

  onScanStop() {
    this.emit('scanStop');
  }

  onDiscover(status: number, address: string, addressType: string, connectable: boolean, advertisement, rssi: number) {
    if (this._scanServiceUuids === undefined) {
      return;
    }

    let serviceUuids = advertisement.serviceUuids || [];
    const serviceData = advertisement.serviceData || [];
    let hasScanServiceUuids = (this._scanServiceUuids.length === 0);

    if (!hasScanServiceUuids) {
      let i;

      serviceUuids = serviceUuids.slice();

      for (i in serviceData) {
        serviceUuids.push(serviceData[i].uuid);
      }

      for (i in serviceUuids) {
        hasScanServiceUuids = (this._scanServiceUuids.includes(serviceUuids[i]));

        if (hasScanServiceUuids) {
          break;
        }
      }
    }

    if (hasScanServiceUuids) {
      const uuid = address.split(':').join('');
      this._addresses[uuid] = address;
      this._addresseTypes[uuid] = addressType;
      this._connectable[uuid] = connectable;

      this.emit('discover', uuid, address, addressType, connectable, advertisement, rssi);
    }
  }

  onLeConnComplete(
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
      uuid = address.split(':').join('').toLowerCase();

      const aclStream = new AclStream(this._hci, handle, this._hci.addressType, this._hci.address, addressType, address);
      const gatt = new Gatt(address, aclStream, this.options.gattMultiRole);
      const signaling = new Signaling(handle, aclStream, this.options.useHciUserChannel);

      this._gatts[uuid] = this._gatts[handle] = gatt;
      this._signalings[uuid] = this._signalings[handle] = signaling;
      this._aclStreams[handle] = aclStream;
      this._handles[uuid] = handle;
      this._handles[handle] = uuid;

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
      let statusMessage = this._hci.STATUS_MAPPER[status] || 'HCI Error: Unknown';
      const errorCode = ` (0x${status.toString(16)})`;
      statusMessage = statusMessage + errorCode;
      error = new Error(statusMessage);
    }

    this.emit('connect', uuid, error);

    if (this._connectionQueue.length > 0) {
      const peripheralUuid = this._connectionQueue.shift();

      address = this._addresses[peripheralUuid];
      addressType = this._addresseTypes[peripheralUuid];

      this._pendingConnectionUuid = peripheralUuid;

      this._hci.createLeConn(address, addressType);
    } else {
      this._pendingConnectionUuid = null;
    }
  }

  onLeConnUpdateComplete(handle: number, interval: number, latency: number, supervisionTimeout: number) {
    // no-op
  }

  onDisconnComplete(handle: number, reason: number) {
    const uuid = this._handles[handle];

    if (uuid) {
      this._aclStreams[handle].push(null, null);
      this._gatts[handle].removeAllListeners();
      this._signalings[handle].removeAllListeners();

      delete this._gatts[uuid];
      delete this._gatts[handle];
      delete this._signalings[uuid];
      delete this._signalings[handle];
      delete this._aclStreams[handle];
      delete this._handles[uuid];
      delete this._handles[handle];

      this.emit('disconnect', uuid); // TODO: handle reason?
    } else {
      console.warn(`noble warning: unknown handle ${handle} disconnected!`);
    }
  }

  onEncryptChange(handle: number, encrypt: boolean) {
    const aclStream = this._aclStreams[handle];

    if (aclStream) {
      aclStream.pushEncrypt(encrypt);
    }
  }

  onMtu(address: string, mtu: number) {

  }

  onRssiRead(handle: number, rssi: number) {
    this.emit('rssiUpdate', this._handles[handle], rssi);
  }

  onAclDataPkt(handle: number, cid: number, data: Buffer) {
    const aclStream = this._aclStreams[handle];

    if (aclStream) {
      aclStream.push(cid, data);
    }
  }

  discoverServices(peripheralUuid: string, serviceUuids: string[] = []) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.discoverServices(serviceUuids);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onServicesDiscovered(address: string, serviceUuids: string[]) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('servicesDiscover', uuid, serviceUuids);
  }

  discoverIncludedServices(peripheralUuid: string, serviceUuid: string, serviceUuids: string[] = []) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.discoverIncludedServices(serviceUuid, serviceUuids);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onIncludedServicesDiscovered(address: string, serviceUuid: string, includedServiceUuids: string[]) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('includedServicesDiscover', uuid, serviceUuid, includedServiceUuids);
  }

  discoverCharacteristics(peripheralUuid: string, serviceUuid: string, characteristicUuids: string[] = []) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.discoverCharacteristics(serviceUuid, characteristicUuids);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onCharacteristicsDiscovered(address: string, serviceUuid: string, characteristics) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('characteristicsDiscover', uuid, serviceUuid, characteristics);
  }

  read(peripheralUuid: string, serviceUuid: string, characteristicUuid: string) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.read(serviceUuid, characteristicUuid);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onRead(address: string, serviceUuid: string, characteristicUuid: string, data: Buffer) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('read', uuid, serviceUuid, characteristicUuid, data, false);
  }

  write(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, data: Buffer, withoutResponse: boolean) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.write(serviceUuid, characteristicUuid, data, withoutResponse);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onWrite(address: string, serviceUuid: string, characteristicUuid: string) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('write', uuid, serviceUuid, characteristicUuid);
  }

  broadcast(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, broadcast: boolean) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.broadcast(serviceUuid, characteristicUuid, broadcast);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onBroadcast(address: string, serviceUuid: string, characteristicUuid: string, state: string) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('broadcast', uuid, serviceUuid, characteristicUuid, state);
  }

  notify(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, notify: boolean) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.notify(serviceUuid, characteristicUuid, notify);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onNotify(address: string, serviceUuid: string, characteristicUuid: string, state: string) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('notify', uuid, serviceUuid, characteristicUuid, state);
  }

  onNotification(address: string, serviceUuid: string, characteristicUuid: string, data: Buffer) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('read', uuid, serviceUuid, characteristicUuid, data, true);
  }

  discoverDescriptors(peripheralUuid: string, serviceUuid: string, characteristicUuid: string) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.discoverDescriptors(serviceUuid, characteristicUuid);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onDescriptorsDiscovered(address: string, serviceUuid: string, characteristicUuid: string, descriptorUuids: string[]) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('descriptorsDiscover', uuid, serviceUuid, characteristicUuid, descriptorUuids);
  }

  readValue(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.readValue(serviceUuid, characteristicUuid, descriptorUuid);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onValueRead(address: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('valueRead', uuid, serviceUuid, characteristicUuid, descriptorUuid, data);
  }

  writeValue(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.writeValue(serviceUuid, characteristicUuid, descriptorUuid, data);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onValueWrite(address: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('valueWrite', uuid, serviceUuid, characteristicUuid, descriptorUuid);
  }

  readHandle(peripheralUuid: string, attHandle: number) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.readHandle(attHandle);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onHandleRead(address: string, handle: number, data: Buffer) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('handleRead', uuid, handle, data);
  }

  writeHandle(peripheralUuid: string, attHandle: number, data: Buffer, withoutResponse: boolean) {
    const handle = this._handles[peripheralUuid];
    const gatt = this._gatts[handle];

    if (gatt) {
      gatt.writeHandle(attHandle, data, withoutResponse);
    } else {
      console.warn(`noble warning: unknown peripheral ${peripheralUuid}`);
    }
  }

  onHandleWrite(address: string, handle: number) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('handleWrite', uuid, handle);
  }

  onHandleNotify(address: string, handle: number, data: Buffer) {
    const uuid = address.split(':').join('').toLowerCase();

    this.emit('handleNotify', uuid, handle, data);
  }

  onConnectionParameterUpdateRequest(handle: number, minInterval: number, maxInterval: number, latency: number, supervisionTimeout: number) {
    this._hci.connUpdateLe(handle, minInterval, maxInterval, latency, supervisionTimeout);
  }
}
