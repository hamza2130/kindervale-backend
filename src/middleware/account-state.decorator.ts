import { SetMetadata } from "@nestjs/common";

// Lets a handler run even when the caller's account has mustChangePassword set -- only the
// routes that exist specifically to get OUT of that state (change-password) or that the forced
// password-change screen itself needs (profile, to know who it's greeting) should carry this.
export const SKIP_ACCOUNT_STATE_KEY = "skipAccountStateCheck";
export const SkipAccountStateCheck = () => SetMetadata(SKIP_ACCOUNT_STATE_KEY, true);
