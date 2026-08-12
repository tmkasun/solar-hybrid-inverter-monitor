from app.protocol import crc16_xmodem, frame, parse_qpigs, response_payload


def test_pip_frame_has_crc_and_return():
    assert frame("QPIGS").endswith(b"\r")
    assert crc16_xmodem(b"QPIGS") == 0xB7A9


def test_status_parser():
    status = parse_qpigs("230.0 50.0 230.0 50.0 0550 0440 22 390 51.20 012 86 31 4.2 116.0 51.10 000 01000000")
    assert status.output_active_power_w == 440
    assert status.battery_capacity_percent == 86


def test_bad_checksum_is_rejected():
    try:
        response_payload(b"(ACKxx\r")
    except ValueError as exc:
        assert "checksum" in str(exc)
    else:
        raise AssertionError("checksum should be checked")
