import { Noble } from './lib/noble';

const noble = new Noble();

export * from './lib/characteristic';
export * from './lib/descriptor';
export * from './lib/peripheral';
export * from './lib/service';
export default noble;
