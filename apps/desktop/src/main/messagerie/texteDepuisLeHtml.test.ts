import { describe, expect, it } from 'vitest';
import { texteDepuisLeHtml } from './texteDepuisLeHtml.js';

describe('texteDepuisLeHtml', () => {
  it('garde le texte et les retours à la ligne, sans balises, styles ni scripts', () => {
    const html = `<html><head><title>x</title></head><body>
      <style>p { color: red }</style><script>alert(1)</script><!-- note -->
      <p>Bonjour Claire,</p><div>Peux-tu confirmer<br>jeudi ?</div>
      <ul><li>Point 1</li><li>Point 2</li></ul></body></html>`;
    expect(texteDepuisLeHtml(html)).toBe(
      'Bonjour Claire,\nPeux-tu confirmer\njeudi ?\n\nPoint 1\nPoint 2',
    );
  });

  it('décode les entités nommées, décimales et hexadécimales', () => {
    expect(texteDepuisLeHtml('Caf&eacute;&nbsp;&amp; th&#233; &#x20AC; &lt;b&gt; &QUOT;')).toBe(
      'Café & thé € <b> "',
    );
  });

  it('laisse une entité inconnue telle quelle', () => {
    expect(texteDepuisLeHtml('a &inconnue; b')).toBe('a &inconnue; b');
  });
});
