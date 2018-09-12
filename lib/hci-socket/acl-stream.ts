import * as events from 'events';

import { Hci } from './hci';
import { Smp } from './smp';

export class AclStream extends events.EventEmitter {
  private _hci: Hci;
  private _handle: number;
  private _smp: Smp;
  private onSmpStkBinded: (stk: Buffer) => void;
  private onSmpFailBinded: () => void;
  private onSmpEndBinded: () => void;

  constructor(hci: Hci, handle: number, localAddressType: string, localAddress: string, remoteAddressType: string, remoteAddress: string) {
    super();
    this._hci = hci;
    this._handle = handle;

    this._smp = new Smp(this, localAddressType, localAddress, remoteAddressType, remoteAddress);

    this.onSmpStkBinded = this.onSmpStk.bind(this);
    this.onSmpFailBinded = this.onSmpFail.bind(this);
    this.onSmpEndBinded = this.onSmpEnd.bind(this);

    this._smp.on('stk', this.onSmpStkBinded);
    this._smp.on('fail', this.onSmpFailBinded);
    this._smp.on('end', this.onSmpEndBinded);
  }

  encrypt() {
    this._smp.sendPairingRequest();
  }

  write(cid: number, data: Buffer) {
    this._hci.queueAclDataPkt(this._handle, cid, data);
  }

  push(cid: number | null, data?: Buffer) {
    if (data) {
      this.emit('data', cid, data);
    } else {
      this.emit('end');
    }
  }

  pushEncrypt(encrypt: boolean) {
    this.emit('encrypt', encrypt);
  }

  onSmpStk(stk: Buffer) {
    const random = Buffer.from('0000000000000000', 'hex');
    const diversifier = Buffer.from('0000', 'hex');

    this._hci.startLeEncryption(this._handle, random, diversifier, stk);
  }

  onSmpFail() {
    this.emit('encryptFail');
  }

  onSmpEnd() {
    this._smp.removeListener('stk', this.onSmpStkBinded);
    this._smp.removeListener('fail', this.onSmpFailBinded);
    this._smp.removeListener('end', this.onSmpEndBinded);
  }
}
