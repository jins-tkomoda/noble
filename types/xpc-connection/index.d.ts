import * as event from 'events';

declare global {
  interface Buffer {
      isUuid?: boolean;
  }
}

declare class XpcConnection extends event.EventEmitter {
  constructor(serviceName: string);
  setup(): void;

  sendMessage(message?: XpcConnection.XpcObject): void;
}


declare namespace XpcConnection {
  interface XpcMsgArgOptions {
    kCBScanOptionAllowDuplicates?: number;
  }

  export interface XpcObject {
    kCBMsgArgOptions?: XpcMsgArgOptions;
    kCBMsgArgName?: string;
    kCBMsgArgDeviceUUID?: Buffer;
    kCBMsgArgUUIDs?: Buffer[];
    CBMsgArgType?: number;
  }
}

export = XpcConnection;
