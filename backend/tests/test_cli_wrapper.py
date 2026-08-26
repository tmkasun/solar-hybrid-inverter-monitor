from pathlib import Path


def test_cli_wrapper_prefers_the_project_virtual_environment():
    script = Path("scripts/inverter-cli").read_text()
    assert '"$root_dir/backend/.venv/bin/python"' in script
    assert "pi-api-install first" in script

    bms_script = Path("scripts/bms-cli").read_text()
    assert '"$root_dir/backend/.venv/bin/python"' in bms_script
    assert "app.bms_cli" in bms_script


def test_pi_api_install_explains_missing_venv_package():
    script = Path("scripts/pi-api-install").read_text()
    assert "import ensurepip, venv" in script
    assert "sudo apt update && sudo apt install -y python3-venv" in script
    assert "/var/solar.log" in script
    assert "/etc/logrotate.d/sako-inverter-api" in script

    preflight = Path("scripts/pi-api-preflight").read_text()
    assert "pkg-config --exists glib-2.0" in preflight


def test_jkbms_bluetooth_recovery_script_covers_adapter_recovery_flow():
    script = Path("scripts/recover-jkbms-bluetooth").read_text()
    assert "systemctl stop sako-inverter-api" in script
    assert "bluetoothctl disconnect" in script
    assert "rfkill unblock bluetooth" in script
    assert "systemctl restart hciuart" in script
    assert "bluetoothctl list" in script
    assert "--backend ble" in script
    assert "systemctl restart sako-inverter-api" in script
    assert "--fix-packages" in script
    assert "Bluetooth core loaded, but no HCI controller is visible." in script
    assert "PL011 UART" in script
    assert "enable_uart" in script
    assert "dtparam=krnbt=on" in script
    assert "systemctl disable hciuart" in script
