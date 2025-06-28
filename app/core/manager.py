from asyncio import Lock
from copy import deepcopy

from app import on_startup
from app.core.abstract_core import AbstractCore
from app.core.xray import XRayConfig
from app.db import GetDB
from app.db.crud.core import get_core_configs
from app.db.models import CoreConfig


class CoreManager:
    def __init__(self):
        self._cores: dict[int, AbstractCore] = {}
        self._lock = Lock()
        self._inbounds: list[str] = []
        self._inbounds_by_tag = {}

    @staticmethod
    def validate_core(config: dict, fallbacks_inbounds: str, exclude_inbounds: str):
        fallbacks_inbound_tags = fallbacks_inbounds.split(",") if fallbacks_inbounds else []
        exclude_inbound_tags = exclude_inbounds.split(",") if exclude_inbounds else []

        return XRayConfig(config, exclude_inbound_tags, fallbacks_inbound_tags)

    async def update_inbounds(self):
        async with self._lock:
            new_inbounds = {}
            for core in self._cores.values():
                new_inbounds.update(core.inbounds_by_tag)

            self._inbounds_by_tag = new_inbounds
            self._inbounds = list(self._inbounds_by_tag.keys())

    async def update_core(self, db_core_config: CoreConfig):
        backend_config = self.validate_core(
            db_core_config.config, db_core_config.fallbacks_inbound_tags, db_core_config.exclude_inbound_tags
        )

        async with self._lock:
            self._cores.update({db_core_config.id: backend_config})

        await self.update_inbounds()

    async def remove_core(self, core_id: int):
        async with self._lock:
            core = self._cores.get(core_id, None)
            if core:
                del self._cores[core_id]
            else:
                return

        await self.update_inbounds()

    async def get_core(self, core_id: int) -> AbstractCore | None:
        async with self._lock:
            core = self._cores.get(core_id, None)

            if not core:
                core = self._cores.get(1)

            return core

    async def get_inbounds(self) -> list[str]:
        async with self._lock:
            return deepcopy(self._inbounds)

    async def get_inbounds_by_tag(self) -> dict:
        async with self._lock:
            return deepcopy(self._inbounds_by_tag)

    async def get_inbound_by_tag(self, tag) -> dict:
        async with self._lock:
            inbound = self._inbounds_by_tag.get(tag, None)
            if not inbound:
                return None
            return deepcopy(inbound)


core_manager = CoreManager()


@on_startup
async def init_core_manager():
    async with GetDB() as db:
        core_configs, _ = await get_core_configs(db)

        for config in core_configs:
            await core_manager.update_core(config)
