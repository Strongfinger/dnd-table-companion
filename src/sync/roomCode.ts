// Room codes for the lobby: short, easy to read aloud and type on a phone.
// No look-alike characters (0/O, 1/I/L), so "K7QX4M" can't be misread.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6

/** A new random room code (uses the browser's secure random numbers). */
export function newRoomCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // 31 letters: reject bytes ≥ 248 so every letter is equally likely.
  let code = ''
  while (code.length < ROOM_CODE_LENGTH) {
    for (const b of random(ROOM_CODE_LENGTH * 2)) {
      if (b < 248 && code.length < ROOM_CODE_LENGTH) code += ALPHABET[b % ALPHABET.length]
    }
  }
  return code
}

/** Clean what a player typed: upper case, spaces and dashes removed ("k7q x4m" → "K7QX4M"). */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((ch) => ALPHABET.includes(ch))
}
