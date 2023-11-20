from datetime import datetime as dt


def calculate_usage_percent(used_traffic: int, data_limit: int) -> float:
    return (used_traffic * 100) / data_limit


def calculate_expiration_days(expire: int) -> int:
    return (expire - dt.utcnow()).days
