from sqlalchemy import Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date

from database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[date] = mapped_column(Date)

    turbines: Mapped[list["Turbine"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Turbine(Base):
    __tablename__ = "turbines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str | None] = mapped_column(String)
    site: Mapped[str | None] = mapped_column(String)
    source_file: Mapped[str | None] = mapped_column(String)
    imported_at: Mapped[date | None] = mapped_column(Date)

    project: Mapped[Project] = relationship(back_populates="turbines")
    parameters: Mapped[list] = relationship("Parameter", back_populates="turbine", cascade="all, delete-orphan")
    curves: Mapped[list] = relationship("Curve", back_populates="turbine", cascade="all, delete-orphan")
