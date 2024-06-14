from datetime import timedelta
from typing import Any

from apepay.utils import time_unit_to_timedelta
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APEPAY_", case_sensitive=True)

    WARNING_LEVEL: timedelta = timedelta(days=2)
    CRITICAL_LEVEL: timedelta = timedelta(hours=12)

    @field_validator("WARNING_LEVEL", "CRITICAL_LEVEL", mode="before")
    def _normalize_timedelta(cls, value: Any) -> timedelta:
        if isinstance(value, timedelta):
            return value

        elif isinstance(value, int):
            return timedelta(seconds=value)

        elif not isinstance(value, str):
            raise ValueError(f"Cannot convert: {value}")

        elif ":" in value and len(value.split(":")) == 3:
            h, m, s = value.split(":")
            return timedelta(hours=int(h), minutes=int(m), seconds=int(s))

        else:
            multiplier, time_unit = value.split(" ")
            return int(multiplier) * time_unit_to_timedelta(time_unit)
