import json

from app.cli import main


def test_cli_status_json_uses_simulator(capsys):
    assert main(["--mode", "simulator", "status", "--json"]) == 0
    snapshot = json.loads(capsys.readouterr().out)
    assert snapshot["connected"] is True
    assert snapshot["status"]["battery_capacity_percent"] == 86


def test_cli_setting_requires_explicit_confirmation(capsys):
    assert main(["--mode", "simulator", "set", "output_source_priority", "sbu"]) == 2
    assert "without --yes" in capsys.readouterr().err

    assert main(["--mode", "simulator", "set", "output_source_priority", "sbu", "--yes"]) == 0
    assert "POP02" in capsys.readouterr().out
