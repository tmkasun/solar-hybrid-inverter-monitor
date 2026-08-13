from pathlib import Path


def test_cli_wrapper_prefers_the_project_virtual_environment():
    script = Path("scripts/inverter-cli").read_text()
    assert '"$root_dir/backend/.venv/bin/python"' in script
    assert "pi-api-install first" in script


def test_pi_api_install_explains_missing_venv_package():
    script = Path("scripts/pi-api-install").read_text()
    assert "import ensurepip, venv" in script
    assert "sudo apt update && sudo apt install -y python3-venv" in script
    assert "/var/solar.log" in script
    assert "/etc/logrotate.d/sako-inverter-api" in script
