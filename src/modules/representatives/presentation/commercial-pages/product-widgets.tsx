'use client';

import { useId, useMemo, useState } from 'react';

import type { OriginId } from '@/modules/analytics/domain/origin';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import widgetStyles from '@/modules/representatives/presentation/commercial-pages/product-widgets.module.css';
import { buildWhatsappHref, trackWhatsappClick } from '@/modules/representatives/presentation/commercial-pages/whatsapp';

function ProductWhatsapp({ representative, product, message, label, origin }: { representative: Representative; product: RepresentativeProduct; message: string; label: string; origin: OriginId | null }) {
  if (!representative.phone) return null;
  return <a className={`${styles.btnWhats} ${styles.billCta}`} href={buildWhatsappHref(representative.phone, message)} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsappClick(product.slug, origin)}>{label}</a>;
}

export function TelecomHeroWidget({ representative, product, origin }: { representative: Representative; product: RepresentativeProduct; origin: OriginId | null }) {
  const benefits = [
    'Internet que acumula mês a mês',
    'Bônus de +5GB só por trazer seu número',
    'Acesso grátis ao Clube de benefícios',
    'Ligações ilimitadas + WhatsApp ilimitado',
  ];

  return <div className={styles.billCard}>
    <div className={styles.billHeader}><span>O que vem no chip</span><span className={styles.badgeDesconto}>Todos os planos</span></div>
    <ul className={styles.heroFeatureList}>{benefits.map((item) => <li key={item}><span className={styles.check}>✓</span><span>{item}</span></li>)}</ul>
    <ProductWhatsapp representative={representative} product={product} message="Olá! Quero ver os planos da iGreen Telecom." label="Ver planos no WhatsApp" origin={origin} />
  </div>;
}

export function SolarHeroWidget({ representative, product, origin }: { representative: Representative; product: RepresentativeProduct; origin: OriginId | null }) {
  const benefits = [
    'Análise do seu perfil e da sua conta de energia',
    'Simulação do seu projeto, sem compromisso',
    'Visita técnica antes de qualquer instalação',
    'Uma pessoa acompanhando cada etapa, do início ao fim',
  ];

  return <div className={styles.billCard}>
    <div className={styles.billHeader}><span>O que você recebe</span><span className={styles.badgeDesconto}>Sem custo</span></div>
    <ul className={styles.heroFeatureList}>{benefits.map((item) => <li key={item}><span className={styles.check}>✓</span><span>{item}</span></li>)}</ul>
    <ProductWhatsapp representative={representative} product={product} message="Olá! Quero iniciar minha análise na Conexão Solar." label="Quero minha análise" origin={origin} />
    <p className={styles.billCtaNote}>Leva 2 minutos para começar — a documentação vem depois.</p>
  </div>;
}

export function GreenCalculator({ representative, product, origin }: { representative: Representative; product: RepresentativeProduct; origin: OriginId | null }) {
  const id = useId();
  const [bill, setBill] = useState(500);
  const result = useMemo(() => {
    const value = Math.max(0, Number.isFinite(bill) ? bill : 0);
    const percentage = 10;
    const saving = value * (percentage / 100);
    return { value, percentage, saving, newBill: value - saving };
  }, [bill]);
  const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 }).format(value);
  return <div className={styles.billCard}>
    <div className={styles.billHeader}><span>Estimativa de desconto</span><span className={styles.badgeDesconto}>{Math.round(result.percentage)}%</span></div>
    <label className={styles.billInputLabel} htmlFor={id}>Quanto você paga de luz por mês?</label>
    <div className={styles.billInputWrap}><span aria-hidden="true">R$</span><input id={id} className={styles.billInput} type="number" min={0} step={10} inputMode="numeric" value={bill} onChange={(event) => setBill(event.target.valueAsNumber || 0)} /></div>
    <div className={styles.billValues}><span className={styles.billOld}>{brl(result.value)}</span><span className={styles.billNew}>{brl(result.newBill)}</span></div>
    <p className={styles.billCaption}>Economia estimada de <strong>{brl(result.saving)}</strong> por mês, aplicando <strong>10% de desconto</strong> sobre o valor total da sua conta de luz.</p>
    <div className={styles.billProgress}><div className={styles.billProgressFill} style={{ width:'70%' }} /></div>
    <p className={styles.billAnnual}>No ano, isso representa cerca de <strong>{brl(result.saving * 12)}</strong>. Estimativa — o valor exato sai na sua simulação e consta no contrato.</p>
    <ProductWhatsapp representative={representative} product={product} message={`Olá! Minha conta de luz é de ${brl(result.value)} por mês. Quero simular meu desconto.`} label="Simular meu desconto no WhatsApp" origin={origin} />
    <p className={styles.billCtaNote}>Simulação sem compromisso — o valor exato vem depois da análise da sua conta.</p>
  </div>;
}

export function LivreEligibilityQuiz({ representative, product, origin }: { representative: Representative; product: RepresentativeProduct; origin: OriginId | null }) {
  const questions = ['Sua unidade tem transformador próprio?', 'Você tem demanda contratada junto à distribuidora?', 'Sua unidade é de média ou alta tensão (Grupo A)?'];
  const [answers, setAnswers] = useState<(boolean|null)[]>([null,null,null]);
  const complete = answers.every((answer) => answer !== null);
  const eligible = complete && answers.every(Boolean);
  return <div className={styles.billCard}>
    <div className={styles.billHeader}><span>Sua empresa se encaixa?</span><span className={styles.badgeDesconto}>Teste rápido</span></div>
    {questions.map((question,index)=><div className={widgetStyles.quizQuestion} key={question}><p>{index+1}. {question}</p><div className={widgetStyles.quizOptions}><button type="button" className={answers[index]===true?widgetStyles.yes:undefined} aria-pressed={answers[index]===true} onClick={()=>setAnswers((current)=>current.map((answer,i)=>i===index?true:answer))}>Sim</button><button type="button" className={answers[index]===false?widgetStyles.no:undefined} aria-pressed={answers[index]===false} onClick={()=>setAnswers((current)=>current.map((answer,i)=>i===index?false:answer))}>Não</button></div></div>)}
    {complete?<div className={`${widgetStyles.quizResult} ${eligible?widgetStyles.ok:widgetStyles.no}`} role="status">{eligible?'Sua empresa parece se encaixar no perfil Grupo A. Vamos confirmar os detalhes no WhatsApp!':'Pelo perfil informado, sua empresa pode não se enquadrar como Grupo A ainda. Fale com a gente para confirmar — às vezes existe um caminho de migração.'}</div>:null}
    <ProductWhatsapp representative={representative} product={product} message={eligible?'Olá! Fiz o teste de elegibilidade da Conexão Livre e me encaixo no perfil Grupo A. Quero simular minha migração.':'Olá! Fiz o teste de elegibilidade da Conexão Livre e não tenho certeza se me encaixo no Grupo A. Pode me ajudar?'} label="Falar com um especialista" origin={origin} />
  </div>;
}

const PAYMENTS = [
  ['Financiado (bancos parceiros)','Simule diretamente com os bancos parceiros da iGreen. Basta enviar os dados do cliente para receber a simulação de financiamento, sujeita a análise de crédito.','Olá! Quero simular o financiamento com bancos parceiros da iGreen.'],
  ['Financiado (seu banco)','Prefere financiar com seu próprio banco? Envie o contato do seu gerente e nossa equipe conduz a simulação com ele, sujeita à análise de crédito da instituição.','Olá! Quero financiar meu sistema de placas solares com meu próprio banco.'],
  ['À vista','Pagamento integral pelo valor apresentado na proposta, sem necessidade de análise de crédito.','Olá! Quero pagar meu sistema de placas solares à vista.'],
  ['Cartão até 21x','Parcelamento em até 21 vezes no cartão de crédito, com os juros praticados pela operadora do seu cartão.','Olá! Quero parcelar meu sistema de placas solares no cartão de crédito.'],
] as const;
export function PlacasPaymentSelector({ representative, product, origin }: { representative: Representative; product: RepresentativeProduct; origin: OriginId | null }) {
  const [active,setActive]=useState(0); const selected=PAYMENTS[active]??PAYMENTS[0];
  return <div className={styles.billCard}><div className={styles.billHeader}><span>Como prefere pagar?</span><span className={styles.badgeDesconto}>4 opções</span></div><div className={widgetStyles.tabs} role="tablist" aria-label="Formas de pagamento">{PAYMENTS.map(([label],index)=><button type="button" role="tab" aria-selected={active===index} className={active===index?widgetStyles.active:undefined} key={label} onClick={()=>setActive(index)}>{label}</button>)}</div><p className={widgetStyles.description} aria-live="polite">{selected[1]}</p><ProductWhatsapp representative={representative} product={product} message={selected[2]} label="Simular esta opção" origin={origin} /></div>;
}

const INSURANCE = {
  'Compreensivo':['Colisão e perda total','Furto e roubo','Danos da natureza','RCF (danos a terceiros)','Assistência 24h (guincho, pane seca, chaveiro)'],
  'Furto e Roubo':['Furto e roubo','RCF (danos a terceiros)','Assistência 24h (guincho, pane seca, chaveiro)'],
} as const;
export function InsurancePlanSelector({ representative, product, origin }: { representative: Representative; product: RepresentativeProduct; origin: OriginId | null }) {
  const labels=Object.keys(INSURANCE) as (keyof typeof INSURANCE)[]; const [active,setActive]=useState<keyof typeof INSURANCE>('Compreensivo');
  return <div className={widgetStyles.planCard}><div className={styles.billHeader}><span>Qual proteção você quer pro seu carro?</span></div><div className={widgetStyles.planToggle} role="tablist" aria-label="Escolha do plano">{labels.map(label=><button type="button" role="tab" aria-selected={active===label} className={active===label?widgetStyles.active:undefined} key={label} onClick={()=>setActive(label)}>{label}</button>)}</div><ul className={widgetStyles.planList}>{INSURANCE[active].map(item=><li key={item}><span>✓</span><span>{item}</span></li>)}</ul><p className={widgetStyles.addons}>Adicionais disponíveis na simulação: carro reserva, cobertura de vidros e ampliação do limite de RCF.</p><ProductWhatsapp representative={representative} product={product} message={`Olá! Quero simular o plano ${active} do seguro por assinatura.`} label={`Simular o plano ${active}`} origin={origin} /></div>;
}

const PLANS={portabilidade:[['Start','4','+2 GB de ativação e +5 GB de portabilidade','11','54,90'],['Mega','7','+3 GB de ativação e +5 GB de portabilidade','15','59,90'],['Giga','11','+4 GB de ativação e +5 GB de portabilidade','20','69,90'],['Ultra','19','+4 GB de ativação e +5 GB de portabilidade','28','79,90'],['Infinity','41','+4 GB de ativação e +5 GB de portabilidade','50','99,90']],novo:[['Start','4','+2 GB de ativação','6','59,90'],['Mega','7','+3 GB de ativação','10','64,90'],['Giga','11','+4 GB de ativação','15','74,90'],['Ultra','19','+4 GB de ativação','23','84,90'],['Infinity','41','+4 GB de ativação','45','104,90']]} as const;
export function TelecomPlans({ representative, product, origin }: { representative: Representative; product: RepresentativeProduct; origin: OriginId | null }) {
  const [mode,setMode]=useState<'portabilidade'|'novo'>('portabilidade');
  return <><div className={`${widgetStyles.planToggle} ${widgetStyles.telecomToggle}`} role="tablist" aria-label="Tipo de ativação"><button type="button" role="tab" aria-selected={mode==='portabilidade'} className={mode==='portabilidade'?widgetStyles.active:undefined} onClick={()=>setMode('portabilidade')}>Com portabilidade</button><button type="button" role="tab" aria-selected={mode==='novo'} className={mode==='novo'?widgetStyles.active:undefined} onClick={()=>setMode('novo')}>Número novo</button></div><div className={widgetStyles.plansGrid}>{PLANS[mode].map(([name,gb,bonus,total,price])=><article className={`${widgetStyles.planTile} ${name==='Giga'?widgetStyles.featured:''}`} key={name}>{name==='Giga'?<span className={widgetStyles.planTag}>Mais escolhido</span>:null}<h3>{name}</h3><div className={widgetStyles.planGb}>{gb}<small>GB</small></div><p>franquia mensal garantida</p><p>{bonus}<br/><strong>até {total} GB acumulados</strong></p><div className={widgetStyles.planPrice}>R$ {price}<small>por mês</small></div>{representative.phone?<a className={styles.btnWhats} href={buildWhatsappHref(representative.phone,`Olá! Quero o plano ${name} da iGreen Telecom (${mode==='portabilidade'?'com portabilidade':'número novo'}).`)} target="_blank" rel="noopener noreferrer" onClick={()=>trackWhatsappClick(product.slug, origin)}>Quero esse plano</a>:null}</article>)}</div></>;
}
