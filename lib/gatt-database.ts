import * as characteristicsJson from './characteristics.json';
import * as descriptorsJson from './descriptors.json';
import * as servicesJson from './services.json';

export interface GattElement {
    name: string;
    type: string;
}

export interface GattCollection {
  [uuid: string]: GattElement;
}

export const characteristicInfo = (uuid: string) => {
  const characteristics: GattCollection = characteristicsJson;

  return characteristics[uuid];
}

export const descriptorInfo = (uuid: string) => {
  const descriptors: GattCollection = descriptorsJson;

  return descriptors[uuid];
}

export const serviceInfo = (uuid: string) => {
  const services: GattCollection = servicesJson;

  return services[uuid];
}
