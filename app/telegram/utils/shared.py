import math


def readable_size(size_bytes: int):
    if int(size_bytes) == 0:
        return "0 Bytes"

    is_negative = False
    if size_bytes < 0:
        size_bytes = size_bytes * -1
        is_negative = True

    size_name = ("Bytes", "KB", "MB", "GB", "TB", "PT")
    i = int(math.floor(math.log(size_bytes, 1024)))
    s = round(size_bytes / (1024 ** i), 1)
    return f"{'-' if is_negative else ''}{int(s) if s.is_integer() else s} {size_name[i]}"
