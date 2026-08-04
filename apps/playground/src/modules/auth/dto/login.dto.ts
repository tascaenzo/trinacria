import { type Infer, s } from "@trinacria/schema";

export const LoginDtoSchema = s.object(
  {
    email: s.string({ trim: true, toLowerCase: true, email: true }),
    password: s.string({ minLength: 8, maxLength: 128 }),
    sessionContext: s
      .object(
        {
          clientIp: s.string({ ip: "both" }).optional(),
          clientHost: s.string({ hostname: true }).optional(),
          device: s
            .tuple([
              s.string({ trim: true, minLength: 1, maxLength: 32 }),
              s.string({ trim: true, minLength: 1, maxLength: 32 }),
            ] as const)
            .optional(),
          labels: s
            .record(
              s.string({ pattern: /^[a-z0-9_-]{1,32}$/ }),
              s.string({ trim: true, minLength: 1, maxLength: 64 }),
            )
            .optional(),
        },
        { strict: true },
      )
      .refine(
        (value) =>
          value.clientIp !== undefined ||
          value.clientHost !== undefined ||
          value.device !== undefined ||
          value.labels !== undefined,
        "sessionContext must include at least one field",
        "empty_session_context",
      )
      .optional(),
  },
  { strict: true },
);

export type LoginDto = Infer<typeof LoginDtoSchema>;
