from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Choice:
    value: str
    label: str
    command: str


@dataclass(frozen=True)
class Capability:
    key: str
    label: str
    warning: str
    choices: tuple[Choice, ...]


CAPABILITIES = (
    Capability("output_source_priority", "Output source priority", "Changing this can transfer the load between grid, solar, and battery.", (
        Choice("utility", "Utility first", "POP00"), Choice("solar", "Solar first", "POP01"), Choice("sbu", "SBU priority", "POP02"))),
    Capability("charger_source_priority", "Charger source priority", "Changing this can alter battery charging behaviour.", (
        Choice("solar_first", "Solar first", "PCP01"), Choice("solar_utility", "Solar and utility", "PCP02"), Choice("solar", "Solar only", "PCP03"))),
)


def public_capabilities() -> list[dict]:
    return [asdict(capability) for capability in CAPABILITIES]


def command_for(key: str, value: str) -> str | None:
    for capability in CAPABILITIES:
        if capability.key == key:
            return next((choice.command for choice in capability.choices if choice.value == value), None)
    return None


def confirmation_for(key: str) -> str:
    return f"APPLY {key}"
