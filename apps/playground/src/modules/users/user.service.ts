export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserInput {
  name: string;
  email: string;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
}

const seedUsers: User[] = [
  {
    id: "1",
    name: "Mario Rossi",
    email: "mario@test.com",
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
  },
  {
    id: "2",
    name: "Luigi Verdi",
    email: "luigi@test.com",
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
  },
];

export class UserService {
  private readonly users = new Map<string, User>(
    seedUsers.map((user) => [user.id, user]),
  );

  list(): User[] {
    return Array.from(this.users.values());
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  existsByEmail(email: string, excludeId?: string): boolean {
    for (const user of this.users.values()) {
      if (excludeId && user.id === excludeId) continue;

      if (user.email.toLowerCase() === email.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  create(input: CreateUserInput): User {
    const now = new Date().toISOString();
    const user: User = {
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }

  update(id: string, input: UpdateUserInput): User | undefined {
    const existing = this.users.get(id);
    if (!existing) return undefined;

    const updated: User = {
      ...existing,
      name: input.name ?? existing.name,
      email: input.email?.toLowerCase() ?? existing.email,
      updatedAt: new Date().toISOString(),
    };

    this.users.set(id, updated);
    return updated;
  }

  delete(id: string): User | undefined {
    const existing = this.users.get(id);
    if (!existing) return undefined;

    this.users.delete(id);
    return existing;
  }
}
