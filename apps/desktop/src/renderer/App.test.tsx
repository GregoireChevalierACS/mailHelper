/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FauxPont, uneFiche } from '../testing/fauxPont.js';
import { App } from './App.js';
import { LIMITE } from './composants/Boite.js';
import { MESSAGE_DE_PANNE } from './messages.js';

async function connecte(pont = new FauxPont()) {
  const utilisateur = userEvent.setup();
  render(<App pont={pont} />);
  await utilisateur.click(screen.getByRole('button', { name: 'Se connecter à Gmail' }));
  return { pont, utilisateur };
}

describe('connexion', () => {
  it('propose Gmail et Outlook, en lecture seule', () => {
    render(<App pont={new FauxPont()} />);
    expect(screen.getByRole('button', { name: 'Se connecter à Gmail' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Se connecter à Outlook' })).toBeEnabled();
    expect(screen.getByText(/Accès en lecture seule/u)).toBeInTheDocument();
  });

  it('indique la connexion en cours et bloque les boutons', async () => {
    const pont = new FauxPont();
    pont.connexion = new Promise(() => undefined);
    const utilisateur = userEvent.setup();
    render(<App pont={pont} />);
    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter à Outlook' }));

    expect(screen.getByRole('button', { name: 'Connexion à Outlook…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Se connecter à Gmail' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Terminez la connexion dans la fenêtre de votre navigateur.',
    );
    expect(pont.connexions).toEqual(['outlook']);
  });

  it('explique un refus, puis permet de réessayer', async () => {
    const pont = new FauxPont();
    pont.connexion = { ok: false, probleme: 'connexion-refusee' };
    const { utilisateur } = await connecte(pont);

    expect(screen.getByRole('alert')).toHaveTextContent("La connexion n'a pas abouti");
    expect(screen.getByRole('button', { name: 'Se connecter à Gmail' })).toBeEnabled();
    pont.connexion = { ok: true, fournisseur: 'gmail' };
    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter à Gmail' }));
    expect(
      await screen.findByRole('heading', { name: 'Courriels récents · Gmail' }),
    ).toBeInTheDocument();
  });

  it('signale une panne du pont', async () => {
    const pont = new FauxPont();
    pont.connexion = new Error('contrat rompu');
    await connecte(pont);
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE_DE_PANNE);
  });
});

describe('synthèse', () => {
  it('résume les 24 dernières heures à la connexion', async () => {
    const { pont } = await connecte();
    const fiche = await screen.findByRole('article', { name: 'Réunion de jeudi' });

    expect(pont.syntheses).toEqual([{ fenetreEnHeures: 24, limite: LIMITE }]);
    expect(within(fiche).getByText('Claire Martin')).toHaveAttribute(
      'title',
      'claire.martin@exemple.fr',
    );
    expect(within(fiche).getByText('Réponse attendue · urgent')).toBeInTheDocument();
    expect(
      within(fiche).getByText('Claire demande une confirmation de présence jeudi à 10 h.'),
    ).toBeInTheDocument();
    expect(within(fiche).getByText('Question directe.')).toBeInTheDocument();
    expect(within(fiche).getByRole('group', { name: 'Réponses proposées' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 courriel(s), dont 1 attendent une réponse.',
    );
  });

  it('indique le chargement, puis l’absence de courriel', async () => {
    const pont = new FauxPont();
    let terminer: () => void = () => undefined;
    pont.synthese = new Promise((resoudre) => {
      terminer = () => {
        resoudre({ ok: true, fiches: [], illisibles: 0 });
      };
    });
    await connecte(pont);
    expect(screen.getByRole('status')).toHaveTextContent('Lecture et résumé des courriels…');
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeDisabled();
    terminer();
    expect(await screen.findByText('Aucun courriel sur cette période.')).toBeInTheDocument();
  });

  it('signale les courriels illisibles', async () => {
    const pont = new FauxPont();
    pont.synthese = { ok: true, fiches: [uneFiche()], illisibles: 2 };
    await connecte(pont);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 courriel(s) illisible(s) ignoré(s).',
    );
  });

  it('change de période et actualise à la demande', async () => {
    const { pont, utilisateur } = await connecte();
    await screen.findByRole('article');
    await utilisateur.selectOptions(
      screen.getByRole('combobox', { name: 'Période' }),
      '7 derniers jours',
    );
    await screen.findByRole('article');
    await utilisateur.click(screen.getByRole('button', { name: 'Actualiser' }));
    await screen.findByRole('article');
    expect(pont.syntheses.map((s) => s.fenetreEnHeures)).toEqual([24, 168, 168]);
  });

  it.each([
    [
      'réussie',
      (terminer: { resoudre: () => void; rejeter: () => void }) => {
        terminer.resoudre();
      },
    ],
    [
      'en panne',
      (terminer: { resoudre: () => void; rejeter: () => void }) => {
        terminer.rejeter();
      },
    ],
  ])('ignore une synthèse périmée (%s) arrivée après la plus récente', async (_cas, finir) => {
    const pont = new FauxPont();
    const terminer = { resoudre: () => undefined, rejeter: () => undefined };
    pont.synthese = new Promise((resoudre, rejeter) => {
      terminer.resoudre = () => {
        resoudre({
          ok: true,
          fiches: [uneFiche({ id: 'perime', objet: 'Périmé' })],
          illisibles: 0,
        });
      };
      terminer.rejeter = () => {
        rejeter(new Error('trop tard'));
      };
    });
    const { utilisateur } = await connecte(pont);

    pont.synthese = { ok: true, fiches: [uneFiche({ objet: 'Récent' })], illisibles: 0 };
    await utilisateur.selectOptions(
      screen.getByRole('combobox', { name: 'Période' }),
      '3 derniers jours',
    );
    expect(await screen.findByRole('article', { name: 'Récent' })).toBeInTheDocument();

    finir(terminer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('article', { name: 'Périmé' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Récent' })).toBeInTheDocument();
  });

  it('montre chaque niveau d’attente par un libellé, pas seulement une couleur', async () => {
    const pont = new FauxPont();
    const attendue = (urgence: 'normale' | 'basse', id: string) =>
      uneFiche({
        id,
        objet: id,
        analyse: {
          ok: true,
          resume: 'r',
          attente: { kind: 'attendue', urgence, motif: '' },
          propositions: [],
        },
      });
    pont.synthese = {
      ok: true,
      illisibles: 0,
      fiches: [
        attendue('normale', 'normale'),
        attendue('basse', 'basse'),
        uneFiche({
          id: 'info',
          objet: '',
          analyse: {
            ok: true,
            resume: 'r',
            attente: { kind: 'aucune', motif: 'Information.' },
            propositions: [],
          },
        }),
      ],
    };
    await connecte(pont);
    expect(await screen.findByText('Réponse attendue')).toBeInTheDocument();
    expect(screen.getByText('Réponse attendue · peu urgent')).toBeInTheDocument();
    const sansObjet = screen.getByRole('article', { name: '(sans objet)' });
    expect(within(sansObjet).getByText('Aucune réponse attendue')).toBeInTheDocument();
    expect(within(sansObjet).queryByRole('group')).not.toBeInTheDocument();
  });

  it('montre l’aperçu d’un courriel qui n’a pas pu être analysé', async () => {
    const pont = new FauxPont();
    pont.synthese = {
      ok: true,
      illisibles: 0,
      fiches: [uneFiche({ analyse: { ok: false, probleme: 'analyseur-injoignable' } })],
    };
    await connecte(pont);
    const fiche = await screen.findByRole('article');
    expect(within(fiche).getByText('Non analysé')).toBeInTheDocument();
    expect(within(fiche).getByText(/service d'analyse injoignable/u)).toBeInTheDocument();
    expect(
      within(fiche).getByText('Bonjour, peux-tu confirmer ta présence jeudi à 10 h ?'),
    ).toBeInTheDocument();
  });

  it('explique une boîte injoignable', async () => {
    const pont = new FauxPont();
    pont.synthese = { ok: false, probleme: 'boite-injoignable' };
    await connecte(pont);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de lire la boîte de réception',
    );
  });

  it('signale une panne du pont', async () => {
    const pont = new FauxPont();
    pont.synthese = new Error('contrat rompu');
    await connecte(pont);
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGE_DE_PANNE);
  });
});

describe('réponse', () => {
  async function ouvrirLaReponse(
    pont = new FauxPont(),
    proposition: string | RegExp = /^Confirmer/u,
  ) {
    const contexte = await connecte(pont);
    const fiche = await screen.findByRole('article');
    await contexte.utilisateur.click(within(fiche).getByRole('button', { name: proposition }));
    return {
      ...contexte,
      dialogue: screen.getByRole('dialog', { name: 'Répondre à Claire Martin' }),
    };
  }

  it('montre destinataire, objet et texte modifiable avant confirmation', async () => {
    const { dialogue } = await ouvrirLaReponse();
    expect(
      within(dialogue).getByText('Claire Martin <claire.martin@exemple.fr>'),
    ).toBeInTheDocument();
    expect(within(dialogue).getByText('RE: Réunion de jeudi')).toBeInTheDocument();
    expect(within(dialogue).getByRole('textbox', { name: 'Texte de la réponse' })).toHaveValue(
      'Bonjour Claire, je serai présent.',
    );
    expect(within(dialogue).getByRole('textbox')).toHaveFocus();
  });

  it('n’envoie que le texte confirmé, puis confirme l’ouverture', async () => {
    const { pont, utilisateur, dialogue } = await ouvrirLaReponse();
    const texte = within(dialogue).getByRole('textbox');
    await utilisateur.clear(texte);
    await utilisateur.type(texte, 'Je serai là à 10 h.');
    await utilisateur.click(
      within(dialogue).getByRole('button', { name: 'Copier et ouvrir la réponse' }),
    );

    expect(pont.reponses).toEqual([{ idDuCourriel: 'courriel-1', texte: 'Je serai là à 10 h.' }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Réponse à claire\.martin@exemple\.fr ouverte dans Gmail/u),
    ).toBeInTheDocument();
  });

  it('n’ouvre rien sans confirmation : Annuler ou Échap', async () => {
    const { pont, utilisateur } = await ouvrirLaReponse();
    await utilisateur.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: /^Décliner/u }));
    await utilisateur.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: /^Décliner/u }));
    await utilisateur.keyboard('a');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(pont.reponses).toEqual([]);
  });

  it('permet de rédiger sa propre réponse, sans envoyer un texte vide', async () => {
    const { utilisateur, dialogue } = await ouvrirLaReponse(
      new FauxPont(),
      'Rédiger ma propre réponse',
    );
    const bouton = within(dialogue).getByRole('button', { name: 'Copier et ouvrir la réponse' });
    expect(bouton).toBeDisabled();
    await utilisateur.type(within(dialogue).getByRole('textbox'), 'Merci !');
    expect(bouton).toBeEnabled();
  });

  it('indique l’ouverture en cours', async () => {
    const pont = new FauxPont();
    pont.reponse = new Promise(() => undefined);
    const { utilisateur, dialogue } = await ouvrirLaReponse(pont);
    await utilisateur.click(
      within(dialogue).getByRole('button', { name: 'Copier et ouvrir la réponse' }),
    );
    expect(within(dialogue).getByRole('button', { name: 'Ouverture…' })).toBeDisabled();
  });

  it('explique un refus sans fermer le dialogue', async () => {
    const pont = new FauxPont();
    pont.reponse = { ok: false, probleme: 'destinataire-sans-lecteur' };
    const { utilisateur, dialogue } = await ouvrirLaReponse(pont);
    await utilisateur.click(
      within(dialogue).getByRole('button', { name: 'Copier et ouvrir la réponse' }),
    );
    expect(within(dialogue).getByRole('alert')).toHaveTextContent(
      "Cette adresse n'est lue par personne",
    );
    expect(
      within(dialogue).getByRole('button', { name: 'Copier et ouvrir la réponse' }),
    ).toBeEnabled();
  });

  it('signale une panne du pont', async () => {
    const pont = new FauxPont();
    pont.reponse = new Error('contrat rompu');
    const { utilisateur, dialogue } = await ouvrirLaReponse(pont);
    await utilisateur.click(
      within(dialogue).getByRole('button', { name: 'Copier et ouvrir la réponse' }),
    );
    expect(within(dialogue).getByRole('alert')).toHaveTextContent(MESSAGE_DE_PANNE);
  });

  it('nomme le destinataire par son adresse s’il n’a pas de nom', async () => {
    const pont = new FauxPont();
    pont.synthese = {
      ok: true,
      illisibles: 0,
      fiches: [
        uneFiche({
          expediteur: { nom: null, adresse: 'claire@exemple.fr' },
          reponse: { a: { nom: null, adresse: 'claire@exemple.fr' }, objet: 'RE: x' },
        }),
      ],
    };
    const utilisateur = userEvent.setup();
    render(<App pont={pont} />);
    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter à Gmail' }));
    await utilisateur.click(await screen.findByRole('button', { name: /^Confirmer/u }));
    const dialogue = screen.getByRole('dialog', { name: 'Répondre à claire@exemple.fr' });
    expect(within(dialogue).getByText('claire@exemple.fr')).toBeInTheDocument();
  });
});
