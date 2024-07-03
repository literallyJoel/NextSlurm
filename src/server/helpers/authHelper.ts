import { z } from "zod";

export const obscureEmail = z
  .function()
  .args(z.string().email())
  .returns(z.string())
  .implement((email) => {
    const split = email.split("@");
    const domain = split[1]!;
    const username = split[0]!;
    const obscuredDomain =
      domain.slice(0, Math.floor(domain.length / 3)) +
      "****" +
      domain.slice(Math.floor(domain.length / 3) * 2);
    const obscuredUsername =
      username.slice(0, Math.floor(username.length / 3)) +
      "****" +
      username.slice(Math.floor(username.length / 3) * 2);

    return `${obscuredUsername}@${obscuredDomain}`;
  });
