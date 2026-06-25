import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def _data_dir() -> str:
    if getattr(sys, 'frozen', False):
        # PyInstaller bundle: store DB in a folder next to the .exe
        return os.path.join(os.path.dirname(sys.executable), 'turbine-analyzer-data')
    # Development: ../data relative to this file
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))


_DATA_DIR = _data_dir()
os.makedirs(_DATA_DIR, exist_ok=True)

DATABASE_URL = "sqlite+aiosqlite:///" + os.path.join(_DATA_DIR, 'turbines.db').replace('\\', '/')

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE turbines ADD COLUMN file_date TEXT"))
        except Exception:
            pass
