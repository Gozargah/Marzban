def get_grpc_gun(path: str) -> str:
    if not path.startswith("/"):
        return path

    servicename = path.rsplit("/", 1)[0]
    streamname = path.rsplit("/", 1)[1].split("|")[0]
    
    if streamname == "Tun":
        return servicename[1:]
    
    return "%s%s%s" % (servicename, "/", streamname)

def get_grpc_multi(path: str) -> str:
    if not path.startswith("/"):
        return path
    
    servicename = path.rsplit("/", 1)[0]
    streamname = path.rsplit("/", 1)[1].split("|")[1]

    return "%s%s%s" % (servicename, "/", streamname)