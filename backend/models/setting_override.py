from sqlalchemy import Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from database import Base


class SettingOverride(Base):
    __tablename__ = "setting_overrides"
    __table_args__ = (
        UniqueConstraint("turbine_id", "sheet_id", "srel_key", name="uq_override"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    turbine_id: Mapped[int] = mapped_column(ForeignKey("turbines.id", ondelete="CASCADE"))
    sheet_id: Mapped[str] = mapped_column(String, nullable=False)
    srel_key: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
