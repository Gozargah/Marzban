from enum import Enum
from app.db.models import ProxyHostSecurity, ProxyHostALPN, ProxyHostFingerprint, UserStatus
from pydantic import BaseModel, ConfigDict, Field, field_validator


class XHttpModes(str, Enum):
    auto = "auto"
    packet_up = "packet-up"
    stream_up = "stream-up"
    stream_one = "stream-one"


class MultiplexProtocol(str, Enum):
    smux = "smux"
    yamux = "yamux"
    h2mux = "h2mux"


class XUDP(str, Enum):
    reject = "reject"
    allow = "allow"
    skip = "skip"


class XrayFragmentSettings(BaseModel):
    packets: str = Field(pattern=r"^(:?tlshello|[\d-]{1,16})$")
    length: str = Field(pattern=r"^[\d-]{1,16}$")
    interval: str = Field(pattern=r"^[\d-]{1,16}$")


class FragmentSettings(BaseModel):
    xray: XrayFragmentSettings | None = None


class XrayNoiseSettings(BaseModel):
    type: str = Field(pattern=r"^(:?rand|str|base64|hex)$")
    packet: str
    delay: str = Field(pattern=r"^\d{1,16}(-\d{1,16})?$")


class NoiseSettings(BaseModel):
    xray: list[XrayNoiseSettings] | None = None


class XMuxSettings(BaseModel):
    max_concurrency: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    max_connections: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    c_max_reuse_times: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    c_max_lifetime: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    h_max_request_times: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    h_keep_alive_period: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")


class XHttpSettings(BaseModel):
    mode: XHttpModes = XHttpModes.auto
    no_grpc_header: bool | None = None
    x_padding_bytes: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    sc_max_each_post_bytes: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    sc_min_posts_interval_ms: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    sc_max_buffered_posts: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    sc_stream_up_server_secs: str | int | None = Field(None, pattern=r"^\d{1,16}(-\d{1,16})?$")
    xmux: XMuxSettings | None = None
    download_settings: int | None = None


class HTTPBase(BaseModel):
    version: str = Field("1.1", pattern=r"^(1(?:\.0|\.1)|2\.0|3\.0)$")
    headers: dict[str, list[str]] | None = None


class HTTPResponse(HTTPBase):
    status: str = Field("200", pattern=r"^[1-5]\d{2}$")
    reason: str = Field(
        "OK",
        pattern=r"^(?i)(?:OK|Created|Accepted|Non-Authoritative Information|No Content|Reset Content|Partial Content|Multiple Choices|Moved Permanently|Found|See Other|Not Modified|Use Proxy|Temporary Redirect|Permanent Redirect|Bad Request|Unauthorized|Payment Required|Forbidden|Not Found|Method Not Allowed|Not Acceptable|Proxy Authentication Required|Request Timeout|Conflict|Gone|Length Required|Precondition Failed|Payload Too Large|URI Too Long|Unsupported Media Type|Range Not Satisfiable|Expectation Failed|I'm a teapot|Misdirected Request|Unprocessable Entity|Locked|Failed Dependency|Too Early|Upgrade Required|Precondition Required|Too Many Requests|Request Header Fields Too Large|Unavailable For Legal Reasons|Internal Server Error|Not Implemented|Bad Gateway|Service Unavailable|Gateway Timeout|HTTP Version Not Supported)$",
    )


class HTTPRequest(HTTPBase):
    method: str = Field("GET", pattern=r"^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|TRACE|CONNECT)$")


class TcpSettings(BaseModel):
    header: str = Field("none", pattern=r"^(:?none|http)$")
    request: HTTPRequest | None = None
    response: HTTPResponse | None = None


class WebSocketSettings(BaseModel):
    heartbeatPeriod: int | None = None


class KCPSettings(BaseModel):
    header: str = Field(default="none", pattern=r"^(:?none|srtp|utp|wechat-video|dtls|wireguard)$")
    mtu: int | None = None
    tti: int | None = None
    uplink_capacity: int | None = None
    downlink_capacity: int | None = None
    congestion: int | None = None
    read_buffer_size: int | None = None
    write_buffer_size: int | None = None


class GRPCSettings(BaseModel):
    multi_mode: bool | None = None
    idle_timeout: int | None = None
    health_check_timeout: int | None = None
    permit_without_stream: int | None = None
    initial_windows_size: int | None = None


class Brutal(BaseModel):
    enable: bool = False
    up_mbps: int
    down_mbps: int


class SingBoxMuxSettings(BaseModel):
    enable: bool = False
    protocol: MultiplexProtocol = MultiplexProtocol.smux
    max_connections: int | None = None
    max_streams: int | None = None
    min_streams: int | None = None
    padding: bool = False
    brutal: Brutal | None = None


class ClashMuxSettings(SingBoxMuxSettings):
    statistic: bool = False
    only_tcp: bool = False


class XrayMuxSettings(BaseModel):
    enable: bool = False
    concurrency: int | None = None
    xudp_concurrency: int | None = None
    xudp_proxy_443: XUDP = Field(default=XUDP.reject)


class MuxSettings(BaseModel):
    sing_box: SingBoxMuxSettings | None = None
    clash: ClashMuxSettings | None = None
    xray: XrayMuxSettings | None = None


class TransportSettings(BaseModel):
    xhttp_settings: XHttpSettings | None = None
    grpc_settings: GRPCSettings | None = None
    kcp_settings: KCPSettings | None = None
    tcp_settings: TcpSettings | None = None
    websocket_settings: WebSocketSettings | None = None


class FormatVariables(dict):
    def __missing__(self, key):
        return key.join("{}")


class BaseHost(BaseModel):
    id: int | None = None
    remark: str
    address: str
    inbound_tag: str | None = None
    port: int | None = None
    sni: str | None = None
    host: str | None = None
    path: str | None = None
    security: ProxyHostSecurity = ProxyHostSecurity.inbound_default
    alpn: ProxyHostALPN = ProxyHostALPN.none
    fingerprint: ProxyHostFingerprint = ProxyHostFingerprint.none
    allowinsecure: bool | None = None
    is_disabled: bool = False
    http_headers: dict[str, str] | None = None
    transport_settings: TransportSettings | None = None
    mux_settings: MuxSettings | None = None
    fragment_settings: FragmentSettings | None = None
    noise_settings: NoiseSettings | None = None
    random_user_agent: bool = False
    use_sni_as_host: bool = False
    priority: int
    status: set[UserStatus] = Field(default_factory=set)

    model_config = ConfigDict(from_attributes=True)


class CreateHost(BaseHost):
    @field_validator("remark", mode="after")
    def validate_remark(cls, v):
        try:
            v.format_map(FormatVariables())
        except ValueError:
            raise ValueError("Invalid formatting variables")

        return v

    @field_validator("address", mode="after")
    def validate_address(cls, v):
        try:
            v.format_map(FormatVariables())
        except ValueError:
            raise ValueError("Invalid formatting variables")

        return v
