import { Injectable } from "@nestjs/common";
import { genSalt, hash, compare } from "bcrypt";
import { createHash, randomInt } from "node:crypto";

// Excludes visually ambiguous characters (0/O, 1/l/I) so a password read off a printed slip
// or read aloud over the phone isn't misheard.
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

@Injectable()
export class HashService {
  async hash(value: string): Promise<string> {
    const salt = await genSalt(10);
    return await hash(value, salt);
  }

  async compare(value: string, hash: string): Promise<boolean> {
    return await compare(value, hash);
  }

  /**
   * For long, high-entropy secrets we generate ourselves (JWT refresh tokens) rather than
   * user-chosen passwords. bcrypt silently truncates its input at 72 bytes, so two different
   * tokens that share the same first 72 bytes (e.g. an access and a refresh token issued for
   * the same user, whose payloads start identically) hash to the same value and become
   * interchangeable. SHA-256 has no such truncation and lets us look the row up by an exact
   * match instead of bcrypt-comparing against every row for the user.
   */
  sha256Hex(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  /**
   * A one-time login password handed to a new account, never derived from the person's name
   * (the old scheme was literally `${FirstName}@2026` for everyone). 12 characters from a
   * 55-symbol alphabet is comfortably beyond what login throttling + a few hundred guesses
   * could reach.
   */
  generateRandomPassword(length = 12): string {
    let password = "";
    for (let i = 0; i < length; i++) {
      password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
    }
    return password;
  }
}
