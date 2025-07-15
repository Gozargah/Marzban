from fastapi import status

from tests.api import client

xray_config = {
    "log": {"loglevel": "info"},
    "inbounds": [
        {
            "tag": "xhttp",
            "listen": "@xhttp",
            "protocol": "vless",
            "settings": {"decryption": "none", "clients": []},
            "streamSettings": {"network": "xhttp", "xhttpSettings": {"path": "/yourpath"}},
        },
        {
            "tag": "fallback-A",
            "listen": "0.0.0.0",
            "port": 4443,
            "protocol": "vless",
            "settings": {"decryption": "none", "fallbacks": [{"dest": "@xhttp"}]},
            "streamSettings": {
                "network": "raw",
                "security": "reality",
                "realitySettings": {
                    "target": "example.com:443",
                    "serverNames": ["example.com"],
                    "privateKey": "4KbYtgqzRAmCmTrniPPFpQUdaYN5EmITRGuoorFnRwY",
                    "publickey": "HjfcDVKvPv2PiYVamUbERn90JYqiXz_WXeQ2Xt-lHkU",
                    "shortIds": [""],
                },
            },
        },
        {
            "tag": "fallback-B",
            "listen": "0.0.0.0",
            "port": 8443,
            "protocol": "vless",
            "settings": {"decryption": "none", "fallbacks": [{"dest": "@xhttp"}]},
            "streamSettings": {
                "network": "raw",
                "security": "reality",
                "realitySettings": {
                    "target": "example.net:443",
                    "serverNames": ["example.net"],
                    "privateKey": "gFbYRwfpj7V6vZekkQDoU0OBjGcKLUiHt1lp4Ek9GSI",
                    "publickey": "IHQwUTSdXwojPTIbNrHpvmG4cb50xBiheLkjlCVczWU",
                    "shortIds": [""],
                },
            },
        },
        {
            "tag": "VLESS WebSocket TEST",
            "listen": "0.0.0.0",
            "port": 2087,
            "protocol": "vless",
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {"network": "ws", "wsSettings": {"path": "/wss?ed=2560"}, "security": "none"},
        },
        {
            "tag": "VLESS + xhttp",
            "listen": "0.0.0.0",
            "port": 8443,
            "protocol": "vless",
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {
                "network": "xhttp",
                "xhttpSettings": {
                    "scMinPostsIntervalMs": "200-500",
                    "downloadSettings": {
                        "address": "95.182.99.59",
                        "port": 8443,
                        "network": "xhttp",
                        "security": "none",
                        "xhttpSettings": {
                            "path": "/",
                            "host": "google.com",
                            "extra": {
                                "xmux": {
                                    "maxConcurrency": "16-32",
                                    "maxConnections": 0,
                                    "cMaxReuseTimes": "64-128",
                                    "cMaxLifetimeMs": 0,
                                    "hMaxRequestTimes": "800-900",
                                    "hKeepAlivePeriod": 0,
                                }
                            },
                        },
                    },
                },
                "security": "none",
            },
            "sniffing": {"enabled": True, "destOverride": ["http"]},
        },
        {
            "tag": "VMESS HTTPUPGRADE",
            "listen": "0.0.0.0",
            "port": 54659,
            "protocol": "vmess",
            "settings": {"clients": []},
            "streamSettings": {
                "network": "httpupgrade",
                "httpupgradeSettings": {"path": "/wss54659?ed=2560", "host": ""},
                "security": "none",
            },
            "sniffing": {"enabled": True, "destOverride": ["http", "tls", "quic"]},
        },
        {
            "tag": "VLESS + H2 + REALITY",
            "listen": "0.0.0.0",
            "port": 6761,
            "protocol": "vless",
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {"network": "h3", "httpSettings": {"host": ["xray.com"], "path": "/random/path"}},
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        },
        {
            "tag": "VLESS + raw",
            "listen": "0.0.0.0",
            "port": 8080,
            "protocol": "vless",
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {
                "network": "raw",
                "rawSettings": {
                    "header": {"type": "http", "request": {"method": "GET", "path": ["/get"]}, "response": {}}
                },
                "security": "none",
            },
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        },
        {
            "tag": "VMess TCP",
            "listen": "0.0.0.0",
            "port": 8081,
            "protocol": "vmess",
            "settings": {"clients": []},
            "streamSettings": {
                "network": "tcp",
                "tcpSettings": {
                    "header": {
                        "type": "http",
                        "request": {"method": "GET", "path": ["/"], "headers": {"Host": ["google.com"]}},
                        "response": {},
                    }
                },
                "security": "none",
            },
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        },
        {
            "tag": "VMess Websocket",
            "listen": "0.0.0.0",
            "port": 8080,
            "protocol": "vmess",
            "settings": {"clients": []},
            "streamSettings": {
                "network": "ws",
                "wsSettings": {"path": "/ww", "headers": {"Host": "google.com"}},
                "security": "none",
            },
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        },
        {
            "tag": "VLESS TCP REALITY",
            "listen": "0.0.0.0",
            "port": 8543,
            "protocol": "vless",
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {
                "network": "tcp",
                "tcpSettings": {},
                "security": "reality",
                "realitySettings": {
                    "show": False,
                    "dest": "discordapp.com:443",
                    "xver": 0,
                    "serverNames": ["cdn.discordapp.com", "discordapp.com"],
                    "privateKey": "MMX7m0Mj3faUstoEm5NBdegeXkHG6ZB78xzBv2n3ZUA",
                    "shortIds": [
                        "",
                        "6ba85179e30d4fc2",
                        "e7259c5b0310d4e8",
                        "60c4b04f4bef523a",
                        "320e91be52cd3f33",
                        "dc1c530f6f823bce",
                    ],
                },
            },
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        },
        {
            "tag": "VLESS splithttp",
            "listen": "0.0.0.0",
            "port": 8643,
            "protocol": "vless",
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {
                "network": "splithttp",
                "splithttpSettings": {
                    "path": "/5",
                    "headers": {
                        "Sec-Fetch-Dest": "empty",
                        "Sec-Fetch-Mode": "cors",
                        "Sec-Fetch-Site": "same-origin",
                        "Priority": "u=4",
                        "Pragma": "no-cache",
                    },
                    "scMaxEachPostBytes": 5000000,
                    "scMaxConcurrentPosts": 800,
                    "scMinPostsIntervalMs": 90,
                    "noSSEHeader": False,
                    "xPaddingBytes": "100-1400",
                    "xmux": {"maxConcurrency": 6, "maxConnections": 0, "cMaxReuseTimes": 2, "cMaxLifetimeMs": 4},
                },
                "security": "none",
            },
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        },
        {
            "tag": "VLESS GRPC REALITY",
            "listen": "0.0.0.0",
            "port": 2053,
            "protocol": "vless",
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {
                "network": "grpc",
                "grpcSettings": {"serviceName": "xyz"},
                "security": "reality",
                "realitySettings": {
                    "show": False,
                    "dest": "discordapp.com:443",
                    "xver": 0,
                    "serverNames": ["cdn.discordapp.com", "discordapp.com"],
                    "privateKey": "MMX7m0Mj3faUstoEm5NBdegeXkHG6ZB78xzBv2n3ZUA",
                    "shortIds": ["", "6ba85179e30d4fc2"],
                },
            },
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        },
        {
            "tag": "Trojan Websocket TLS",
            "listen": "0.0.0.0",
            "port": 2083,
            "protocol": "trojan",
            "settings": {"clients": []},
            "streamSettings": {
                "network": "ws",
                "security": "tls",
                "tlsSettings": {
                    "certificates": [
                        {
                            "certificate": [
                                "-----BEGIN CERTIFICATE-----",
                                "MIIBvTCCAWOgAwIBAgIRAIY9Lzn0T3VFedUnT9idYkEwCgYIKoZIzj0EAwIwJjER",
                                "MA8GA1UEChMIWHJheSBJbmMxETAPBgNVBAMTCFhyYXkgSW5jMB4XDTIzMDUyMTA4",
                                "NDUxMVoXDTMzMDMyOTA5NDUxMVowJjERMA8GA1UEChMIWHJheSBJbmMxETAPBgNV",
                                "BAMTCFhyYXkgSW5jMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEGAmB8CILK7Q1",
                                "FG47g5VXg/oX3EFQqlW8B0aZAftYpHGLm4hEYVA4MasoGSxRuborhGu3lDvlt0cZ",
                                "aQTLvO/IK6NyMHAwDgYDVR0PAQH/BAQDAgWgMBMGA1UdJQQMMAoGCCsGAQUFBwMB",
                                "MAwGA1UdEwEB/wQCMAAwOwYDVR0RBDQwMoILZ3N0YXRpYy5jb22CDSouZ3N0YXRp",
                                "Yy5jb22CFCoubWV0cmljLmdzdGF0aWMuY29tMAoGCCqGSM49BAMCA0gAMEUCIQC1",
                                "XMIz1XwJrcu3BSZQFlNteutyepHrIttrtsfdd05YsQIgAtCg53wGUSSOYGL8921d",
                                "KuUcpBWSPkvH6y3Ak+YsTMg=",
                                "-----END CERTIFICATE-----",
                            ],
                            "key": [
                                "-----BEGIN RSA PRIVATE KEY-----",
                                "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg7ptMDsNFiL7iB5N5",
                                "gemkQUHIWvgIet+GiY7x7qB13V6hRANCAAQYCYHwIgsrtDUUbjuDlVeD+hfcQVCq",
                                "VbwHRpkB+1ikcYubiERhUDgxqygZLFG5uiuEa7eUO+W3RxlpBMu878gr",
                                "-----END RSA PRIVATE KEY-----",
                            ],
                        }
                    ],
                    "minVersion": "1.2",
                    "cipherSuites": "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
                },
            },
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        },
        {
            "tag": "VLESS + TCP",
            "listen": "0.0.0.0",
            "port": 1532,
            "protocol": "vless",
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {"network": "tcp", "tcpSettings": {}, "security": "none"},
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        },
        {
            "tag": "Shadowsocks TCP",
            "listen": "0.0.0.0",
            "port": 1080,
            "protocol": "shadowsocks",
            "settings": {"clients": [], "network": "tcp,udp"},
        },
    ],
    "outbounds": [{"protocol": "freedom", "tag": "DIRECT"}, {"protocol": "blackhole", "tag": "BLOCK"}],
    "routing": {
        "rules": [
            {"ip": ["geoip:private"], "outboundTag": "BLOCK", "type": "field"},
            {"domain": ["geosite:private"], "outboundTag": "BLOCK", "type": "field"},
            {"protocol": ["bittorrent"], "outboundTag": "BLOCK", "type": "field"},
        ]
    },
}


def test_core_create(access_token):
    """Test that the core create route is accessible."""

    response = client.post(
        url="/api/core",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "config": xray_config,
            "name": "xray_config",
            "exclude_inbound_tags": "",
            "fallbacks_inbound_tags": "fallback-B,fallback-A",
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["config"] == xray_config
    assert response.json()["name"] == "xray_config"
    assert response.json()["exclude_inbound_tags"] == ""
    assert response.json()["fallbacks_inbound_tags"] == "fallback-B,fallback-A"


def test_core_update(access_token):
    """Test that the core update route is accessible."""

    response = client.put(
        url="/api/core/1",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "config": xray_config,
            "name": "xray_config_update",
            "exclude_inbound_tags": "",
            "fallbacks_inbound_tags": "fallback-B,fallback-A",
        },
        params={"restart_nodes": False},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["config"] == xray_config
    assert response.json()["name"] == "xray_config_update"
    assert response.json()["exclude_inbound_tags"] == ""
    assert response.json()["fallbacks_inbound_tags"] == "fallback-B,fallback-A"


def test_core_get(access_token):
    """Test that the core get route is accessible."""

    response = client.get(
        url="/api/core/1",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["config"] == xray_config


def test_core_delete_1(access_token):
    """Test that the core delete route is accessible."""

    response = client.delete(
        url="/api/core/1", headers={"Authorization": f"Bearer {access_token}"}, params={"restart_nodes": True}
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_core_delete_2(access_token):
    """Test that the core delete route is accessible."""

    response = client.post(
        url="/api/core",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "config": xray_config,
            "name": "xray_config",
            "exclude_inbound_tags": "",
            "fallbacks_inbound_tags": "fallback-B,fallback-A",
        },
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["config"] == xray_config
    assert response.json()["name"] == "xray_config"
    assert response.json()["exclude_inbound_tags"] == ""
    assert response.json()["fallbacks_inbound_tags"] == "fallback-B,fallback-A"

    response = client.delete(
        url=f"/api/core/{response.json()['id']}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT


def test_inbounds_get(access_token):
    """Test that the inbounds get route is accessible."""

    response = client.get(
        url="/api/inbounds",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    config_tags = [
        inbound["tag"] for inbound in xray_config["inbounds"] if inbound["tag"] not in ["fallback-B", "fallback-A"]
    ]
    response_tags = [inbound for inbound in response.json() if "<=>" not in inbound]
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) > 0
    assert response_tags == config_tags
