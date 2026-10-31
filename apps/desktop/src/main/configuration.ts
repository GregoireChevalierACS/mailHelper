import { err, ok, type Result } from '@mailhelper/domain';
import { z } from 'zod';

const nonVide = z.string().trim().min(1);

const schemaDeLEnvironnement = z.object({
  ANTHROPIC_API_KEY: nonVide,
  MAILHELPER_MODELE: nonVide.default('claude-opus-5-5'),
  // Résumer et rédiger une réponse courte ne demande pas de longue réflexion : « low » garde une
  // boîte de 20 courriels sous la minute (ADR 0002). Ajustable sans recompiler.
  MAILHELPER_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
  GOOGLE_CLIENT_ID: nonVide.optional(),
  GOOGLE_CLIENT_SECRET: nonVide.optional(),
  MICROSOFT_CLIENT_ID: nonVide.optional(),
  MICROSOFT_TENANT: nonVide.default('organizations'),
});

export interface Configuration {
  readonly anthropic: {
    readonly cleDApi: string;
    readonly modele: string;
    readonly effort: 'low' | 'medium' | 'high';
  };
  /** `null` quand l'application n'est pas enregistrée chez Google : le bouton Gmail est refusé. */
  readonly google: { readonly clientId: string; readonly clientSecret: string } | null;
  readonly microsoft: { readonly clientId: string; readonly tenant: string } | null;
}

export interface ConfigurationInvalide {
  readonly kind: 'configuration-invalide';
  /** Noms des variables en cause, jamais leur valeur : ce pourrait être un secret. */
  readonly variables: readonly string[];
}

export function lireLaConfiguration(
  environnement: Readonly<Record<string, string | undefined>>,
): Result<Configuration, ConfigurationInvalide> {
  const lue = schemaDeLEnvironnement.safeParse(environnement);
  if (!lue.success) {
    const variables = [...new Set(lue.error.issues.map((probleme) => String(probleme.path[0])))];
    return err({ kind: 'configuration-invalide', variables });
  }
  const env = lue.data;
  return ok({
    anthropic: {
      cleDApi: env.ANTHROPIC_API_KEY,
      modele: env.MAILHELPER_MODELE,
      effort: env.MAILHELPER_EFFORT,
    },
    google:
      env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : null,
    microsoft:
      env.MICROSOFT_CLIENT_ID !== undefined
        ? { clientId: env.MICROSOFT_CLIENT_ID, tenant: env.MICROSOFT_TENANT }
        : null,
  });
}
