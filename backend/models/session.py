from sqlalchemy import Integer, String, Text, Date
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date

from database import Base


class WorkSession(Base):
    __tablename__ = "work_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    state_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[date] = mapped_column(Date)
    updated_at: Mapped[date] = mapped_column(Date)


class ExperimentalData(Base):
    __tablename__ = "experimental_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    turbine_id: Mapped[int | None] = mapped_column(Integer)
    filename: Mapped[str | None] = mapped_column(String)
    label: Mapped[str | None] = mapped_column(String)
    data_json: Mapped[str] = mapped_column(Text, nullable=False)
    imported_at: Mapped[date | None] = mapped_column(Date)
