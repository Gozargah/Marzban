import { ProxyHostSecurity } from "types/ProxyHosts";

export const proxyHostSecurity: {title: string, value: ProxyHostSecurity}[] = [
    {
        "title": "Inbound's default",
        "value": "inbound_default"
    },
    {
        "title": "TLS",
        "value": "tls"
    },
    {
        "title": "None",
        "value": "none"
    }
]