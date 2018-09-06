import { Noble } from './lib/noble';
import bindings from './lib/resolve-bindings';

const noble = new Noble(bindings());

export = noble;
