import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import { ReadyState } from "react-use-websocket";
import debounce from 'lodash.debounce';
import { getAuthToken } from '@/utils/authStorage';
import { useTranslation } from 'react-i18next';

export const MAX_NUMBER_OF_LOGS = 500;

const joinPaths = (paths: string[]) => {
    return paths
        .map((path) => path.replace(/(^\/+|\/+$)/g, ''))  // Remove leading and trailing slashes
        .join('/');
};

const getStatus = (status: string) => {
    return {
        [ReadyState.CONNECTING]: "connecting",
        [ReadyState.OPEN]: "connected",
        [ReadyState.CLOSING]: "closed",
        [ReadyState.CLOSED]: "closed",
        [ReadyState.UNINSTANTIATED]: "closed",
    }[status];
};

const getWebsocketUrl = (nodeID: string) => {
    try {
        let baseURL = new URL(
            import.meta.env.VITE_BASE_API.startsWith("/")
                ? window.location.origin + import.meta.env.VITE_BASE_API
                : import.meta.env.VITE_BASE_API
        );

        return (
            (baseURL.protocol === "https:" ? "wss://" : "ws://") +
            joinPaths([baseURL.host + baseURL.pathname, !nodeID ? "api/core/logs" : `/node/${nodeID}/logs`]) +
            "?interval=1&token=" +
            getAuthToken()
        );
    } catch (e) {
        console.error("Unable to generate websocket url");
        console.error(e);
        return null;
    }
};

const Logs = ({ className }: { className?: string }) => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<string[]>([]);
    const [selectedNode, setSelectedNode] = useState<string>('');
    const logsDiv = useRef<HTMLDivElement | null>(null);
    const scrollShouldStayOnEnd = useRef<boolean>(true);

    const updateLogs = useCallback(
        debounce(() => {
            if (logsDiv.current) {
                logsDiv.current.scrollTo({
                    top: logsDiv.current.scrollHeight,
                    behavior: 'smooth',
                });
            }
        }, 300),
        []
    );

    const { readyState } = useWebSocket(getWebsocketUrl(selectedNode), {
        onMessage: (e: any) => {
            const newLogs = e.data.split('\n').filter((line: string) => line.trim() !== ''); // Remove empty lines
            setLogs((prevLogs) => {
                const updatedLogs = [...prevLogs, ...newLogs];
                if (updatedLogs.length > MAX_NUMBER_OF_LOGS) updatedLogs.splice(0, updatedLogs.length - MAX_NUMBER_OF_LOGS);
                updateLogs();
                console.log(updateLogs.length);

                return updatedLogs;
            });
        },
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 1000,
    });

    useEffect(() => {
        return () => {
            setLogs([]);
        };
    }, []);

    const status = getStatus(readyState.toString());

    return (
        <div ref={logsDiv} className="h-[400px] space-y-2 overflow-auto rounded-lg border p-4 font-mono text-sm">
            <div className={`w-full rounded-lg p-4 font-mono text-sm ${className}`}>
                <div className="space-y-1">
                    {logs.map((log, index) => (
                        <div key={index} className="flex items-start space-x-4">
                            <span
                                className={`min-w-16 ${log.includes('Warning') ? 'text-yellow-600 dark:text-yellow-500' : log.includes('info') ? 'text-blue-600 dark:text-blue-500' : 'text-green-600 dark:text-green-500'}`}
                            >
                                {log.includes('Warning') ? 'warning' : 'info'}
                            </span>
                            <span>{log}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Logs;
