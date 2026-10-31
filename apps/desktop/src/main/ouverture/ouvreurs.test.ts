import { unCourriel } from '@mailhelper/application/testing';
import { preparerLeBrouillon, type BrouillonDeReponse } from '@mailhelper/domain';
import { describe, expect, it } from 'vitest';
import {
  creerUnOuvreur,
  lienDeRedactionGmail,
  lienMailto,
  LONGUEUR_MAXIMALE_D_URL,
} from './ouvreurs.js';

function unBrouillon(texte = 'Bonjour Claire,\nJe serai là & à l’heure.'): BrouillonDeReponse {
  const brouillon = preparerLeBrouillon(unCourriel(), texte);
  if (!brouillon.ok) throw new Error(brouillon.error.kind);
  return brouillon.value;
}

describe('lienDeRedactionGmail', () => {
  it('préremplit destinataire, objet et corps, correctement encodés', () => {
    const url = new URL(lienDeRedactionGmail(unBrouillon()));
    expect(url.origin + url.pathname).toBe('https://mail.google.com/mail/');
    expect(url.searchParams.get('view')).toBe('cm');
    expect(url.searchParams.get('to')).toBe('claire.martin@exemple.fr');
    expect(url.searchParams.get('su')).toBe('RE: Réunion de jeudi');
    expect(url.searchParams.get('body')).toBe('Bonjour Claire,\nJe serai là & à l’heure.');
  });

  it('omet un corps trop long plutôt que de le couper', () => {
    const lien = lienDeRedactionGmail(unBrouillon('a'.repeat(LONGUEUR_MAXIMALE_D_URL)));
    expect(new URL(lien).searchParams.has('body')).toBe(false);
    expect(new URL(lien).searchParams.get('to')).toBe('claire.martin@exemple.fr');
  });
});

describe('lienMailto', () => {
  it('encode les espaces en %20, jamais en +', () => {
    expect(lienMailto(unBrouillon('Je serai là.'))).toBe(
      'mailto:claire.martin%40exemple.fr?subject=RE%3A%20R%C3%A9union%20de%20jeudi&body=Je%20serai%20l%C3%A0.',
    );
  });

  it('omet un corps trop long plutôt que de le couper', () => {
    expect(lienMailto(unBrouillon('a'.repeat(LONGUEUR_MAXIMALE_D_URL)))).toBe(
      'mailto:claire.martin%40exemple.fr?subject=RE%3A%20R%C3%A9union%20de%20jeudi',
    );
  });
});

describe('creerUnOuvreur', () => {
  it('ouvre le lien construit pour le brouillon', async () => {
    const ouverts: string[] = [];
    const ouvreur = creerUnOuvreur(lienMailto, (url) => {
      ouverts.push(url);
      return Promise.resolve();
    });
    await ouvreur.ouvrir(unBrouillon('Merci'));
    expect(ouverts).toEqual([lienMailto(unBrouillon('Merci'))]);
  });
});
