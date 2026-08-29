import json
from datetime import datetime as dt
from typing import Tuple
from uuid import UUID


def parse_version(version_str: str) -> Tuple[int, ...]:
    """Parse a dotted numeric version string into a comparable tuple.

    Used to compare client versions taken from the User-Agent header, which the
    matching regexes constrain to digits and dots.
    """
    return tuple(int(part) for part in version_str.split('.'))


def calculate_usage_percent(used_traffic: int, data_limit: int) -> float:
    return (used_traffic * 100) / data_limit


def calculate_expiration_days(expire: int) -> int:
    return (dt.fromtimestamp(expire) - dt.utcnow()).days


def yml_uuid_representer(dumper, data):
    return dumper.represent_scalar('tag:yaml.org,2002:str', str(data))


class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            # if the obj is uuid, we simply return the value of uuid
            return str(obj)
        return super().default(obj)
