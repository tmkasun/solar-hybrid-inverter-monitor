# Sako solar inverter monitor

Python + React control plane for a Sako hybrid inverter attached by USB to a Raspberry Pi. It communicates with the Cypress `0665:5161` USB HID device using the PIP protocol; it is not a `/dev/ttyUSB*` serial connection.

## Laptop development

The default backend mode is a safe simulator. It accepts the supported priority changes and returns realistic PIP status/rating replies.

```sh
cd backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
DATABASE_PATH=/tmp/sako.db INVERTER_MODE=simulator ADMIN_PASSWORD_HASH='$2b$12$25VCqgb3TIbw6ZqH4g0qOOHsECOMRdeqznKF.oPQHI68shZHcbKT.' uvicorn app.main:app --reload

cd ../frontend && npm install && npm run dev
```

Open `http://localhost:5173`. The demo password is `admin`. The API documentation is at `http://localhost:8000/docs`.

Run the stack in containers with `docker compose -f compose.dev.yaml up --build`; browse to `http://localhost:8080`.

## Command-line control

The CLI talks to the inverter directly; it does not require the web stack to be running. It defaults to the safe simulator and can be run from the repository root:

```sh
./scripts/inverter-cli status
./scripts/inverter-cli monitor --interval 5
./scripts/inverter-cli info
./scripts/inverter-cli set output_source_priority sbu --yes
```

For a connected inverter, use hardware mode. The CLI uses `backend/.venv` automatically; prepare it first with `./scripts/pi-api-install` on the Pi:

```sh
INVERTER_MODE=hardware ./scripts/inverter-cli status
INVERTER_MODE=hardware ./scripts/inverter-cli set charger_source_priority solar --yes
```

After an Ubuntu release upgrade, rerun `./scripts/pi-api-install`. It detects a changed Python major/minor version, recreates `backend/.venv`, and installs the required dependencies (including PyUSB) for the new interpreter.

Only the supported, model-verified priority settings are available. `set` always requires `--yes`; use `./scripts/inverter-cli --help` for all options, including USB vendor/product ID overrides and JSON output.

For troubleshooting, add `--verbose` before the command to show USB transport details and stack traces on stderr. The normal result remains on stdout, so JSON output can still be redirected safely:

```sh
INVERTER_MODE=hardware ./scripts/inverter-cli --verbose status --json >status.json
docker compose logs --follow api
```

If the CLI reports `could not claim USB interface 0` or `Resource busy`, another process already owns the inverter HID interface. Stop the API before using the direct CLI, then restart it when finished:

```sh
sudo systemctl stop sako-inverter-api
INVERTER_MODE=hardware ./scripts/inverter-cli status
sudo systemctl start sako-inverter-api
```

If the earlier Docker deployment is still running on the Pi, stop it with `docker compose down`. If neither app is running, check for UPS daemons such as NUT/usbhid-ups or apcupsd and disable them for this USB device.

The API logs connection setup, protocol probes, failed USB commands (including malformed reply bytes), polling failures, settings changes, and database errors. It never logs passwords, session IDs, or CSRF tokens.

If the Pi was manually restarted after becoming unreachable, first compare the previous boot's end time with the incident time. `journalctl -u sako-inverter-api -b -1` only shows the API service; a clean `Stopping Sako inverter API...` line means systemd intentionally stopped the service during shutdown/reboot, not that the API was killed by the kernel. Check the whole previous boot for the real cause:

```sh
sudo journalctl -b -1 -e --no-pager
sudo journalctl -k -b -1 --no-pager | grep -Ei 'oom|out of memory|killed process|under-voltage|voltage|usb|reset|ext4|mmc|i/o error'
sudo journalctl -b -1 --no-pager | grep -Ei 'reboot|shutdown|watchdog|thermal|thrott|NetworkManager|sshd|sako-inverter'
```

`USB inverter 0665:5161 not found` means the HID device was absent when the API probed it. The service retries inverter discovery every `INVERTER_DISCOVERY_RETRY_SECONDS`, so a temporary USB/inverter reset can recover without restarting the API.

## JK-BMS Bluetooth telemetry

The app can read a JK-BMS over Bluetooth as a read-only second telemetry source. BMS values become authoritative for battery SOC, voltage, current, cell voltages, and temperatures when fresh; if Bluetooth polling fails, the dashboard falls back to the inverter battery values.

First discover and verify the BMS from the Pi:

```sh
./scripts/bms-cli scan --json
./scripts/bms-cli status --address C8:47:8C:E2:A0:2E --protocol JK02 --json
./scripts/bms-cli monitor --address C8:47:8C:E2:A0:2E --protocol JK02 --interval 30
```

Enable API polling in `/etc/sako-inverter/api.env` after the CLI read succeeds:

```env
BMS_MODE=jkbms
BMS_BLUETOOTH_ADDRESS=C8:47:8C:E2:A0:2E
BMS_NAME=JK-B1A20S15P
BMS_PROTOCOL=JK02
BMS_CELL_COUNT=8
BMS_POLL_SECONDS=30
BMS_TIMEOUT_SECONDS=25
BMS_RETRIES=2
BMS_RETRY_DELAY_SECONDS=2
BMS_JKBMS_BACKEND=ble
```

Restart the API with `sudo systemctl restart sako-inverter-api`. Use `BMS_MODE=simulator` for laptop/UI development, or keep `BMS_MODE=disabled` to run inverter-only. `BMS_JKBMS_BACKEND=ble` keeps one Bluetooth LE connection open and reads the JK-BMS notification stream between polls; set `BMS_JKBMS_BACKEND=cli` to force the older behavior that shells out to the `jkbms` command for each poll. The `bms-cli status` and `bms-cli monitor` commands also default to persistent BLE; add `--backend cli` to compare against the old reader. `mppsolar[ble]==0.15.62` is pinned intentionally because it supports Python 3.8.1+ and the older `jkbms` CLI behavior used by this pack.

## Raspberry Pi deployment

On the Pi, install Docker Engine and the Compose plugin. From the laptop run `scripts/deploy-pi user@PI_HOST:/opt/sako-inverter`. The first run copies the udev rule and creates `.env`; set a unique bcrypt `ADMIN_PASSWORD_HASH` there, then run the deploy command again.

Route `sako.knnect.com` to the Pi's static LAN address using the router/Pi-hole local DNS override. The app is LAN-only and intentionally listens on HTTP port 80; do not port-forward it.

Run `./scripts/pi-preflight` on the Pi to validate Docker, USB bus availability, and the inverter USB ID. Ubuntu 20.04 is out of standard support and should be upgraded after commissioning.

## Split deployment: Pi API and remote UI

To minimise Raspberry Pi resource use, run only the Python API directly on the Pi and serve the compiled UI from `home.knnect.lk`. The web server must reach the Pi over a private LAN or VPN address; do not expose the Pi's port 8000 to the public internet. The reverse proxy keeps browser requests same-origin, so authentication cookies and WebSockets continue to work without CORS changes.

On the Pi, install the API service (this installs Python packages in `backend/.venv`, configures USB access, and starts systemd):

```sh
cd ~/projects/solar-hybrid-inverter-monitor
# If Python reports "No module named ensurepip":
sudo apt update && sudo apt install -y python3-venv build-essential pkg-config libglib2.0-dev bluetooth bluez
# Only if this Pi previously ran the Docker stack:
docker compose down
./scripts/pi-api-install
sudoedit /etc/sako-inverter/api.env
sudo systemctl restart sako-inverter-api
sudo journalctl -u sako-inverter-api -f
sudo tail -f /var/solar.log
```

Set a bcrypt `ADMIN_PASSWORD_HASH` in `/etc/sako-inverter/api.env`. Its database is stored at `/var/lib/sako-inverter/sako.db`. API logs are also written to `/var/solar.log`, with logrotate keeping 5 compressed 5 MB backups. Permit TCP port 8000 only from the private IP of the `home.knnect.lk` server, for example with UFW:

```sh
sudo ufw allow from HOME_SERVER_PRIVATE_IP to any port 8000 proto tcp
```

The frontend can run as a lightweight Docker container on `home.knnect.lk`. Clone this repository there, create an environment file, and start the frontend container:

```sh
cd /opt/sako-inverter
printf 'PI_API_UPSTREAM=PI_PRIVATE_IP:8000\n' > .env.ui
docker compose --env-file .env.ui -f compose.ui.yaml up -d --build
```

`PI_API_UPSTREAM` is used only inside the frontend container and should be the Pi's private LAN/VPN address, such as `192.168.1.50:8000`. Do not set it to the public frontend hostname; the browser-facing site should proxy to the local frontend container, and the frontend container should proxy only to the private Pi API address. The container is bound to `127.0.0.1:8080`, so it is not publicly reachable by itself. On `home.knnect.lk`, install [home.knnect.lk.docker.nginx.conf.template](deployment/home.knnect.lk.docker.nginx.conf.template) as the HTTPS virtual host, validate it with `sudo nginx -t`, then reload nginx. It assumes an existing Let's Encrypt certificate for `home.knnect.lk`.

If `/api/*` returns `502 Bad Gateway` from the UI but direct API requests work elsewhere, check from inside the frontend container:

```sh
./scripts/check-ui-proxy
```

The `direct upstream health` step must return `{"ok":true,...}`. If it fails, set `PI_API_UPSTREAM` in `.env.ui` to an address reachable from the `home.knnect.lk` server/container, then recreate the UI container:

```sh
printf 'PI_API_UPSTREAM=PI_PRIVATE_IP:8000\n' > .env.ui
docker compose --env-file .env.ui -f compose.ui.yaml up -d --force-recreate
```

The previous static-file option remains available through [home.knnect.lk.nginx.conf.template](deployment/home.knnect.lk.nginx.conf.template) and `scripts/deploy-ui`.

For future Pi API updates from a development machine, use:

```sh
./scripts/deploy-pi-api ubuntu@PI_HOST:/home/ubuntu/projects/solar-hybrid-inverter-monitor
```

## Safety

Only capability-registered settings are exposed. Every write needs an authenticated cookie, CSRF header, typed API confirmation, UI confirmation, inverter acknowledgement, and audit-log entry. First validate each offered setting against the LCD/manual with the appliance in a safe operating condition.

The initial capability catalog deliberately includes the two write operations verified in the referenced Sako implementation: output-source priority (`POP00`/`POP01`/`POP02`) and charging-source priority (`PCP01`/`PCP02`/`PCP03`). Add any further PIP settings only after verifying their model-specific command and accepted value range against your inverter manual.
