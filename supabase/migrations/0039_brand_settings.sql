-- ─── Migration 0039: brand_settings — zentrale Vereins-Identität ───
-- Refactor des Admin-Branding-Tabs. Trennung:
--   - tv_settings: bleibt für rein TV-spezifische Settings (aktuell leer-Schema)
--   - brand_settings (NEU): Vereins-Identität (Logo-Set, Vereinsdaten, Mail-Footer,
--     Seiten-Hintergründe, Tile-Hintergründe, Badge, Werbung mit href)
--
-- Migrationsschritt: bestehende Daten aus tv_settings werden in brand_settings
-- übernommen, sofern sinnvoll. tv_settings bleibt aus Sicherheitsgründen
-- erhalten — wird vom neuen Frontend-Code aber nicht mehr gelesen.

insert into public.system_config (key, value) values
  ('brand_settings', jsonb_build_object(
    'org', jsonb_build_object(
      'name', 'Saunafreunde Schwarzwald e.V.',
      'short_name', 'Saunafreunde',
      'location', 'Freudenstadt',
      'website', null,
      'contact_email', 'info@sauna-fds.de',
      'mail_footer', null
    ),
    'logo', jsonb_build_object('icon', null, 'banner', null, 'favicon', null, 'dark', null),
    'backgrounds', jsonb_build_object(
      'dashboard', null, 'guest', null, 'planner', null, 'wm', null, 'login', null
    ),
    'tile_bgs', '{}'::jsonb,
    'badge', jsonb_build_object('front_bg', null, 'back_bg', null),
    'ads', '[]'::jsonb
  ))
  on conflict (key) do nothing;

-- ─── Datenmigration tv_settings → brand_settings ───
do $$
declare
  v_tv jsonb;
  v_brand jsonb;
  v_tile_bgs jsonb;
begin
  select value into v_tv from public.system_config where key = 'tv_settings';
  if v_tv is null then return; end if;
  select value into v_brand from public.system_config where key = 'brand_settings';

  -- tile_bgs: pro Sauna max 3 Slots beibehalten (war 5)
  select coalesce(jsonb_object_agg(s_id, slice), '{}'::jsonb)
    into v_tile_bgs
    from (
      select key as s_id,
             jsonb_path_query_array(value, '$[0 to 2]') as slice
        from jsonb_each(coalesce(v_tv->'tile_bgs', '{}'::jsonb))
       where jsonb_typeof(value) = 'array'
    ) sq;

  -- Logo, Backgrounds, Badge, Ads mappen
  v_brand := v_brand
    || jsonb_build_object(
         'logo',
         (v_brand->'logo')
           || jsonb_build_object('icon', v_tv->>'logo_path')
       )
    || jsonb_build_object(
         'backgrounds',
         (v_brand->'backgrounds') || coalesce(v_tv->'backgrounds', '{}'::jsonb)
       )
    || jsonb_build_object('tile_bgs', v_tile_bgs)
    || jsonb_build_object(
         'badge',
         (v_brand->'badge') || coalesce(v_tv->'badge', '{}'::jsonb)
       )
    || jsonb_build_object('ads', coalesce(v_tv->'ads', '[]'::jsonb));

  update public.system_config set value = v_brand where key = 'brand_settings';
end$$;

-- ─── Read-Policy ───
-- Bisher: nur key='tv_settings' war public lesbar.
-- Jetzt: auch brand_settings.
drop policy if exists config_read_public on public.system_config;
create policy config_read_public on public.system_config
  for select using (key in ('tv_settings','brand_settings'));

comment on column public.system_config.value is
  'JSONB-Konfiguration. Aktive Keys: tv_settings (Tafel-Settings legacy), brand_settings (Vereins-Identität ab Migration 0039).';
