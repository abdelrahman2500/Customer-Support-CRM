import { registerDecorator, ValidationOptions } from "class-validator";

const LOWERCASE = /[a-z]/;
const UPPERCASE = /[A-Z]/;
const DIGIT = /\d/;
const SYMBOL = /[^A-Za-z0-9]/;

const MIN_CHARACTER_CLASSES = 3;

/**
 * Story 123 — Password Complexity. Requires a value to contain characters
 * from at least 3 of the 4 classes below (lowercase, uppercase, digit,
 * symbol) — the same "3-of-4 character categories" rule used by Windows/
 * Active Directory's and Microsoft Entra ID's default password-complexity
 * policy, a well-known industry default that needs no external stakeholder
 * input.
 *
 * Applied alongside `@MinLength(8)` (never in place of it) on every
 * password-creation/change DTO: `CreateUserDto.password`,
 * `ResetPasswordDto.newPassword`, `SetContactPortalPasswordDto.newPassword`.
 * Deliberately NOT applied to `LoginDto`/`PortalLoginDto` — complexity is a
 * creation/change-time policy, never a verification-time one.
 */
export function isPasswordComplex(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const classesPresent = [LOWERCASE, UPPERCASE, DIGIT, SYMBOL].filter((pattern) =>
    pattern.test(value),
  ).length;
  return classesPresent >= MIN_CHARACTER_CLASSES;
}

export function IsPasswordComplex(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isPasswordComplex",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isPasswordComplex(value);
        },
        defaultMessage(): string {
          return "password must contain at least 3 of: lowercase letter, uppercase letter, number, symbol";
        },
      },
    });
  };
}
