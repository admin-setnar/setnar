-- SET-48: corrige um bug real, achado ao rodar o ensaio de verdade contra
-- dado sintético (docs/runbooks/LGPD_RIGHTS.md §10) — as duas FKs de
-- `lgpd_request_log` nasceram sem `on delete`, ou seja `NO ACTION`: a
-- própria linha de auditoria de uma eliminação passava a IMPEDIR a
-- eliminação que ela documenta (apagar o Lead falhava com violação de FK
-- contra o log que acabou de registrar o `acesso` anterior sobre o mesmo
-- Lead). Uma trilha de auditoria nunca pode bloquear a operação que audita
-- — `set null` preserva o restante da linha (actor, direito exercido,
-- verificação de identidade, outcome, detail) mesmo depois que o sujeito
-- referenciado deixa de existir.
alter table public.lgpd_request_log
  drop constraint lgpd_request_log_lead_id_fkey,
  add constraint lgpd_request_log_lead_id_fkey
    foreign key (lead_id) references public.leads (id) on delete set null;

alter table public.lgpd_request_log
  drop constraint lgpd_request_log_representative_id_fkey,
  add constraint lgpd_request_log_representative_id_fkey
    foreign key (representative_id) references public.representatives (id) on delete set null;
