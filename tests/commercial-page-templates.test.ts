import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const PRODUCTS = [
  ['conexao-club','conexao-club','ConexaoClubPage','ConexaoClub'],
  ['conexao-green','conexao-green','ConexaoGreenPage','ConexaoGreen'],
  ['conexao-livre','conexao-livre','ConexaoLivrePage','ConexaoLivre'],
  ['conexao-placas','conexao-placas','ConexaoPlacasPage','ConexaoPlacas'],
  ['conexao-solar','conexao-solar','ConexaoSolarPage','ConexaoSolar'],
  ['green-seguros','green-seguros','GreenSegurosPage','GreenSeguros'],
  ['telecom','telecom','TelecomPage','Telecom'],
] as const;

const FIDELITY_MARKERS = {
  'conexao-club': ['Economize todos os dias em mais de 600 mil produtos e serviços, no Brasil inteiro.', 'O clube funciona em todo o Brasil?'],
  'conexao-green': ['Cansado de ver a conta de luz subir todo mês? Dá pra pagar menos, sem obra e sem trocar de distribuidora.', 'de 90 a 180 dias'],
  'conexao-livre': ['Sua empresa é Grupo A? Migre para o Mercado Livre de Energia e reduza o custo da sua conta.', 'O que é um cliente B Optante? Ele pode migrar?'],
  'conexao-placas': ['Tenha suas próprias placas solares e pare de depender só do desconto na conta de luz.', 'Posso propor uma forma de pagamento diferente das listadas?'],
  'conexao-solar': ['Energia solar com 50% de desconto na primeira fatura e uma central dedicada do início ao fim.', 'E se a visita técnica pedir alguma adequação?'],
  'green-seguros': ['Seguro pro seu carro, mês a mês, sem anuidade e sem multa de cancelamento.', 'Já tenho cotação em outra seguradora, dá pra usar?'],
  telecom: ['Leve seu número de graça e ganhe internet que acumula todo mês.', 'O bônus de portabilidade vale para número novo também?'],
} as const;
function source(path:string){return readFileSync(resolve(process.cwd(),path),'utf8')}

describe('ADR-089 commercial page composition',()=>{
  const dispatcher=source('src/modules/representatives/presentation/commercial-pages/dispatch-commercial-page.tsx');
  const publicPage=source('src/app/[productSlug]/page.tsx');
  const previewPage=source('src/app/pre-visualizacao/[productSlug]/page.tsx');

  it('dispatches exactly the seven approved slugs without a legacy fallback',()=>{
    for(const [slug,folder,component] of PRODUCTS){
      assert.match(dispatcher,new RegExp(`case '${slug}'`));
      assert.match(dispatcher,new RegExp(`<${component}`));
      assert.ok(existsSync(resolve(process.cwd(),`src/modules/representatives/presentation/commercial-pages/${folder}/${folder}-page.tsx`)));
    }
    assert.equal((dispatcher.match(/case '/g)??[]).length,7);
    assert.doesNotMatch(dispatcher,/CommercialPageContent|getCommercialPageTemplate/);
    assert.match(dispatcher,/default: return null/);
  });

  it('uses the same dispatcher in public and private preview routes',()=>{
    assert.match(publicPage,/<DispatchCommercialPage/);
    assert.match(previewPage,/<DispatchCommercialPage/);
    assert.match(previewPage,/leadFormDisabled/);
  });

  it('keeps one secure shared form and product-specific presentation trees',()=>{
    const form=source('src/modules/representatives/presentation/commercial-pages/commercial-lead-form.tsx');
    const footer=source('src/modules/representatives/presentation/commercial-pages/commercial-page-footer.tsx');
    const css=source('src/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css');
    assert.match(form,/fetch\('\/api\/leads'/);
    assert.match(form,/LEAD_HONEYPOT_FIELD/);
    assert.match(form,/status === 'success'/);
    assert.doesNotMatch(footer,/getProductComplianceNotice/);
    assert.match(footer,/NOT_OFFICIAL_CHANNEL_NOTICE/);
    assert.match(css,/\.page \.btnWhats,[\s\S]*?color: #fff/);
    assert.match(css,/\.heroFeatureList/);
    for(const [,folder] of PRODUCTS){
      const page=source(`src/modules/representatives/presentation/commercial-pages/${folder}/${folder}-page.tsx`);
      assert.match(page,/<CommercialLeadForm/);
      assert.match(page,/<CommercialPageFooter/);
      assert.match(page,/<CommercialPageHeader/);
      assert.doesNotMatch(page,/GA4_ID|Meta Pixel|fbq\(/i);
    }
  });

  it('preserves the seven immutable references and their product-specific copy',()=>{
    for(const [slug,folder,,referenceFolder] of PRODUCTS){
      const reference=source(`templates/commercial-pages/${referenceFolder}/index.html`);
      const page=source(`src/modules/representatives/presentation/commercial-pages/${folder}/${folder}-page.tsx`);
      for(const marker of FIDELITY_MARKERS[slug]){
        assert.match(reference,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
        assert.match(page,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
      }
    }
    const widgets=source('src/modules/representatives/presentation/commercial-pages/product-widgets.tsx');
    assert.match(widgets,/const percentage = 10;/);
    assert.match(widgets,/\+5 GB de portabilidade/);
    assert.match(widgets,/RCF \(danos a terceiros\)/);
  });
});
