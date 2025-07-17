from sqlalchemy import String, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import DATABASE_DIALECT
from app.db.models import JWT, System
from app.models.stats import Period

MYSQL_FORMATS = {
    Period.minute: "%Y-%m-%d %H:%i:00",
    Period.hour: "%Y-%m-%d %H:00:00",
    Period.day: "%Y-%m-%d",
    Period.month: "%Y-%m-01",
}
SQLITE_FORMATS = {
    Period.minute: "%Y-%m-%d %H:%M:00",
    Period.hour: "%Y-%m-%d %H:00:00",
    Period.day: "%Y-%m-%d",
    Period.month: "%Y-%m-01",
}


def _build_trunc_expression(period: Period, column):
    """Builds the appropriate truncation SQL expression based on DATABASE_DIALECT and period."""
    if DATABASE_DIALECT == "postgresql":
        return func.date_trunc(period.value, column)
    elif DATABASE_DIALECT == "mysql":
        return func.date_format(column, MYSQL_FORMATS[period.value])
    elif DATABASE_DIALECT == "sqlite":
        return func.strftime(SQLITE_FORMATS[period.value], column)

    raise ValueError(f"Unsupported dialect: {DATABASE_DIALECT}")


def get_datetime_add_expression(datetime_column, seconds: int):
    """
    Get database-specific datetime addition expression
    """
    if DATABASE_DIALECT == "mysql":
        return func.date_add(datetime_column, text("INTERVAL :seconds SECOND").bindparams(seconds=seconds))
    elif DATABASE_DIALECT == "postgresql":
        return datetime_column + func.make_interval(0, 0, 0, 0, 0, 0, seconds)
    elif DATABASE_DIALECT == "sqlite":
        return func.datetime(func.strftime("%s", datetime_column) + seconds, "unixepoch")

    raise ValueError(f"Unsupported dialect: {DATABASE_DIALECT}")


def json_extract(column, path: str):
    """
    Args:
        column: The JSON column in your model
        path: JSON path (e.g., '$.theme')
    """
    match DATABASE_DIALECT:
        case "postgresql":
            keys = path.replace("$.", "").split(".")
            expr = column
            for key in keys:
                expr = expr.op("->>")(key) if key == keys[-1] else expr.op("->")(key)
            return expr.cast(String)
        case "mysql":
            return func.json_unquote(func.json_extract(column, path)).cast(String)
        case "sqlite":
            return func.json_extract(column, path).cast(String)


def build_json_proxy_settings_search_condition(column, value: str):
    """
    Builds a condition to search JSON column for UUIDs or passwords.
    Supports PostgresSQL, MySQL, SQLite.
    """
    return or_(
        *[
            json_extract(column, field) == value
            for field in ("$.vmess.id", "$.vless.id", "$.trojan.password", "$.shadowsocks.password")
        ],
    )


async def get_system_usage(db: AsyncSession) -> System:
    """
    Retrieves system usage information.

    Args:
        db (AsyncSession): Database session.

    Returns:
        System: System usage information.
    """
    return (await db.execute(select(System))).scalar_one_or_none()


async def get_jwt_secret_key(db: AsyncSession) -> str:
    """
    Retrieves the JWT secret key.

    Args:
        db (AsyncSession): Database session.

    Returns:
        str: JWT secret key.
    """
    return (await db.execute(select(JWT))).scalar_one_or_none().secret_key
