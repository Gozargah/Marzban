import { afterEach, test, expect, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createHostsResource } from "../../src/features/hosts/resource";
import { createCoreResource, type CoreSettings } from "../../src/features/core/resource";
import { queryKeys } from "../../src/features/shared/query-keys";
import { network, flushPromises } from "../helpers/network";
const clients: QueryClient[] = [];
afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client);
  const net = network(), refresh = mock(async () => {});
  return { client, net, refresh, hosts: createHostsResource(client, net.fetch), core: createCoreResource(client, net.fetch, refresh) };
}
test("hosts failure preserves last successful data; cancelled late read cannot overwrite save", async () => {
  const { client, net, hosts } = setup();
  client.setQueryData(queryKeys.hosts, { existing: [] });
  const reading = client.fetchQuery({ ...hosts.options(), staleTime: 0 });
  net.calls[0].reject(new Error("offline")); await expect(reading).rejects.toThrow("offline");
  expect(client.getQueryData(queryKeys.hosts)).toEqual({ existing: [] });
  const old = client.fetchQuery({ ...hosts.options(), staleTime: 0 }).catch(() => {});
  const saving = hosts.save({ saved: [] }); await flushPromises();
  expect(net.calls[1].options.signal.aborted).toBe(true);
  net.calls[2].resolve({}); await saving;
  net.calls[1].resolve({ late: [] }); await old;
  expect(client.getQueryData(queryKeys.hosts)).toEqual({ saved: [] });
});
test("failed hosts save keeps cache unchanged", async () => {
  const { client, net, hosts } = setup(); client.setQueryData(queryKeys.hosts, { saved: [] });
  const saving = hosts.save({ draft: [] }); await flushPromises();
  net.calls[0].reject(new Error("offline")); await expect(saving).rejects.toThrow("offline");
  expect(client.getQueryData(queryKeys.hosts)).toEqual({ saved: [] });
});
test("core reads publish atomically and failed read aborts sibling", async () => {
  const { client, net, core } = setup();
  const reading = client.fetchQuery(core.options());
  net.calls[0].resolve({ version: "1", started: true, logs_websocket: "/logs" }); await flushPromises();
  expect(client.getQueryData(queryKeys.core)).toBeUndefined();
  net.calls[1].resolve({ inbounds: [] }); await reading;
  expect(client.getQueryData(queryKeys.core)).toMatchObject({ version: "1", config: JSON.stringify({ inbounds: [] }, null, 2) });
  const failed = client.fetchQuery({ ...core.options(), staleTime: 0 });
  net.calls[2].reject(new Error("offline")); await expect(failed).rejects.toThrow("offline");
  expect(net.calls[3].options.signal.aborted).toBe(true); net.calls[3].resolve({});
  expect(client.getQueryData(queryKeys.core)).toHaveProperty("version", "1");
});
test("cancelling core closes both requests and ignores late responses", async () => {
  const { client, net, core } = setup();
  const reading = client.fetchQuery(core.options()).catch(() => {});
  await core.cancel();
  expect(net.calls[0].options.signal.aborted).toBe(true); expect(net.calls[1].options.signal.aborted).toBe(true);
  net.calls[0].resolve({ version: "late" }); net.calls[1].resolve({}); await reading;
  expect(client.getQueryData(queryKeys.core)).toBeUndefined();
});
test("core save validates JSON, sends an object and tolerates inbound refresh failure", async () => {
  const { client, net, core, refresh } = setup();
  await expect(core.save("{bad")).rejects.toThrow(); expect(net.calls).toHaveLength(0);
  client.setQueryData<CoreSettings>(queryKeys.core, { version: "1", started: true, logs_websocket: null, config: "{}" });
  refresh.mockRejectedValueOnce(new Error("offline"));
  const saving = core.save('{"inbounds":[]}'); await flushPromises();
  expect(net.calls[0].options.body).toEqual({ inbounds: [] }); net.calls[0].resolve({}); await saving;
  expect(client.getQueryData(queryKeys.core)).toHaveProperty("config", JSON.stringify({ inbounds: [] }, null, 2));
});
test("failed core save preserves cached config and does not refresh inbounds", async () => {
  const { client, net, core, refresh } = setup();
  client.setQueryData(queryKeys.core, { config: "{}" });
  const saving = core.save('{"changed":true}'); await flushPromises();
  net.calls[0].reject(new Error("invalid")); await expect(saving).rejects.toThrow("invalid");
  expect(client.getQueryData(queryKeys.core)).toEqual({ config: "{}" }); expect(refresh).not.toHaveBeenCalled();
});
test("restart sends POST and propagates failures", async () => {
  const { net, core } = setup(); const restarting = core.restart();
  expect(net.calls[0]).toMatchObject({ url: "/core/restart", options: { method: "POST", retry: 0 } });
  net.calls[0].reject(new Error("offline")); await expect(restarting).rejects.toThrow("offline");
});

test.each(["null", "[]", "1", '"text"'])("invalid core root %s never reaches the API", async (json) => {
  const { net, core } = setup(); await expect(core.save(json)).rejects.toThrow("core.objectRequired"); expect(net.calls).toHaveLength(0);
});
