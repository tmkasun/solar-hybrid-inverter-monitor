from app.protocol import crc16_xmodem, frame, parse_qpigs, response_payload


def test_pip_frame_has_crc_and_return():
    assert frame("QPIGS").endswith(b"\r")
    assert crc16_xmodem(b"QPIGS") == 0xB7A9


def test_status_parser():
    status = parse_qpigs("230.0 50.0 230.0 50.0 0550 0440 22 390 51.20 012 86 31 4.2 116.0 51.10 000 01000000")
    assert status.output_active_power_w == 440
    assert status.battery_capacity_percent == 86


def test_status_parser_decodes_deci_degree_temperature():
    status = parse_qpigs("232.0 49.9 229.0 50.0 0592 0476 020 374 26.12 000 078 0490 0010 036.9 25.43 00011 10010110")
    assert status.inverter_temperature_c == 49.0


def test_bad_checksum_is_rejected():
    try:
        response_payload(b"(ACKxx\r")
    except ValueError as exc:
        assert "checksum" in str(exc)
    else:
        raise AssertionError("checksum should be checked")


def test_checksumless_structured_rating_can_be_explicitly_allowed():
    rating = b"(230.0 13.0 230.0 50.0 13.0 3000 3000 24.0 25.0 24.0 27.4 27.4 2 15 40 0 1 3 - 01 1 0 26\r"
    assert response_payload(rating, allow_unchecksummed_rating=True).endswith("0 26")
