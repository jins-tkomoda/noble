export default function resolveBindings() {
  if (navigator.bluetooth && !process.env.NOBLE_WEBSOCKET) {
    return new (require('./webbluetooth/bindings').default)();
  }

  return new (require('./websocket/bindings').default)();
}
