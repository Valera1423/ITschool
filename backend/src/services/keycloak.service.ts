import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified?: boolean;
  realmRoles?: string[];
  attributes?: Record<string, string[]>;
}

const ROLES = ['admin', 'manager', 'nam'] as const;

export class KeycloakService {
  private static tokenCache: { token: string; expiresAt: number } | null = null;

  // ============================================================
  // Auth
  // ============================================================
  private static async getAdminToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 5000) {
      return this.tokenCache.token;
    }

    const url = `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.KEYCLOAK_CLIENT_ID,
      client_secret: env.KEYCLOAK_CLIENT_SECRET ?? '',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error({ err, status: res.status }, 'Не удалось получить admin token Keycloak');
      throw new Error(`Keycloak auth failed: ${res.status}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  // ============================================================
  // List users — БЕЗ N+1.
  //
  // Вместо запроса ролей на каждого юзера — берём три списка
  // «кому назначена роль X» и объединяем в Map<userId, roles[]>.
  // Для 500 юзеров получается 3 запроса вместо 500.
  // ============================================================
  static async listUsers(first = 0, max = 500): Promise<KeycloakUser[]> {
    const token = await this.getAdminToken();
    const base = `${env.KEYCLOAK_URL}/admin/realms/${env.KEYCLOAK_REALM}`;

    const [usersRes, ...roleRes] = await Promise.all([
      fetch(`${base}/users?first=${first}&max=${max}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      ...ROLES.map((r) =>
        fetch(`${base}/roles/${r}/users?first=0&max=10000`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    ]);

    if (!usersRes.ok) throw new Error(`Keycloak listUsers failed: ${usersRes.status}`);

    const users = (await usersRes.json()) as KeycloakUser[];

    // userRoles: Map<userId, string[]>
    const userRoles = new Map<string, string[]>();
    await Promise.all(
      roleRes.map(async (res, idx) => {
        if (!res.ok) return;
        const list = (await res.json()) as Array<{ id: string }>;
        const roleName = ROLES[idx];
        for (const u of list) {
          const arr = userRoles.get(u.id) ?? [];
          arr.push(roleName);
          userRoles.set(u.id, arr);
        }
      }),
    );

    return users.map((u) => ({ ...u, realmRoles: userRoles.get(u.id) ?? [] }));
  }

  // ============================================================
  // Find by email
  // ============================================================
  static async findUserByEmail(email: string): Promise<KeycloakUser | null> {
    const token = await this.getAdminToken();
    const url = `${env.KEYCLOAK_URL}/admin/realms/${env.KEYCLOAK_REALM}/users?email=${encodeURIComponent(email)}&exact=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const list = (await res.json()) as KeycloakUser[];
    return list[0] ?? null;
  }

  // ============================================================
  // Role mappings
  // ============================================================
  static async assignRealmRole(userId: string, roleName: string): Promise<void> {
    const token = await this.getAdminToken();
    const base = `${env.KEYCLOAK_URL}/admin/realms/${env.KEYCLOAK_REALM}`;

    const roleRes = await fetch(`${base}/roles/${roleName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!roleRes.ok) throw new Error(`Role ${roleName} not found`);
    const role = await roleRes.json();

    const res = await fetch(`${base}/users/${userId}/role-mappings/realm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([role]),
    });
    if (!res.ok) throw new Error(`Assign role failed: ${res.status}`);
  }

  static async removeRealmRole(userId: string, roleName: string): Promise<void> {
    const token = await this.getAdminToken();
    const base = `${env.KEYCLOAK_URL}/admin/realms/${env.KEYCLOAK_REALM}`;

    const roleRes = await fetch(`${base}/roles/${roleName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!roleRes.ok) return;
    const role = await roleRes.json();

    const res = await fetch(`${base}/users/${userId}/role-mappings/realm`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([role]),
    });
    if (!res.ok && res.status !== 404) {
      logger.warn({ userId, roleName, status: res.status }, 'removeRealmRole failed');
    }
  }

  static async changeRole(userId: string, newRole: 'admin' | 'manager' | 'nam'): Promise<void> {
    // Снять все, потом назначить одну — параллельно небезопасно, делаем последовательно
    for (const r of ROLES) {
      await this.removeRealmRole(userId, r).catch(() => {});
    }
    await this.assignRealmRole(userId, newRole);
  }

  // ============================================================
  // User mutations
  // ============================================================
  static async setUserEnabled(userId: string, enabled: boolean): Promise<void> {
    const token = await this.getAdminToken();
    const res = await fetch(
      `${env.KEYCLOAK_URL}/admin/realms/${env.KEYCLOAK_REALM}/users/${userId}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      },
    );
    if (!res.ok) throw new Error(`Set enabled failed: ${res.status}`);
  }

  static async sendResetPasswordEmail(userId: string): Promise<void> {
    const token = await this.getAdminToken();
    const res = await fetch(
      `${env.KEYCLOAK_URL}/admin/realms/${env.KEYCLOAK_REALM}/users/${userId}/execute-actions-email`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['UPDATE_PASSWORD']),
      },
    );
    if (!res.ok) throw new Error(`Send reset email failed: ${res.status}`);
  }

  /**
   * Отправить письмо-приглашение новому сотруднику.
   * Keycloak сам сгенерирует ссылку с UPDATE_PASSWORD + VERIFY_EMAIL.
   *
   * В отличие от sendResetPasswordEmail, здесь сразу два action'а:
   * - VERIFY_EMAIL — подтверждение адреса (обязательно для новых учёток);
   * - UPDATE_PASSWORD — задать пароль при первом входе.
   *
   * ВАЖНО: у пользователя должно быть установлено requiredAction
   * или как минимум право на execute-actions-email. Если Keycloak
   * настроен с обязательной проверкой email — этот вызов её выполнит.
   */
  static async sendInviteEmail(userId: string): Promise<void> {
    const token = await this.getAdminToken();
    const res = await fetch(
      `${env.KEYCLOAK_URL}/admin/realms/${env.KEYCLOAK_REALM}/users/${userId}/execute-actions-email`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['UPDATE_PASSWORD', 'VERIFY_EMAIL']),
      },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn(
        { userId, status: res.status, err },
        'sendInviteEmail failed',
      );
      throw new Error(`Send invite failed: ${res.status}`);
    }
  }

  static async createUser(input: {
    email: string;
    fullName: string;
    role: 'admin' | 'manager' | 'nam';
    password?: string;
  }): Promise<KeycloakUser> {
    const token = await this.getAdminToken();
    const base = `${env.KEYCLOAK_URL}/admin/realms/${env.KEYCLOAK_REALM}`;

    const [firstName, ...rest] = input.fullName.split(' ');
    const body = {
      username: input.email,
      email: input.email,
      firstName,
      lastName: rest.join(' '),
      enabled: true,
      emailVerified: true,
      attributes: { fullName: [input.fullName] },
    };

    const res = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Create user failed: ${res.status} ${err}`);
    }

    const user = await this.findUserByEmail(input.email);
    if (!user) throw new Error('User not found after creation');

    await this.assignRealmRole(user.id, input.role);

    if (input.password) {
      const pwdRes = await fetch(`${base}/users/${user.id}/reset-password`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'password', value: input.password, temporary: false }),
      });
      if (!pwdRes.ok) {
        logger.warn({ userId: user.id, status: pwdRes.status }, 'Set password failed');
      }
    }

    return user;
  }
}