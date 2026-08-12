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

For a connected inverter, use hardware mode (and ensure `pyusb` is installed in the Python environment):

```sh
INVERTER_MODE=hardware ./scripts/inverter-cli status
INVERTER_MODE=hardware ./scripts/inverter-cli set charger_source_priority solar --yes
```

Only the supported, model-verified priority settings are available. `set` always requires `--yes`; use `./scripts/inverter-cli --help` for all options, including USB vendor/product ID overrides and JSON output.

For troubleshooting, add `--verbose` before the command to show USB transport details and stack traces on stderr. The normal result remains on stdout, so JSON output can still be redirected safely:

```sh
INVERTER_MODE=hardware ./scripts/inverter-cli --verbose status --json >status.json
docker compose logs --follow api
```

The API logs connection setup, protocol probes, failed USB commands (including malformed reply bytes), polling failures, settings changes, and database errors. It never logs passwords, session IDs, or CSRF tokens.

## Raspberry Pi deployment

On the Pi, install Docker Engine and the Compose plugin. From the laptop run `scripts/deploy-pi user@PI_HOST:/opt/sako-inverter`. The first run copies the udev rule and creates `.env`; set a unique bcrypt `ADMIN_PASSWORD_HASH` there, then run the deploy command again.

Route `sako.knnect.com` to the Pi's static LAN address using the router/Pi-hole local DNS override. The app is LAN-only and intentionally listens on HTTP port 80; do not port-forward it.

Run `./scripts/pi-preflight` on the Pi to validate Docker, USB bus availability, and the inverter USB ID. Ubuntu 20.04 is out of standard support and should be upgraded after commissioning.

## Safety

Only capability-registered settings are exposed. Every write needs an authenticated cookie, CSRF header, typed API confirmation, UI confirmation, inverter acknowledgement, and audit-log entry. First validate each offered setting against the LCD/manual with the appliance in a safe operating condition.

The initial capability catalog deliberately includes the two write operations verified in the referenced Sako implementation: output-source priority (`POP00`/`POP01`/`POP02`) and charging-source priority (`PCP01`/`PCP02`/`PCP03`). Add any further PIP settings only after verifying their model-specific command and accepted value range against your inverter manual.
