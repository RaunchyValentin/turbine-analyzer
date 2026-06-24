from sqlalchemy import Integer, String, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Curve(Base):
    __tablename__ = "curves"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    turbine_id: Mapped[int] = mapped_column(ForeignKey("turbines.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    poly_order: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)

    turbine: Mapped["Turbine"] = relationship(back_populates="curves")  # type: ignore[name-defined]
    points: Mapped[list["CurvePoint"]] = relationship(back_populates="curve", cascade="all, delete-orphan", order_by="CurvePoint.order")


class CurvePoint(Base):
    __tablename__ = "curve_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    curve_id: Mapped[int] = mapped_column(ForeignKey("curves.id"))
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)

    curve: Mapped[Curve] = relationship(back_populates="points")
