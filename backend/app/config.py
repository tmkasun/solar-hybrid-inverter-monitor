from dataclasses import dataclass
import os


def _integer(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)), 0)


@dataclass(frozen=True)
class Settings:
    mode: str = os.getenv("INVERTER_MODE", "simulator")
    database_path: str = os.getenv("DATABASE_PATH", "data/sako.db")
    poll_seconds: float = float(os.getenv("INVERTER_POLL_SECONDS", "5"))
    db_sample_seconds: float = float(os.getenv("INVERTER_DB_SAMPLE_SECONDS", "15"))
    raw_retention_days: int = int(os.getenv("RAW_RETENTION_DAYS", "30"))
    admin_password_hash: str = os.getenv("ADMIN_PASSWORD_HASH", "")
    vendor_id: int = _integer("INVERTER_USB_VENDOR_ID", 0x0665)
    product_id: int = _integer("INVERTER_USB_PRODUCT_ID", 0x5161)
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()
    log_file: str = os.getenv("LOG_FILE", "")
    bms_mode: str = os.getenv("BMS_MODE", "disabled")
    bms_bluetooth_address: str = os.getenv("BMS_BLUETOOTH_ADDRESS", "")
    bms_name: str = os.getenv("BMS_NAME", "")
    bms_protocol: str = os.getenv("BMS_PROTOCOL", "JK02")
    bms_cell_count: int = int(os.getenv("BMS_CELL_COUNT", "8"))
    bms_poll_seconds: float = float(os.getenv("BMS_POLL_SECONDS", "30"))
    bms_timeout_seconds: float = float(os.getenv("BMS_TIMEOUT_SECONDS", "25"))
    bms_retries: int = int(os.getenv("BMS_RETRIES", "2"))
    bms_retry_delay_seconds: float = float(os.getenv("BMS_RETRY_DELAY_SECONDS", "2"))
    bms_jkbms_command: str = os.getenv("BMS_JKBMS_COMMAND", "")


settings = Settings()
