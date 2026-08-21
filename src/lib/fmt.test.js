import { IDR, IDRPlain, rupiah, N, numInput } from "./fmt";

// Non-breaking space: Intl currency formatting for id-ID uses U+00A0.
const nb = (s) => s.replace(/\u00a0/g, " ");

test("IDR renders locale currency without decimals", () => {
  expect(nb(IDR(1000))).toBe("Rp 1.000");
  expect(nb(IDR(1234567))).toBe("Rp 1.234.567");
});

test("IDRPlain omits the currency symbol and rounds to whole rupiah", () => {
  expect(IDRPlain(1000)).toBe("1.000");
  expect(IDRPlain(1000.5)).toBe("1.001");
});

test("rupiah prefixes manually, optionally without a space", () => {
  expect(rupiah(1000)).toBe("Rp 1.000");
  expect(rupiah(1000, { space: false })).toBe("Rp1.000");
});

test("null and undefined are treated as zero, not NaN", () => {
  for (const f of [IDR, IDRPlain, rupiah]) {
    expect(f(null)).toEqual(f(0));
    expect(f(undefined)).toEqual(f(0));
    expect(String(f(null))).not.toMatch(/NaN/);
  }
});

describe("numInput", () => {
  // MySQL returns DECIMAL columns as zero-padded strings. Edit forms were
  // showing "5000.00" and "100.0000" where the user only ever typed 5000/100.
  test("strips padding that MySQL adds to DECIMAL columns", () => {
    expect(numInput("5000.00")).toBe("5000");
    expect(numInput("100.0000")).toBe("100");
    expect(numInput("0.00")).toBe("0");
  });

  test("keeps decimals that actually carry meaning", () => {
    expect(numInput("0.50")).toBe("0.5");
    expect(numInput("1.5000")).toBe("1.5");
    expect(numInput("12.34")).toBe("12.34");
    expect(numInput(1.5)).toBe("1.5");
  });

  // "" (not "0") so an unknown cost stays an empty field. A 0 would look like
  // a deliberate answer and book zero-cost stock.
  test("blank-ish values stay blank rather than becoming zero", () => {
    expect(numInput(null)).toBe("");
    expect(numInput(undefined)).toBe("");
    expect(numInput("")).toBe("");
  });

  test("never emits NaN or exponent notation into an input", () => {
    // Garbage passes through visibly instead of vanishing.
    expect(numInput("abc")).toBe("abc");
    // Number->String would give "1e+21", which type=number rejects.
    expect(numInput("1000000000000000000000")).not.toMatch(/e\+/i);
  });

  test("handles negatives", () => {
    expect(numInput("-12.50")).toBe("-12.5");
  });
});

test("N coerces API numerics, treating '.' as a decimal point", () => {
  // N is for raw backend values ("1000.50"), NOT display strings. It cannot
  // round-trip IDR() output: "1.000" parses as 1, since the dot is decimal.
  expect(N("1000.50")).toBe(1000.5);
  expect(N(1000)).toBe(1000);
  expect(N("Rp 2.500")).not.toBe(2500);
  expect(N(null)).toBe(0);
  expect(N("abc")).toBe(0);
});
