from dataclasses import dataclass
import os


def _integer(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)), 0)


@dataclass(frozen=True)
class Settings:
    mode: str = os.getenv("INVERTER_MODE", "simulator")
    database_path: str = os.getenv("DATABASE_PATH", "data/sako.db")
    poll_seconds: float = float(os.getenv("INVERTER_POLL_SECONDS", "5"))
    raw_retention_days: int = int(os.getenv("RAW_RETENTION_DAYS", "30"))
    admin_password_hash: str = os.getenv("ADMIN_PASSWORD_HASH", "")
    vendor_id: int = _integer("INVERTER_USB_VENDOR_ID", 0x0665)
    product_id: int = _integer("INVERTER_USB_PRODUCT_ID", 0x5161)
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()
    log_file: str = os.getenv("LOG_FILE", "")


settings = Settings()
