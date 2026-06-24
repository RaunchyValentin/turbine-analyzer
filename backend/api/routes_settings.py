from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.sheet_service import get_navigation, get_sheet, save_override

router = APIRouter(tags=["settings"])


@router.get("/settings/navigation")
async def navigation():
    return get_navigation()


@router.get("/settings/{turbine_id}/{sheet_id}")
async def sheet_data(turbine_id: int, sheet_id: str, db: AsyncSession = Depends(get_db)):
    return await get_sheet(turbine_id, sheet_id, db)


class OverrideBody(BaseModel):
    srel_key: str
    value: str


@router.put("/settings/{turbine_id}/{sheet_id}/override")
async def set_override(
    turbine_id: int,
    sheet_id: str,
    body: OverrideBody,
    db: AsyncSession = Depends(get_db),
):
    return await save_override(turbine_id, sheet_id, body.srel_key, body.value, db)


@router.delete("/settings/{turbine_id}/{sheet_id}/override/{srel_key}", status_code=204)
async def delete_override(
    turbine_id: int,
    sheet_id: str,
    srel_key: str,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, and_, delete
    from models.setting_override import SettingOverride

    await db.execute(
        delete(SettingOverride).where(
            and_(
                SettingOverride.turbine_id == turbine_id,
                SettingOverride.sheet_id == sheet_id,
                SettingOverride.srel_key == srel_key,
            )
        )
    )
    await db.commit()
