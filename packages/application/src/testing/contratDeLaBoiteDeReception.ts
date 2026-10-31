import type { SaisieDeCourriel } from '@mailhelper/domain';
import { describe, expect, it } from 'vitest';
import type { BoiteDeReception } from '../ports.js';
import { INSTANT_DE_REFERENCE, UNE_HEURE, unInstant, uneSaisieDeCourriel } from './doublures.js';

/**
 * Fabrique une boîte qui contient exactement ces courriels. Un adapter la réalise en simulant
 * l'API de sa messagerie (réponses HTTP de Gmail, de Graph…).
 */
export type FabriqueDeBoite = (courriels: readonly SaisieDeCourriel[]) => Promise<BoiteDeReception>;

/**
 * Comportement exigé de toute boîte de réception. Le même contrat tient la doublure en mémoire et
 * les adapters réels : un test de la couche application ne peut pas passer grâce à une doublure
 * plus arrangeante que la vraie messagerie.
 */
export function verifierLeContratDeLaBoiteDeReception(
  nom: string,
  fabriquer: FabriqueDeBoite,
): void {
  const ilYA = (heures: number) => INSTANT_DE_REFERENCE - heures * UNE_HEURE;

  describe(`contrat de la boîte de réception : ${nom}`, () => {
    it('renvoie les courriels du plus récent au plus ancien', async () => {
      const boite = await fabriquer([
        uneSaisieDeCourriel({ id: 'ancien', recuLe: ilYA(5) }),
        uneSaisieDeCourriel({ id: 'recent', recuLe: ilYA(1) }),
        uneSaisieDeCourriel({ id: 'milieu', recuLe: ilYA(3) }),
      ]);
      const lot = await boite.listerLesRecents({ depuis: unInstant(ilYA(24)), limite: 10 });
      expect(lot.courriels.map((c) => c.id)).toEqual(['recent', 'milieu', 'ancien']);
    });

    it('ne renvoie rien d’antérieur à la date demandée', async () => {
      const boite = await fabriquer([
        uneSaisieDeCourriel({ id: 'dedans', recuLe: ilYA(2) }),
        uneSaisieDeCourriel({ id: 'dehors', recuLe: ilYA(30) }),
      ]);
      const lot = await boite.listerLesRecents({ depuis: unInstant(ilYA(24)), limite: 10 });
      expect(lot.courriels.map((c) => c.id)).toEqual(['dedans']);
    });

    it('renvoie au plus le nombre demandé, en gardant les plus récents', async () => {
      const boite = await fabriquer(
        [1, 2, 3, 4].map((heures) =>
          uneSaisieDeCourriel({ id: `c${String(heures)}`, recuLe: ilYA(heures) }),
        ),
      );
      const lot = await boite.listerLesRecents({ depuis: unInstant(ilYA(24)), limite: 2 });
      expect(lot.courriels.map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it('restitue expéditeur, Reply-To, objet, corps et diffusion de masse', async () => {
      const saisie = uneSaisieDeCourriel({
        id: 'complet',
        expediteur: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
        repondreA: { nom: 'Secrétariat', adresse: 'secretariat@exemple.fr' },
        objet: 'Réunion de jeudi',
        corps: 'Bonjour,\nÀ jeudi ?',
        diffusionDeMasse: true,
      });
      const boite = await fabriquer([saisie]);
      const lot = await boite.listerLesRecents({ depuis: unInstant(ilYA(24)), limite: 10 });
      expect(lot).toEqual({
        courriels: [
          {
            id: 'complet',
            expediteur: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
            repondreA: { nom: 'Secrétariat', adresse: 'secretariat@exemple.fr' },
            objet: 'Réunion de jeudi',
            corps: 'Bonjour,\nÀ jeudi ?',
            recuLe: saisie.recuLe,
            diffusionDeMasse: true,
          },
        ],
        illisibles: 0,
      });
    });

    it('renvoie une liste vide sur une boîte vide', async () => {
      const boite = await fabriquer([]);
      const lot = await boite.listerLesRecents({ depuis: unInstant(ilYA(24)), limite: 10 });
      expect(lot).toEqual({ courriels: [], illisibles: 0 });
    });
  });
}
