export default function Logs({ className }: { className?: string }) {
    const logs = [
        {
            timestamp: "01/22/25, 03:09:40 PM",
            level: "info",
            message: "from 77.33.44.11:0 accepted tcp:www.googleapis.com:80 [VLESS_WS_INBOUND >> direct] email: user5322",
        },
        {
            timestamp: "01/22/25, 03:09:40 PM",
            level: "info",
            message: "from 77.33.44.11:0 accepted tcp:www.googleapis.com:80 [VLESS_WS_INBOUND >> direct] email: user5322",
        },
        {
            timestamp: "01/22/25, 03:09:40 PM",
            level: "info",
            message: "from 22.33.44.55:0 accepted tcp:www.google.com:443 [VLESS_WS_INBOUND >> direct] email: user123",
        },
        {
            timestamp: "01/22/25, 03:09:40 PM",
            level: "info",
            message: "from 22.33.44.55:0 accepted tcp:3.3.3.3:80 [VLESS_WS_INBOUND >> direct] email: user123",
        },
        {
            timestamp: "01/22/25, 03:10:00 PM",
            level: "info",
            message: "from 77.33.44.11:0 accepted tcp:www.example.com:443 [VLESS_WS_INBOUND >> direct] email: user456",
        },
        {
            timestamp: "01/22/25, 03:10:10 PM",
            level: "info",
            message: "from 88.33.44.66:0 accepted tcp:www.test.com:80 [VLESS_WS_INBOUND >> direct] email: user789",
        },
        {
            timestamp: "01/22/25, 03:10:20 PM",
            level: "info",
            message: "from 99.33.44.77:0 accepted tcp:www.example.net:443 [VLESS_WS_INBOUND >> direct] email: user321",
        },
        {
            timestamp: "01/22/25, 03:10:30 PM",
            level: "info",
            message: "from 22.33.44.88:0 accepted tcp:www.domain.com:80 [VLESS_WS_INBOUND >> direct] email: user654",
        },
        {
            timestamp: "01/22/25, 03:10:00 PM",
            level: "info",
            message: "from 77.33.44.11:0 accepted tcp:www.example.com:443 [VLESS_WS_INBOUND >> direct] email: user456",
        },
        {
            timestamp: "01/22/25, 03:10:10 PM",
            level: "info",
            message: "from 88.33.44.66:0 accepted tcp:www.test.com:80 [VLESS_WS_INBOUND >> direct] email: user789",
        },
        {
            timestamp: "01/22/25, 03:10:20 PM",
            level: "info",
            message: "from 99.33.44.77:0 accepted tcp:www.example.net:443 [VLESS_WS_INBOUND >> direct] email: user321",
        },
        {
            timestamp: "01/22/25, 03:10:30 PM",
            level: "info",
            message: "from 22.33.44.88:0 accepted tcp:www.domain.com:80 [VLESS_WS_INBOUND >> direct] email: user654",
        },
        {
            timestamp: "01/22/25, 03:10:00 PM",
            level: "info",
            message: "from 77.33.44.11:0 accepted tcp:www.example.com:443 [VLESS_WS_INBOUND >> direct] email: user456",
        },
        {
            timestamp: "01/22/25, 03:10:10 PM",
            level: "info",
            message: "from 88.33.44.66:0 accepted tcp:www.test.com:80 [VLESS_WS_INBOUND >> direct] email: user789",
        },
        {
            timestamp: "01/22/25, 03:10:20 PM",
            level: "info",
            message: "from 99.33.44.77:0 accepted tcp:www.example.net:443 [VLESS_WS_INBOUND >> direct] email: user321",
        },
        {
            timestamp: "01/22/25, 03:10:30 PM",
            level: "info",
            message: "from 22.33.44.88:0 accepted tcp:www.domain.com:80 [VLESS_WS_INBOUND >> direct] email: user654",
        },
        {
            timestamp: "01/22/25, 03:10:00 PM",
            level: "info",
            message: "from 77.33.44.11:0 accepted tcp:www.example.com:443 [VLESS_WS_INBOUND >> direct] email: user456",
        },
        {
            timestamp: "01/22/25, 03:10:10 PM",
            level: "info",
            message: "from 88.33.44.66:0 accepted tcp:www.test.com:80 [VLESS_WS_INBOUND >> direct] email: user789",
        },
        {
            timestamp: "01/22/25, 03:10:20 PM",
            level: "info",
            message: "from 99.33.44.77:0 accepted tcp:www.example.net:443 [VLESS_WS_INBOUND >> direct] email: user321",
        },
        {
            timestamp: "01/22/25, 03:10:30 PM",
            level: "info",
            message: "from 22.33.44.88:0 accepted tcp:www.domain.com:80 [VLESS_WS_INBOUND >> direct] email: user654",
        },
        {
            timestamp: "01/22/25, 03:10:00 PM",
            level: "info",
            message: "from 77.33.44.11:0 accepted tcp:www.example.com:443 [VLESS_WS_INBOUND >> direct] email: user456",
        },
        {
            timestamp: "01/22/25, 03:10:10 PM",
            level: "info",
            message: "from 88.33.44.66:0 accepted tcp:www.test.com:80 [VLESS_WS_INBOUND >> direct] email: user789",
        },
        {
            timestamp: "01/22/25, 03:10:20 PM",
            level: "info",
            message: "from 99.33.44.77:0 accepted tcp:www.example.net:443 [VLESS_WS_INBOUND >> direct] email: user321",
        },
        {
            timestamp: "01/22/25, 03:10:30 PM",
            level: "info",
            message: "from 22.33.44.88:0 accepted tcp:www.domain.com:80 [VLESS_WS_INBOUND >> direct] email: user654",
        },
    ]

    return (
        <div className={`w-full rounded-lg p-4 font-mono text-sm ${className} `}>
            <div className="space-y-1">
                {logs.map((log, index) => (
                    <div key={index} className="flex items-start space-x-4">
                        <span className="text-zinc-500">{log.timestamp}</span>
                        <span
                            className={`min - w - 16 ${log.level === "warning"
                                ? "text-yellow-500"
                                : log.level === "info"
                                    ? "text-blue-500"
                                    : log.level === "debug"
                                        ? "text-amber-500"
                                        : "text-green-500"
                                } `}
                        >
                            {log.level}
                        </span>
                        <span>{log.message}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

