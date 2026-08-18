import json

from app import bms_cli
from app.bms import SimulatorBms


def test_bms_cli_scan_json(monkeypatch, capsys):
    async def fake_scan(timeout):
        assert timeout == 1
        return [{"address": "AA:BB", "name": "JK-BMS", "rssi": -45}]

    monkeypatch.setattr(bms_cli, "scan_bluetooth_devices", fake_scan)

    assert bms_cli.main(["scan", "--timeout", "1", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["devices"][0]["address"] == "AA:BB"


def test_bms_cli_status_json(monkeypatch, capsys):
    class FakeBms:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        async def status(self):
            return await SimulatorBms(2).status()

        async def close(self):
            return None

    monkeypatch.setattr(bms_cli, "JkbmsBleBms", FakeBms)

    assert bms_cli.main(["status", "--address", "AA:BB", "--backend", "ble", "--json"]) == 0
    snapshot = json.loads(capsys.readouterr().out)
    assert snapshot["connected"] is True
    assert snapshot["cells"][0]["index"] == 1


def test_bms_cli_status_can_force_cli_backend(monkeypatch, capsys):
    class FakeBms:
        def __init__(self, *args):
            self.args = args

        async def status(self):
            return await SimulatorBms(2).status()

        async def close(self):
            return None

    monkeypatch.setattr(bms_cli, "JkbmsCliBms", FakeBms)

    assert bms_cli.main(["status", "--address", "AA:BB", "--backend", "cli", "--json"]) == 0
    snapshot = json.loads(capsys.readouterr().out)
    assert snapshot["connected"] is True


def test_bms_cli_raw_prints_unmodified_json(monkeypatch, capsys):
    class FakeBms:
        def __init__(self, *args):
            self.args = args

        async def raw(self, command):
            assert command == "getCellData"
            return {"getCellData": {"_command": ["getCellData", ""], "note": "raw"}}

        async def close(self):
            return None

    monkeypatch.setattr(bms_cli, "JkbmsCliBms", FakeBms)

    assert bms_cli.main(["raw", "--address", "AA:BB"]) == 0
    assert json.loads(capsys.readouterr().out)["getCellData"]["note"] == "raw"
