"""Normalise per-host Xray options onto the inbound dict used by generators.

Hosts store structured option groups (tls_extra, reality_extra, xhttp_extra,
mux_settings). The subscription generators read flat, camelCase keys from the
inbound dict, so everything is translated in one place here.
"""

from typing import Optional


def apply_host_extras(host_inbound: dict, host: dict) -> None:
    if (reality := host.get("reality_extra")) and host.get("tls") == "reality":
        host_inbound["pbk"] = reality["public_key"]
        host_inbound["sid"] = reality.get("short_id", "")
        host_inbound["spx"] = reality.get("spider_x") or ""

    host_inbound["tls_extra"] = host.get("tls_extra") or None

    if xhttp := host.get("xhttp_extra"):
        mapping = {
            "mode": "mode",
            "x_padding_bytes": "xPaddingBytes",
            "sc_max_each_post_bytes": "scMaxEachPostBytes",
            "no_grpc_header": "noGRPCHeader",
        }
        for src, dst in mapping.items():
            if xhttp.get(src) is not None:
                host_inbound[dst] = xhttp[src]
        if xmux := xhttp.get("xmux"):
            xmux_mapping = {
                "max_concurrency": "maxConcurrency",
                "max_connections": "maxConnections",
                "c_max_reuse_times": "cMaxReuseTimes",
                "h_max_request_times": "hMaxRequestTimes",
                "h_max_reusable_secs": "hMaxReusableSecs",
                "h_keep_alive_period": "hKeepAlivePeriod",
            }
            host_inbound["xmux"] = {
                dst: xmux[src] for src, dst in xmux_mapping.items() if xmux.get(src) is not None
            }

    if mux := host.get("mux_settings"):
        host_inbound["mux_enable"] = bool(mux.get("enabled"))
        host_inbound["mux_settings"] = mux


def xray_tls_extra(tls_extra: Optional[dict]) -> dict:
    """tlsSettings keys for the Xray JSON config."""
    if not tls_extra:
        return {}
    result = {}
    if tls_extra.get("ech_config_list"):
        result["echConfigList"] = tls_extra["ech_config_list"]
    if tls_extra.get("ech_force_query"):
        result["echForceQuery"] = tls_extra["ech_force_query"]
    # Xray (26.x) takes both of these as comma separated strings, not arrays.
    if tls_extra.get("pinned_peer_cert_sha256"):
        result["pinnedPeerCertSha256"] = ",".join(tls_extra["pinned_peer_cert_sha256"])
    if tls_extra.get("verify_peer_cert_by_name"):
        result["verifyPeerCertByName"] = ",".join(tls_extra["verify_peer_cert_by_name"])
    return result


def link_tls_extra(payload: dict, tls_extra: Optional[dict]) -> None:
    """v2rayN-style share link query keys: ech, pcs, vcn."""
    if not tls_extra:
        return
    if tls_extra.get("ech_config_list"):
        payload["ech"] = tls_extra["ech_config_list"]
    if tls_extra.get("pinned_peer_cert_sha256"):
        payload["pcs"] = ",".join(tls_extra["pinned_peer_cert_sha256"])
    if tls_extra.get("verify_peer_cert_by_name"):
        payload["vcn"] = ",".join(tls_extra["verify_peer_cert_by_name"])


def xray_mux(mux_settings: Optional[dict], base: dict) -> dict:
    """Merge host mux settings over the template mux config."""
    result = dict(base)
    result["enabled"] = True
    if not mux_settings:
        return result
    if mux_settings.get("concurrency") is not None:
        result["concurrency"] = mux_settings["concurrency"]
    if mux_settings.get("xudp_concurrency") is not None:
        result["xudpConcurrency"] = mux_settings["xudp_concurrency"]
    if mux_settings.get("xudp_proxy_udp443"):
        result["xudpProxyUDP443"] = mux_settings["xudp_proxy_udp443"]
    return result


def ech_config_b64(tls_extra: Optional[dict]) -> Optional[str]:
    """Raw base64 ECHConfigList, or None when absent or given as a DoH query ("domain+https://...")."""
    value = (tls_extra or {}).get("ech_config_list")
    if not value or "://" in value:
        return None
    return value
