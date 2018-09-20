import { Noble } from './lib/noble';
import bindings from './lib/resolve-bindings';

const noble = new Noble(bindings());

export * from './lib/characteristic';
export * from './lib/descriptor';
export * from './lib/peripheral';
export * from './lib/service';
export default noble;
