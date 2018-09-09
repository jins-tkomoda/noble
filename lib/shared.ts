export const propertyBitstoPropertyNames = (propertyBits: number): string[] => {
  const propertyNames: string[] = [];

  if (propertyBits & 0x01) {
    propertyNames.push('broadcast');
  }
  if (propertyBits & 0x02) {
    propertyNames.push('read');
  }
  if (propertyBits & 0x04) {
    propertyNames.push('writeWithoutResponse');
  }
  if (propertyBits & 0x08) {
    propertyNames.push('write');
  }
  if (propertyBits & 0x10) {
    propertyNames.push('notify');
  }
  if (propertyBits & 0x20) {
    propertyNames.push('indicate');
  }
  if (propertyBits & 0x40) {
    propertyNames.push('authenticatedSignedWrites');
  }
  if (propertyBits & 0x80) {
    propertyNames.push('extendedProperties');
  }

  return propertyNames;
};

