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


def test_status_parser_decodes_human_readable_status_flags():
    status = parse_qpigs("232.0 49.9 229.0 50.0 0592 0476 020 374 26.12 000 078 0490 0010 036.9 25.43 00011 10010110")
    assert [flag["label"] for flag in status.status_flags if flag["active"]] == [
        "SBU-priority capability", "Load output on", "Charging enabled", "Solar charging enabled"
    ]


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


def test_structured_status_with_firmware_bad_checksum_can_be_explicitly_allowed():
    reply = bytes.fromhex(
        "28 32 32 38 2e 30 20 35 30 2e 30 20 32 32 38 2e 31 36 31 20 30 31 36 31 20 30 30 35 20 33 38 30 "
        "20 32 36 2e 34 35 20 30 30 30 20 30 38 36 20 30 34 33 34 20 30 30 30 32 20 30 33 37 2e 38 20 "
        "32 35 2e 37 33 20 30 30 30 30 37 20 31 30 30 31 30 31 31 30 20 30 30 20 30 33 20 30 30 30 37 "
        "34 20 30 30 30 a8 7f 0d"
    )

    assert response_payload(reply, allow_unverified_status=True).startswith("228.0 50.0")


def test_status_parser_handles_compact_sako_qpigs_variant():
    status = parse_qpigs(
        "228.0 50.0 228.161 0161 005 380 26.45 000 086 0434 0002 037.8 25.73 00007 10010110 00 03 00074 000"
    )

    assert status.grid_voltage == 228.0
    assert status.grid_frequency == 50.0
    assert status.output_voltage == 228.161
    assert status.output_frequency is None
    assert status.output_apparent_power_va == 161
    assert status.output_active_power_w == 5
    assert status.load_percent is None
    assert status.bus_voltage == 380
    assert status.battery_voltage == 26.45
    assert status.battery_capacity_percent == 86
    assert status.inverter_temperature_c == 43.4
    assert status.pv_input_voltage == 37.8
    assert status.battery_discharge_current == 7
    assert status.status_bits == "10010110"
