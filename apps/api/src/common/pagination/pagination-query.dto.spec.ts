import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PaginationQueryDto } from "./pagination-query.dto";

/**
 * Query params arrive as strings, so what matters here is the combination
 * of `@Type(() => Number)` and the validators — exactly the pipeline the
 * global `ValidationPipe` runs (`transform: true`, see `main.ts`). These
 * assertions mirror that: transform first, then validate.
 */
function validate(query: Record<string, unknown>) {
  const dto = plainToInstance(PaginationQueryDto, query, { enableImplicitConversion: false });
  return { dto, errors: validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }) };
}

function propertiesWithErrors(query: Record<string, unknown>) {
  return validate(query).errors.map((error) => error.property);
}

describe("PaginationQueryDto", () => {
  it("accepts a request with neither field, so paging stays opt-in", () => {
    const { dto, errors } = validate({});

    expect(errors).toEqual([]);
    expect(dto.page).toBeUndefined();
    expect(dto.pageSize).toBeUndefined();
  });

  it("coerces the numeric strings a query string actually delivers", () => {
    const { dto, errors } = validate({ page: "3", pageSize: "50" });

    expect(errors).toEqual([]);
    expect(dto.page).toBe(3);
    expect(dto.pageSize).toBe(50);
  });

  it("accepts the first page and the smallest page size", () => {
    expect(propertiesWithErrors({ page: "1", pageSize: "1" })).toEqual([]);
  });

  it("accepts the maximum page size", () => {
    expect(propertiesWithErrors({ pageSize: String(MAX_PAGE_SIZE) })).toEqual([]);
  });

  it("rejects a page size above the maximum instead of clamping it", () => {
    // Clamping would repeat the mistake the old `take: MAX_*_ROWS` caps
    // made: a response that silently does not match the request.
    expect(propertiesWithErrors({ pageSize: String(MAX_PAGE_SIZE + 1) })).toEqual(["pageSize"]);
    expect(propertiesWithErrors({ pageSize: "1000" })).toEqual(["pageSize"]);
  });

  it("rejects a page below one", () => {
    expect(propertiesWithErrors({ page: "0" })).toEqual(["page"]);
    expect(propertiesWithErrors({ page: "-1" })).toEqual(["page"]);
  });

  it("rejects a page size below one", () => {
    expect(propertiesWithErrors({ pageSize: "0" })).toEqual(["pageSize"]);
    expect(propertiesWithErrors({ pageSize: "-5" })).toEqual(["pageSize"]);
  });

  it("rejects fractional values", () => {
    expect(propertiesWithErrors({ page: "1.5" })).toEqual(["page"]);
    expect(propertiesWithErrors({ pageSize: "2.5" })).toEqual(["pageSize"]);
  });

  it("rejects text, which Number() turns into NaN", () => {
    expect(propertiesWithErrors({ page: "abc" })).toEqual(["page"]);
    expect(propertiesWithErrors({ pageSize: "abc" })).toEqual(["pageSize"]);
  });

  it("rejects an empty value rather than treating it as absent", () => {
    // `Number("")` is 0, which `@Min(1)` catches - worth pinning, because a
    // UI that clears a page input would otherwise ask for page 0.
    expect(propertiesWithErrors({ page: "" })).toEqual(["page"]);
  });

  it("reports both fields when both are wrong", () => {
    expect(propertiesWithErrors({ page: "0", pageSize: "500" }).sort()).toEqual([
      "page",
      "pageSize",
    ]);
  });

  it("publishes the defaults the service layer applies", () => {
    // `paginate` falls back to these, so they are part of the contract
    // rather than an implementation detail.
    expect(DEFAULT_PAGE_SIZE).toBe(25);
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});
