import json

import pytest

from app.cli import _read_status, _require_pip_protocol, main
from app.driver import InverterError


def test_cli_status_json_uses_simulator(capsys):
    assert main(["--mode", "simulator", "status", "--json"]) == 0
    snapshot = json.loads(capsys.readouterr().out)
    assert snapshot["connected"] is True
    assert snapshot["status"]["battery_capacity_percent"] == 86


def test_cli_setting_requires_explicit_confirmation(capsys):
    assert main(["--mode", "simulator", "set", "output_source_priority", "sbu"]) == 2
    err = capsys.readouterr().err
    assert "without --yes" in err
    assert "Traceback" not in err

    assert main(["--mode", "simulator", "set", "output_source_priority", "sbu", "--yes"]) == 0
    assert "POP02" in capsys.readouterr().out


@pytest.mark.asyncio
async def test_cli_rejects_devices_that_do_not_identify_as_pip():
    class NonPipInverter:
        async def command(self, command):
            assert command == "QPI"
            return "QPI"

    with pytest.raises(InverterError, match="no status or setting command was sent"):
        await _require_pip_protocol(NonPipInverter())


@pytest.mark.asyncio
async def test_cli_rejects_nak_monitoring_responses():
    class RejectingInverter:
        async def command(self, command):
            return "NAK"

    with pytest.raises(InverterError, match="rejected monitoring command"):
        await _read_status(RejectingInverter())
