export function resolveBindings() {
  if (navigator.bluetooth && !process.env.NOBLE_WEBSOCKET) {
    return new (require('./webbluetooth/bindings')).NobleBindings();
  }

  return new (require('./websocket/bindings')).NobleBindings();
}
