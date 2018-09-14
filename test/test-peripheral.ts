import 'should';
import * as sinon from 'sinon';

import { Advertisement, Peripheral } from '../lib/peripheral';
import { Characteristic } from '../lib/characteristic';
import { Service } from '../lib/service';

describe('Peripheral', () => {
  let mockNoble: any;
  const mockId = 'mock-id';
  const mockAddress = 'mock-address';
  const mockAddressType = 'mock-address-type';
  const mockConnectable = true;
  const mockAdvertisement = {
    localName: 'mockName',
    txPowerLevel: 0,
    manufacturerData: null,
    serviceUuids: [],
    serviceData: [{ uuid: 'mock-service-uuid', data: Buffer.alloc(0) }],
  };
  const mockRssi = 0;
  const mockHandle = 1;
  let mockData = Buffer.from('mock-data');

  let peripheral: Peripheral;

  beforeEach(() => {
    mockNoble = {
      connect: sinon.spy(),
      disconnect: sinon.spy(),
      updateRssi: sinon.spy(),
      discoverServices: sinon.spy(),
      readHandle: sinon.spy(),
      writeHandle: sinon.spy(),
    };

    peripheral = new Peripheral(mockNoble, mockId, mockAddress, mockAddressType, mockConnectable, mockAdvertisement, mockRssi);
  });

  afterEach(() => {
    peripheral = (null as any) as Peripheral;
  });

  it('should have a id', () => {
    peripheral.id.should.equal(mockId);
  });

  it('should have an address', () => {
    peripheral.address.should.equal(mockAddress);
  });

  it('should have an address type', () => {
    peripheral.addressType.should.equal(mockAddressType);
  });

  it('should have connectable', () => {
    peripheral.connectable.should.equal(mockConnectable);
  });

  it('should have advertisement', () => {
    peripheral.advertisement.should.equal(mockAdvertisement);
  });

  it('should have rssi', () => {
    peripheral.rssi.should.equal(mockRssi);
  });

  describe('toString', () => {
    const expected = JSON.stringify({
      id: mockId,
      address: mockAddress,
      addressType: mockAddressType,
      connectable: mockConnectable,
      advertisement: mockAdvertisement,
      rssi: mockRssi,
      state: 'disconnected',
    });
    it('should be id, address, address type, connectable, advertisement, rssi, state', () => {
      peripheral.toString().should.equal(expected);
    });
  });

  describe('connect', () => {
    it('should delegate to noble', () => {
      peripheral.connect();

      mockNoble.connect.calledWithExactly(mockId).should.equal(true);
    });

    it('should callback', done => {
      peripheral.connect(() => {
        done();
      });
      peripheral.emit('connect');
    });

    it('should return a promise', done => {
      peripheral.connect().then(() => {
        done();
      });
      peripheral.emit('connect');
    });
  });

  describe('disconnect', () => {
    it('should delegate to noble', () => {
      peripheral.disconnect();

      mockNoble.disconnect.calledWithExactly(mockId).should.equal(true);
    });

    it('should callback', done => {
      peripheral.disconnect(() => {
        done();
      });
      peripheral.emit('disconnect');
    });

    it('should return a promise', done => {
      peripheral.disconnect().then(() => {
        done();
      });
      peripheral.emit('disconnect');
    });
  });

  describe('updateRssi', () => {
    it('should delegate to noble', () => {
      peripheral.updateRssi();

      mockNoble.updateRssi.calledWithExactly(mockId).should.equal(true);
    });

    it('should callback', done => {
      peripheral.updateRssi(() => {
        done();
      });
      peripheral.emit('rssiUpdate');
    });

    it('should callback with rssi', done => {
      peripheral.updateRssi((error, rssi) => {
        rssi!.should.equal(mockRssi);
        done();
      });
      peripheral.emit('rssiUpdate', mockRssi);
    });

    it('should return a promise', done => {
      peripheral.updateRssi().then(rssi => {
        rssi.should.equal(mockRssi);
        done();
      });
      peripheral.emit('rssiUpdate', mockRssi);
    });
  });

  describe('discoverServices', () => {
    it('should delegate to noble', () => {
      peripheral.discoverServices();

      mockNoble.discoverServices.calledWithExactly(mockId, []).should.equal(true);
    });

    it('should delegate to noble, service uuids', () => {
      const mockServiceUuids: string[] = [];

      peripheral.discoverServices(mockServiceUuids);

      mockNoble.discoverServices.calledWithExactly(mockId, mockServiceUuids).should.equal(true);
    });

    it('should callback', done => {
      peripheral.discoverServices([], () => {
        done();
      });
      peripheral.emit('servicesDiscover');
    });

    it('should callback with services', done => {
      const mockServices: Service[] = [];

      peripheral.discoverServices([], (error, services) => {
        services!.should.equal(mockServices);
        done();
      });
      peripheral.emit('servicesDiscover', mockServices);
    });

    it('should return a promise', done => {
      const mockServices: Service[] = [];

      peripheral.discoverServices().then(services => {
        services.should.equal(mockServices);
        done();
      });
      peripheral.emit('servicesDiscover', mockServices);
    });
  });

  describe('discoverSomeServicesAndCharacteristics', () => {
    const mockServiceUuids: string[] = [];
    const mockCharacteristicUuids: string[] = [];
    let mockServices: any[];

    beforeEach(() => {
      peripheral.discoverServices = sinon.spy();

      mockServices = [
        {
          uuid: '1',
          discoverCharacteristics: sinon.spy(),
        },
        {
          uuid: '2',
          discoverCharacteristics: sinon.spy(),
        },
      ];
    });

    it('should call discoverServices', () => {
      peripheral.discoverSomeServicesAndCharacteristics(mockServiceUuids, []);

      (peripheral.discoverServices as any).calledWith(mockServiceUuids).should.equal(true);
    });

    it('should call discoverCharacteristics on each service discovered', () => {
      peripheral.discoverSomeServicesAndCharacteristics(mockServiceUuids, mockCharacteristicUuids);

      const discoverServicesCallback = (peripheral.discoverServices as any).getCall(0).args[1];

      discoverServicesCallback(null, mockServices);

      mockServices[0].discoverCharacteristics.calledWith(mockCharacteristicUuids).should.equal(true);
      mockServices[1].discoverCharacteristics.calledWith(mockCharacteristicUuids).should.equal(true);
    });

    it('should callback', done => {
      peripheral.discoverSomeServicesAndCharacteristics(mockServiceUuids, mockCharacteristicUuids, () => {
        done();
      });

      const discoverServicesCallback = (peripheral.discoverServices as any).getCall(0).args[1];

      discoverServicesCallback(null, mockServices);

      mockServices[0].discoverCharacteristics.getCall(0).args[1](null, []);
      mockServices[1].discoverCharacteristics.getCall(0).args[1](null, []);
    });

    it('should callback with the services and characteristics discovered', done => {
      peripheral.discoverSomeServicesAndCharacteristics(mockServiceUuids, mockCharacteristicUuids, (err, services, characteristics) => {
        services!.should.equal(mockServices);
        characteristics!.should.eql([mockCharacteristic1, mockCharacteristic2, mockCharacteristic3]);
        done();
      });

      const discoverServicesCallback = (peripheral.discoverServices as any).getCall(0).args[1];

      discoverServicesCallback(null, mockServices);

      const mockCharacteristic1 = { uuid: '1' };
      const mockCharacteristic2 = { uuid: '2' };
      const mockCharacteristic3 = { uuid: '3' };

      mockServices[0].discoverCharacteristics.getCall(0).args[1](null, [mockCharacteristic1]);
      mockServices[1].discoverCharacteristics.getCall(0).args[1](null, [mockCharacteristic2, mockCharacteristic3]);
    });

    it('should return a promise', done => {
      peripheral.discoverSomeServicesAndCharacteristics(mockServiceUuids, mockCharacteristicUuids).then(({ services, characteristics }) => {
        services!.should.equal(mockServices);
        characteristics!.should.eql([mockCharacteristic1, mockCharacteristic2, mockCharacteristic3]);
        done();
      });

      const discoverServicesCallback = (peripheral.discoverServices as any).getCall(0).args[1];

      discoverServicesCallback(null, mockServices);

      const mockCharacteristic1 = { uuid: '1' };
      const mockCharacteristic2 = { uuid: '2' };
      const mockCharacteristic3 = { uuid: '3' };

      mockServices[0].discoverCharacteristics.getCall(0).args[1](null, [mockCharacteristic1]);
      mockServices[1].discoverCharacteristics.getCall(0).args[1](null, [mockCharacteristic2, mockCharacteristic3]);
    });
  });

  describe('discoverAllServicesAndCharacteristics', () => {
    it('should call discoverSomeServicesAndCharacteristics', () => {
      const mockCallback = sinon.spy();

      peripheral.discoverSomeServicesAndCharacteristics = sinon.spy();

      peripheral.discoverAllServicesAndCharacteristics(mockCallback);

      (peripheral.discoverSomeServicesAndCharacteristics as any).calledWithExactly([], [], mockCallback).should.equal(true);
    });
  });

  describe('readHandle', () => {
    it('should delegate to noble', () => {
      peripheral.readHandle(mockHandle);

      mockNoble.readHandle.calledWithExactly(mockId, mockHandle).should.equal(true);
    });

    it('should callback', done => {
      peripheral.readHandle(mockHandle, () => {
        done();
      });
      peripheral.emit(`handleRead${mockHandle}`);
    });

    it('should callback with data', done => {
      peripheral.readHandle(mockHandle, (error, data) => {
        data!.should.equal(mockData);
        done();
      });
      peripheral.emit(`handleRead${mockHandle}`, mockData);
    });

    it('should return a promise', done => {
      peripheral.readHandle(mockHandle).then(data => {
        data.should.equal(mockData);
        done();
      });
      peripheral.emit(`handleRead${mockHandle}`, mockData);
    });
  });

  describe('writeHandle', () => {
    beforeEach(() => {
      mockData = Buffer.alloc(0);
    });

    it('should only accept data as a buffer', () => {
      mockData = {} as Buffer;

      (function() {
        peripheral.writeHandle(mockHandle, mockData);
      }.should.throwError('data must be a Buffer'));
    });

    it('should delegate to noble, withoutResponse false', () => {
      peripheral.writeHandle(mockHandle, mockData, false);

      mockNoble.writeHandle.calledWithExactly(mockId, mockHandle, mockData, false).should.equal(true);
    });

    it('should delegate to noble, withoutResponse true', () => {
      peripheral.writeHandle(mockHandle, mockData, true);

      mockNoble.writeHandle.calledWithExactly(mockId, mockHandle, mockData, true).should.equal(true);
    });

    it('should callback', done => {
      peripheral.writeHandle(mockHandle, mockData, false, () => {
        done();
      });
      peripheral.emit(`handleWrite${mockHandle}`);
    });

    it('should return a promise', done => {
      peripheral.writeHandle(mockHandle, mockData, false).then(() => {
        done();
      });
      peripheral.emit(`handleWrite${mockHandle}`);
    });
  });
});
