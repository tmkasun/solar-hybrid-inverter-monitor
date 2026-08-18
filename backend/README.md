# Backend API

FastAPI service for polling and controlling the Sako inverter. In production on
the Raspberry Pi it is installed as the `sako-inverter-api` systemd service and
loads configuration from `/etc/sako-inverter/api.env`.

## Raspberry Pi API Install

From the repository root on the Pi:

```sh
./scripts/pi-api-install
```

The installer creates `backend/.venv`, installs the Python dependencies,
configures the USB udev rule, creates `/etc/sako-inverter/api.env` if it does
not already exist, and enables the `sako-inverter-api` service.

Install the build tools and Bluetooth/GLib packages used by the pinned BLE
dependency before running the installer:

```sh
sudo apt update && sudo apt install -y python3-venv build-essential pkg-config libglib2.0-dev bluetooth bluez
```

Check the service with:

```sh
sudo systemctl status sako-inverter-api
sudo journalctl -u sako-inverter-api -f
sudo tail -f /var/solar.log
```

The installer also configures `/var/solar.log` and `/etc/logrotate.d/sako-inverter-api`.
The file rolls at 5 MB and keeps 5 compressed backups.

## Create the Admin Password Hash

The API does not store the admin password directly. It expects a bcrypt hash in
`ADMIN_PASSWORD_HASH`. To create one over SSH without Docker Compose, run this
from the repository root on the Pi:

```sh
backend/.venv/bin/python -c "import bcrypt,getpass; print(bcrypt.hashpw(getpass.getpass('Admin password: ').encode(), bcrypt.gensalt()).decode())"
```

Paste the printed hash into the API environment file:

```sh
sudoedit /etc/sako-inverter/api.env
```

Set the value like this:

```env
ADMIN_PASSWORD_HASH='$2b$12$PASTE_THE_GENERATED_HASH_HERE'
```

Keep the single quotes around the bcrypt hash because it contains `$`
characters.

Restart the API after changing the file:

```sh
sudo systemctl restart sako-inverter-api
```

## Useful Configuration

`/etc/sako-inverter/api.env` normally contains:

```env
INVERTER_MODE=hardware
DATABASE_PATH=/var/lib/sako-inverter/sako.db
INVERTER_POLL_SECONDS=5
INVERTER_DB_SAMPLE_SECONDS=15
INVERTER_USB_VENDOR_ID=0x0665
INVERTER_USB_PRODUCT_ID=0x5161
ADMIN_PASSWORD_HASH='$2b$12$PASTE_THE_GENERATED_HASH_HERE'
LOG_LEVEL=INFO
LOG_FILE=/var/solar.log
BMS_MODE=disabled
BMS_BLUETOOTH_ADDRESS=
BMS_NAME=
BMS_PROTOCOL=JK02
BMS_CELL_COUNT=8
BMS_POLL_SECONDS=30
BMS_TIMEOUT_SECONDS=25
BMS_RETRIES=2
BMS_RETRY_DELAY_SECONDS=2
BMS_JKBMS_BACKEND=auto
BMS_BLE_RETRY_SECONDS=300
BMS_BLE_BOOTSTRAP_SECONDS=1
```

`INVERTER_POLL_SECONDS` controls live telemetry reads and WebSocket updates.
`INVERTER_DB_SAMPLE_SECONDS` controls how often successful telemetry is saved
to history.
`BMS_MODE` can be `disabled`, `simulator`, or `jkbms`. For hardware BMS reads,
first run `../scripts/bms-cli scan --json`, then verify with
`../scripts/bms-cli status --address <address> --protocol JK02 --json`.
`BMS_JKBMS_BACKEND=auto` tries persistent BLE first and falls back to the
pinned `jkbms` command if Bleak cannot use the adapter or no BLE frame arrives.
`BMS_BLE_RETRY_SECONDS` controls how long to stay on CLI before trying BLE
again. `BMS_BLE_BOOTSTRAP_SECONDS` waits after the device-info command before
requesting cell data. Use `ble` to force persistent BLE only, or `cli` to shell
out per poll. For CLI diagnostics, `status` and `monitor` accept
`--backend auto|ble|cli` too.

If `bluetoothctl list` prints nothing and `/sys/class/bluetooth/` has no
`hci*` entry, BlueZ is running but Linux has not created a Bluetooth adapter.
Check Pi firmware, overlays, and `hciuart` before debugging the app.

For local development, the backend can run in simulator mode:

```sh
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
DATABASE_PATH=/tmp/sako.db INVERTER_MODE=simulator ADMIN_PASSWORD_HASH='$2b$12$25VCqgb3TIbw6ZqH4g0qOOHsECOMRdeqznKF.oPQHI68shZHcbKT.' uvicorn app.main:app --reload
```

The demo password for that development hash is `admin`.
