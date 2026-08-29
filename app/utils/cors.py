"""Working out the CORS policy from ALLOWED_ORIGINS.

Same-origin requests — which is how the bundled dashboard talks to the API —
need no CORS at all, so an empty list means "no cross-origin access" rather
than "everything". A wildcard cannot be combined with credentials: browsers
reject such a response outright, so the wildcard turns credentials off
instead of quietly producing a policy that never works.
"""

from typing import List, NamedTuple, Optional

# Where the Vite dev server runs when DEBUG is on.
DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


class CORSPolicy(NamedTuple):
    origins: List[str]
    allow_credentials: bool
    warning: Optional[str]

    @property
    def enabled(self) -> bool:
        return bool(self.origins)


def cors_policy(allowed_origins: List[str], debug: bool = False) -> CORSPolicy:
    origins = [origin.strip() for origin in allowed_origins if origin.strip()]
    warning = None

    if debug:
        origins = origins + [o for o in DEV_ORIGINS if o not in origins]

    if "*" in origins:
        warning = (
            "ALLOWED_ORIGINS contains '*', so cross-origin requests cannot carry "
            "the session cookie: browsers reject a wildcard combined with "
            "credentials. List the exact origins instead."
        )
        return CORSPolicy(origins=["*"], allow_credentials=False, warning=warning)

    return CORSPolicy(origins=origins, allow_credentials=True, warning=warning)
