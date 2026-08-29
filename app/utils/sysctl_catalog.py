"""The kernel tunables the panel manages, and what they are for.

Only keys listed here can be read or written through the API. The panel is
not a general-purpose sysctl shell: an unknown key is a mistake, and a
mistake in this area takes a server off the network.

The `baseline` value of each entry is the tuning this panel ships with; it
is what the built-in profile applies and what the UI compares against when
it marks a value as customised.
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple

# Section id -> title shown in the dashboard, in display order.
SECTIONS: Tuple[Tuple[str, str], ...] = (
    ("performance", "Network performance"),
    ("conntrack", "Connection tracking"),
    ("security", "Network security"),
    ("routing", "Routing and forwarding"),
    ("icmp", "ICMP"),
    ("ipv6", "IPv6"),
    ("files", "File descriptors"),
    ("memory", "Memory"),
    ("kernel", "Kernel"),
)

# How a value is spelled, which is also how it is validated.
#   int   a single integer
#   ints  integers separated by spaces, e.g. "4096 4194304 67108864"
#   text  a bare name, e.g. a congestion control or qdisc module
KINDS = ("int", "ints", "text")


@dataclass(frozen=True)
class Tunable:
    key: str
    section: str
    kind: str
    baseline: str
    description: str

    @property
    def proc_path(self) -> str:
        """Where the live value lives, e.g. net.ipv4.ip_forward -> net/ipv4/ip_forward."""
        return self.key.replace(".", "/")


def _t(key, section, kind, baseline, description) -> Tunable:
    return Tunable(key=key, section=section, kind=kind, baseline=baseline, description=description)


TUNABLES: Tuple[Tunable, ...] = (
    # --- Network performance -------------------------------------------------
    _t("net.core.default_qdisc", "performance", "text", "fq",
       "Queueing discipline new interfaces get. fq pairs with BBR; fq_codel fights bufferbloat."),
    _t("net.ipv4.tcp_congestion_control", "performance", "text", "bbr",
       "Congestion control algorithm. BBR holds throughput up on lossy long-haul links."),
    _t("net.core.rmem_max", "performance", "int", "67108864",
       "Largest receive buffer a socket may ask for, in bytes."),
    _t("net.core.wmem_max", "performance", "int", "67108864",
       "Largest send buffer a socket may ask for, in bytes."),
    _t("net.core.rmem_default", "performance", "int", "16777216",
       "Default receive buffer for sockets that do not set one."),
    _t("net.core.wmem_default", "performance", "int", "16777216",
       "Default send buffer for sockets that do not set one."),
    _t("net.ipv4.tcp_rmem", "performance", "ints", "4096 4194304 67108864",
       "TCP receive buffer autotuning: minimum, default and maximum."),
    _t("net.ipv4.tcp_wmem", "performance", "ints", "4096 4194304 67108864",
       "TCP send buffer autotuning: minimum, default and maximum."),
    _t("net.ipv4.tcp_mem", "performance", "ints", "65536 131072 262144",
       "Pages of memory across all TCP sockets: low, pressure and high marks."),
    _t("net.ipv4.tcp_fastopen", "performance", "int", "3",
       "TCP Fast Open. 3 enables it for both incoming and outgoing connections."),
    _t("net.ipv4.tcp_mtu_probing", "performance", "int", "1",
       "Search for a working MTU when a path black-holes large packets."),
    _t("net.ipv4.tcp_keepalive_time", "performance", "int", "120",
       "Seconds an idle connection waits before the first keepalive probe."),
    _t("net.ipv4.tcp_keepalive_intvl", "performance", "int", "15",
       "Seconds between keepalive probes."),
    _t("net.ipv4.tcp_keepalive_probes", "performance", "int", "5",
       "Unanswered keepalive probes before the connection is dropped."),
    _t("net.ipv4.tcp_max_syn_backlog", "performance", "int", "65536",
       "Half-open connections queued while completing the handshake."),
    _t("net.core.somaxconn", "performance", "int", "65536",
       "Upper bound on a listening socket's accept queue."),
    _t("net.ipv4.tcp_tw_reuse", "performance", "int", "1",
       "Reuse TIME-WAIT sockets for new outgoing connections."),
    _t("net.ipv4.tcp_fin_timeout", "performance", "int", "15",
       "Seconds a connection stays in FIN-WAIT-2."),
    _t("net.ipv4.tcp_max_tw_buckets", "performance", "int", "200000",
       "TIME-WAIT sockets kept before the oldest are dropped."),
    _t("net.ipv4.tcp_timestamps", "performance", "int", "1",
       "TCP timestamps, needed for round-trip measurement and PAWS."),
    _t("net.ipv4.tcp_window_scaling", "performance", "int", "1",
       "Window scaling, without which windows cap at 64 KB."),
    _t("net.ipv4.tcp_adv_win_scale", "performance", "int", "1",
       "How the receive buffer is split between the window and overhead."),
    _t("net.ipv4.tcp_sack", "performance", "int", "1",
       "Selective acknowledgements, so loss costs one segment rather than a window."),
    _t("net.ipv4.tcp_dsack", "performance", "int", "1",
       "Duplicate SACK, which reports needless retransmissions back to the sender."),
    _t("net.ipv4.tcp_low_latency", "performance", "int", "1",
       "Prefer latency over throughput in the receive path."),
    _t("net.core.netdev_max_backlog", "performance", "int", "65536",
       "Packets queued per CPU when the interface outruns the stack."),
    _t("net.core.netdev_budget", "performance", "int", "600",
       "Packets one softirq pass may process before yielding."),
    _t("net.core.netdev_budget_usecs", "performance", "int", "8000",
       "Microseconds one softirq pass may run before yielding."),
    _t("net.core.optmem_max", "performance", "int", "262144",
       "Ancillary buffer size allowed per socket."),
    _t("net.ipv4.udp_rmem_min", "performance", "int", "32768",
       "Receive buffer each UDP socket keeps under memory pressure."),
    _t("net.ipv4.udp_wmem_min", "performance", "int", "32768",
       "Send buffer each UDP socket keeps under memory pressure."),
    _t("net.ipv4.ip_local_port_range", "performance", "ints", "1024 65535",
       "Ephemeral port range for outgoing connections."),
    _t("net.ipv4.tcp_slow_start_after_idle", "performance", "int", "0",
       "Restart in slow start after an idle period. Off keeps long-lived tunnels fast."),
    _t("net.ipv4.tcp_notsent_lowat", "performance", "int", "131072",
       "Unsent bytes allowed in the write queue before the socket blocks."),
    _t("net.core.rps_sock_flow_entries", "performance", "int", "32768",
       "Flow table size for steering packets to the CPU that owns the socket."),
    _t("net.ipv4.tcp_no_metrics_save", "performance", "int", "1",
       "Do not cache connection metrics between connections to the same peer."),
    _t("net.ipv4.tcp_retries2", "performance", "int", "12",
       "Retransmissions before a live connection is given up on."),
    _t("net.ipv4.tcp_frto", "performance", "int", "2",
       "Forward RTO recovery, which avoids needless retransmits after a spurious timeout."),
    _t("net.ipv4.tcp_ecn", "performance", "int", "1",
       "Explicit congestion notification. 1 requests it, 2 only answers it."),
    _t("net.core.busy_poll", "performance", "int", "50",
       "Microseconds a socket may busy-poll the device on poll/select."),
    _t("net.core.busy_read", "performance", "int", "50",
       "Microseconds a socket may busy-poll the device on read."),
    _t("net.ipv4.neigh.default.gc_thresh1", "performance", "int", "4096",
       "ARP entries below which nothing is collected."),
    _t("net.ipv4.neigh.default.gc_thresh2", "performance", "int", "8192",
       "ARP entries above which collection starts after five seconds."),
    _t("net.ipv4.neigh.default.gc_thresh3", "performance", "int", "16384",
       "Hard cap on ARP entries."),

    # --- Connection tracking -------------------------------------------------
    _t("net.netfilter.nf_conntrack_max", "conntrack", "int", "262144",
       "Connections the firewall tracks at once. Too low drops traffic under load."),
    _t("net.netfilter.nf_conntrack_buckets", "conntrack", "int", "65536",
       "Hash buckets for the tracking table. Around a quarter of the maximum."),
    _t("net.netfilter.nf_conntrack_tcp_timeout_established", "conntrack", "int", "3600",
       "Seconds an idle established connection is remembered."),
    _t("net.netfilter.nf_conntrack_tcp_timeout_close_wait", "conntrack", "int", "30",
       "Seconds a connection is remembered in CLOSE-WAIT."),
    _t("net.netfilter.nf_conntrack_tcp_timeout_time_wait", "conntrack", "int", "30",
       "Seconds a connection is remembered in TIME-WAIT."),
    _t("net.netfilter.nf_conntrack_tcp_timeout_fin_wait", "conntrack", "int", "30",
       "Seconds a connection is remembered in FIN-WAIT."),
    _t("net.netfilter.nf_conntrack_tcp_timeout_last_ack", "conntrack", "int", "15",
       "Seconds a connection is remembered in LAST-ACK."),
    _t("net.netfilter.nf_conntrack_tcp_timeout_syn_recv", "conntrack", "int", "15",
       "Seconds a half-open inbound connection is remembered."),
    _t("net.netfilter.nf_conntrack_tcp_timeout_syn_sent", "conntrack", "int", "30",
       "Seconds a half-open outbound connection is remembered."),
    _t("net.netfilter.nf_conntrack_tcp_timeout_close", "conntrack", "int", "5",
       "Seconds a closed connection is remembered."),
    _t("net.netfilter.nf_conntrack_udp_timeout", "conntrack", "int", "15",
       "Seconds a one-way UDP flow is remembered."),
    _t("net.netfilter.nf_conntrack_udp_timeout_stream", "conntrack", "int", "60",
       "Seconds a two-way UDP flow is remembered."),

    # --- Network security ----------------------------------------------------
    _t("net.ipv4.tcp_syncookies", "security", "int", "1",
       "Answer a full SYN backlog with cookies instead of dropping connections."),
    _t("net.ipv4.conf.all.rp_filter", "security", "int", "2",
       "Reverse path filter. 2 is the loose check that survives asymmetric routing."),
    _t("net.ipv4.conf.default.rp_filter", "security", "int", "2",
       "Reverse path filter applied to interfaces added later."),
    _t("net.ipv4.conf.all.accept_redirects", "security", "int", "0",
       "Accept ICMP redirects, which let a local attacker reroute traffic."),
    _t("net.ipv4.conf.default.accept_redirects", "security", "int", "0",
       "Accept ICMP redirects on interfaces added later."),
    _t("net.ipv6.conf.all.accept_redirects", "security", "int", "0",
       "Accept ICMPv6 redirects."),
    _t("net.ipv6.conf.default.accept_redirects", "security", "int", "0",
       "Accept ICMPv6 redirects on interfaces added later."),
    _t("net.ipv4.conf.all.send_redirects", "security", "int", "0",
       "Send ICMP redirects. Only routers have a reason to."),
    _t("net.ipv4.conf.default.send_redirects", "security", "int", "0",
       "Send ICMP redirects from interfaces added later."),
    _t("net.ipv4.conf.all.accept_source_route", "security", "int", "0",
       "Honour source-routed packets, which let a sender pick the return path."),
    _t("net.ipv4.conf.default.accept_source_route", "security", "int", "0",
       "Honour source-routed packets on interfaces added later."),
    _t("net.ipv6.conf.all.accept_source_route", "security", "int", "0",
       "Honour source-routed IPv6 packets."),
    _t("net.ipv6.conf.default.accept_source_route", "security", "int", "0",
       "Honour source-routed IPv6 packets on interfaces added later."),
    _t("net.ipv4.conf.all.log_martians", "security", "int", "1",
       "Log packets with impossible source addresses."),
    _t("net.ipv4.conf.default.log_martians", "security", "int", "1",
       "Log martians on interfaces added later."),
    _t("net.ipv4.icmp_ignore_bogus_error_responses", "security", "int", "1",
       "Stop logging ICMP errors that violate the RFCs."),

    # --- Routing and forwarding ---------------------------------------------
    _t("net.ipv4.ip_forward", "routing", "int", "1",
       "Forward packets between interfaces. Required to route proxied traffic."),
    _t("net.ipv4.ip_nonlocal_bind", "routing", "int", "1",
       "Let services bind addresses the host does not hold yet."),
    _t("net.bridge.bridge-nf-call-iptables", "routing", "int", "0",
       "Send bridged frames through iptables. Off keeps bridge traffic out of the filter path."),

    # --- ICMP ----------------------------------------------------------------
    _t("net.ipv4.icmp_echo_ignore_all", "icmp", "int", "1",
       "Ignore every ping. Hides the host, and hides real outages with it."),
    _t("net.ipv6.icmp.echo_ignore_all", "icmp", "int", "1",
       "Ignore every IPv6 ping."),

    # --- IPv6 ----------------------------------------------------------------
    _t("net.ipv6.conf.all.disable_ipv6", "ipv6", "int", "1",
       "Turn IPv6 off on every interface."),
    _t("net.ipv6.conf.default.disable_ipv6", "ipv6", "int", "1",
       "Turn IPv6 off on interfaces added later."),
    _t("net.ipv6.conf.lo.disable_ipv6", "ipv6", "int", "1",
       "Turn IPv6 off on loopback. Some services expect ::1 to exist."),
    _t("net.ipv6.conf.all.use_tempaddr", "ipv6", "int", "2",
       "Privacy addresses. 2 prefers a temporary address for outgoing connections."),
    _t("net.ipv6.conf.default.use_tempaddr", "ipv6", "int", "2",
       "Privacy addresses on interfaces added later."),

    # --- File descriptors ----------------------------------------------------
    _t("fs.file-max", "files", "int", "2097152",
       "Open files allowed across the whole system. A proxy holds two per connection."),
    _t("fs.nr_open", "files", "int", "1048576",
       "Ceiling on any one process's file descriptor limit. Nothing can raise nofile above it."),

    # --- Memory --------------------------------------------------------------
    _t("vm.swappiness", "memory", "int", "10",
       "How readily the kernel swaps. Low keeps the proxy's pages resident."),
    _t("vm.max_map_count", "memory", "int", "1048576",
       "Memory mappings one process may hold."),

    # --- Kernel --------------------------------------------------------------
    _t("kernel.printk", "kernel", "ints", "4 4 1 7",
       "Console log levels: current, default, minimum and boot-time."),
    _t("kernel.kptr_restrict", "kernel", "int", "1",
       "Hide kernel pointers from unprivileged users."),
    _t("kernel.sysrq", "kernel", "int", "176",
       "Which magic SysRq keys are allowed, as a bitmask."),
)

BY_KEY: Dict[str, Tunable] = {tunable.key: tunable for tunable in TUNABLES}

BASELINE: Dict[str, str] = {tunable.key: tunable.baseline for tunable in TUNABLES}


def section_titles() -> List[Tuple[str, str]]:
    """Sections that actually hold a tunable, in display order."""
    used = {tunable.section for tunable in TUNABLES}
    return [(section, title) for section, title in SECTIONS if section in used]
