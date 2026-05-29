# Migrating a node from the rpyc transport to the REST transport

> **Status:** rpyc node transport is **deprecated** as of v0.9.0 and
> will be **removed in v1.0**. New deployments should use the REST
> agent. Existing rpyc nodes continue to work in v0.9.x; the panel
> logs a one-shot `DEPRECATED` warning per process when an rpyc node
> connects.

The panel auto-detects which transport a node speaks. When a node is
connected it tries an HTTP probe first (`HEAD /` to the node's
control port); if the node replies HTTP-ish, the panel uses the REST
transport (`ReSTXRayNode`); otherwise it falls back to rpyc
(`RPyCXRayNode`). See `app/xray/node.py:XRayNode.__new__` for the
detection logic.

You don't need to change anything panel-side — switching a node to the
REST agent is a node-side operation. Once the node serves HTTP on its
control port, the next `connect_node` will pick `ReSTXRayNode`.

## Steps

1. **Verify which transport the node is currently using.** The
   simplest signal is the deprecation warning in the panel log:
   ```
   DEPRECATED: rpyc node transport is in use. The REST (uvicorn-based)
   marzban-node agent is the supported transport going forward;
   rpyc support will be removed in v1.0.
   ```
   If you see it, at least one of your nodes is still on rpyc.

2. **On the node host**, update the marzban-node service to a version
   that ships the uvicorn/REST agent. The upstream marzban-node
   project provides a REST-capable image; pin to a tag that has it
   (consult upstream release notes). If you maintain a custom node
   build, switch the entrypoint from the rpyc service to the
   uvicorn-based one.

3. **Confirm the node control port speaks HTTPS.** From the panel
   host:
   ```bash
   curl -k -i https://<node-address>:<node-port>/
   ```
   A response (even 404) is enough — the panel only needs any
   HTTP-ish reply to choose the REST transport.

4. **Trigger a reconnect** from the panel UI (Nodes → Reconnect) or
   wait for the next 10 s health check (`core_health_check` in
   `app/jobs/xray_core.py`). On the next connection, the panel will
   probe HTTP, get a reply, and use `ReSTXRayNode`. The deprecation
   warning will no longer fire for that node.

5. **(Optional) Verify the transport selection.** With `LOG_FORMAT=json`
   you can grep for the `XRayNode.__new__` branch decision; otherwise
   look for the disappearance of the `DEPRECATED` warning on next
   panel restart.

## What does NOT change

- Node TLS certs: the same mTLS cert pair is reused. The panel
  presents its TLS key/cert in both transports.
- Node API gRPC port (`api_port`, default 62051): the Xray data plane
  is unaffected — both transports open the same gRPC channel for
  stats and user provisioning after `start`.
- DB schema: `Node` row format is identical.

## Troubleshooting

- **Node still detected as rpyc after the upgrade.** The detection
  uses a 1 s TCP probe (see `XRayNode.__new__` in
  `app/xray/node.py`). If the node is slow to bind its HTTPS port, the
  panel can race the probe. Restart the panel after the node is fully
  up.
- **TLS verification errors.** REST nodes use mTLS with a SAN-ignoring
  adapter (`SANIgnoringAdaptor` in `app/xray/node.py`). The panel pins
  the node's server cert on first `/connect`. If you regenerated certs
  on the node, restart the panel so the cache resets.

## Removal timeline

- **v0.9.x:** rpyc supported, one-shot deprecation warning per process.
- **v1.0:** `RPyCXRayNode` removed. Any node that doesn't speak HTTP
  on its control port will fail to connect. Plan to migrate before
  v1.0 ships.
