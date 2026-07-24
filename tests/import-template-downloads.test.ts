import { beforeEach, describe, expect, it, vi } from "vitest"

const xlsxMocks = vi.hoisted(() => ({
  aoaToSheet: vi.fn(() => ({})),
  bookAppendSheet: vi.fn(),
  bookNew: vi.fn(() => ({})),
  encodeRange: vi.fn(() => "A1:J2"),
  jsonToSheet: vi.fn(() => ({})),
  writeFile: vi.fn(),
}))

vi.mock("xlsx", () => ({
  utils: {
    aoa_to_sheet: xlsxMocks.aoaToSheet,
    book_append_sheet: xlsxMocks.bookAppendSheet,
    book_new: xlsxMocks.bookNew,
    encode_range: xlsxMocks.encodeRange,
    json_to_sheet: xlsxMocks.jsonToSheet,
  },
  writeFile: xlsxMocks.writeFile,
}))

import {
  IMPORT_TEMPLATE_OPTIONS,
  downloadImportTemplate,
} from "@/lib/client/import-template-downloads"

describe("import template downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exposes the three pilot import template choices", () => {
    expect(IMPORT_TEMPLATE_OPTIONS.map((option) => option.type)).toEqual([
      "properties",
      "installations",
      "events",
    ])
    expect(IMPORT_TEMPLATE_OPTIONS.map((option) => option.title)).toEqual([
      "Mall för fastigheter",
      "Mall för aggregat",
      "Mall för händelser",
    ])
  })

  it("downloads the properties template with the expected filename", () => {
    downloadImportTemplate("properties")

    expect(xlsxMocks.writeFile).toHaveBeenCalledWith(
      expect.any(Object),
      "helm-polar-importmall-fastigheter.xlsx"
    )
  })

  it("downloads the installations template with CO₂e guidance", () => {
    downloadImportTemplate("installations")

    expect(xlsxMocks.aoaToSheet).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.stringContaining("CO₂e"),
        ]),
      ])
    )
    expect(xlsxMocks.writeFile).toHaveBeenCalledWith(
      expect.any(Object),
      "helm-polar-importmall-aggregat.xlsx"
    )
  })

  it("downloads the events template with the expected filename", () => {
    downloadImportTemplate("events")

    expect(xlsxMocks.writeFile).toHaveBeenCalledWith(
      expect.any(Object),
      "helm-polar-importmall-handelser.xlsx"
    )
  })
})
