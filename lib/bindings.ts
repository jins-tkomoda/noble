import { Characteristic } from './characteristic';
import { Advertisement } from './peripheral';

export type NobleBindingsConstructor = new (options?: object) => NobleBindingsInterface;

export interface NobleBindingsInterface {
  init(): void;
  startScanning(serviceUuids: string[], allowDuplicates: boolean): void;
  stopScanning(): void;
  connect(peripheralUuid: string): void;
  disconnect(peripheralUuid: string): void;
  updateRssi(peripheralUuid: string): void;
  discoverServices(peripheralUuid: string, serviceUuids: string[]): void;
  discoverIncludedServices(peripheralUuid: string, serviceUuid: string, serviceUuids: string[]): void;
  discoverCharacteristics(peripheralUuid: string, serviceUuid: string, characteristicUuids: string[]): void;
  discoverDescriptors(peripheralUuid: string, serviceUuid: string, characteristicUuid: string): void;
  read(peripheralUuid: string, serviceUuid: string, characteristicUuid: string): void;
  readValue(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string): void;
  write(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, data: Buffer, withoutResponse: boolean): void;
  writeValue(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer): void;
  readHandle(peripheralUuid: string, handle: number): void;
  writeHandle(peripheralUuid: string, handle: number, data: Buffer, withoutResponse: boolean): void;
  broadcast(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, broadcast: boolean): void;
  notify(peripheralUuid: string, serviceUuid: string, characteristicUuid: string, notify: boolean): void;

  on(event: 'stateChange', listener: (state: string) => void): this;
  on(event: 'scanStart', listener: (filterDuplicates: boolean) => void): this;
  on(event: 'scanStop', listener: () => void): this;
  on(
    event: 'discover',
    listener: (uuid: string, address: string, addressType: string, connectable: boolean, advertisement: Advertisement, rssi: number) => void
  ): this;
  on(event: 'addressChange', listener: (address: string) => void): this;
  on(event: 'connect', listener: (peripheralUuid: string, error?: Error) => void): this;
  on(event: 'disconnect', listener: (peripheralUuid: string) => void): this;
  on(event: 'rssiUpdate', listener: (peripheralUuid: string, rssi: number) => void): this;
  on(event: 'servicesDiscover', listener: (peripheralUuid: string, serviceUuids: string[]) => void): this;
  on(
    event: 'includedServicesDiscover',
    listener: (peripheralUuid: string, serviceUuid: string, includedServiceUuids: string[]) => void
  ): this;
  on(
    event: 'characteristicsDiscover',
    listener: (peripheralUuid: string, serviceUuid: string, characteristics: Characteristic[]) => void
  ): this;
  on(
    event: 'read',
    listener: (peripheralUuid: string, serviceUuid: string, characteristicUuid: string, data: Buffer, isNotification: boolean) => void
  ): this;
  on(event: 'write', listener: (peripheralUuid: string, serviceUuid: string, characteristicUuid: string) => void): this;
  on(event: 'broadcast', listener: (peripheralUuid: string, serviceUuid: string, characteristicUuid: string, state: string) => void): this;
  on(event: 'notify', listener: (peripheralUuid: string, serviceUuid: string, characteristicUuid: string, state: string) => void): this;
  on(
    event: 'descriptorsDiscover',
    listener: (peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuids: string[]) => void
  ): this;
  on(
    event: 'valueRead',
    listener: (peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data: Buffer) => void
  ): this;
  on(
    event: 'valueWrite',
    listener: (peripheralUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) => void
  ): this;
  on(event: 'handleRead', listener: (peripheralUuid: string, handle: number, data: Buffer) => void): this;
  on(event: 'handleWrite', listener: (peripheralUuid: string, handle: number) => void): this;
  on(event: 'handleNotify', listener: (peripheralUuid: string, handle: number, data: Buffer) => void): this;
}
