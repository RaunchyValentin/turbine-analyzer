"""Пересоздаёт БД turbines.db по текущим моделям SQLAlchemy."""
import asyncio
import sys
from pathlib import Path

# Гарантируем, что backend/ на первом месте в sys.path
sys.path.insert(0, str(Path(__file__).parent))

from database import engine, Base

# Импортируем все модели, чтобы metadata знала о таблицах
import models  # noqa: F401


async def rebuild():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("OK - tables recreated:")
    for table in Base.metadata.sorted_tables:
        cols = [c.name for c in table.columns]
        print(f"  {table.name}: {cols}")


asyncio.run(rebuild())
