from datetime import datetime
from sqlalchemy import Integer, String, Text, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class UserOverride(Base):
    __tablename__ = "user_overrides"
    __table_args__ = (
        UniqueConstraint("turbine_id", "parameter_id", name="uq_override_turbine_param"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    turbine_id: Mapped[int] = mapped_column(ForeignKey("turbines.id"))
    parameter_id: Mapped[int] = mapped_column(ForeignKey("parameters.id"))
    user_value: Mapped[str] = mapped_column(Text, nullable=False)
    original_value: Mapped[str | None] = mapped_column(Text)   # snapshot for diff
    modified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    note: Mapped[str | None] = mapped_column(Text)

    parameter: Mapped["Parameter"] = relationship()            # type: ignore[name-defined]
