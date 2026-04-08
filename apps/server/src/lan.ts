import os from "node:os";

function isPrivateIpv4(address: string): boolean {
  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

export function getLanOrigin(port: number): string {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const values of Object.values(interfaces)) {
    for (const entry of values ?? []) {
      if (entry.family === "IPv4" && !entry.internal && isPrivateIpv4(entry.address)) {
        candidates.push(entry.address);
      }
    }
  }

  const host = candidates.sort()[0] ?? "localhost";
  return `http://${host}:${port}`;
}
