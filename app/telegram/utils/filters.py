from aiogram.filters import Filter

from app.models.admin import AdminDetails


class IsAdminFilter(Filter):
    async def __call__(self, _, admin: AdminDetails | None = None) -> bool:
        return bool(admin)


class IsAdminSUDO(Filter):
    async def __call__(self, _, admin: AdminDetails | None = None) -> bool:
        return admin.is_sudo if admin else False
