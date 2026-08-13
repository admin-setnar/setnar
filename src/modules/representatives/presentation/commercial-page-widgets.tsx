'use client';

import { useId, useMemo, useState } from 'react';

import { CONEXAO_CLUB_TABS } from '@/modules/representatives/domain/product-content/conexao-club';
import type { ProductWidget } from '@/modules/representatives/domain/commercial-page-template';
import { ProductContentTabs } from '@/modules/representatives/presentation/product-content-tabs';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Text } from '@/shared/ui/typography';

const paymentOptions = [
  ['Bancos parceiros', 'Simulação de financiamento com instituições parceiras, sujeita à análise de crédito.'],
  ['Seu banco', 'Leve a proposta ao gerente do seu banco; a equipe apoia a simulação.'],
  ['À vista', 'Pagamento integral pelo valor confirmado na proposta.'],
  ['Cartão até 21x', 'Parcelamento sujeito aos juros e às condições da operadora.'],
] as const;

const insurancePlans = {
  Compreensivo: ['Colisão e perda total', 'Furto e roubo', 'Danos da natureza', 'RCF (danos a terceiros)', 'Assistência 24h'],
  'Furto e Roubo': ['Furto e roubo', 'RCF (danos a terceiros)', 'Assistência 24h'],
} as const;

const widgetCard = 'rounded-2xl border-line bg-surface-raised shadow-[0_8px_24px_rgba(20,67,43,0.08)]';

const telecomPlans = {
  portabilidade: [
    ['Start', '4 GB', 'R$ 54,90', 'até 11 GB acumulados'], ['Mega', '7 GB', 'R$ 59,90', 'até 15 GB acumulados'],
    ['Giga', '11 GB', 'R$ 69,90', 'até 20 GB acumulados'], ['Ultra', '19 GB', 'R$ 79,90', 'até 28 GB acumulados'],
    ['Infinity', '41 GB', 'R$ 99,90', 'até 50 GB acumulados'],
  ],
  novo: [
    ['Start', '4 GB', 'R$ 59,90', 'até 6 GB acumulados'], ['Mega', '7 GB', 'R$ 64,90', 'até 10 GB acumulados'],
    ['Giga', '11 GB', 'R$ 74,90', 'até 15 GB acumulados'], ['Ultra', '19 GB', 'R$ 84,90', 'até 23 GB acumulados'],
    ['Infinity', '41 GB', 'R$ 104,90', 'até 45 GB acumulados'],
  ],
} as const;

function SegmentedControl({ labels, active, onChange, label }: { labels: readonly string[]; active: number; onChange: (index: number) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {labels.map((item, index) => (
        <Button key={item} type="button" role="tab" aria-selected={active === index} variant={active === index ? 'primary' : 'secondary'} size="sm" className="rounded-full" onClick={() => onChange(index)}>
          {item}
        </Button>
      ))}
    </div>
  );
}

function GreenCalculator() {
  const id = useId();
  const [bill, setBill] = useState(500);
  const result = useMemo(() => {
    const safeBill = Number.isFinite(bill) ? Math.max(0, bill) : 0;
    const discount = safeBill >= 1000 ? 0.14 : 0.1;
    const compensable = Math.max(0, safeBill * (1 - 0.27) - 25);
    const saving = compensable * discount;
    return { discount, saving, newBill: safeBill - saving };
  }, [bill]);
  const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  return (
    <Card variant="raised" padding="lg" className={widgetCard}>
      <Text as="h2" variant="title">Estimativa de desconto</Text>
      <label htmlFor={id} className="mt-5 block text-sm font-medium">Quanto você paga de luz por mês?</label>
      <Input id={id} type="number" min={50} step={10} inputMode="numeric" value={bill} onChange={(event) => setBill(event.target.valueAsNumber || 0)} className="mt-2" />
      <div aria-live="polite" className="mt-5 grid grid-cols-2 gap-4">
        <div><Text variant="caption">Conta atual</Text><Text as="p" variant="title">{brl(bill)}</Text></div>
        <div><Text variant="caption">Conta estimada</Text><Text as="p" variant="title">{brl(result.newBill)}</Text></div>
      </div>
      <Text as="p" variant="body" className="mt-4">Economia estimada de <strong>{brl(result.saving)} por mês ({Math.round(result.discount * 100)}%)</strong>.</Text>
      <Text as="p" variant="caption" className="mt-2">Estimativa sobre o consumo compensável. Impostos, iluminação pública e taxas fixas não entram no cálculo; o valor exato consta na simulação e no contrato.</Text>
    </Card>
  );
}

function EligibilityQuiz() {
  const questions = ['Sua unidade tem transformador próprio?', 'Você tem demanda contratada?', 'Sua unidade é de média ou alta tensão (Grupo A)?'];
  const [answers, setAnswers] = useState<(boolean | null)[]>([null, null, null]);
  const complete = answers.every((answer) => answer !== null);
  const eligible = complete && answers.every(Boolean);
  return (
    <Card variant="raised" padding="lg" className={widgetCard}>
      <Text as="h2" variant="title">Sua empresa se encaixa? Teste rápido</Text>
      <div className="mt-5 space-y-5">{questions.map((question, index) => <fieldset key={question}><legend className="text-sm font-medium">{index + 1}. {question}</legend><div className="mt-2 flex gap-2">{[true,false].map((value) => <Button key={String(value)} type="button" size="sm" variant={answers[index] === value ? 'primary' : 'secondary'} aria-pressed={answers[index] === value} onClick={() => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? value : answer))}>{value ? 'Sim' : 'Não'}</Button>)}</div></fieldset>)}</div>
      {complete ? <p role="status" className={`mt-5 rounded-md p-4 text-sm font-medium ${eligible ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>{eligible ? 'Sua empresa parece se encaixar no Grupo A. Confirme os detalhes com o especialista.' : 'Seu perfil pode não se enquadrar ainda. Fale com um especialista para confirmar os caminhos possíveis.'}</p> : null}
    </Card>
  );
}

function PaymentSelector() {
  const [active, setActive] = useState(0);
  const selected = paymentOptions[active] ?? paymentOptions[0];
  return <Card variant="raised" padding="lg" className={widgetCard}><Text as="h2" variant="title">Como prefere pagar?</Text><div className="mt-4"><SegmentedControl labels={paymentOptions.map(([label]) => label)} active={active} onChange={setActive} label="Formas de pagamento" /></div><Text as="p" variant="body" className="mt-4" aria-live="polite">{selected[1]}</Text></Card>;
}

function InsuranceSelector() {
  const labels = Object.keys(insurancePlans) as (keyof typeof insurancePlans)[];
  const [active, setActive] = useState(0);
  const selected: keyof typeof insurancePlans = labels[active] ?? 'Compreensivo';
  return <Card variant="raised" padding="lg" className={widgetCard}><Text as="h2" variant="title">Qual proteção você quer para seu carro?</Text><div className="mt-4"><SegmentedControl labels={labels} active={active} onChange={setActive} label="Coberturas do seguro" /></div><ul className="mt-5 grid gap-2 text-sm text-content-muted">{insurancePlans[selected].map((item: string) => <li key={item}>✓ {item}</li>)}</ul><Text as="p" variant="caption" className="mt-4">Adicionais podem incluir carro reserva, vidros e ampliação de RCF. Confirme disponibilidade e condições na proposta.</Text></Card>;
}

function SolarBenefits() {
  const benefits = [
    'Análise do perfil e da conta de energia',
    'Simulação do projeto, sem compromisso',
    'Visita técnica antes de qualquer instalação',
    'Acompanhamento dedicado em cada etapa',
  ];
  return <Card variant="raised" padding="lg" className={widgetCard}><div className="flex items-center justify-between gap-4"><Text as="h2" variant="title">O que você recebe</Text><span className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold text-brand">Sem custo para começar</span></div><ul className="mt-5 grid gap-3 text-sm text-content-muted">{benefits.map((benefit) => <li key={benefit}>✓ {benefit}</li>)}</ul><Text as="p" variant="caption" className="mt-4">Leva poucos minutos para começar; a documentação é solicitada quando você decide avançar.</Text></Card>;
}

function TelecomPlans() {
  const [active, setActive] = useState(0);
  const plans = active === 0 ? telecomPlans.portabilidade : telecomPlans.novo;
  return <Card variant="raised" padding="lg" className={widgetCard}><Text as="h2" variant="title">Nossos planos</Text><div className="mt-4"><SegmentedControl labels={['Com portabilidade', 'Número novo']} active={active} onChange={setActive} label="Modalidade do plano" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{plans.map(([name,gb,price,bonus]) => <div key={name} className="rounded-xl border border-line bg-surface p-4"><Text as="h3" variant="title">{name}</Text><p className="mt-2 text-2xl font-semibold">{gb}</p><Text variant="caption">franquia mensal</Text><p className="mt-3 font-semibold text-content">{price}<span className="block text-xs font-normal text-content-subtle">por mês</span></p><Text variant="caption" className="mt-2">{bonus}</Text></div>)}</div><Text as="p" variant="caption" className="mt-4">Valores, bônus, acúmulo e perda de saldo por atraso seguem o contrato vigente.</Text></Card>;
}

export function CommercialPageWidget({ widget }: { widget: ProductWidget }) {
  if (widget === 'club-categories') return <ProductContentTabs tabs={CONEXAO_CLUB_TABS} />;
  if (widget === 'green-calculator') return <GreenCalculator />;
  if (widget === 'livre-eligibility') return <EligibilityQuiz />;
  if (widget === 'placas-payment') return <PaymentSelector />;
  if (widget === 'solar-benefits') return <SolarBenefits />;
  if (widget === 'seguros-coverage') return <InsuranceSelector />;
  return <TelecomPlans />;
}
