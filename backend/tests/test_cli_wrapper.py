from pathlib import Path


def test_cli_wrapper_prefers_the_project_virtual_environment():
    script = Path("scripts/inverter-cli").read_text()
    assert '"$root_dir/backend/.venv/bin/python"' in script
    assert "pi-api-install first" in script
