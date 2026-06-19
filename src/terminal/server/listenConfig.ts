export function getServerListenOptions(port: number) {
  return {
    port,
    host: "0.0.0.0",
  };
}
