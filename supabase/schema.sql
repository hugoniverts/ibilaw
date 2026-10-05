-- =====================================================================
-- IBILAW : base de données du partage d'équipe (Supabase / Postgres).
--
-- À coller dans l'éditeur SQL du projet Supabase puis « Run ».
-- Peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Principe : aucune table n'est lisible ni modifiable directement depuis
-- internet. L'appli ne passe que par les fonctions définies plus bas.
--   - rejoindre / synchroniser : il faut connaître le code de session ;
--   - publier : il faut connaître le code de publication (choisi par Hugo
--     lors de la toute première publication, jamais stocké en clair).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.reglages (
  cle text primary key,
  valeur text not null
);

create table if not exists public.sessions (
  code text primary key,                       -- code de session, en majuscules
  lieu jsonb not null,                         -- le lieu complet (points, captures, calage), sans l'image
  version integer not null default 1,          -- augmente à chaque publication
  plan_type text,
  plan_version integer not null default 0,     -- augmente quand l'image du plan change
  plan_morceaux integer not null default 0,
  maj timestamptz not null default now()
);

-- L'image du plan, découpée en morceaux de texte (base64).
create table if not exists public.plans (
  code text not null references public.sessions(code) on delete cascade,
  version integer not null,
  rang integer not null,
  donnees text not null,
  primary key (code, version, rang)
);

-- Dernière position connue de chaque membre (aucun historique).
create table if not exists public.positions (
  code text not null references public.sessions(code) on delete cascade,
  membre text not null,                        -- identifiant aléatoire du téléphone
  pseudo text not null,
  fonction text not null,
  lat double precision,
  lon double precision,
  precision_m real,
  destination text,
  vue timestamptz not null default now(),      -- heure (serveur) de la dernière position reçue
  primary key (code, membre)
);

alter table public.reglages enable row level security;
alter table public.sessions enable row level security;
alter table public.plans enable row level security;
alter table public.positions enable row level security;
revoke all on public.reglages, public.sessions, public.plans, public.positions from anon, authenticated;

-- ---------------------------------------------------------------------
-- Code de publication : défini au premier usage, vérifié ensuite.
-- (fonction interne, non accessible depuis internet)
-- ---------------------------------------------------------------------
create or replace function public.verifier_cle(p_cle text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  h text;
begin
  if p_cle is null or length(p_cle) < 6 then
    raise exception 'CLE_TROP_COURTE';
  end if;
  select valeur into h from reglages where cle = 'cle_publication';
  if h is null then
    insert into reglages (cle, valeur) values ('cle_publication', crypt(p_cle, gen_salt('bf', 8)));
  elsif crypt(p_cle, h) <> h then
    perform pg_sleep(1);
    raise exception 'CLE_INCORRECTE';
  end if;
end $$;
revoke execute on function public.verifier_cle(text) from public, anon, authenticated;

-- Un code de publication a-t-il déjà été choisi ?
create or replace function public.publication_initialisee() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from reglages where cle = 'cle_publication');
$$;

-- ---------------------------------------------------------------------
-- Publier (admin)
-- ---------------------------------------------------------------------
-- Crée la session, ou met à jour son lieu. Renvoie les versions en cours.
create or replace function public.publier_session(p_cle text, p_code text, p_lieu jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c text := upper(trim(p_code));
  s sessions;
begin
  perform verifier_cle(p_cle);
  if c !~ '^[A-Z0-9-]{4,20}$' then
    raise exception 'CODE_INVALIDE';
  end if;
  if pg_column_size(p_lieu) > 2000000 then
    raise exception 'LIEU_TROP_GROS';
  end if;
  insert into sessions (code, lieu) values (c, p_lieu)
  on conflict (code) do update set lieu = excluded.lieu, version = sessions.version + 1, maj = now()
  returning * into s;
  return jsonb_build_object('version', s.version, 'plan_version', s.plan_version);
end $$;

-- Envoie un morceau de la nouvelle image du plan (version = plan_version en cours + 1).
create or replace function public.publier_plan_morceau(p_cle text, p_code text, p_version integer, p_rang integer, p_donnees text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  c text := upper(trim(p_code));
begin
  perform verifier_cle(p_cle);
  if p_rang < 0 or p_rang >= 200 or length(p_donnees) > 400000 then
    raise exception 'MORCEAU_INVALIDE';
  end if;
  insert into plans (code, version, rang, donnees) values (c, p_version, p_rang, p_donnees)
  on conflict (code, version, rang) do update set donnees = excluded.donnees;
end $$;

-- Une fois tous les morceaux envoyés : la nouvelle image devient celle de la session.
create or replace function public.valider_plan(p_cle text, p_code text, p_version integer, p_type text, p_morceaux integer) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c text := upper(trim(p_code));
  s sessions;
begin
  perform verifier_cle(p_cle);
  if (select count(*) from plans where code = c and version = p_version) <> p_morceaux then
    raise exception 'PLAN_INCOMPLET';
  end if;
  update sessions set plan_version = p_version, plan_type = p_type, plan_morceaux = p_morceaux,
    version = version + 1, maj = now()
  where code = c returning * into s;
  if not found then
    raise exception 'SESSION_INCONNUE';
  end if;
  delete from plans where code = c and version <> p_version;
  return jsonb_build_object('version', s.version, 'plan_version', s.plan_version);
end $$;

-- ---------------------------------------------------------------------
-- Rejoindre et se synchroniser (équipe)
-- ---------------------------------------------------------------------
create or replace function public.rejoindre(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s sessions;
begin
  select * into s from sessions where code = upper(trim(p_code));
  if not found then
    raise exception 'SESSION_INCONNUE';
  end if;
  return jsonb_build_object('code', s.code, 'version', s.version, 'lieu', s.lieu,
    'plan_version', s.plan_version, 'plan_type', s.plan_type, 'plan_morceaux', s.plan_morceaux);
end $$;

create or replace function public.lire_plan_morceau(p_code text, p_version integer, p_rang integer) returns text
language sql security definer set search_path = public as $$
  select donnees from plans where code = upper(trim(p_code)) and version = p_version and rang = p_rang;
$$;

-- Un seul échange : « voici ma position, donne-moi celles des autres ».
-- Sans position (p_lat vide), mon ancienne position est gardée et vieillit.
create or replace function public.synchroniser(
  p_code text, p_membre text, p_pseudo text, p_fonction text,
  p_lat double precision default null, p_lon double precision default null,
  p_precision real default null, p_destination text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c text := upper(trim(p_code));
  s sessions;
begin
  select * into s from sessions where code = c;
  if not found then
    raise exception 'SESSION_INCONNUE';
  end if;
  if p_membre is not null and length(p_membre) between 8 and 40 then
    if not exists (select 1 from positions where code = c and membre = p_membre)
       and (select count(*) from positions where code = c) >= 60 then
      raise exception 'SESSION_PLEINE';
    end if;
    insert into positions (code, membre, pseudo, fonction, lat, lon, precision_m, destination, vue)
    values (c, p_membre, left(coalesce(nullif(trim(p_pseudo), ''), '?'), 24), left(coalesce(p_fonction, 'Autre'), 40),
      p_lat, p_lon, p_precision, left(p_destination, 60), now())
    on conflict (code, membre) do update set
      pseudo = excluded.pseudo,
      fonction = excluded.fonction,
      destination = excluded.destination,
      lat = coalesce(excluded.lat, positions.lat),
      lon = coalesce(excluded.lon, positions.lon),
      precision_m = case when excluded.lat is null then positions.precision_m else excluded.precision_m end,
      vue = case when excluded.lat is null then positions.vue else now() end;
  end if;
  -- Ménage de temps en temps : rien n'est gardé plus de 24 heures.
  if random() < 0.02 then
    delete from positions where vue < now() - interval '24 hours';
  end if;
  return jsonb_build_object(
    'version', s.version,
    'plan_version', s.plan_version,
    'membres', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membre', membre, 'pseudo', pseudo, 'fonction', fonction,
        'lat', lat, 'lon', lon, 'precision', precision_m, 'destination', destination,
        'age', round(extract(epoch from now() - vue))::integer))
      from positions where code = c and vue > now() - interval '24 hours'), '[]'::jsonb));
end $$;

-- Quitter la session : ma position est effacée du serveur.
create or replace function public.quitter(p_code text, p_membre text) returns void
language sql security definer set search_path = public as $$
  delete from positions where code = upper(trim(p_code)) and membre = p_membre;
$$;

grant execute on function
  public.publication_initialisee(),
  public.publier_session(text, text, jsonb),
  public.publier_plan_morceau(text, text, integer, integer, text),
  public.valider_plan(text, text, integer, text, integer),
  public.rejoindre(text),
  public.lire_plan_morceau(text, integer, integer),
  public.synchroniser(text, text, text, text, double precision, double precision, real, text),
  public.quitter(text, text)
to anon, authenticated;
