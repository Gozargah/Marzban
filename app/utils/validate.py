from datetime import datetime
from typing import Optional

def validate_dates(start: Optional[str], end: Optional[str]) -> bool:
    try:
        if start:
            start_date = datetime.fromisoformat(start)
        if end:
            end_date = datetime.fromisoformat(end)
            if start and end and end_date < start_date:
                return False
        return True
    except ValueError:
        return False