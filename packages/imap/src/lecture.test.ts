import { ErreurDeMessagerie } from '@mailhelper/messagerie';
import { describe, expect, it } from 'vitest';
import { datesDesMessages, sourceDuMessage, toutLire, uidValiditeDe } from './lecture.js';

describe('uidValiditeDe', () => {
  it('lit l’UIDVALIDITY du dossier ouvert', () => {
    expect(uidValiditeDe({ path: 'INBOX', uidValidity: 42n })).toBe(42n);
  });

  it('échoue quand aucun dossier n’est ouvert (imapflow renvoie false)', () => {
    expect(() => uidValiditeDe(false)).toThrow(ErreurDeMessagerie);
  });
});

describe('datesDesMessages', () => {
  it('lit les dates internes, objets Date ou chaînes', () => {
    expect(
      datesDesMessages([
        { uid: 1, internalDate: new Date('2026-10-31T09:00:00Z') },
        { uid: 2, internalDate: '2026-10-31T10:00:00Z' },
      ]),
    ).toEqual([
      { uid: 1, recuLe: Date.parse('2026-10-31T09:00:00Z') },
      { uid: 2, recuLe: Date.parse('2026-10-31T10:00:00Z') },
    ]);
  });

  it('écarte un message sans UID ou sans date lisible', () => {
    expect(
      datesDesMessages([
        { uid: 1 },
        { internalDate: new Date() },
        { uid: 2, internalDate: 'pas une date' },
      ]),
    ).toEqual([]);
  });
});

describe('sourceDuMessage', () => {
  it('lit la source brute et l’UID', () => {
    const source = Buffer.from('From: a@b.fr\r\n\r\n');
    expect(sourceDuMessage({ uid: 3, source })).toEqual({ uid: 3, source });
  });

  it('renvoie null quand le serveur n’a pas renvoyé la source', () => {
    expect(sourceDuMessage({ uid: 3 })).toBeNull();
  });
});

describe('toutLire', () => {
  it('lit tout un flux asynchrone, dans l’ordre', async () => {
    async function* flux() {
      yield await Promise.resolve(1);
      yield await Promise.resolve(2);
    }
    expect(await toutLire(flux())).toEqual([1, 2]);
  });
});
