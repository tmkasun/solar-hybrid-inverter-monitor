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
```

`INVERTER_POLL_SECONDS` controls live telemetry reads and WebSocket updates.
`INVERTER_DB_SAMPLE_SECONDS` controls how often successful telemetry is saved
to history.

For local development, the backend can run in simulator mode:

```sh
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
DATABASE_PATH=/tmp/sako.db INVERTER_MODE=simulator ADMIN_PASSWORD_HASH='$2b$12$25VCqgb3TIbw6ZqH4g0qOOHsECOMRdeqznKF.oPQHI68shZHcbKT.' uvicorn app.main:app --reload
```

The demo password for that development hash is `admin`.
