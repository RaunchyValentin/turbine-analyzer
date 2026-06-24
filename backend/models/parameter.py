from sqlalchemy import Integer, String, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Parameter(Base):
    __tablename__ = "parameters"
    __table_args__ = (
        Index("ix_parameters_turbine_kks", "turbine_id", "kks"),
        Index("ix_parameters_turbine_name", "turbine_id", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    turbine_id: Mapped[int] = mapped_column(ForeignKey("turbines.id"))
    kks: Mapped[str | None] = mapped_column(String, index=True)
    name: Mapped[str | None] = mapped_column(String)
    value: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str | None] = mapped_column(String)
    data_type: Mapped[str | None] = mapped_column(String)  # REAL, INT, BOOL, STRING, CURVE
    source: Mapped[str | None] = mapped_column(String)     # srel / excel / csv / manual
    group: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    # JSON-encoded dict of all original source columns — preserves every field
    # regardless of SREL format version (35-col, 42-col, future variants, etc.)
    raw_data: Mapped[str | None] = mapped_column(Text)

    turbine: Mapped["Turbine"] = relationship(back_populates="parameters")  # type: ignore[name-defined]
