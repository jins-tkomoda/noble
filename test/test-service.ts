import 'should';
import * as sinon from 'sinon';

import { Service } from '../lib/service';
import { Characteristic } from '../lib/characteristic';

describe('service', () => {
  let mockNoble: any;
  const mockPeripheralId = 'mock-peripheral-id';
  const mockUuid = 'mock-uuid';

  let service: Service;

  beforeEach(() => {
    mockNoble = {
      discoverIncludedServices: sinon.spy(),
      discoverCharacteristics: sinon.spy(),
    };

    service = new Service(mockNoble, mockPeripheralId, mockUuid);
  });

  it('should have a uuid', () => {
    service.uuid.should.equal(mockUuid);
  });

  it('should lookup name and type by uuid', () => {
    service = new Service(mockNoble, mockPeripheralId, '1800');

    service.name!.should.equal('Generic Access');
    service.type!.should.equal('org.bluetooth.service.generic_access');
  });

  describe('toString', () => {
    it('should be uuid, name, type, includedServiceUuids', () => {
      service.toString().should.equal('{"uuid":"mock-uuid","name":null,"type":null,"includedServiceUuids":[]}');
    });
  });

  describe('discoverIncludedServices', () => {
    it('should delegate to noble', () => {
      service.discoverIncludedServices();

      mockNoble.discoverIncludedServices.calledWithExactly(mockPeripheralId, mockUuid, []).should.equal(true);
    });

    it('should delegate to noble, with uuids', () => {
      const mockUuids: string[] = [];

      service.discoverIncludedServices(mockUuids);

      mockNoble.discoverIncludedServices.calledWithExactly(mockPeripheralId, mockUuid, mockUuids).should.equal(true);
    });

    it('should callback', done => {
      service.discoverIncludedServices([], () => {
        done();
      });
      service.emit('includedServicesDiscover');
    });

    it('should callback with data', done => {
      const mockIncludedServiceUuids: string[] = [];
      service.discoverIncludedServices([], (error, includedServiceUuids) => {
        includedServiceUuids!.should.equal(mockIncludedServiceUuids);
        done();
      });
      service.emit('includedServicesDiscover', mockIncludedServiceUuids);
    });

    it('should return a promise', done => {
      const mockIncludedServiceUuids: string[] = [];
      service.discoverIncludedServices().then(includedServiceUuids => {
        includedServiceUuids.should.equal(mockIncludedServiceUuids);
        done();
      });
      service.emit('includedServicesDiscover', mockIncludedServiceUuids);
    });
  });

  describe('discoverCharacteristics', () => {
    it('should delegate to noble', () => {
      service.discoverCharacteristics();

      mockNoble.discoverCharacteristics.calledWithExactly(mockPeripheralId, mockUuid, []).should.equal(true);
    });

    it('should delegate to noble, with uuids', () => {
      const mockUuids: string[] = [];

      service.discoverCharacteristics(mockUuids);

      mockNoble.discoverCharacteristics.calledWithExactly(mockPeripheralId, mockUuid, mockUuids).should.equal(true);
    });

    it('should callback', done => {
      service.discoverCharacteristics([], () => {
        done();
      });
      service.emit('characteristicsDiscover');
    });

    it('should callback with data', done => {
      const mockCharacteristics: Characteristic[] = [];

      service.discoverCharacteristics([], (error, mockCharacteristics) => {
        mockCharacteristics!.should.equal(mockCharacteristics);
        done();
      });
      service.emit('characteristicsDiscover', mockCharacteristics);
    });

    it('should return a promise', done => {
      const mockCharacteristics: Characteristic[] = [];

      service.discoverCharacteristics().then(mockCharacteristics => {
        mockCharacteristics.should.equal(mockCharacteristics);
        done();
      });
      service.emit('characteristicsDiscover', mockCharacteristics);
    });
  });
});
