import grpc


class XRayBase(object):
    def __init__(self, address, port):
        self.address = address
        self.port = port
        self._channel = grpc.insecure_channel(f"{address}:{port}")
