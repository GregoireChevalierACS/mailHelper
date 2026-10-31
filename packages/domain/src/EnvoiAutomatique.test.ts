import { describe, expect, it } from 'vitest';
import { creerAdresseCourriel } from './AdresseCourriel.js';
import { estUneAdresseSansLecteur, motifDeNonReponse } from './EnvoiAutomatique.js';
import { unCourriel } from './testing/fixtures.js';

function adresse(texte: string) {
  const resultat = creerAdresseCourriel(texte);
  if (!resultat.ok) throw new Error(texte);
  return resultat.value;
}

describe('estUneAdresseSansLecteur', () => {
  it.each([
    'noreply@banque.fr',
    'no-reply@banque.fr',
    'no_reply@banque.fr',
    'no.reply@banque.fr',
    'NoReply@banque.fr',
    'noreply+factures@banque.fr',
    'no-reply-factures@banque.fr',
    'donotreply@banque.fr',
    'do-not-reply@banque.fr',
    'ne-pas-repondre@impots.gouv.fr',
    'nepasrepondre@impots.gouv.fr',
    'ne_pas_répondre@impots.gouv.fr',
    'mailer-daemon@googlemail.com',
    'MAILER-DAEMON@exemple.fr',
    'mailerdaemon@exemple.fr',
    'postmaster@exemple.fr',
    'bounce@exemple.fr',
    'bounces+123@exemple.fr',
    'notification@github.com',
    'notifications@github.com',
  ])('%s n’est lue par personne', (texte) => {
    expect(estUneAdresseSansLecteur(adresse(texte))).toBe(true);
  });

  it.each([
    'claire@exemple.fr',
    'reply@exemple.fr',
    'noreen@exemple.fr',
    'noreplyer@exemple.fr',
    'notificationsteam@exemple.fr',
    'postmasters@exemple.fr',
    'support@noreply.fr',
    'brunoreply@exemple.fr',
    'rebounce@exemple.fr',
  ])('%s est lue par quelqu’un', (texte) => {
    expect(estUneAdresseSansLecteur(adresse(texte))).toBe(false);
  });
});

describe('motifDeNonReponse', () => {
  it('laisse la décision au modèle pour un courriel ordinaire', () => {
    expect(motifDeNonReponse(unCourriel())).toBeNull();
  });

  it('exclut une réponse à un expéditeur sans lecteur', () => {
    const courriel = unCourriel({ expediteur: { nom: 'Banque', adresse: 'noreply@banque.fr' } });
    expect(motifDeNonReponse(courriel)).toBe(
      "Envoi automatique : l'adresse de réponse n'est lue par personne.",
    );
  });

  it('juge l’adresse Reply-To plutôt que l’expéditeur', () => {
    const versUnHumain = unCourriel({
      expediteur: { nom: 'Banque', adresse: 'noreply@banque.fr' },
      repondreA: { nom: 'Conseiller', adresse: 'conseiller@banque.fr' },
    });
    expect(motifDeNonReponse(versUnHumain)).toBeNull();

    const versUnRobot = unCourriel({ repondreA: { nom: null, adresse: 'no-reply@exemple.fr' } });
    expect(motifDeNonReponse(versUnRobot)).not.toBeNull();
  });

  it('exclut une réponse à un envoi en nombre', () => {
    expect(motifDeNonReponse(unCourriel({ diffusionDeMasse: true }))).toBe(
      "Envoi en nombre (lettre d'information, notification) : aucune réponse attendue.",
    );
  });
});
