/** An expected failure with a message safe to show the user (rendered as a 4xx by route handlers). */
export class UserError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
