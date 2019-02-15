import * as event from 'events';

declare class BluetoothHciSocket extends event.EventEmitter {
  _isUp: boolean;
  _hciEventEndpointBuffer: Buffer;
  _aclDataInEndpointBuffer: Buffer;
  constructor();
  setFilter(filter?: Buffer): void;
  bindRaw(devId: number): void;
  bindUser(devId: number): void;
  bindControl(): void;
  getDeviceList(): BluetoothHciSocket.HciSocketDeviceInfo[];
  isDevUp(): boolean;
  start(): void;
  stop(): void;
  write(data: Buffer): void;
  onHciEventEndpointData(data: Buffer): void;
  onAclDataInEndpointData(data: Buffer): void;
  reset(): void;
}

declare namespace BluetoothHciSocket {
  interface HciSocketDeviceInfo {
    devId?: string;
    devUp?: string;
    idVendor?: string;
    idProduct?: string;
    busNumber?: number;
    deviceAddress?: number;
  }
}

export = BluetoothHciSocket;
