-- Sadece bu dosyayı çalıştır (schema.sql zaten uygulandıysa)
-- Agent logs — authenticated kullanıcılar yazabilir
create policy "agent_logs: auth insert"
  on public.agent_logs for insert
  with check (auth.uid() is not null);

create policy "agent_logs: no read"
  on public.agent_logs for select
  using (false);

-- Fraud events
create policy "fraud_events: auth insert"
  on public.fraud_events for insert
  with check (auth.uid() is not null);

create policy "fraud_events: no read"
  on public.fraud_events for select
  using (false);
