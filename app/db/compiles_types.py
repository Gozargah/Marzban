from sqlalchemy import String, Numeric, TypeDecorator
from sqlalchemy.sql.expression import FunctionElement
from sqlalchemy.ext.compiler import compiles


class CaseSensitiveString(String):
    def __init__(self, length=None):
        super(CaseSensitiveString, self).__init__(length)


# Modify how this type is handled for each dialect
@compiles(CaseSensitiveString, "sqlite")
def compile_cs_sqlite(element, compiler, **kw):
    return f"VARCHAR({element.length}) COLLATE BINARY"  # BINARY is case-sensitive in SQLite


@compiles(CaseSensitiveString, "postgresql")
def compile_cs_postgresql(element, compiler, **kw):
    return f'VARCHAR({element.length}) COLLATE "C"'  # "C" collation is case-sensitive


@compiles(CaseSensitiveString, "mysql")
def compile_cs_mysql(element, compiler, **kw):
    return f"VARCHAR({element.length}) COLLATE utf8mb4_bin"  # utf8mb4_bin is case-sensitive


class EnumArray(TypeDecorator):
    """Custom SQLAlchemy type to handle Enum lists as a comma-separated string."""

    impl = String

    def __init__(self, enum_cls, length=255):
        super(EnumArray, self).__init__(length=length)
        self.enum_cls = enum_cls

    def process_bind_param(self, value, dialect):
        """Convert Enum list to a comma-separated string for storage."""
        if value is None:
            return None
        return ",".join([v.value for v in value])

    def process_result_value(self, value, dialect):
        """Convert stored comma-separated string back to an Enum list."""
        if value is None:
            return None
        if isinstance(value, str):
            return [self.enum_cls(v) for v in value.split(",") if v]
        return [self.enum_cls(v) for v in value]


class DaysDiff(FunctionElement):
    type = Numeric()
    name = "days_diff"
    inherit_cache = True


@compiles(DaysDiff, "postgresql")
def compile_days_diff_postgresql(element, compiler, **kw):
    return "EXTRACT(EPOCH FROM (expire - CURRENT_TIMESTAMP)) / 86400"


@compiles(DaysDiff, "mysql")
def compile_days_diff_mysql(element, compiler, **kw):
    return "DATEDIFF(expire, UTC_TIMESTAMP())"


@compiles(DaysDiff, "sqlite")
def compile_days_diff_sqlite(element, compiler, **kw):
    return "(julianday(expire) - julianday('now'))"


class DateDiff(FunctionElement):
    type = Numeric()
    name = "date_diff"
    inherit_cache = True

    def __init__(self, date1, date2, **kwargs):
        super().__init__(**kwargs)
        self.date1 = date1
        self.date2 = date2


@compiles(DateDiff, "postgresql")
def compile_date_diff_postgresql(element, compiler, **kw):
    return f"EXTRACT(EPOCH FROM ({compiler.process(element.date1)} - {compiler.process(element.date2)})) / 86400"


@compiles(DateDiff, "mysql")
def compile_date_diff_mysql(element, compiler, **kw):
    return f"DATEDIFF({compiler.process(element.date1)}, {compiler.process(element.date2)})"


@compiles(DateDiff, "sqlite")
def compile_date_diff_sqlite(element, compiler, **kw):
    return f"julianday({compiler.process(element.date1)}) - julianday({compiler.process(element.date2)})"
