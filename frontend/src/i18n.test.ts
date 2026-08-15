import { describe, expect, it } from "vitest";
import { createI18n, metricLabel, normalizeLanguage, settingChoiceLabel, settingWarningLabel, statusFlagLabel, storedLanguage } from "./i18n";

describe("i18n helpers", () => {
  it("normalizes stored and browser-style language values", () => {
    expect(normalizeLanguage("si-LK")).toBe("si");
    expect(normalizeLanguage("ta")).toBe("ta");
    expect(normalizeLanguage("fr-FR")).toBe("en");
    expect(storedLanguage(() => "ta-LK")).toBe("ta");
  });

  it("interpolates translated strings and falls back to English", () => {
    const si = createI18n("si");
    expect(si.t("analysis.samplesSummary", { samples: 12, range: "1h", zoom: "full" })).toContain("12");
    expect(si.t("rating.agm")).toBe("AGM");
  });

  it("translates generated metric labels", () => {
    const ta = createI18n("ta");
    expect(metricLabel(ta, "battery_voltage")).toContain("பேட்டரி");
    expect(metricLabel(ta, "bms_cell_03_voltage")).toContain("3");
  });

  it("uses stable keys for setting choices and backend text fallbacks", () => {
    const si = createI18n("si");
    expect(settingChoiceLabel(si, "charger_source_priority", "solar", "Solar only")).toBe("සූර්ය පමණයි");
    expect(settingWarningLabel(si, "future_setting", "Future warning")).toBe("Future warning");
    expect(statusFlagLabel(si, "future_flag", "Future flag")).toBe("Future flag");
  });
});
