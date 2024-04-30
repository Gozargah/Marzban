import re
from typing import List

def grpc_correct_path(path: str, word: str):

    pattern = r'\b(?:' + re.escape(word) + r'|[|])\b'
    path = re.sub(pattern, '', path)

    return path