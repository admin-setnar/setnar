import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONEXAO_CLUB_TABS,
  getActiveTab,
} from '@/modules/representatives/domain/product-content/conexao-club';

/**
 * Mesmo limite de `product-compliance-notice.test.ts`: nenhuma infraestrutura
 * de teste de render React neste projeto. `ProductContentTabs` é um render
 * fino do que `getActiveTab` resolve, então o risco real — a descrição errada
 * aparecendo para a categoria errada — mora inteiramente neste lookup.
 */

describe('CONEXAO_CLUB_TABS', () => {
  it('tem exatamente as 5 categorias do template estático', () => {
    const chaves = CONEXAO_CLUB_TABS.map((tab) => tab.chave).sort();
    assert.deepEqual(chaves, ['combustivel', 'farmacia', 'lazer', 'mercado', 'viagem'].sort());
  });

  it('nenhuma aba tem descrição vazia', () => {
    for (const tab of CONEXAO_CLUB_TABS) {
      assert.ok(tab.descricao.length > 0, `${tab.chave} sem descrição`);
    }
  });
});

describe('getActiveTab', () => {
  it('resolve a descrição correta para cada chave', () => {
    const mercado = getActiveTab(CONEXAO_CLUB_TABS, 'mercado');
    assert.equal(mercado?.descricao, 'Descontos em redes de supermercado parceiras, para o seu dia a dia render mais.');

    const farmacia = getActiveTab(CONEXAO_CLUB_TABS, 'farmacia');
    assert.equal(farmacia?.descricao, 'Economia em farmácias parceiras na compra de medicamentos e produtos de higiene.');
  });

  it('retorna null para uma chave fora do array, nunca a primeira aba como fallback', () => {
    assert.equal(getActiveTab(CONEXAO_CLUB_TABS, 'nao-existe'), null);
  });

  it('retorna null para um array vazio', () => {
    assert.equal(getActiveTab([], 'mercado'), null);
  });
});
