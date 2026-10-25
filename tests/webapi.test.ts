import { describe, expect, it } from "vitest";
import { AIRCRAFT_ICAO, idFromLookup, lookupUrl, textFromValue, valueUrl } from "../src/core/telemetry/webapi";

describe("X-Plane Web API", () => {
  it("looks a dataref up by name and reads it by id", () => {
    expect(lookupUrl("127.0.0.1", 8086, "v3", AIRCRAFT_ICAO)).toBe(
      "http://127.0.0.1:8086/api/v3/datarefs?filter%5Bname%5D=sim%2Faircraft%2Fview%2Facf_ICAO",
    );
    expect(valueUrl("127.0.0.1", 8086, "v2", 1225)).toBe("http://127.0.0.1:8086/api/v2/datarefs/1225/value");
  });

  it("takes the id from a lookup answer", () => {
    expect(idFromLookup({ data: [{ id: 1225, name: AIRCRAFT_ICAO, value_type: "data" }] })).toBe(1225);
    expect(idFromLookup({ data: [] })).toBeNull();
    expect(idFromLookup({ error_code: "invalid_dataref_name" })).toBeNull();
    expect(idFromLookup(null)).toBeNull();
  });

  it("decodes a byte-array value up to its first NUL", () => {
    expect(textFromValue({ data: btoa("C172\0\0\0\0") })).toBe("C172");
    expect(textFromValue({ data: btoa("Extra\0garbage") })).toBe("Extra");
  });

  it("says nothing for an empty, binary or malformed value", () => {
    expect(textFromValue({ data: btoa("\0\0\0") })).toBeNull();
    expect(textFromValue({ data: btoa("\u0001\u0002") })).toBeNull();
    expect(textFromValue({ data: "not base64!" })).toBeNull();
    expect(textFromValue({ data: 1.5 })).toBeNull();
  });
});
