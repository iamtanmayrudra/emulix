import http from "node:http";
import net, { type AddressInfo } from "node:net";
import { parseTargetUrl, resolvesToPublicAddress } from "@/lib/testing/url-guard";

/**
 * Local HTTP proxy that the audit browser must use. Plain requests and CONNECT tunnels are only passed on
 * when the host resolves to a public address, so pages cannot reach private networks through the audit.
 * Checks happen per request, so redirects and sub-resources are covered too.
 */
export async function startPublicOnlyProxy(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(async (req, res) => {
    const target = parseTargetUrl(req.url ?? "");
    if (!target.ok || target.url.protocol !== "http:" || !(await resolvesToPublicAddress(target.url.hostname))) {
      res.writeHead(403, { "Content-Type": "text/plain" }).end("Blocked: non-public address");
      return;
    }
    const headers = { ...req.headers };
    delete headers["proxy-connection"];
    const upstream = http.request(target.url, { method: req.method, headers }, (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    });
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });

  server.on("connect", async (req, client, head) => {
    const target = parseTargetUrl(`https://${req.url ?? ""}`);
    if (!target.ok || !(await resolvesToPublicAddress(target.url.hostname))) {
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    const upstream = net.connect(Number(target.url.port || 443), target.url.hostname, () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on("error", () => client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"));
    client.on("error", () => upstream.destroy());
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
