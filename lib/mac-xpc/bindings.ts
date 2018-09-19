import * as events from 'events';
import * as os from 'os';

import * as debugModule from 'debug';
import * as XpcConnection from 'xpc-connection';

import * as shared from '../shared';
import { NobleBindingsInterface } from '../bindings';
import { Advertisement, AdvertismentServiceData } from '../peripheral';
import { localAddress } from './local-address';
import { uuidToAddress } from './uuid-to-address';
import { xpcCommandToNumber } from './xpc-command-to-number';

const debug = debugModule('mac-xpc-bindings');

let cmdToNumber: { [command: string]: string };
const osRelease = parseFloat(os.release());
if (osRelease < 14) {
  throw new Error('Mac OS versions earlier than Yosemite are no longer supported.');
} else if (osRelease < 15) {
  cmdToNumber = xpcCommandToNumber.yosemite;
} else if (osRelease < 18) {
  cmdToNumber = xpcCommandToNumber.highSierra;
} else {
  cmdToNumber = xpcCommandToNumber.mojave;
}

interface MacCharacteristic {
  uuid: string;
  properties: string[];
}

/**
 *  NobleBindings for mac
 */
export class NobleBindings extends events.EventEmitter implements NobleBindingsInterface {
  private _peripherals: any;
  private _xpcConnection: XpcConnection;

  constructor() {
    super();
    this._peripherals = {};
    const xpcServiceName = osRelease < 15 ? 'com.apple.blued' : 'com.apple.bluetoothd';
    this._xpcConnection = new XpcConnection(xpcServiceName);

    this._xpcConnection.on('error', message => {
      this.emit('xpcError', message);
    });
    this._xpcConnection.on('event', event => {
      this.emit('xpcEvent', event);
    });
  }

  /**
   * Init xpc connection to bluetoothd
   */
  public init() {
    this._xpcConnection.setup();
    this.setupListeners();

    localAddress((address: string | undefined) => {
      if (address) {
        this.emit('addressChange', address);
      }

      this.sendCBMsg(cmdToNumber.ADDRESS_CHANGE, {
        kCBMsgArgName: `node-${new Date().getTime()}`,
        kCBMsgArgOptions: {
          kCBInitOptionShowPowerAlert: 0,
        },
        kCBMsgArgType: 0,
      });
    });
  }

  public startScanning(serviceUuids: string[] = [], allowDuplicates: boolean = false) {
    const args = {
      kCBMsgArgOptions: { kCBScanOptionAllowDuplicates: allowDuplicates ? 1 : 0 },
      kCBMsgArgUUIDs: serviceUuids.map(uuid => Buffer.from(uuid, 'hex')),
    };

    this.sendCBMsg(cmdToNumber.START_SCANNING, args);
    this.emit('scanStart');
  }

  public stopScanning() {
    this.sendCBMsg(cmdToNumber.STOP_SCANNING, null);
    this.emit('scanStop');
  }

  public connect(deviceUuid: string) {
    this.sendCBMsg(cmdToNumber.CONNECT, {
      kCBMsgArgOptions: {
        kCBConnectOptionNotifyOnDisconnection: 1,
      },
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
    });
  }

  public disconnect(deviceUuid: string) {
    this.sendCBMsg(cmdToNumber.DISCONNECT, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
    });
  }

  public updateRssi(deviceUuid: string) {
    this.sendCBMsg(cmdToNumber.UPDATE_RSSI, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
    });
  }

  public discoverServices(deviceUuid: string, serviceUuids: string[] = []) {
    const args = {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgUUIDs: serviceUuids.map(uuid => Buffer.from(uuid, 'hex')),
    };

    this.sendCBMsg(cmdToNumber.DISCOVER_SERVICES, args);
  }

  public discoverIncludedServices(deviceUuid: string, serviceUuid: string, serviceUuids: string[] = []) {
    const args = {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgServiceStartHandle: this._peripherals[deviceUuid].services[serviceUuid].startHandle,
      kCBMsgArgServiceEndHandle: this._peripherals[deviceUuid].services[serviceUuid].endHandle,
      kCBMsgArgUUIDs: serviceUuids.map(uuid => Buffer.from(uuid, 'hex')),
    };

    this.sendCBMsg(cmdToNumber.DISCOVER_INCLUDED_SERVICES, args);
  }

  public discoverCharacteristics(deviceUuid: string, serviceUuid: string, characteristicUuids: string[] = []) {
    const args = {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgServiceStartHandle: this._peripherals[deviceUuid].services[serviceUuid].startHandle,
      kCBMsgArgServiceEndHandle: this._peripherals[deviceUuid].services[serviceUuid].endHandle,
      kCBMsgArgUUIDs: characteristicUuids.map(uuid => Buffer.from(uuid, 'hex')),
    };

    this.sendCBMsg(cmdToNumber.DISCOVER_CHARACTERISTICS, args);
  }

  public read(deviceUuid: string, serviceUuid: string, characteristicUuid: string) {
    this.sendCBMsg(cmdToNumber.READ, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgCharacteristicHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid].handle,
      kCBMsgArgCharacteristicValueHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid]
        .valueHandle,
    });
  }

  public write(deviceUuid: string, serviceUuid: string, characteristicUuid: string, data: Buffer, withoutResponse: boolean = false) {
    this.sendCBMsg(cmdToNumber.WRITE, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgCharacteristicHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid].handle,
      kCBMsgArgCharacteristicValueHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid]
        .valueHandle,
      kCBMsgArgData: data,
      kCBMsgArgType: withoutResponse ? 1 : 0,
    });

    if (withoutResponse) {
      this.emit('write', deviceUuid, serviceUuid, characteristicUuid);
    }
  }

  /**
   * @discussion The ids were incemented but there seems to be no CoreBluetooth function to call/verify this.
   */
  public broadcast(deviceUuid: string, serviceUuid: string, characteristicUuid: string, broadcast: boolean) {
    throw new Error('This OS does not support broadcast.');
  }

  public notify(deviceUuid: string, serviceUuid: string, characteristicUuid: string, notify: boolean) {
    this.sendCBMsg(cmdToNumber.NOTIFY, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgCharacteristicHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid].handle,
      kCBMsgArgCharacteristicValueHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid]
        .valueHandle,
      kCBMsgArgState: notify ? 1 : 0,
    });
  }

  public discoverDescriptors(deviceUuid: string, serviceUuid: string, characteristicUuid: string) {
    this.sendCBMsg(cmdToNumber.DISCOVER_DESCRIPTORS, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgCharacteristicHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid].handle,
      kCBMsgArgCharacteristicValueHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid]
        .valueHandle,
    });
  }

  public readValue(deviceUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) {
    this.sendCBMsg(cmdToNumber.READ_VALUE, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgDescriptorHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid].descriptors[
        descriptorUuid
      ].handle,
    });
  }

  public writeValue(deviceUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer) {
    this.sendCBMsg(cmdToNumber.WRITE_VALUE, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgDescriptorHandle: this._peripherals[deviceUuid].services[serviceUuid].characteristics[characteristicUuid].descriptors[
        descriptorUuid
      ].handle,
      kCBMsgArgData: data,
    });
  }

  public readHandle(deviceUuid: string, handle: number) {
    this.sendCBMsg(cmdToNumber.READ_HANDLE, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgDescriptorHandle: handle,
    });
  }

  public writeHandle(deviceUuid: string, handle: number, data: Buffer, withoutResponse: boolean = false) {
    // TODO: use without response
    this.sendCBMsg(cmdToNumber.WRITE_HANDLE, {
      kCBMsgArgDeviceUUID: this._peripherals[deviceUuid].uuid,
      kCBMsgArgDescriptorHandle: handle,
      kCBMsgArgData: data,
    });
  }

  private sendCBMsg(id: string, args: any) {
    debug(`sendCBMsg: ${id}, ${JSON.stringify(args, undefined, 2)}`);
    this.sendXpcMessage({ kCBMsgId: id, kCBMsgArgs: args });
  }

  private sendXpcMessage(message: any) {
    this._xpcConnection.sendMessage(message);
  }

  private setupListeners() {
    // General xpc message handling
    this.on('xpcEvent', event => {
      debug(`xpcEvent: ${JSON.stringify(event, undefined, 2)}`);

      const kCBMsgId = event.kCBMsgId;
      const kCBMsgArgs = event.kCBMsgArgs;
      this.emit(kCBMsgId, kCBMsgArgs);
    });

    this.on('xpcError', message => {
      console.error(`xpcError: ${message}`); // eslint-disable-line no-console
    });

    this.on(cmdToNumber.STATE_CHANGE_RESPONSE, args => {
      const state = ['unknown', 'resetting', 'unsupported', 'unauthorized', 'poweredOff', 'poweredOn'][args.kCBMsgArgState];
      debug(`state change ${state}`);
      this.emit('stateChange', state);
    });

    /**
     * Response message to start scanning
     *
     * @example
     * // For `TI Sensortag` the message lookes like this:
     * handleMsg: 37, {
     *     kCBMsgArgAdvertisementData =     {
     *         kCBAdvDataIsConnectable = 1;
     *         kCBAdvDataLocalName = SensorTag;
     *         kCBAdvDataTxPowerLevel = 0;
     *     };
     *     kCBMsgArgDeviceUUID = "<__NSConcreteUUID 0x6180000208e0> 53486C7A-DED2-4AA6-8913-387CD22F25D8";
     *     kCBMsgArgName = SensorTag;
     *     kCBMsgArgRssi = "-68";
     * }
     */
    this.on(cmdToNumber.START_SCANNING_RESPONSE, args => {
      if (
        Object.keys(args.kCBMsgArgAdvertisementData).length === 0 ||
        (args.kCBMsgArgAdvertisementData.kCBAdvDataIsConnectable !== undefined && Object.keys(args.kCBMsgArgAdvertisementData).length === 1)
      ) {
        return;
      }

      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const serviceUuids: Buffer[] = args.kCBMsgArgAdvertisementData.kCBAdvDataServiceUUIDs || [];

      const advertisement = {
        localName: args.kCBMsgArgAdvertisementData.kCBAdvDataLocalName || args.kCBMsgArgName,
        txPowerLevel: args.kCBMsgArgAdvertisementData.kCBAdvDataTxPowerLevel,
        manufacturerData: args.kCBMsgArgAdvertisementData.kCBAdvDataManufacturerData,
        serviceData: [] as AdvertismentServiceData[],
        serviceUuids: serviceUuids.map(uuid => uuid.toString('hex')),
      } as Advertisement;
      const connectable = !!args.kCBMsgArgAdvertisementData.kCBAdvDataIsConnectable;
      const rssi = args.kCBMsgArgRssi;

      const serviceData = args.kCBMsgArgAdvertisementData.kCBAdvDataServiceData;
      if (serviceData) {
        for (let i = 0; i < serviceData.length; i += 2) {
          const serviceDataUuid = serviceData[i].toString('hex');
          const data = serviceData[i + 1];

          advertisement.serviceData.push({
            uuid: serviceDataUuid,
            data: data,
          });
        }
      }

      debug(`peripheral ${deviceUuid} discovered`);

      const uuid = Buffer.from(deviceUuid, 'hex');
      uuid.isUuid = true;

      if (!this._peripherals[deviceUuid]) {
        this._peripherals[deviceUuid] = {};
      }

      this._peripherals[deviceUuid].uuid = uuid;
      this._peripherals[deviceUuid].connectable = connectable;
      this._peripherals[deviceUuid].advertisement = advertisement;
      this._peripherals[deviceUuid].rssi = rssi;

      ((deviceUuid, advertisement, rssi) => {
        uuidToAddress(deviceUuid, (error, address = 'unknown', addressType = 'unknown') => {
          this._peripherals[deviceUuid].address = address;
          this._peripherals[deviceUuid].addressType = addressType;

          this.emit('discover', deviceUuid, address, addressType, connectable, advertisement, rssi);
        });
      })(deviceUuid, advertisement, rssi);
    });

    this.on(cmdToNumber.CONNECT_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');

      debug(`peripheral ${deviceUuid} connected`);

      this.emit('connect', deviceUuid);
    });

    /**
     * Response to disconnect
     *
     * @discussion tested
     */
    this.on(cmdToNumber.DISCONNECT_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');

      debug(`peripheral ${deviceUuid} disconnected`);

      this.emit('disconnect', deviceUuid);
    });

    /**
     * Response to RSSI update
     *
     * @discussion tested
     */
    this.on(cmdToNumber.UPDATE_RSSI_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const rssi = args.kCBMsgArgData;

      this._peripherals[deviceUuid].rssi = rssi;

      debug(`peripheral ${deviceUuid} RSSI update ${rssi}`);

      this.emit('rssiUpdate', deviceUuid, rssi);
    });

    /**
     * Response to discover service
     *
     * @discussion tested
     */
    this.on(cmdToNumber.DISCOVER_SERVICES_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const serviceUuids: string[] = [];

      this._peripherals[deviceUuid].services = this._peripherals[deviceUuid].services || {};

      if (args.kCBMsgArgServices) {
        for (const kCBMsgArgService of args.kCBMsgArgServices) {
          const service = {
            uuid: kCBMsgArgService.kCBMsgArgUUID.toString('hex'),
            startHandle: kCBMsgArgService.kCBMsgArgServiceStartHandle,
            endHandle: kCBMsgArgService.kCBMsgArgServiceEndHandle,
          };

          if (!this._peripherals[deviceUuid].services[service.uuid]) {
            this._peripherals[deviceUuid].services[service.uuid] = this._peripherals[deviceUuid].services[service.startHandle] = service;
          }

          serviceUuids.push(service.uuid);
        }
      }
      // TODO: result 24 => device not connected

      this.emit('servicesDiscover', deviceUuid, serviceUuids);
    });

    /**
     * Response to dicover included services
     *
     * @dicussion tested
     */
    this.on(cmdToNumber.DISCOVER_INCLUDED_SERVICES_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const serviceStartHandle = args.kCBMsgArgServiceStartHandle;
      const serviceUuid = this._peripherals[deviceUuid].services[serviceStartHandle].uuid;
      const includedServiceUuids: string[] = [];

      this._peripherals[deviceUuid].services[serviceStartHandle].includedServices =
        this._peripherals[deviceUuid].services[serviceStartHandle].includedServices || {};

      for (const kCBMsgArgService of args.kCBMsgArgServices) {
        const includedService = {
          uuid: kCBMsgArgService.kCBMsgArgUUID.toString('hex'),
          startHandle: kCBMsgArgService.kCBMsgArgServiceStartHandle,
          endHandle: kCBMsgArgService.kCBMsgArgServiceEndHandle,
        };

        if (!this._peripherals[deviceUuid].services[serviceStartHandle].includedServices[includedService.uuid]) {
          this._peripherals[deviceUuid].services[serviceStartHandle].includedServices[includedService.uuid] = this._peripherals[
            deviceUuid
          ].services[serviceStartHandle].includedServices[includedService.startHandle] = includedService;
        }

        includedServiceUuids.push(includedService.uuid);
      }

      this.emit('includedServicesDiscover', deviceUuid, serviceUuid, includedServiceUuids);
    });

    /**
     * Response to characteristic discovery
     *
     * @discussion tested
     */
    this.on(cmdToNumber.DISCOVER_CHARACTERISTICS_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const serviceStartHandle = args.kCBMsgArgServiceStartHandle;
      const serviceUuid = this._peripherals[deviceUuid].services[serviceStartHandle].uuid;
      const characteristics: MacCharacteristic[] = [];

      this._peripherals[deviceUuid].services[serviceStartHandle].characteristics =
        this._peripherals[deviceUuid].services[serviceStartHandle].characteristics || {};

      for (const kCBMsgArgCharacteristic of args.kCBMsgArgCharacteristics) {
        const properties = shared.propertyBitstoPropertyNames(kCBMsgArgCharacteristic.kCBMsgArgCharacteristicProperties);

        const characteristic = {
          uuid: kCBMsgArgCharacteristic.kCBMsgArgUUID.toString('hex'),
          handle: kCBMsgArgCharacteristic.kCBMsgArgCharacteristicHandle,
          valueHandle: kCBMsgArgCharacteristic.kCBMsgArgCharacteristicValueHandle,
          properties: properties,
        };

        this._peripherals[deviceUuid].services[serviceStartHandle].characteristics[characteristic.uuid] = this._peripherals[
          deviceUuid
        ].services[serviceStartHandle].characteristics[characteristic.handle] = this._peripherals[deviceUuid].services[
          serviceStartHandle
        ].characteristics[characteristic.valueHandle] = characteristic;

        characteristics.push({
          uuid: characteristic.uuid,
          properties: characteristic.properties,
        });
      }

      this.emit('characteristicsDiscover', deviceUuid, serviceUuid, characteristics);
    });

    /**
     * Response to read value
     *
     * @discussion tested
     */
    this.on(cmdToNumber.READ_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const characteristicHandle = args.kCBMsgArgCharacteristicHandle;
      const isNotification = !!args.kCBMsgArgIsNotification;
      const data = args.kCBMsgArgData;

      const peripheral = this._peripherals[deviceUuid];

      if (peripheral) {
        for (const i in peripheral.services) {
          if (peripheral.services[i].characteristics && peripheral.services[i].characteristics[characteristicHandle]) {
            this.emit(
              'read',
              deviceUuid,
              peripheral.services[i].uuid,
              peripheral.services[i].characteristics[characteristicHandle].uuid,
              data,
              isNotification
            );
            break;
          }
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn(`noble (mac-xpc): received read event from unknown peripheral: ${deviceUuid} !`);
      }
    });

    /**
     * Response to write
     *
     * @discussion tested
     */
    this.on(cmdToNumber.WRITE_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const characteristicHandle = args.kCBMsgArgCharacteristicHandle;

      for (const i in this._peripherals[deviceUuid].services) {
        if (
          this._peripherals[deviceUuid].services[i].characteristics &&
          this._peripherals[deviceUuid].services[i].characteristics[characteristicHandle]
        ) {
          this.emit(
            'write',
            deviceUuid,
            this._peripherals[deviceUuid].services[i].uuid,
            this._peripherals[deviceUuid].services[i].characteristics[characteristicHandle].uuid
          );
          break;
        }
      }
    });

    /**
     * Response notification
     *
     * @discussion tested
     */
    this.on(cmdToNumber.NOTIFY_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const characteristicHandle = args.kCBMsgArgCharacteristicHandle;
      const state = !!args.kCBMsgArgState;

      for (const i in this._peripherals[deviceUuid].services) {
        if (
          this._peripherals[deviceUuid].services[i].characteristics &&
          this._peripherals[deviceUuid].services[i].characteristics[characteristicHandle]
        ) {
          this.emit(
            'notify',
            deviceUuid,
            this._peripherals[deviceUuid].services[i].uuid,
            this._peripherals[deviceUuid].services[i].characteristics[characteristicHandle].uuid,
            state
          );
          break;
        }
      }
    });

    /**
     * Response to descriptor discovery
     *
     * @discussion tested
     */
    this.on(cmdToNumber.DISCOVER_DESCRIPTORS_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const characteristicHandle = args.kCBMsgArgCharacteristicHandle;
      const descriptors: string[] = []; // args.kCBMsgArgDescriptors;

      for (const i in this._peripherals[deviceUuid].services) {
        if (
          this._peripherals[deviceUuid].services[i].characteristics &&
          this._peripherals[deviceUuid].services[i].characteristics[characteristicHandle]
        ) {
          this._peripherals[deviceUuid].services[i].characteristics[characteristicHandle].descriptors = {};

          for (const kCBMsgArgDescriptor of args.kCBMsgArgDescriptors) {
            const descriptor = {
              uuid: kCBMsgArgDescriptor.kCBMsgArgUUID.toString('hex'),
              handle: kCBMsgArgDescriptor.kCBMsgArgDescriptorHandle,
            };

            this._peripherals[deviceUuid].services[i].characteristics[characteristicHandle].descriptors[
              descriptor.uuid
            ] = this._peripherals[deviceUuid].services[i].characteristics[characteristicHandle].descriptors[descriptor.handle] = descriptor;

            descriptors.push(descriptor.uuid);
          }

          this.emit(
            'descriptorsDiscover',
            deviceUuid,
            this._peripherals[deviceUuid].services[i].uuid,
            this._peripherals[deviceUuid].services[i].characteristics[characteristicHandle].uuid,
            descriptors
          );
          break;
        }
      }
    });

    /**
     * Response to read value
     *
     * @discussion tested
     */
    this.on(cmdToNumber.READ_VALUE_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const descriptorHandle = args.kCBMsgArgDescriptorHandle;
      const data = args.kCBMsgArgData;

      this.emit('handleRead', deviceUuid, descriptorHandle, data);

      for (const i in this._peripherals[deviceUuid].services) {
        for (const j in this._peripherals[deviceUuid].services[i].characteristics) {
          if (
            this._peripherals[deviceUuid].services[i].characteristics[j].descriptors &&
            this._peripherals[deviceUuid].services[i].characteristics[j].descriptors[descriptorHandle]
          ) {
            this.emit(
              'valueRead',
              deviceUuid,
              this._peripherals[deviceUuid].services[i].uuid,
              this._peripherals[deviceUuid].services[i].characteristics[j].uuid,
              this._peripherals[deviceUuid].services[i].characteristics[j].descriptors[descriptorHandle].uuid,
              data
            );
            return; // break;
          }
        }
      }
    });

    /**
     * Response to write value
     *
     * @discussion tested
     */
    this.on(cmdToNumber.WRITE_VALUE_RESPONSE, args => {
      const deviceUuid = args.kCBMsgArgDeviceUUID.toString('hex');
      const descriptorHandle = args.kCBMsgArgDescriptorHandle;

      this.emit('handleWrite', deviceUuid, descriptorHandle);

      for (const i in this._peripherals[deviceUuid].services) {
        for (const j in this._peripherals[deviceUuid].services[i].characteristics) {
          if (
            this._peripherals[deviceUuid].services[i].characteristics[j].descriptors &&
            this._peripherals[deviceUuid].services[i].characteristics[j].descriptors[descriptorHandle]
          ) {
            this.emit(
              'valueWrite',
              deviceUuid,
              this._peripherals[deviceUuid].services[i].uuid,
              this._peripherals[deviceUuid].services[i].characteristics[j].uuid,
              this._peripherals[deviceUuid].services[i].characteristics[j].descriptors[descriptorHandle].uuid
            );
            return; // break;
          }
        }
      }
    });
  }
}
