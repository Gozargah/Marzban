from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CoreConfig
from app.models.core import CoreCreate


async def get_core_config_by_id(db: AsyncSession, core_id: int) -> CoreConfig | None:
    """
    Retrieves a core configuration by its ID.

    Args:
        db (AsyncSession): The database session.
        core_id (int): The ID of the core configuration to retrieve.

    Returns:
        Optional[CoreConfig]: The CoreConfig object if found, None otherwise.
    """
    return (await db.execute(select(CoreConfig).where(CoreConfig.id == core_id))).unique().scalar_one_or_none()


async def create_core_config(db: AsyncSession, core_config: CoreCreate) -> CoreConfig:
    """
    Creates a new core configuration in the database.

    Args:
        db (AsyncSession): The database session.
        core_config (CoreCreate): The core configuration creation model containing core details.

    Returns:
        CoreConfig: The newly created CoreConfig object.
    """
    db_core_config = CoreConfig(
        name=core_config.name,
        config=core_config.config,
        exclude_inbound_tags=core_config.exclude_inbound_tags or "",
        fallbacks_inbound_tags=core_config.fallbacks_inbound_tags or "",
    )
    db.add(db_core_config)
    await db.commit()
    await db.refresh(db_core_config)
    return db_core_config


async def modify_core_config(
    db: AsyncSession, db_core_config: CoreConfig, modified_core_config: CoreCreate
) -> CoreConfig:
    """
    Modifies an existing core configuration with new information.

    Args:
        db (AsyncSession): The database session.
        db_core_config (CoreConfig): The CoreConfig object to be updated.
        modified_core_config (CoreCreate): The modification model containing updated core details.

    Returns:
        CoreConfig: The updated CoreConfig object.
    """
    core_data = modified_core_config.model_dump(exclude_none=True)

    for key, value in core_data.items():
        setattr(db_core_config, key, value)

    await db.commit()
    await db.refresh(db_core_config)
    return db_core_config


async def remove_core_config(db: AsyncSession, db_core_config: CoreConfig) -> None:
    """
    Removes a core configuration from the database.

    Args:
        db (AsyncSession): The database session.
        db_core_config (CoreConfig): The CoreConfig object to be removed.
    """
    await db.delete(db_core_config)
    await db.commit()


async def get_core_configs(db: AsyncSession, offset: int = None, limit: int = None) -> tuple[int, list[CoreConfig]]:
    """
    Retrieves a list of core configurations with optional pagination.

    Args:
        db (AsyncSession): The database session.
        offset (int, optional): The number of records to skip (for pagination).
        limit (int, optional): The maximum number of records to return.

    Returns:
        tuple: A tuple containing:
            - list[CoreConfig]: A list of CoreConfig objects
            - int: The total count of core configurations
    """
    query = select(CoreConfig)
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)

    all_core_configs = (await db.execute(query)).scalars().all()
    return all_core_configs, len(all_core_configs)
